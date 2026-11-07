import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createRace,
  createTrack,
  getRaceResult,
  resetCar,
  stepRaceDrivers,
  type Controls,
  type RaceState,
} from '../src/game/simulation';
import {
  MATCHMAKING_MS,
  RECONNECT_MS,
  ONLINE_FORMATS,
  ONLINE_TRACKS,
  type OnlineIdentity,
  type OnlineRosterEntry,
  type OnlineResult,
  type OnlineServerMessage,
  type OnlineFormatId,
  type OnlineTrackId,
} from '../src/shared/online-protocol';

const neutral = (): Controls => ({
  throttle: 0,
  steer: 0,
  brake: false,
  drift: false,
  boost: false,
  power: false,
});
type Client = {
  ws: WebSocket;
  identity: OnlineIdentity;
  room?: Room;
  slot?: Slot;
  alive: boolean;
  count: number;
  bucket: number;
  lastPong: number;
  joinedAt: number;
  lastInputMessage: number;
  joins: number;
  joinBucket: number;
};
type Slot = {
  actorId: string;
  roster: OnlineRosterEntry;
  token: string;
  client?: Client;
  disconnectedAt?: number;
  controls: Controls;
  inputAt: number;
  seq: number;
};
type Room = {
  id: string;
  trackId: OnlineTrackId;
  formatId: OnlineFormatId;
  deadline: number;
  slots: Slot[];
  race?: RaceState;
  lastStep: number;
  lastSnapshot: number;
  tick: number;
  finishDeadline: number | null;
  results?: OnlineResult[];
  finishedAt?: number;
};
export function attachOnlineServer(
  server: Server,
  options: {
    resolveIdentity: (cookieHeader: string) => OnlineIdentity | null;
    allowedOrigins?: string[];
    now?: () => number;
    autoTick?: boolean;
  },
) {
  const now = options.now ?? Date.now;
  const rooms = new Map<string, Room>(),
    clients = new Set<Client>(),
    actors = new Map<string, Slot>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  let closed = false,
    lastHeartbeat = now();
  const send = (client: Client, message: OnlineServerMessage) => {
    if (client.ws.readyState !== WebSocket.OPEN) return;
    if (client.ws.bufferedAmount > 256 * 1024) {
      client.ws.terminate();
      return;
    }
    client.ws.send(JSON.stringify(message));
  };
  const error = (client: Client, code: string, message: string) =>
    send(client, { type: 'error', code, message });
  const roster = (room: Room) =>
    room.slots.map((slot) => ({ ...slot.roster, connected: !!slot.client }));
  const announce = (room: Room) => {
    for (const slot of room.slots)
      if (slot.client)
        send(slot.client, {
          type: 'room',
          roomId: room.id,
          trackId: room.trackId,
          formatId: room.formatId,
          deadline: room.deadline,
          serverNow: now(),
          roster: roster(room),
          localCarId: slot.roster.id,
          resumeToken: slot.token,
        });
  };
  const snapshot = (room: Room, time: number) => {
    if (!room.race) return;
    const { track: _track, ...state } = room.race;
    const message: OnlineServerMessage = {
      type: 'snapshot',
      roomId: room.id,
      tick: room.tick,
      serverNow: time,
      state,
      roster: roster(room),
      finishDeadline: room.finishDeadline,
      ...(room.results ? { results: room.results } : {}),
    };
    for (const slot of room.slots) if (slot.client) send(slot.client, message);
    room.lastSnapshot = time;
  };
  const removeRoom = (room: Room) => {
    rooms.delete(room.id);
    for (const slot of room.slots) {
      if (actors.get(slot.actorId) === slot) actors.delete(slot.actorId);
      if (slot.client) {
        slot.client.room = undefined;
        slot.client.slot = undefined;
      }
    }
  };
  const markAbandoned = (room: Room, slot: Slot) => {
    if (!room.race || room.race.phase === 'finished' || room.finishedAt !== undefined) return;
    const car = room.race.cars[slot.roster.id];
    if (car.finishTime === null && car.eliminatedAt === null && !car.didNotFinish)
      car.didNotFinish = true;
  };
  const hasRemainingHuman = (room: Room, time: number) =>
    room.slots.some(
      (slot) =>
        slot.roster.kind === 'human' &&
        (slot.client ||
          (slot.token &&
            slot.disconnectedAt !== undefined &&
            time - slot.disconnectedAt < RECONNECT_MS)),
    );
  const leave = (client: Client, explicit: boolean) => {
    const room = client.room,
      slot = client.slot;
    client.room = undefined;
    client.slot = undefined;
    if (!room || !slot || slot.client !== client) return;
    slot.client = undefined;
    slot.controls = neutral();
    slot.disconnectedAt = now();
    if (!room.race && explicit) {
      room.slots.splice(room.slots.indexOf(slot), 1);
      actors.delete(slot.actorId);
    }
    if (room.race && explicit) {
      markAbandoned(room, slot);
      actors.delete(slot.actorId);
      slot.token = '';
    }
    if (!hasRemainingHuman(room, now())) {
      removeRoom(room);
      return;
    }
    if (!room.race) announce(room);
  };
  const start = (room: Room, time: number) => {
    while (room.slots.length < 6) {
      const id = [0, 1, 2, 3, 4, 5].find((id) => !room.slots.some((s) => s.roster.id === id))!;
      room.slots.push({
        actorId: `bot:${room.id}:${id}`,
        roster: {
          id,
          name: ['NOVA', 'GHOST', 'BLUE', 'DASH', 'PEACH', 'ORBIT'][id],
          kind: 'bot',
          customization: {},
          connected: false,
        },
        token: '',
        controls: neutral(),
        inputAt: 0,
        seq: -1,
      });
    }
    room.slots.sort((a, b) => a.roster.id - b.roster.id);
    room.race = createRace(createTrack(room.trackId), 0, room.formatId, {
      drivers: room.slots.map((s) => ({
        id: s.roster.id,
        kind: s.roster.kind,
        name: s.roster.name,
        customization: s.roster.customization,
      })),
      completion: 'all',
    });
    room.lastStep = time;
    announce(room);
    snapshot(room, time);
  };
  function tick(time = now()) {
    if (closed) return;
    if (time - lastHeartbeat >= 10000) {
      lastHeartbeat = time;
      for (const client of clients) {
        if (!client.alive || (!client.room && time - client.joinedAt > 30000))
          client.ws.terminate();
        else {
          client.alive = false;
          client.ws.ping();
        }
      }
    }
    for (const room of rooms.values()) {
      for (const slot of [...room.slots])
        if (
          slot.roster.kind === 'human' &&
          !slot.client &&
          slot.token &&
          slot.disconnectedAt !== undefined &&
          time - slot.disconnectedAt >= RECONNECT_MS
        ) {
          actors.delete(slot.actorId);
          slot.token = '';
          if (room.race) markAbandoned(room, slot);
          else {
            room.slots.splice(room.slots.indexOf(slot), 1);
            announce(room);
          }
        }
      if (!hasRemainingHuman(room, time)) {
        removeRoom(room);
        continue;
      }
      if (!room.race) {
        if (time >= room.deadline || room.slots.length === 6) start(room, time);
        continue;
      }
      if (room.finishedAt !== undefined) {
        if (time - room.finishedAt >= 30000) removeRoom(room);
        else if (time - room.lastSnapshot >= 50) snapshot(room, time);
        continue;
      }
      // A delayed event loop never performs an unbounded simulation catch-up.
      const target = Math.min(time, room.lastStep + 250);
      while (room.lastStep + 1000 / 60 <= target + 0.00001 && room.race.phase !== 'finished') {
        room.lastStep += 1000 / 60;
        const inputs: Record<number, Controls> = {};
        for (const slot of room.slots)
          if (slot.roster.kind === 'human')
            inputs[slot.roster.id] =
              slot.client && time - slot.inputAt <= 250 ? slot.controls : neutral();
        stepRaceDrivers(room.race, inputs, 1 / 60);
        room.tick++;
        if (room.finishDeadline === null && room.race.cars.some((car) => car.finishTime !== null))
          room.finishDeadline = room.race.time + 30;
        if (
          room.race.time >= 300 ||
          (room.finishDeadline !== null && room.race.time >= room.finishDeadline)
        )
          room.race.phase = 'finished';
      }
      if (time - room.lastStep > 250) room.lastStep = time;
      if (room.race.phase === 'finished') {
        if (room.formatId === 'classic' || room.formatId === 'sprint')
          for (const car of room.race.cars) if (car.finishTime === null) car.didNotFinish = true;
        room.results = room.race.cars.map((car) => ({
          carId: car.id,
          result: { ...getRaceResult(room.race!, car.id), online: true },
        }));
        room.finishedAt = time;
        snapshot(room, time);
      } else if (time - room.lastSnapshot >= 50) snapshot(room, time);
    }
  }
  const onUpgrade = (
    req: import('node:http').IncomingMessage,
    socket: import('node:stream').Duplex,
    head: Buffer,
  ) => {
    const reject = (status: number) => {
      socket.write(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (req.url !== '/ws/race' || closed) return reject(404);
    const origin = req.headers.origin;
    const expected = `${'encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
    const defaultAllowed = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/.test(expected)
      ? [expected]
      : [];
    if (!origin || !(options.allowedOrigins ?? defaultAllowed).includes(origin)) return reject(403);
    let identity: OnlineIdentity | null = null;
    try {
      identity = options.resolveIdentity(req.headers.cookie ?? '');
    } catch {
      return reject(401);
    }
    if (!identity) return reject(401);
    if (
      clients.size >= 256 ||
      [...clients].filter((c) => c.identity.actorId === identity.actorId).length >= 2
    )
      return reject(429);
    const verified = identity;
    wss.handleUpgrade(req, socket, head, (ws) => {
      const client: Client = {
        ws,
        identity: verified,
        alive: true,
        count: 0,
        bucket: now(),
        lastPong: now(),
        joinedAt: now(),
        lastInputMessage: 0,
        joins: 0,
        joinBucket: now(),
      };
      clients.add(client);
      ws.on('pong', () => {
        client.lastPong = now();
        client.alive = true;
      });
      ws.on('error', () => {});
      ws.on('close', () => {
        clients.delete(client);
        leave(client, false);
      });
      ws.on('message', (data, binary) => {
        const time = now();
        if (time - client.bucket >= 1000) {
          client.bucket = time;
          client.count = 0;
        }
        if (++client.count > 90) {
          ws.close(1008, 'Rate limit');
          return;
        }
        let m: Record<string, unknown>;
        try {
          m = JSON.parse(data.toString());
          if (binary || !m || typeof m !== 'object' || Array.isArray(m)) throw Error();
        } catch {
          error(client, 'INVALID_MESSAGE', 'Некорректное сообщение');
          return;
        }
        if (m.type === 'leave') {
          leave(client, true);
          send(client, { type: 'left' });
          return;
        }
        if (m.type === 'input') {
          const s = client.slot,
            c = m.controls as Controls | undefined;
          if (!s || !client.room?.race) return;
          if (
            !Number.isSafeInteger(m.seq) ||
            (m.seq as number) <= s.seq ||
            (m.seq as number) < 0 ||
            !c ||
            typeof c !== 'object' ||
            !Number.isFinite(c.throttle) ||
            Math.abs(c.throttle) > 1 ||
            !Number.isFinite(c.steer) ||
            Math.abs(c.steer) > 1 ||
            !['brake', 'drift', 'boost', 'power'].every(
              (k) => typeof c[k as keyof Controls] === 'boolean',
            ) ||
            (m.reset !== undefined && typeof m.reset !== 'boolean')
          ) {
            error(client, 'INVALID_INPUT', 'Некорректное управление');
            return;
          }
          s.seq = m.seq as number;
          s.controls = {
            throttle: c.throttle,
            steer: c.steer,
            brake: c.brake,
            drift: c.drift,
            boost: c.boost,
            power: c.power,
          };
          s.inputAt = time;
          if (
            m.reset &&
            time - client.lastInputMessage >= 1000 &&
            client.room.race.phase === 'racing'
          ) {
            resetCar(client.room.race, s.roster.id);
            client.lastInputMessage = time;
          }
          return;
        }
        if (m.type !== 'join' && m.type !== 'resume') {
          error(client, 'INVALID_MESSAGE', 'Неизвестное сообщение');
          return;
        }
        if (m.version !== 1) {
          error(client, 'VERSION', 'Обновите страницу');
          return;
        }
        if (time - client.joinBucket >= 10000) {
          client.joinBucket = time;
          client.joins = 0;
        }
        if (++client.joins > 10) {
          error(client, 'RATE_LIMIT', 'Подождите перед новым подбором');
          return;
        }
        if (client.room) {
          error(client, 'ALREADY_JOINED', 'Вы уже в комнате');
          return;
        }
        if (m.type === 'resume') {
          const room =
            typeof m.roomId === 'string' ? rooms.get(m.roomId.trim().toUpperCase()) : undefined;
          const slot = room?.slots.find(
            (s) => s.actorId === client.identity.actorId && s.token && s.token === m.token,
          );
          if (
            !room ||
            !slot ||
            slot.client ||
            slot.disconnectedAt === undefined ||
            time - slot.disconnectedAt >= RECONNECT_MS
          ) {
            error(client, 'RESUME_EXPIRED', 'Место недоступно. Начните новый подбор');
            return;
          }
          slot.client = client;
          slot.disconnectedAt = undefined;
          slot.token = randomBytes(24).toString('hex');
          slot.seq = -1;
          client.room = room;
          client.slot = slot;
          announce(room);
          snapshot(room, time);
          return;
        }
        if (actors.has(client.identity.actorId)) {
          error(client, 'ALREADY_JOINED', 'У вас уже есть место. Восстановите подключение');
          return;
        }
        if (
          (!m.roomId &&
            (!(ONLINE_FORMATS as readonly unknown[]).includes(m.formatId) ||
              !(ONLINE_TRACKS as readonly unknown[]).includes(m.trackId))) ||
          (m.roomId !== undefined && (typeof m.roomId !== 'string' || m.roomId.length > 32))
        ) {
          error(client, 'INVALID_JOIN', 'Выберите трассу и формат');
          return;
        }
        let room: Room | undefined;
        if (m.roomId) {
          room = rooms.get((m.roomId as string).trim().toUpperCase());
          if (!room) {
            error(client, 'ROOM_NOT_FOUND', 'Комната не найдена');
            return;
          }
          if (room.race || room.slots.length >= 6 || room.deadline <= time) {
            error(client, 'ROOM_STARTED', 'Комната уже стартовала или заполнена');
            return;
          }
        } else
          room = [...rooms.values()].find(
            (r) =>
              !r.race &&
              r.deadline > time &&
              r.slots.length < 6 &&
              r.trackId === m.trackId &&
              r.formatId === m.formatId,
          );
        if (!room) {
          if (rooms.size >= 64) {
            error(client, 'SERVER_FULL', 'Сервер заполнен. Попробуйте позже');
            return;
          }
          let roomId: string;
          do {
            roomId = randomBytes(3).toString('hex').toUpperCase();
          } while (rooms.has(roomId));
          room = {
            id: roomId,
            trackId: m.trackId as OnlineTrackId,
            formatId: m.formatId as OnlineFormatId,
            deadline: time + MATCHMAKING_MS,
            slots: [],
            lastStep: time,
            lastSnapshot: time,
            tick: 0,
            finishDeadline: null,
          };
          rooms.set(room.id, room);
        }
        const slot: Slot = {
          actorId: client.identity.actorId,
          roster: {
            id: [0, 1, 2, 3, 4, 5].find((id) => !room!.slots.some((s) => s.roster.id === id))!,
            name: client.identity.name.slice(0, 24),
            kind: 'human',
            customization: client.identity.customization,
            connected: true,
          },
          token: randomBytes(24).toString('hex'),
          client,
          controls: neutral(),
          inputAt: time,
          seq: -1,
        };
        room.slots.push(slot);
        actors.set(slot.actorId, slot);
        client.room = room;
        client.slot = slot;
        announce(room);
        if (room.slots.length === 6) start(room, time);
      });
    });
  };
  server.on('upgrade', onUpgrade);
  const timer = options.autoTick === false ? undefined : setInterval(() => tick(), 1000 / 60);
  timer?.unref();
  return {
    tick,
    stats: () => ({ rooms: rooms.size, clients: clients.size, actors: actors.size }),
    close: () => {
      closed = true;
      if (timer) clearInterval(timer);
      server.off('upgrade', onUpgrade);
      for (const client of clients) client.ws.terminate();
      clients.clear();
      rooms.clear();
      actors.clear();
      wss.close();
    },
  };
}
