import { afterEach, expect, it, vi } from 'vitest';
import { OnlineClient, loadSavedOnlineSession } from './online-client';
import { createRace, createTrack, getRaceResult } from './simulation';
class Socket {
  readyState = 0;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  send(s: string) {
    this.sent.push(JSON.parse(s));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  frame(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}
const room = {
  type: 'room',
  roomId: 'abc',
  trackId: 'coast',
  formatId: 'classic',
  deadline: 30000,
  serverNow: 0,
  roster: [{ id: 1, name: 'Me', kind: 'human', connected: true, customization: {} }],
  localCarId: 1,
  resumeToken: 'token',
};
const state = () => {
  const { track: _, ...race } = createRace(createTrack('coast'));
  return race;
};
const snapshot = (tick = 1) => ({
  type: 'snapshot',
  roomId: 'abc',
  tick,
  serverNow: tick,
  state: state(),
  roster: room.roster,
  finishDeadline: 80,
});
async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const sockets: Socket[] = [];
  const client = new OnlineClient(
    { formatId: 'classic', trackId: 'coast' },
    {
      storage: null,
      prepareSession: async () => {},
      socketFactory: () => {
        const s = new Socket();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
    },
  );
  await client.connect();
  sockets[0].open();
  sockets[0].frame(room);
  return { client, sockets, s: sockets[0] };
}
afterEach(() => vi.useRealTimers());
it('hydrates stable car/progress identities, ignores stale frames and waits for authoritative results', async () => {
  const { client, s } = await setup();
  s.frame(snapshot());
  const runtime = client.getSnapshot().runtime!;
  const race = runtime.race,
    car = race.cars[1],
    progress = car.progress,
    track = race.track;
  const next = snapshot(2);
  next.state.cars[1].x = 99;
  s.frame(next);
  expect(runtime.localCarId).toBe(1);
  expect(race.cars.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(runtime.race).toBe(race);
  expect(race.cars[1]).toBe(car);
  expect(car.progress).toBe(progress);
  expect(race.track).toBe(track);
  expect(car.x).toBe(99);
  s.frame(snapshot(1));
  s.frame({ ...snapshot(3), roomId: 'other' });
  expect(car.x).toBe(99);
  expect(runtime.finishDeadline).toBe(80);
  expect(runtime.getResult()).toBeNull();
  s.frame({ ...snapshot(4), results: [{ carId: 1, result: getRaceResult(race, 1) }] });
  expect(runtime.getResult()?.online).toBe(true);
  client.leave();
});
it('sends sanitized controls at most 30Hz with increasing sequence and reset command', async () => {
  const { client, s } = await setup();
  s.frame(snapshot());
  const runtime = client.getSnapshot().runtime!;
  const c = {
    throttle: 8,
    steer: NaN,
    brake: false,
    drift: true,
    boost: false,
    power: false,
    x: 999,
  };
  runtime.update(c, 1);
  runtime.update(c, 1);
  vi.advanceTimersByTime(34);
  runtime.reset();
  const inputs = s.sent.filter((m) => m.type === 'input');
  expect(inputs).toHaveLength(2);
  expect(inputs.map((m) => m.seq)).toEqual([0, 1]);
  expect(inputs[0].controls).toEqual({
    throttle: 1,
    steer: 0,
    brake: false,
    drift: true,
    boost: false,
    power: false,
  });
  expect(inputs[1].reset).toBe(true);
  client.leave();
});
it('resumes and rotates tokens, cancellation never reconnects', async () => {
  const { client, sockets, s } = await setup();
  s.close();
  await vi.advanceTimersByTimeAsync(500);
  sockets[1].open();
  expect(sockets[1].sent[0]).toEqual({ type: 'resume', version: 1, roomId: 'abc', token: 'token' });
  sockets[1].frame({ ...room, resumeToken: 'rotated' });
  sockets[1].close();
  await vi.advanceTimersByTimeAsync(500);
  sockets[2].open();
  expect(sockets[2].sent[0].token).toBe('rotated');
  client.leave();
  await vi.advanceTimersByTimeAsync(20000);
  expect(sockets).toHaveLength(3);
});
it('fails safely on malformed frames', async () => {
  const { client, s } = await setup();
  s.onmessage?.({ data: '{bad' });
  expect(client.getSnapshot().connection).toBe('error');
  client.leave();
});
it('rejects malformed and expired recovery data', () => {
  const storage = {
    getItem: () => JSON.stringify({ ...room, token: 'x', at: 0 }),
  } as unknown as Storage;
  expect(loadSavedOnlineSession(storage)).toBeNull();
});
it('cancels pending session preparation and supports strict effect reconnect', async () => {
  const sockets: Socket[] = [];
  let release!: () => void;
  const preparation = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = new OnlineClient(
    { formatId: 'classic', trackId: 'coast' },
    {
      storage: null,
      prepareSession: () => preparation,
      socketFactory: () => {
        const s = new Socket();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
    },
  );
  const first = client.connect();
  expect(client.connect()).toBe(first);
  client.leave();
  const second = client.connect();
  release();
  await Promise.all([first, second]);
  expect(sockets).toHaveLength(1);
  sockets[0].open();
  expect(sockets[0].sent[0].type).toBe('join');
  client.leave();
});
it('bounds reconnect attempts to twelve seconds', async () => {
  const { client, s } = await setup();
  s.close();
  await vi.advanceTimersByTimeAsync(12000);
  expect(client.getSnapshot().connection).toBe('error');
  client.leave();
});
it('retains reset requested immediately after input until the next allowed send', async () => {
  const { client, s } = await setup();
  s.frame(snapshot());
  const runtime = client.getSnapshot().runtime!;
  const controls = {
    throttle: 1,
    steer: 0,
    brake: false,
    drift: false,
    boost: false,
    power: false,
  };
  runtime.update(controls, 1 / 60);
  runtime.reset();
  expect(s.sent.filter((m) => m.type === 'input')).toHaveLength(1);
  vi.advanceTimersByTime(34);
  runtime.update(controls, 1 / 60);
  const inputs = s.sent.filter((m) => m.type === 'input');
  expect(inputs).toHaveLength(2);
  expect(inputs[1].reset).toBe(true);
  vi.advanceTimersByTime(34);
  runtime.update(controls, 1 / 60);
  expect(s.sent.filter((m) => m.type === 'input')[2].reset).toBeUndefined();
  client.leave();
});
it('keeps authoritative results after the server closes a completed room without resuming', async () => {
  const { client, sockets, s } = await setup();
  s.frame(snapshot());
  const runtime = client.getSnapshot().runtime!;
  s.frame({ ...snapshot(2), results: [{ carId: 1, result: getRaceResult(runtime.race, 1) }] });
  const result = runtime.getResult();
  s.close();
  await vi.advanceTimersByTimeAsync(20000);
  expect(sockets).toHaveLength(1);
  expect(client.getSnapshot().connection).toBe('connected');
  expect(client.getSnapshot().error).toBeNull();
  expect(runtime.getResult()).toBe(result);
  client.leave();
});
