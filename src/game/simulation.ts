import type { Customization } from './types';
import { getRaceFormat, type RaceFormatId, type RaceResult } from '../shared/race-formats';

export type Controls = {
  throttle: number;
  steer: number;
  brake: boolean;
  drift: boolean;
  boost: boolean;
  power: boolean;
};
export type Progress = { checkpoints: number; lastT: number; value: number; finished: boolean };
export type Point = { x: number; z: number; tx: number; tz: number; t: number };
export type Track = { id: string; name: string; points: Point[]; length: number; width: number };
export type Power = 'turbo' | 'shield' | 'pulse';
export type RaceDriver = {
  id: number;
  kind: 'human' | 'bot';
  name: string;
  customization: Customization;
};
export type RaceOptions = { drivers?: RaceDriver[]; completion?: 'local' | 'all' };
export type Car = {
  driverKind: 'human' | 'bot';
  customization: Customization;
  lastPower: boolean;
  didNotFinish: boolean;
  id: number;
  name: string;
  color: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  vx: number;
  vz: number;
  progress: Progress;
  boost: number;
  boosting: boolean;
  drifting: boolean;
  driftCharge: number;
  turbo: number;
  shield: number;
  stun: number;
  item: Power | null;
  pickupCooldown: number;
  offroad: boolean;
  steer: number;
  finishTime: number | null;
  bestLap: number | null;
  lapStartedAt: number;
  eliminatedAt: number | null;
  eliminationPlace: number | null;
  aiT: number;
  tuning: { maxSpeed: number; acceleration: number; handling: number };
};
export type RaceState = {
  completion: 'local' | 'all';
  pulses: Array<{ sourceCarId: number; x: number; z: number; remaining: number }>;
  track: Track;
  formatId: RaceFormatId;
  nextEliminationAt: number | null;
  cars: Car[];
  time: number;
  phase: 'countdown' | 'racing' | 'paused' | 'finished';
  countdown: number;
  position: number;
  pulse: number;
  lastPower: boolean;
};
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const wrap = (t: number) => ((t % 1) + 1) % 1;
export const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function advanceProgress(
  p: Progress,
  t: number,
  onTrack: boolean,
  lapTarget: number | null = 3,
): void {
  if (p.finished) return;
  t = wrap(t);
  let delta = t - p.lastT;
  if (delta < -0.5) delta += 1;
  if (delta > 0.5) delta -= 1;
  const target = ((p.checkpoints + 1) % 16) / 16;
  const remaining = wrap(target - p.lastT);
  if (onTrack && delta > 0 && delta < 0.045 && remaining > 1e-8 && remaining <= delta + 1e-8)
    p.checkpoints++;
  const base = (p.checkpoints % 16) / 16;
  let partial = wrap(t - base);
  if (partial > 0.5) partial -= 1;
  p.value = p.checkpoints / 16 + clamp(partial, -0.0625, 0.06249);
  p.lastT = t;
  p.finished = lapTarget !== null && p.checkpoints >= lapTarget * 16;
  if (p.finished) p.value = lapTarget!;
}

