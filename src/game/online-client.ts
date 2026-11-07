import { createTrack, type Controls, type RaceState } from './simulation';
import {
  ONLINE_FORMATS,
  ONLINE_TRACKS,
  RECONNECT_MS,
  type OnlineConnectionState,
  type OnlineFormatId,
  type OnlineJoin,
  type OnlineRaceRuntime,
  type OnlineResult,
  type OnlineRoomMessage,
  type OnlineServerMessage,
  type OnlineTrackId,
} from '../shared/online-protocol';

export interface SavedOnlineSession {
  roomId: string;
  token: string;
  formatId: OnlineFormatId;
  trackId: OnlineTrackId;
  at: number;
}
export interface OnlineClientView {
  connection: OnlineConnectionState;
  room: OnlineRoomMessage | null;
  runtime: OnlineRaceRuntime | null;
  error: string | null;
}
const KEY = 'fapix.online-session';
const sessionStorageSafe = (): Storage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};
const validSaved = (v: SavedOnlineSession, now: number) =>
  v &&
  typeof v.roomId === 'string' &&
  !!v.roomId &&
  typeof v.token === 'string' &&
  !!v.token &&
  ONLINE_FORMATS.includes(v.formatId) &&
  ONLINE_TRACKS.includes(v.trackId) &&
  Number.isFinite(v.at) &&
  now >= v.at &&
  now - v.at < 600_000;
