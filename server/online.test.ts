// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import * as simulation from '../src/game/simulation';
import { attachOnlineServer } from './online';
import { createApplication } from './app';
import { customizationFor } from '../src/lib/customization';
import { products } from './catalog';
import type { OnlineServerMessage } from '../src/shared/online-protocol';

const disposals: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const dispose of disposals.splice(0)) await dispose();
});
async function setup() {
  let time = 100000;
  const http = createServer();
  const online = attachOnlineServer(http, {
    autoTick: false,
    now: () => time,
    allowedOrigins: ['http://game.test'],
    resolveIdentity: (cookie) =>
      cookie.startsWith('actor=')
        ? { actorId: cookie.slice(6), name: cookie.slice(6), customization: { color: '#123456' } }
        : null,
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening', { signal: AbortSignal.timeout(2000) });
  const url = `ws://127.0.0.1:${(http.address() as { port: number }).port}/ws/race`;
  const sockets: WebSocket[] = [];
  disposals.push(async () => {
    online.close();
    for (const ws of sockets) ws.terminate();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  });
  async function connect(actor: string) {
    const ws = new WebSocket(url, {
      origin: 'http://game.test',
      headers: { Cookie: `actor=${actor}` },
    });
    const messages: OnlineServerMessage[] = [];
    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    sockets.push(ws);
    await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
    return {
      ws,
      messages,
      send: async (m: unknown) => {
        ws.send(JSON.stringify(m));
        await flushSocket(ws);
      },
    };
  }
  return {
    online,
    connect,
    url,
    advance: async (ms: number) => {
      time += ms;
      online.tick(time);
      await Promise.all(sockets.map(flushSocket));
    },
    flush: () => Promise.all(sockets.map(flushSocket)),
    disconnected: async (ws: WebSocket) => {
      const expected = sockets.filter(
        (socket) => socket !== ws && socket.readyState === WebSocket.OPEN,
      ).length;
      await vi.waitFor(() => expect(online.stats().clients).toBe(expected), {
        timeout: 2000,
        interval: 5,
      });
    },
    time: () => time,
  };
}
// Ping/pong is an ordered transport barrier: preceding server messages and client
// frames have crossed the socket before it resolves, regardless of suite load.
const flushSocket = (ws: WebSocket): Promise<void> => {
  if (ws.readyState !== WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const token = Buffer.from(`barrier-${barrierId++}`);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('WebSocket barrier timed out'));
    }, 2000);
    const cleanup = () => {
      clearTimeout(timer);
      ws.off('pong', onPong);
      ws.off('close', onClose);
    };
    const onClose = () => {
      cleanup();
      resolve();
    };
    const onPong = (data: Buffer) => {
      if (data.equals(token)) {
        cleanup();
        resolve();
      }
    };
    ws.on('pong', onPong);
    ws.once('close', onClose);
    ws.ping(token);
  });
};
let barrierId = 0;
const join = { type: 'join', version: 1, trackId: 'coast', formatId: 'classic' };
const controls = { throttle: 1, steer: 0, brake: false, drift: false, boost: false, power: false };
const latest = (messages: OnlineServerMessage[], type: 'room' | 'snapshot') =>
  messages.filter((m) => m.type === type).at(-1)! as any;