const layouts: Record<string, { name: string; width: number; control: number[][] }> = {
  coast: {
    name: 'Лазурный берег',
    width: 19,
    control: [
      [0, 140],
      [80, 132],
      [130, 75],
      [132, 5],
      [82, -44],
      [110, -105],
      [65, -150],
      [-20, -158],
      [-103, -112],
      [-132, -35],
      [-110, 30],
      [-65, 73],
      [-65, 130],
    ],
  },
  neon: {
    name: 'Неоновый квартал',
    width: 20,
    control: [
      [0, 140],
      [115, 140],
      [145, 96],
      [140, 35],
      [74, 5],
      [75, -65],
      [128, -110],
      [98, -155],
      [0, -155],
      [-90, -140],
      [-125, -80],
      [-120, 20],
      [-58, 65],
      [-62, 122],
    ],
  },
  canyon: {
    name: 'Красный каньон',
    width: 18,
    control: [
      [0, 130],
      [80, 137],
      [128, 90],
      [110, 30],
      [45, -8],
      [89, -65],
      [115, -120],
      [55, -161],
      [-10, -137],
      [-65, -160],
      [-125, -105],
      [-120, -35],
      [-75, 15],
      [-108, 80],
      [-65, 125],
    ],
  },
  sky: {
    name: 'Небесная трасса',
    width: 20,
    control: [
      [0, 150],
      [80, 130],
      [120, 65],
      [92, 5],
      [132, -62],
      [85, -140],
      [0, -165],
      [-85, -130],
      [-123, -65],
      [-85, 5],
      [-122, 67],
      [-80, 135],
    ],
  },
};
export function createTrack(id: string): Track {
  const variant = layouts[id] || layouts.coast;
  const controls = variant.control,
    raw: { x: number; z: number }[] = [];
  const blend = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i < controls.length; i++)
    for (let j = 0; j < 50; j++) {
      const p0 = controls[(i + controls.length - 1) % controls.length],
        p1 = controls[i],
        p2 = controls[(i + 1) % controls.length],
        p3 = controls[(i + 2) % controls.length];
      raw.push({
        x: blend(p0[0], p1[0], p2[0], p3[0], j / 50),
        z: blend(p0[1], p1[1], p2[1], p3[1], j / 50),
      });
    }
  const lengths = [0];
  let length = 0;
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1],
      b = raw[i % raw.length];
    length += Math.hypot(b.x - a.x, b.z - a.z);
    lengths.push(length);
  }
  const points: Point[] = [];
  let cursor = 0;
  for (let i = 0; i < 600; i++) {
    const d = (i / 600) * length;
    while (lengths[cursor + 1] < d) cursor++;
    const a = raw[cursor],
      b = raw[(cursor + 1) % raw.length],
      f = (d - lengths[cursor]) / (lengths[cursor + 1] - lengths[cursor]);
    const dx = b.x - a.x,
      dz = b.z - a.z,
      l = Math.hypot(dx, dz);
    points.push({
      x: a.x + (b.x - a.x) * f,
      z: a.z + (b.z - a.z) * f,
      tx: dx / l,
      tz: dz / l,
      t: i / 600,
    });
  }
  return {
    id: layouts[id] ? id : 'coast',
    name: variant.name,
    points,
    length,
    width: variant.width,
  };
}
export function sampleTrack(track: Track, t: number): Point {
  const f = wrap(t) * track.points.length,
    i = Math.floor(f),
    a = track.points[i],
    b = track.points[(i + 1) % track.points.length],
    mix = f - i;
  return {
    x: a.x + (b.x - a.x) * mix,
    z: a.z + (b.z - a.z) * mix,
    tx: a.tx + (b.tx - a.tx) * mix,
    tz: a.tz + (b.tz - a.tz) * mix,
    t: wrap(t),
  };
}
export function projectTrack(track: Track, x: number, z: number) {
  let best = Infinity,
    bestIndex = 0,
    bestF = 0,
    bestX = 0,
    bestZ = 0;
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i],
      b = track.points[(i + 1) % track.points.length],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const f = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1),
      px = a.x + dx * f,
      pz = a.z + dz * f;
    const d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < best) {
      best = d;
      bestIndex = i;
      bestF = f;
      bestX = px;
      bestZ = pz;
    }
  }
  const point = track.points[bestIndex];
  return {
    t: (bestIndex + bestF) / track.points.length,
    distance: Math.sqrt(best),
    side: (x - bestX) * point.tz - (z - bestZ) * point.tx,
    x: bestX,
    z: bestZ,
    tx: point.tx,
    tz: point.tz,
  };
}
export function createRace(
  track: Track,
  carVariant = 0,
  formatId: RaceFormatId = 'classic',
  options: RaceOptions = {},
): RaceState {
  const rules = getRaceFormat(formatId);

  const colors = ['#ff794b', '#ff8368', '#a78bfa', '#54c7fc', '#ffcc52', '#e98fb9'];
  const names = ['ТЫ', 'NOVA', 'GHOST', 'BLUE', 'DASH', 'PEACH'];
  const cars = Array.from(
    { length: options.drivers?.length ?? rules.opponents + 1 },
    (_, i): Car => {
      const driver = options.drivers?.find((d) => d.id === i);
      const customization = { ...(driver?.customization ?? { car: carVariant }) };
      const variant = customization.car ?? 0;
      const upgrade = clamp(variant - 1, 0, 9);
      const t = wrap(0.985 - Math.floor(i / 2) * 0.006),
        p = sampleTrack(track, t),
        lane = i % 2 ? -2.9 : 2.9;
      return {
        id: i,
        driverKind: driver?.kind ?? (i === 0 ? 'human' : 'bot'),
        customization,
        lastPower: false,
        didNotFinish: false,
        name: driver?.name ?? names[i],
        color: customization.color ?? colors[i],
        x: p.x + p.tz * lane,
        z: p.z - p.tx * lane,
        heading: Math.atan2(p.tx, p.tz),
        speed: 0,
        vx: 0,
        vz: 0,
        progress: { checkpoints: 0, lastT: t, value: t - 1, finished: false },
        boost: 100,
        boosting: false,
        drifting: false,
        driftCharge: 0,
        turbo: 0,
        shield: 0,
        stun: 0,
        item: null,
        pickupCooldown: 0,
        offroad: false,
        steer: 0,
        finishTime: null,
        bestLap: null,
        lapStartedAt: 0,
        eliminatedAt: null,
        eliminationPlace: null,
        aiT: t,
        tuning:
          variant > 0
            ? {
                maxSpeed: 50 + upgrade * 5,
                acceleration: 24 + upgrade * 2.9,
                handling: 1 + upgrade * 0.065,
              }
            : { maxSpeed: 44, acceleration: 21, handling: 0.93 },
      };
    },
  );
  return {
    track,
    completion: options.completion ?? 'local',
    pulses: [],
    formatId,
    nextEliminationAt: rules.eliminationInterval,
    cars,
    time: 0,
    phase: 'countdown',
    countdown: 3.6,
    position: 1,
    pulse: 0,
    lastPower: false,
  };
}
const activeCar = (car: Car) =>
  !car.didNotFinish &&
  !car.progress.finished &&
  car.finishTime === null &&
  car.eliminatedAt === null;