export function loadSavedOnlineSession(
  storage: Storage | undefined = sessionStorageSafe() ?? undefined,
): SavedOnlineSession | null {
  try {
    const v = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (validSaved(v, Date.now())) return v;
    storage?.removeItem(KEY);
  } catch {
    /* Unavailable storage is optional. */
  }
  return null;
}
const neutral = (): Controls => ({
  throttle: 0,
  steer: 0,
  brake: false,
  drift: false,
  boost: false,
  power: false,
});
const axis = (n: number) => (Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0);
export class OnlineClient {
  private view: OnlineClientView = {
    connection: 'connecting',
    room: null,
    runtime: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private socket: WebSocket | null = null;
  private pending: Promise<void> | null = null;
  private generation = 0;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private reconnectUntil: number | null = null;
  private saved: SavedOnlineSession | null;
  private storage: Storage | null;
  private now: () => number;
  private lastTick = -1;
  private seq = 0;
  private lastInput = -Infinity;
  private controls = neutral();
  private pendingReset = false;
  private results: OnlineResult[] | null = null;
  private deadline: number | null = null;
  constructor(
    private join: OnlineJoin,
    private options: {
      resume?: SavedOnlineSession;
      socketFactory?: (url: string) => WebSocket;
      prepareSession?: () => Promise<void>;
      now?: () => number;
      storage?: Storage | null;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.storage = options.storage === undefined ? sessionStorageSafe() : options.storage;
    const resume = options.resume ?? (this.storage ? loadSavedOnlineSession(this.storage) : null);
    this.saved =
      resume &&
      validSaved(resume, this.now()) &&
      resume.formatId === join.formatId &&
      resume.trackId === join.trackId &&
      (!join.roomId || resume.roomId === join.roomId)
        ? resume
        : null;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = (): OnlineClientView => this.view;
  private publish(patch: Partial<OnlineClientView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private clearSaved() {
    this.saved = null;
    try {
      this.storage?.removeItem(KEY);
    } catch {
      /* Optional storage. */
    }
  }
  private cancelTimers() {
    clearTimeout(this.timer);
    clearTimeout(this.expiry);
    this.timer = this.expiry = undefined;
  }
  private fail(message: string, clear = true) {
    this.stopped = true;
    this.generation++;
    this.pending = null;
    this.cancelTimers();
    if (clear) this.clearSaved();
    const ws = this.socket;
    this.socket = null;
    ws?.close();
    this.publish({ connection: 'error', error: message });
  }
  connect = (): Promise<void> => {
    if (this.pending) return this.pending;
    if (this.socket && this.socket.readyState < 2) return Promise.resolve();
    this.stopped = false;
    const generation = ++this.generation;
    this.publish({
      connection: this.reconnectUntil === null ? 'connecting' : 'reconnecting',
      error: null,
    });
    const attempt = (async () => {
      try {
        await (
          this.options.prepareSession ??
          (async () => {
            const response = await fetch('/api/session', { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Не удалось открыть сессию');
          })
        )();
        if (this.stopped || generation !== this.generation) return;
        const location = globalThis.location;
        const url = location
          ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/race`
          : 'ws://localhost/ws/race';
        const ws = (this.options.socketFactory ?? ((url) => new WebSocket(url)))(url);
        this.socket = ws;
        const current = () => !this.stopped && this.socket === ws && generation === this.generation;
        ws.onopen = () => {
          if (!current()) return;
          this.seq = 0;
          this.lastInput = -Infinity;
          ws.send(
            JSON.stringify(
              this.saved
                ? { type: 'resume', version: 1, roomId: this.saved.roomId, token: this.saved.token }
                : { type: 'join', version: 1, ...this.join },
            ),
          );
        };
        ws.onmessage = (event) => {
          if (!current()) return;
          try {
            this.receive(JSON.parse(event.data));
          } catch {
            this.fail('Некорректные данные сервера');
          }
        };
        ws.onerror = () => {
          if (current()) ws.close();
        };
        ws.onclose = () => {
          if (!current()) return;
          this.socket = null;
          if (!this.results) this.reconnect();
        };
      } catch (error) {
        if (!this.stopped && generation === this.generation) {
          if (this.reconnectUntil !== null) this.reconnect();
          else this.fail(error instanceof Error ? error.message : 'Ошибка подключения', false);
        }
      }
    })();
    this.pending = attempt;
    void attempt.finally(() => {
      if (this.pending === attempt) this.pending = null;
    });
    return attempt;
  };
  private reconnect() {
    if (this.stopped) return;
    if (this.reconnectUntil === null) {
      this.reconnectUntil = this.now() + RECONNECT_MS;
      this.expiry = setTimeout(
        () => this.fail('Время восстановления подключения истекло'),
        RECONNECT_MS,
      );
    }
    if (this.now() >= this.reconnectUntil) {
      this.fail('Время восстановления подключения истекло');
      return;
    }
    this.publish({ connection: 'reconnecting' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.connect();
    }, 500);
  }
  private receive(message: OnlineServerMessage) {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string')
      throw new Error();
    if (message.type === 'error') {
      if (typeof message.message !== 'string') throw new Error();
      this.fail(message.message);
      return;
    }
    if (message.type === 'left') {
      this.leave();
      return;
    }
    if (message.type === 'room') {
      if (
        !validSaved(
          {
            roomId: message.roomId,
            token: message.resumeToken,
            trackId: message.trackId,
            formatId: message.formatId,
            at: this.now(),
          },
          this.now(),
        ) ||
        !Array.isArray(message.roster) ||
        !message.roster.some((c) => c.id === message.localCarId) ||
        !Number.isFinite(message.deadline)
      )
        throw new Error();
      if (this.view.room && message.roomId !== this.view.room.roomId) return;
      this.saved = {
        roomId: message.roomId,
        token: message.resumeToken,
        trackId: message.trackId,
        formatId: message.formatId,
        at: this.now(),
      };
      try {
        this.storage?.setItem(KEY, JSON.stringify(this.saved));
      } catch {
        /* Optional storage. */
      }
      this.cancelTimers();
      this.reconnectUntil = null;
      this.publish({ room: message, connection: 'connected', error: null });
      return;
    }
    if (message.type !== 'snapshot') throw new Error();
    const room = this.view.room;
    if (
      !room ||
      message.roomId !== room.roomId ||
      !Number.isSafeInteger(message.tick) ||
      message.tick <= this.lastTick
    )
      return;
    const state = message.state;
    if (
      !state ||
      !Array.isArray(state.cars) ||
      !state.cars.length ||
      !Array.isArray(message.roster) ||
      !Number.isFinite(state.time) ||
      !['countdown', 'racing', 'paused', 'finished'].includes(state.phase) ||
      !(message.finishDeadline === null || Number.isFinite(message.finishDeadline)) ||
      new Set(state.cars.map((c) => c.id)).size !== state.cars.length ||
      !state.cars.some((c) => c.id === room.localCarId)
    )
      throw new Error();
    for (const car of state.cars)
      if (
        !Number.isSafeInteger(car.id) ||
        !car.progress ||
        !Number.isFinite(car.x) ||
        !Number.isFinite(car.z) ||
        !Number.isFinite(car.progress.value)
      )
        throw new Error();
    const runtime = this.view.runtime;
    if (runtime) {
      if (
        runtime.race.cars.length !== state.cars.length ||
        runtime.race.cars.some((car) => !state.cars.some((c) => c.id === car.id))
      )
        throw new Error();
      const { cars: _, ...rest } = state;
      const track = runtime.race.track;
      Object.assign(runtime.race, rest);
      runtime.race.track = track;
      for (const car of runtime.race.cars) {
        const incoming = state.cars.find((c) => c.id === car.id)!;
        const { progress, ...rest } = incoming;
        Object.assign(car, rest);
        Object.assign(car.progress, progress);
      }
    } else {
      const race: RaceState = { ...state, track: createTrack(room.trackId) };
      const client = this;
      this.view = {
        ...this.view,
        runtime: {
          race,
          localCarId: room.localCarId,
          get roster() {
            return client.view.room?.roster ?? [];
          },
          get connectionState() {
            return client.view.connection;
          },
          get finishDeadline() {
            return client.deadline;
          },
          update: (controls, _dt) => {
            client.controls = {
              throttle: axis(controls.throttle),
              steer: axis(controls.steer),
              brake: controls.brake === true,
              drift: controls.drift === true,
              boost: controls.boost === true,
              power: controls.power === true,
            };
            client.sendInput();
          },
          reset: () => client.sendInput(true),
          getResult: () => client.results?.find((r) => r.carId === room.localCarId)?.result ?? null,
          getResults: () => client.results,
        },
      };
    }
    if (message.results !== undefined) {
      if (
        !Array.isArray(message.results) ||
        message.results.some(
          (r) =>
            !r.result ||
            !Number.isSafeInteger(r.carId) ||
            !Number.isFinite(r.result.position) ||
            !Number.isFinite(r.result.time),
        )
      )
        throw new Error();
      this.results = message.results.map((r) => ({
        carId: r.carId,
        result: { ...r.result, online: true },
      }));
    }
    if (this.results) {
      this.clearSaved();
      this.cancelTimers();
      this.reconnectUntil = null;
    }
    this.lastTick = message.tick;
    this.deadline = message.finishDeadline;
    this.publish({ room: { ...room, roster: message.roster } });
  }
  private sendInput(reset = false) {
    if (reset && this.view.connection === 'connected' && this.socket?.readyState === 1)
      this.pendingReset = true;
    if (
      this.view.connection !== 'connected' ||
      this.socket?.readyState !== 1 ||
      this.now() - this.lastInput < 1000 / 30
    )
      return;
    this.lastInput = this.now();
    this.socket.send(
      JSON.stringify({
        type: 'input',
        seq: this.seq++,
        controls: this.controls,
        ...(this.pendingReset ? { reset: true } : {}),
      }),
    );
    this.pendingReset = false;
  }
  leave = () => {
    this.pendingReset = false;
    this.reconnectUntil = null;
    this.stopped = true;
    this.generation++;
    this.pending = null;
    this.cancelTimers();
    const ws = this.socket;
    this.socket = null;
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'leave' }));
    ws?.close();
    this.clearSaved();
    this.publish({ connection: 'closed' });
  };
  retry = () => {
    this.leave();
    this.reconnectUntil = null;
    this.lastTick = -1;
    this.results = null;
    this.deadline = null;
    this.publish({ room: null, runtime: null, error: null });
    void this.connect();
  };
}