describe('authoritative online transport', () => {
  it('derives account identity and equipped catalog appearance without leaking account data', () => {
    const app = createApplication();
    try {
      expect(app.resolveOnlineIdentity('')).toBeNull();
      expect(app.resolveOnlineIdentity('fapix_session=forged')).toBeNull();
      expect(app.resolveOnlineIdentity('fapix_visitor=invalid')).toBeNull();
      const user = app.store.register('driver', 'unused-test-hash');
      const token = app.store.createSession(user.id);
      const identity = app.resolveOnlineIdentity(`fapix_session=${token}`)!;
      expect(identity.name).toBe('driver');
      expect(identity.customization).toEqual(customizationFor(user.equipped, products));
      expect(Object.keys(identity).sort()).toEqual(['actorId', 'customization', 'name']);
      expect(identity.actorId).not.toBe(user.id);
      expect(JSON.stringify(identity)).not.toContain(token);
      app.store.logout(token);
      expect(app.resolveOnlineIdentity(`fapix_session=${token}`)).toBeNull();
      const guest = app.resolveOnlineIdentity(`fapix_visitor=${'a'.repeat(64)}`)!;
      expect(guest.name).toMatch(/^Гость /);
      expect(guest.customization).toEqual({});
    } finally {
      app.close();
    }
  });
  it('keeps a disconnected player resumable when the remaining player explicitly leaves', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send(join);
    await b.send(join);
    const room = latest(a.messages, 'room');
    a.ws.terminate();
    await h.disconnected(a.ws);
    await b.send({ type: 'leave' });
    expect(h.online.stats().rooms).toBe(1);
    const recovered = await h.connect('a');
    await recovered.send({
      type: 'resume',
      version: 1,
      roomId: room.roomId,
      token: room.resumeToken,
    });
    expect(latest(recovered.messages, 'room')).toMatchObject({
      roomId: room.roomId,
      localCarId: 0,
    });
  });
  it.each(['finished', 'eliminated', 'finalized'] as const)(
    'preserves a %s participant when they leave or recovery expires',
    async (status) => {
      // Seed a trusted server simulation state; all transport and recovery use real sockets.
      const create = simulation.createRace;
      vi.spyOn(simulation, 'createRace').mockImplementationOnce((...args) => {
        const race = create(...args);
        if (status === 'eliminated') {
          race.cars[0].eliminatedAt = 10;
          race.cars[0].eliminationPlace = 6;
        } else {
          race.cars[0].finishTime = 10;
          race.cars[0].progress.finished = true;
        }
        if (status === 'finalized') race.phase = 'finished';
        return race;
      });
      const h = await setup(),
        a = await h.connect('a'),
        b = await h.connect('b');
      await a.send(join);
      await b.send(join);
      await h.advance(30000);
      if (status === 'finalized') await h.advance(50);
      const before = latest(b.messages, 'snapshot');
      expect(before.state.cars[0].didNotFinish).toBe(false);
      if (status === 'eliminated' || status === 'finalized') await a.send({ type: 'leave' });
      else {
        a.ws.terminate();
        await h.disconnected(a.ws);
        await h.advance(12000);
      }
      await h.advance(50);
      const after = latest(b.messages, 'snapshot');
      expect(after.state.cars[0].didNotFinish).toBe(false);
      expect(after.state.cars[0].finishTime).toBe(before.state.cars[0].finishTime);
      expect(after.state.cars[0].eliminatedAt).toBe(before.state.cars[0].eliminatedAt);
      if (status === 'finalized') {
        expect(after.state).toEqual(before.state);
        expect(after.results).toEqual(before.results);
      }
    },
  );
  it('issues six uppercase hex invitation codes and accepts lowercase codes', async () => {
    const h = await setup(),
      host = await h.connect('host'),
      guest = await h.connect('guest');
    await host.send(join);
    const room = latest(host.messages, 'room');
    expect(room.roomId).toMatch(/^[0-9A-F]{6}$/);
    await guest.send({ ...join, roomId: room.roomId.toLowerCase() });
    expect(latest(guest.messages, 'room')).toMatchObject({ roomId: room.roomId, localCarId: 1 });
  });
  it('uses the invited room settings when the joining client has default selections', async () => {
    const h = await setup(),
      host = await h.connect('host'),
      guest = await h.connect('guest');
    await host.send({ ...join, trackId: 'neon', formatId: 'sprint' });
    const room = latest(host.messages, 'room');
    await guest.send({ ...join, roomId: room.roomId });
    expect(latest(guest.messages, 'room')).toMatchObject({
      roomId: room.roomId,
      trackId: 'neon',
      formatId: 'sprint',
      localCarId: 1,
    });
  });
  it('shares a room, preserves deadline and fills honest bots exactly at 30 seconds', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send(join);
    const deadline = latest(a.messages, 'room').deadline;
    await h.advance(1000);
    await b.send(join);
    expect(latest(b.messages, 'room').roomId).toBe(latest(a.messages, 'room').roomId);
    expect(latest(b.messages, 'room').localCarId).toBe(1);
    expect(latest(b.messages, 'room').deadline).toBe(deadline);
    await h.advance(28999);
    expect(latest(a.messages, 'snapshot')).toBeUndefined();
    await h.advance(1);
    const state = latest(a.messages, 'snapshot');
    expect(state.roster.map((s: any) => s.kind)).toEqual([
      'human',
      'human',
      'bot',
      'bot',
      'bot',
      'bot',
    ]);
    expect(state.state.track).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain('actorId');
    expect(state.state.cars[1].driverKind).toBe('human');
  });
  it('starts six clients early and moves their stable human slots independently', async () => {
    const h = await setup();
    const users = [];
    for (let i = 0; i < 6; i++) {
      const user = await h.connect(String(i));
      users.push(user);
      await user.send(join);
    }
    expect(latest(users[0].messages, 'snapshot').state.phase).toBe('countdown');
    for (let i = 0; i < 16; i++) await h.advance(250);
    const before = latest(users[0].messages, 'snapshot').state.cars;
    for (let i = 0; i < 5; i++) {
      await users[1].send({ type: 'input', seq: i, controls });
      await h.advance(200);
    }
    const after = latest(users[0].messages, 'snapshot').state.cars;
    expect(Math.hypot(after[1].x - before[1].x, after[1].z - before[1].z)).toBeGreaterThan(1);
    expect(after[0].speed).toBe(0);
    expect(after[2].speed).toBe(0);
    await users[1].send({ type: 'input', seq: 2, controls });
    expect(users[1].messages.at(-1)).toMatchObject({ type: 'error', code: 'INVALID_INPUT' });
    await users[1].send({ type: 'input', seq: 8, controls: { ...controls, throttle: 999 } });
    expect(users[1].messages.at(-1)).toMatchObject({ type: 'error', code: 'INVALID_INPUT' });
    await h.advance(250);
    await h.advance(250);
    expect(latest(users[0].messages, 'snapshot').state.cars[1].speed).toBeLessThan(after[1].speed);
  });
  it('rejects duplicate actors and binds rotating resume tokens to the actor', async () => {
    const h = await setup(),
      a = await h.connect('a');
    await a.send(join);
    const room = latest(a.messages, 'room');
    const duplicate = await h.connect('a');
    await duplicate.send(join);
    expect(duplicate.messages.at(-1)).toMatchObject({ code: 'ALREADY_JOINED' });
    a.ws.terminate();
    await h.disconnected(a.ws);
    const thief = await h.connect('thief');
    await thief.send({ type: 'resume', version: 1, roomId: room.roomId, token: room.resumeToken });
    expect(thief.messages.at(-1)).toMatchObject({ code: 'RESUME_EXPIRED' });
    await duplicate.send({ type: 'resume', version: 1, roomId: room.roomId, token: 'wrong' });
    expect(duplicate.messages.at(-1)).toMatchObject({ code: 'RESUME_EXPIRED' });
    await duplicate.send({
      type: 'resume',
      version: 1,
      roomId: room.roomId,
      token: room.resumeToken,
    });
    expect(latest(duplicate.messages, 'room').localCarId).toBe(0);
    expect(latest(duplicate.messages, 'room').resumeToken).not.toBe(room.resumeToken);
  });
  it('cleans abandoned rooms, supports leave and refuses forged formats', async () => {
    const h = await setup(),
      a = await h.connect('a');
    await a.send({ ...join, formatId: 'time-attack' });
    expect(a.messages.at(-1)).toMatchObject({ code: 'INVALID_JOIN' });
    await a.send(join);
    await a.send({ type: 'leave' });
    expect(h.online.stats().rooms).toBe(0);
    await a.send(join);
    a.ws.terminate();
    await h.disconnected(a.ws);
    await h.advance(12000);
    expect(h.online.stats()).toMatchObject({ rooms: 0, actors: 0 });
  });
  it('finishes on the server and keeps immutable results for 30 seconds', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send({ ...join, formatId: 'sprint' });
    await b.send({ ...join, formatId: 'sprint' });
    await h.advance(30000);
    let result: any;
    for (let i = 0; i < 500; i++) {
      await h.advance(250);
      const message = latest(a.messages, 'snapshot');
      if (message.results) {
        result = message;
        break;
      }
    }
    expect(result?.state.phase).toBe('finished');
    expect(result.results).toHaveLength(6);
    expect(result.finishDeadline).toBeGreaterThan(30);
    expect(result.results[0].result).toMatchObject({ didNotFinish: true, online: true });
    expect(result.results.some((r: any) => r.carId > 1 && !r.result.didNotFinish)).toBe(true);
    await a.send({ type: 'input', seq: 1, controls, reset: true });
    await h.advance(1000);
    expect(latest(a.messages, 'snapshot').results).toEqual(result.results);
    expect(latest(b.messages, 'snapshot').results).toEqual(result.results);
    await h.advance(29000);
    expect(h.online.stats().rooms).toBe(0);
  });
  it('neutralizes disconnects and marks DNF after the recovery window without bot substitution', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send(join);
    await b.send(join);
    await h.advance(30000);
    a.ws.terminate();
    await h.disconnected(a.ws);
    await h.advance(11999);
    expect(latest(b.messages, 'snapshot').state.cars[0].didNotFinish).toBe(false);
    await h.advance(1);
    await h.advance(50);
    const car = latest(b.messages, 'snapshot').state.cars[0];
    expect(car.didNotFinish).toBe(true);
    expect(car.driverKind).toBe('human');
    expect(car.speed).toBe(0);
  });
  it('preserves slot IDs after waiting players cancel and rejects malformed/payload pressure', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send(join);
    await b.send(join);
    await a.send({ type: 'leave' });
    expect(latest(b.messages, 'room').localCarId).toBe(1);
    await a.send(join);
    expect(latest(a.messages, 'room').localCarId).toBe(0);
    a.ws.send('{broken');
    await h.flush();
    expect(a.messages.at(-1)).toMatchObject({ code: 'INVALID_MESSAGE' });
    const close = once(a.ws, 'close', { signal: AbortSignal.timeout(2000) });
    a.ws.send('x'.repeat(2049));
    await close;
    expect(a.ws.readyState).toBe(WebSocket.CLOSED);
  });
  it('separates all four formats, validates invites and enforces connection message rates', async () => {
    const h = await setup();
    const roomIds: string[] = [];
    for (const formatId of ['classic', 'sprint', 'elimination', 'endurance']) {
      const user = await h.connect(formatId);
      await user.send({ ...join, formatId });
      roomIds.push(latest(user.messages, 'room').roomId);
    }
    expect(new Set(roomIds).size).toBe(4);
    const guest = await h.connect('guest');
    await guest.send({ ...join, roomId: 'missing' });
    expect(guest.messages.at(-1)).toMatchObject({ code: 'ROOM_NOT_FOUND' });
    await guest.send({ ...join, roomId: roomIds[0] });
    expect(latest(guest.messages, 'room').roomId).toBe(roomIds[0]);
    await h.advance(30000);
    const late = await h.connect('late');
    await late.send({ ...join, roomId: roomIds[0] });
    expect(late.messages.at(-1)).toMatchObject({ code: 'ROOM_STARTED' });
    const close = once(guest.ws, 'close', { signal: AbortSignal.timeout(2000) });
    for (let i = 0; i < 91; i++) guest.ws.send(JSON.stringify({ type: 'input', seq: i, controls }));
    const [code] = await close;
    expect(code).toBe(1008);
  });
  it('runs elimination to the sole survivor after an early human elimination and shares all six results', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send({ ...join, formatId: 'elimination' });
    await b.send({ ...join, formatId: 'elimination' });
    await h.advance(30000);
    let early: any;
    for (let i = 0; i < 650; i++) {
      await h.advance(250);
      const message = latest(a.messages, 'snapshot');
      if (!early && message.state.cars.slice(0, 2).some((car: any) => car.eliminatedAt !== null))
        early = message;
      if (message.results) break;
    }
    expect(early.state.phase).toBe('racing');
    const eliminatedHuman = early.state.cars
      .slice(0, 2)
      .find((car: any) => car.eliminatedAt !== null);
    expect(eliminatedHuman.eliminatedAt).toBeCloseTo(30, 6);
    expect(early.results).toBeUndefined();
    const final = latest(a.messages, 'snapshot');
    expect(final.state.phase).toBe('finished');
    expect(final.state.time).toBeCloseTo(150, 6);
    expect(final.results).toHaveLength(6);
    expect(final.results).toEqual(latest(b.messages, 'snapshot').results);
    const humanResult = final.results.find(
      (entry: any) => entry.carId === eliminatedHuman.id,
    ).result;
    expect(humanResult).toMatchObject({ eliminated: true, online: true });
    expect(humanResult.didNotFinish).not.toBe(true);
    expect(final.state.cars.filter((car: any) => car.eliminatedAt === null)).toHaveLength(1);
  });
  it('runs endurance for 180 simulated seconds and shares results without false DNF', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send({ ...join, formatId: 'endurance' });
    await b.send({ ...join, formatId: 'endurance' });
    await h.advance(30000);
    for (let i = 0; i < 750 && !latest(a.messages, 'snapshot').results; i++) await h.advance(250);
    const final = latest(a.messages, 'snapshot');
    expect(final.state.phase).toBe('finished');
    expect(final.state.time).toBeCloseTo(180, 6);
    expect(final.results).toHaveLength(6);
    expect(final.results).toEqual(latest(b.messages, 'snapshot').results);
    for (const result of final.results) {
      expect(result.result).toMatchObject({ formatId: 'endurance', online: true });
      expect(result.result.didNotFinish).not.toBe(true);
    }
  });
  it('resumes a moving human in the same running slot and accepts restarted input sequences', async () => {
    const h = await setup(),
      a = await h.connect('a'),
      b = await h.connect('b');
    await a.send(join);
    await b.send(join);
    const room = latest(b.messages, 'room');
    await h.advance(30000);
    for (let i = 0; i < 16; i++) await h.advance(250);
    for (let seq = 100; seq < 105; seq++) {
      await b.send({ type: 'input', seq, controls });
      await h.advance(200);
    }
    const before = latest(a.messages, 'snapshot').state.cars[1];
    expect(before.speed).toBeGreaterThan(1);
    b.ws.terminate();
    await h.disconnected(b.ws);
    await h.advance(500);
    const disconnected = latest(a.messages, 'snapshot').state.cars[1];
    const resumed = await h.connect('b');
    await resumed.send({
      type: 'resume',
      version: 1,
      roomId: room.roomId,
      token: room.resumeToken,
    });
    expect(latest(resumed.messages, 'room').localCarId).toBe(1);
    expect(latest(resumed.messages, 'snapshot').state.cars[1]).toEqual(disconnected);
    expect(disconnected.progress.checkpoints).toBeGreaterThanOrEqual(before.progress.checkpoints);
    expect(disconnected.didNotFinish).toBe(false);
    await resumed.send({ type: 'input', seq: 0, controls });
    await h.advance(200);
    expect(resumed.messages.filter((message) => message.type === 'error')).toEqual([]);
    const after = latest(a.messages, 'snapshot').state.cars[1];
    expect(after.speed).toBeGreaterThan(disconnected.speed);
    expect(Math.hypot(after.x - disconnected.x, after.z - disconnected.z)).toBeGreaterThan(0.1);
    expect(latest(resumed.messages, 'snapshot').state.cars[1]).toEqual(after);
  });
  it('requires authenticated cookies and an allowed Origin', async () => {
    const h = await setup();
    for (const options of [
      { origin: 'http://evil.test', headers: { Cookie: 'actor=a' } },
      { origin: 'http://game.test' },
    ]) {
      const ws = new WebSocket(h.url, options);
      ws.on('error', () => {});
      const [, response] = await once(ws, 'unexpected-response', {
        signal: AbortSignal.timeout(2000),
      });
      expect([401, 403]).toContain(response.statusCode);
      ws.terminate();
    }
  });
});