export function resetPlayer(race: RaceState) {
  resetCar(race, 0);
}
export function resetCar(race: RaceState, id: number) {
  const car = race.cars.find((c) => c.id === id);
  if (!car || !activeCar(car)) return;
  const p = projectTrack(race.track, car.x, car.z);
  car.x = p.x;
  car.z = p.z;
  car.heading = Math.atan2(p.tx, p.tz);
  car.speed = 0;
  car.vx = 0;
  car.vz = 0;
}
export function usePower(race: RaceState) {
  useCarPower(race, 0);
}
export function useCarPower(race: RaceState, id: number) {
  const player = race.cars.find((c) => c.id === id);
  if (!player || !player.item || !activeCar(player)) return;
  if (player.item === 'turbo') player.turbo = 3;
  else if (player.item === 'shield') player.shield = 6;
  else {
    if (id === 0) race.pulse = 1;
    race.pulses.push({ sourceCarId: id, x: player.x, z: player.z, remaining: 1 });
    for (const car of race.cars)
      if (
        car.id !== id &&
        activeCar(car) &&
        Math.hypot(car.x - player.x, car.z - player.z) < 38 &&
        !car.shield
      ) {
        car.stun = 2.1;
        car.speed *= 0.35;
      }
  }
  player.item = null;
}
const idleControls: Controls = {
  throttle: 0,
  steer: 0,
  brake: false,
  drift: false,
  boost: false,
  power: false,
};
export function stepRace(race: RaceState, controls: Controls, dt: number): void {
  stepRaceDrivers(race, { 0: controls }, dt);
}
export function stepRaceDrivers(
  race: RaceState,
  inputs: Readonly<Record<number, Controls>>,
  dt: number,
): void {
  if (race.phase === 'paused' || race.phase === 'finished') return;
  dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  if (race.phase === 'countdown') {
    race.countdown -= dt;
    if (race.countdown <= 0) race.phase = 'racing';
    return;
  }
  const rules = getRaceFormat(race.formatId);
  const boundary = rules.duration ?? race.nextEliminationAt;
  if (boundary !== null) dt = Math.min(dt, Math.max(0, boundary - race.time));
  race.time += dt;
  race.pulse = Math.max(0, race.pulse - dt);
  race.pulses = race.pulses
    .map((p) => ({ ...p, remaining: p.remaining - dt }))
    .filter((p) => p.remaining > 0);
  const humans = race.cars.filter((c) => c.driverKind === 'human' && activeCar(c));
  const humanLeader = humans.length ? Math.max(...humans.map((c) => c.progress.value)) : null;
  for (const car of race.cars) {
    if (!activeCar(car)) continue;
    const controls = inputs[car.id] ?? idleControls;
    if (car.driverKind === 'human') {
      if (controls.power && !car.lastPower) useCarPower(race, car.id);
      car.lastPower = controls.power;
      if (car.id === 0) race.lastPower = car.lastPower;
    }
    const previousLaps = Math.floor(car.progress.checkpoints / 16);
    car.turbo = Math.max(0, car.turbo - dt);
    car.shield = Math.max(0, car.shield - dt);
    car.stun = Math.max(0, car.stun - dt);
    car.pickupCooldown = Math.max(0, car.pickupCooldown - dt);
    if (car.driverKind === 'human') {
      const road = projectTrack(race.track, car.x, car.z);
      car.offroad = road.distance > race.track.width / 2;
      car.steer += (clamp(controls.steer, -1, 1) - car.steer) * Math.min(1, dt * 8);
      car.drifting = controls.drift && Math.abs(car.speed) > 12 && Math.abs(car.steer) > 0.1;
      car.boosting = (controls.boost && car.boost > 1 && controls.throttle > 0) || car.turbo > 0;
      if (car.boosting && !car.turbo) car.boost = Math.max(0, car.boost - dt * 27);
      else car.boost = Math.min(100, car.boost + dt * (car.drifting ? 12 : 4));
      if (car.drifting) car.driftCharge = Math.min(1.6, car.driftCharge + dt);
      else if (car.driftCharge > 0) {
        if (car.driftCharge > 0.55) car.turbo = Math.max(car.turbo, car.driftCharge * 0.55);
        car.driftCharge = 0;
      }
      const topSpeed =
        car.stun > 0
          ? 12
          : car.offroad
            ? 23
            : car.boosting
              ? car.tuning.maxSpeed * 1.35
              : car.tuning.maxSpeed;
      const engine =
        (controls.brake || controls.throttle < 0) && car.speed > 1
          ? -45
          : controls.throttle < 0
            ? -18
            : controls.brake
              ? 0
              : controls.throttle *
                (car.boosting ? car.tuning.acceleration * 1.6 : car.tuning.acceleration);
      const speedBeforeAcceleration = car.speed;
      car.speed +=
        (engine -
          car.speed * 0.19 -
          Math.sign(car.speed) * (controls.throttle ? 1.3 : controls.brake ? 38 : 9)) *
        dt;
      if (!controls.throttle && Math.abs(car.speed) < 0.6) car.speed = 0;
      if (car.speed > topSpeed) {
        // Normal acceleration respects the listed maximum; leftover boost speed settles smoothly.
        const remainingExcess =
          Math.max(0, speedBeforeAcceleration - topSpeed) * (1 - Math.min(1, dt * 5));
        car.speed = Math.min(car.speed, topSpeed + remainingExcess);
      }
      car.speed = clamp(car.speed, -13, car.tuning.maxSpeed * 1.4);
      const steerPower = (1.1 + 24 / (Math.abs(car.speed) + 20)) * car.tuning.handling;
      car.heading +=
        car.steer *
        steerPower *
        Math.min(1, Math.abs(car.speed) / 8) *
        Math.sign(car.speed || 1) *
        dt *
        (car.drifting ? 1.35 : 1);
      const grip = car.drifting ? 3.2 : 12;
      car.vx += (Math.sin(car.heading) * car.speed - car.vx) * Math.min(1, dt * grip);
      car.vz += (Math.cos(car.heading) * car.speed - car.vz) * Math.min(1, dt * grip);
      car.x += car.vx * dt;
      car.z += car.vz * dt;
      const after = projectTrack(race.track, car.x, car.z);
      const limit = race.track.width / 2 + 3.6;
      if (after.distance > limit) {
        const nx = (car.x - after.x) / after.distance,
          nz = (car.z - after.z) / after.distance;
        car.x = after.x + nx * limit;
        car.z = after.z + nz * limit;
        car.speed *= Math.max(0.65, 1 - dt * 4);
        car.vx *= 0.9;
        car.vz *= 0.9;
      }
      advanceProgress(car.progress, after.t, after.distance < race.track.width / 2 + 4, rules.laps);
    } else {
      const catchup =
        humanLeader === null ? 0 : clamp((humanLeader - car.progress.value) * 12, -2, 4);
      const desiredSpeed =
        car.stun > 0
          ? 12
          : 35.8 + car.id * 0.73 + catchup + Math.sin(race.time * 0.6 + car.id) * 1.5;
      car.speed += (desiredSpeed - car.speed) * Math.min(1, dt * 1.35);
      car.aiT = wrap(car.aiT + (car.speed / race.track.length) * dt);
      const point = sampleTrack(race.track, car.aiT),
        lane = (car.id % 2 ? -2.8 : 2.8) + Math.sin(race.time * 0.18 + car.id * 2.1) * 0.5;
      car.x = point.x + point.tz * lane;
      car.z = point.z - point.tx * lane;
      car.heading = Math.atan2(point.tx, point.tz);
      car.steer = Math.sin(race.time + car.id) * 0.12;
      advanceProgress(car.progress, car.aiT, true, rules.laps);
    }
    if (Math.floor(car.progress.checkpoints / 16) > previousLaps) {
      const lapTime = race.time - car.lapStartedAt;
      car.bestLap = car.bestLap === null ? lapTime : Math.min(car.bestLap, lapTime);
      car.lapStartedAt = race.time;
    }
    if (rules.pickups && !car.item && car.pickupCooldown <= 0) {
      const near = [0.13, 0.39, 0.65, 0.88].some((t) => Math.abs(car.progress.lastT - t) < 0.0045);
      if (near && !car.offroad) {
        car.item = (['turbo', 'shield', 'pulse'] as const)[(Math.floor(race.time) + car.id) % 3];
        car.pickupCooldown = 7;
      }
    }
    if (car.progress.finished && car.finishTime === null) car.finishTime = race.time;
  }
  const player = race.cars[0];
  for (let i = 0; i < race.cars.length; i++) {
    const a = race.cars[i];
    if (!activeCar(a)) continue;
    for (const b of race.cars.slice(i + 1)) {
      if (!activeCar(b)) continue;
      const dx = a.x - b.x,
        dz = a.z - b.z,
        distance = Math.hypot(dx, dz);
      if (distance >= 2.2) continue;
      const nx = distance > 0.01 ? dx / distance : a.id < b.id ? -1 : 1;
      const nz = distance > 0.01 ? dz / distance : 0;
      const push = (2.2 - distance) * 0.3;
      if (a.driverKind === 'human' && !a.shield) {
        a.x += nx * push;
        a.z += nz * push;
        a.speed *= 0.995;
      }
      if (b.driverKind === 'human' && !b.shield) {
        b.x -= nx * push;
        b.z -= nz * push;
        b.speed *= 0.995;
      }
    }
  }
  if (race.nextEliminationAt !== null && race.time >= race.nextEliminationAt) {
    const active = rankCars(race.cars).filter(activeCar);
    if (active.length > 1) {
      const last = active[active.length - 1];
      last.eliminatedAt = race.time;
      last.eliminationPlace = active.length;
      last.speed = last.vx = last.vz = 0;
      last.boosting = last.drifting = false;
      if ((last.id === 0 && race.completion === 'local') || active.length === 2)
        race.phase = 'finished';
    } else race.phase = 'finished';
    race.nextEliminationAt += rules.eliminationInterval!;
  }
  if (
    rules.eliminationInterval !== null &&
    race.completion === 'all' &&
    race.cars.filter(activeCar).length <= 1
  )
    race.phase = 'finished';
  if (rules.duration !== null && race.time >= rules.duration) race.phase = 'finished';
  const ordered = rankCars(race.cars);
  race.position = ordered.findIndex((c) => c.id === 0) + 1;
  if (
    race.completion === 'local' ? player.progress.finished : race.cars.every((c) => !activeCar(c))
  )
    race.phase = 'finished';
}

export function rankCars(cars: Car[]): Car[] {
  return [...cars].sort((a, b) => {
    if (a.didNotFinish !== b.didNotFinish) return a.didNotFinish ? 1 : -1;
    if (a.didNotFinish && b.didNotFinish) return b.progress.value - a.progress.value || a.id - b.id;
    if (a.eliminatedAt !== null || b.eliminatedAt !== null) {
      if (a.eliminatedAt === null) return -1;
      if (b.eliminatedAt === null) return 1;
      return b.eliminatedAt - a.eliminatedAt || a.id - b.id;
    }
    if (a.finishTime !== null && b.finishTime !== null)
      return a.finishTime - b.finishTime || a.id - b.id;
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return b.progress.value - a.progress.value || a.id - b.id;
  });
}

export function getCarPosition(race: RaceState, id: number): number {
  return rankCars(race.cars).findIndex((car) => car.id === id) + 1;
}
export function getRaceResult(race: RaceState, id = 0): RaceResult {
  const player = race.cars.find((c) => c.id === id)!;
  return {
    position: getCarPosition(race, id),
    ...(player.didNotFinish ? { didNotFinish: true } : {}),
    time: player.finishTime ?? race.time,
    trackId: race.track.id,
    formatId: race.formatId,
    bestLap: player.bestLap,
    distance: Math.max(0, player.progress.value) * race.track.length,
    completedLaps: Math.floor(player.progress.checkpoints / 16),
    eliminated: player.eliminatedAt !== null,
  };
}
