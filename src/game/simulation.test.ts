import { describe, expect, it } from 'vitest';
import {
  advanceProgress,
  angleDifference,
  createRace,
  createTrack,
  getRaceResult,
  rankCars,
  projectTrack,
  sampleTrack,
  stepRace,
  stepRaceDrivers,
  resetCar,
  useCarPower,
  getCarPosition,
  type Controls,
  type Progress,
} from './simulation';

const idle: Controls = {
  throttle: 0,
  steer: 0,
  brake: false,
  drift: false,
  boost: false,
  power: false,
};
const progress = (): Progress => ({ checkpoints: 0, lastT: 0, value: 0, finished: false });

describe('ordered circuit progress', () => {
  it('does not award a lap by repeatedly crossing the start line', () => {
    const p = progress();
    for (let i = 0; i < 20; i++) {
      advanceProgress(p, 0.99, true);
      advanceProgress(p, 0.01, true);
    }
    expect(p.checkpoints).toBe(0);
    expect(p.finished).toBe(false);
  });
  it('requires three complete circuits through all checkpoints to finish', () => {
    const p = progress();
    for (let lap = 0; lap < 3; lap++) {
      for (let i = 1; i <= 320; i++) advanceProgress(p, (i / 320) % 1, true);
      expect(p.checkpoints).toBe((lap + 1) * 16);
      expect(p.finished).toBe(lap === 2);
    }
  });
  it('does not count checkpoints crossed away from the road or by teleporting', () => {
    const p = progress();
    advanceProgress(p, 0.07, false);
    advanceProgress(p, 0.5, true);
    advanceProgress(p, 0.07, true);
    expect(p.checkpoints).toBe(0);
  });
});

describe('driving simulation', () => {
  it('keeps race time and all cars fixed when paused', () => {
    const race = createRace(createTrack('coast'));
    race.phase = 'paused';
    const before = JSON.stringify(race);
    stepRace(race, { ...idle, throttle: 1, steer: 1 }, 1 / 60);
    expect(JSON.stringify(race)).toBe(before);
  });
  it('moves a car only when driven and turns from steering input', () => {
    const race = createRace(createTrack('coast'));
    race.phase = 'racing';
    race.cars = race.cars.slice(0, 1); // Isolate driving from collisions with moving opponents.
    const start = { ...race.cars[0] };
    for (let i = 0; i < 60; i++) stepRace(race, idle, 1 / 60);
    expect(Math.hypot(race.cars[0].x - start.x, race.cars[0].z - start.z)).toBeLessThan(0.1);
    for (let i = 0; i < 90; i++) stepRace(race, { ...idle, throttle: 1, steer: 0.3 }, 1 / 60);
    expect(race.cars[0].speed).toBeGreaterThan(1);
    expect(Math.abs(race.cars[0].heading - start.heading)).toBeGreaterThan(0.1);
  });
  it('remains finite under prolonged hard drifting and irregular frame times', () => {
    const race = createRace(createTrack('canyon'));
    race.phase = 'racing';
    for (let i = 0; i < 3000; i++)
      stepRace(
        race,
        { ...idle, throttle: 1, steer: Math.sin(i), drift: true, boost: true },
        i % 100 === 0 ? 5 : 1 / 60,
      );
    for (const car of race.cars)
      expect(
        [car.x, car.z, car.speed, car.heading, car.progress.value].every(Number.isFinite),
      ).toBe(true);
  });
  it('lets the brake key reverse the kart after coming to a stop', () => {
    const race = createRace(createTrack('coast'));
    race.phase = 'racing';
    race.cars = race.cars.slice(0, 1);
    const start = { x: race.cars[0].x, z: race.cars[0].z };
    for (let i = 0; i < 60; i++) stepRace(race, { ...idle, throttle: -1, brake: true }, 1 / 60);
    expect(race.cars[0].speed).toBeLessThan(-1);
    expect(Math.hypot(race.cars[0].x - start.x, race.cars[0].z - start.z)).toBeGreaterThan(1);
  });
  it('makes the first purchased car accelerate and turn better than the free Origin', () => {
    const origin = createRace(createTrack('coast'));
    const purchased = createRace(createTrack('coast'), 1);
    for (const race of [origin, purchased]) {
      race.phase = 'racing';
      race.cars = race.cars.slice(0, 1);
    }
    for (let i = 0; i < 60; i++) {
      stepRace(origin, { ...idle, throttle: 1, steer: 0.2 }, 1 / 60);
      stepRace(purchased, { ...idle, throttle: 1, steer: 0.2 }, 1 / 60);
    }
    expect(purchased.cars[0].speed).toBeGreaterThan(origin.cars[0].speed * 1.1);
    expect(purchased.cars[0].heading - origin.cars[0].heading).toBeGreaterThan(0.01);
  });
  it('applies equipped car performance to acceleration and steering', () => {
    const base = createRace(createTrack('coast'), 1);
    const tuned = createRace(createTrack('coast'), 10);
    for (const race of [base, tuned]) {
      race.phase = 'racing';
      race.cars = race.cars.slice(0, 1);
    }
    for (let i = 0; i < 60; i++) {
      stepRace(base, { ...idle, throttle: 1, steer: 0.2 }, 1 / 60);
      stepRace(tuned, { ...idle, throttle: 1, steer: 0.2 }, 1 / 60);
    }
    expect(tuned.cars[0].speed).toBeGreaterThan(base.cars[0].speed * 1.4);
    expect(tuned.cars[0].heading - base.cars[0].heading).toBeGreaterThan(0.1);
  });
  it('freezes results after a completed race', () => {
    const race = createRace(createTrack('sky'));
    race.phase = 'finished';
    const before = JSON.stringify(race);
    stepRace(race, { ...idle, throttle: 1 }, 1);
    expect(JSON.stringify(race)).toBe(before);
  });
});

it('keeps earlier finishers ahead when all completed racers have the same lap progress', () => {
  const race = createRace(createTrack('coast'));
  race.cars[0].progress.value = 3;
  race.cars[0].finishTime = 90;
  race.cars[1].progress.value = 3;
  race.cars[1].finishTime = 80;
  race.cars[2].progress.value = 2.99;
  expect(
    rankCars(race.cars)
      .slice(0, 3)
      .map((car) => car.id),
  ).toEqual([1, 0, 2]);
});

describe('complete races using driving inputs', () => {
  it.each(['coast', 'neon', 'canyon', 'sky'])(
    'finishes three valid laps on %s without teleporting or changing progress',
    (trackId) => {
      const race = createRace(createTrack(trackId), 1);
      // This controller only reads the road and steers through the public driving input.
      // Countdown, motion, opponents, checkpoints and finish detection run unchanged.
      for (let frame = 0; frame < 60 * 180 && race.phase !== 'finished'; frame++) {
        const player = race.cars[0];
        const road = projectTrack(race.track, player.x, player.z);
        const target = sampleTrack(
          race.track,
          road.t + (10 + player.speed * 0.2) / race.track.length,
        );
        const targetHeading = Math.atan2(target.x - player.x, target.z - player.z);
        stepRace(
          race,
          {
            ...idle,
            throttle: 1,
            steer: Math.max(-1, Math.min(1, angleDifference(targetHeading, player.heading) * 2.4)),
          },
          1 / 60,
        );
      }
      expect(race.phase).toBe('finished');
      expect(race.cars[0].progress.checkpoints).toBe(48);
      expect(race.cars[0].finishTime).not.toBeNull();
      expect(race.time).toBeGreaterThan(0);
      expect(race.time).toBeLessThan(180);
    },
  );
});

describe('advertised car speed limits', () => {
  it.each(
    [180, 198, 216, 234, 252, 270, 288, 306, 324, 342].map((speed, index) => [index + 1, speed]),
  )(
    'car %i reaches its listed %i km/h without exceeding it under normal acceleration',
    (variant, listedSpeed) => {
      const track = createTrack('coast');
      // Stretch the real track so ten seconds of acceleration stay on one straight.
      track.length *= 1000;
      track.width *= 1000;
      track.points = track.points.map((point) => ({
        ...point,
        x: point.x * 1000,
        z: point.z * 1000,
      }));
      const race = createRace(track, variant);
      race.phase = 'racing';
      race.cars = race.cars.slice(0, 1);
      let fastest = 0;
      for (let i = 0; i < 600; i++) {
        stepRace(race, { ...idle, throttle: 1 }, 1 / 60);
        fastest = Math.max(fastest, race.cars[0].speed * 3.6);
      }
      expect(fastest).toBeGreaterThan(listedSpeed - 1);
      expect(fastest).toBeLessThanOrEqual(listedSpeed + 0.01);
    },
  );
});

describe('nitro and power-up effects', () => {
  function activeRace() {
    const race = createRace(createTrack('coast'), 1);
    race.phase = 'racing';
    race.countdown = 0;
    return race;
  }

  it('spends nitro during boost, stays within tank bounds, and replenishes after release', () => {
    const race = activeRace();
    race.cars = race.cars.slice(0, 1);
    const player = race.cars[0];
    for (let i = 0; i < 60; i++) stepRace(race, { ...idle, throttle: 1, boost: true }, 1 / 60);
    expect(player.boost).toBeGreaterThan(70);
    expect(player.boost).toBeLessThan(80);
    expect(player.boosting).toBe(true);
    const spent = player.boost;
    for (let i = 0; i < 60; i++) stepRace(race, idle, 1 / 60);
    expect(player.boost).toBeGreaterThan(spent);
    expect(player.boosting).toBe(false);
    for (let i = 0; i < 3000; i++) stepRace(race, idle, 1 / 60);
    expect(player.boost).toBe(100);
    player.boost = 0;
    stepRace(race, { ...idle, throttle: 1, boost: true }, 1 / 60);
    expect(player.boosting).toBe(false);
    expect(player.boost).toBeGreaterThanOrEqual(0);
  });

  it('consumes a turbo pickup, increases actual acceleration and then expires', () => {
    const normal = activeRace(),
      boosted = activeRace();
    normal.cars = normal.cars.slice(0, 1);
    boosted.cars = boosted.cars.slice(0, 1);
    boosted.cars[0].item = 'turbo';
    for (let i = 0; i < 60; i++) {
      stepRace(normal, { ...idle, throttle: 1 }, 1 / 60);
      stepRace(boosted, { ...idle, throttle: 1, power: i === 0 }, 1 / 60);
    }
    expect(boosted.cars[0].item).toBeNull();
    expect(boosted.cars[0].speed).toBeGreaterThan(normal.cars[0].speed * 1.4);
    for (let i = 0; i < 180; i++) stepRace(boosted, idle, 1 / 60);
    expect(boosted.cars[0].turbo).toBe(0);
    expect(boosted.cars[0].boosting).toBe(false);
  });

  it('uses a shield to prevent an overlapping rival from pushing the player', () => {
    const collisions = [false, true].map((shielded) => {
      const race = activeRace();
      race.cars = race.cars.slice(0, 2);
      const point = sampleTrack(race.track, race.cars[0].progress.lastT);
      const player = race.cars[0];
      player.x = point.x - point.tz * 2.3;
      player.z = point.z + point.tx * 2.3;
      const start = { x: player.x, z: player.z };
      if (shielded) player.item = 'shield';
      stepRace(race, { ...idle, power: shielded }, 1 / 60);
      return Math.hypot(player.x - start.x, player.z - start.z);
    });
    expect(collisions[0]).toBeGreaterThan(0.1);
    expect(collisions[1]).toBeLessThan(0.001);
  });

  it('pulses nearby rivals but leaves distant and shielded rivals unaffected', () => {
    const race = activeRace(),
      player = race.cars[0];
    player.item = 'pulse';
    for (let i = 1; i < race.cars.length; i++) {
      race.cars[i].x = player.x + 100;
      race.cars[i].z = player.z;
    }
    race.cars[1].x = player.x + 5;
    race.cars[2].x = player.x + 8;
    race.cars[2].shield = 2;
    stepRace(race, { ...idle, power: true }, 1 / 60);
    expect(player.item).toBeNull();
    expect(race.cars[1].stun).toBeGreaterThan(2);
    expect(race.cars[2].stun).toBe(0);
    expect(race.cars[3].stun).toBe(0);
  });

  it('requires a new press before consuming another collected power-up', () => {
    const race = activeRace(),
      player = race.cars[0];
    player.item = 'turbo';
    stepRace(race, { ...idle, power: true }, 1 / 60);
    player.item = 'shield';
    stepRace(race, { ...idle, power: true }, 1 / 60);
    expect(player.item).toBe('shield');
    stepRace(race, idle, 1 / 60);
    stepRace(race, { ...idle, power: true }, 1 / 60);
    expect(player.item).toBeNull();
    expect(player.shield).toBeGreaterThan(5);
  });
});

describe('race formats', () => {
  it('allows unlimited validated laps and a one-lap target', () => {
    const endless = progress(),
      sprint = progress();
    for (let i = 1; i <= 320 * 4; i++) {
      advanceProgress(endless, (i / 320) % 1, true, null);
      advanceProgress(sprint, (i / 320) % 1, true, 1);
    }
    expect(endless.checkpoints).toBe(64);
    expect(endless.finished).toBe(false);
    expect(sprint.value).toBe(1);
    expect(sprint.finished).toBe(true);
  });
  it('creates solo time attack, clamps time exactly and rejects an incomplete lap', () => {
    const race = createRace(createTrack('coast'), 1, 'time-attack');
    expect(race.cars).toHaveLength(1);
    race.phase = 'racing';
    race.time = 119.99;
    stepRace(race, idle, 0.05);
    expect(race.time).toBe(120);
    expect(race.phase).toBe('finished');
    expect(getRaceResult(race)).toMatchObject({
      bestLap: null,
      completedLaps: 0,
      formatId: 'time-attack',
    });
    const restarted = createRace(race.track, 1, race.formatId);
    expect(restarted.time).toBe(0);
    expect(restarted.cars[0].bestLap).toBeNull();
  });
  it('eliminates the deterministic last car at the boundary and immediately ends on player loss', () => {
    const race = createRace(createTrack('coast'), 1, 'elimination');
    race.phase = 'racing';
    race.time = 29.99;
    race.cars[0].progress.value = -10;
    race.cars[0].progress.checkpoints = -160;
    stepRace(race, idle, 0.05);
    expect(race.time).toBe(30);
    expect(race.phase).toBe('finished');
    expect(race.cars[0].eliminationPlace).toBe(6);
    expect(getRaceResult(race).eliminated).toBe(true);
  });
});

const newFormats = ['sprint', 'time-attack', 'endurance', 'elimination'] as const;
describe('complete new formats using real driving inputs', () => {
  it.each(
    ['coast', 'neon', 'canyon', 'sky'].flatMap((track) =>
      newFormats.map((format) => ({ track, format })),
    ),
  )('completes $format on $track with validated progress', ({ track, format }) => {
    const race = createRace(createTrack(track), 1, format);
    for (let frame = 0; frame < 20 * 185 && race.phase !== 'finished'; frame++) {
      const player = race.cars[0];
      const road = projectTrack(race.track, player.x, player.z);
      const target = sampleTrack(
        race.track,
        road.t + (10 + player.speed * 0.2) / race.track.length,
      );
      const heading = Math.atan2(target.x - player.x, target.z - player.z);
      stepRace(
        race,
        {
          ...idle,
          throttle: 1,
          steer: Math.max(-1, Math.min(1, angleDifference(heading, player.heading) * 2.4)),
        },
        0.05,
      );
      if (format === 'time-attack') expect(player.item).toBeNull();
    }
    expect(race.phase).toBe('finished');
    expect(race.cars[0].bestLap).toBeGreaterThan(10);
    if (format === 'sprint') expect(race.cars[0].progress.checkpoints).toBe(16);
    if (format === 'time-attack' || format === 'endurance') {
      expect(race.time).toBe(format === 'time-attack' ? 120 : 180);
      expect(race.cars[0].progress.checkpoints).toBeGreaterThan(48);
      expect(race.cars[0].finishTime).toBeNull();
    }
    if (format === 'elimination') {
      expect(race.time % 30).toBe(0);
      const active = race.cars.filter((car) => car.eliminatedAt === null);
      expect(race.cars[0].eliminatedAt !== null || active.length === 1).toBe(true);
    }
  });
});

describe('format timing and retired participants', () => {
  it('freezes elimination and duration clocks while paused, including a pending boundary', () => {
    for (const format of ['elimination', 'time-attack', 'endurance'] as const) {
      const race = createRace(createTrack('coast'), 1, format);
      race.time = format === 'elimination' ? 29.99 : format === 'time-attack' ? 119.99 : 179.99;
      race.phase = 'paused';
      const before = JSON.stringify(race);
      stepRace(race, { ...idle, throttle: 1 }, 100);
      expect(JSON.stringify(race)).toBe(before);
      race.phase = 'racing';
      stepRace(race, idle, Number.NaN);
      expect(race.time).toBe(JSON.parse(before).time);
    }
  });
  it('excludes retired cars from movement, collisions, pickup collection and pulse targets', () => {
    const race = createRace(createTrack('coast'), 1, 'elimination');
    race.phase = 'racing';
    const player = race.cars[0],
      retired = race.cars[1];
    race.cars = [player, retired];
    retired.eliminatedAt = 10;
    retired.eliminationPlace = 6;
    retired.x = player.x + 1;
    retired.z = player.z;
    retired.speed = 10;
    retired.progress.lastT = 0.13;
    const before = JSON.stringify(retired);
    const position = { x: player.x, z: player.z };
    player.item = 'pulse';
    stepRace(race, { ...idle, power: true }, 0.05);
    expect(JSON.stringify(retired)).toBe(before);
    expect(player.x).toBe(position.x);
    expect(player.z).toBe(position.z);
    expect(rankCars(race.cars)[0]).toBe(player);
  });
  it('ranks later eliminations above earlier ones and resolves exact ties by id', () => {
    const race = createRace(createTrack('coast'), 1, 'elimination');
    for (const car of race.cars) car.progress.value = 1;
    expect(rankCars([...race.cars].reverse()).map((car) => car.id)).toEqual([0, 1, 2, 3, 4, 5]);
    race.cars[0].eliminatedAt = 30;
    race.cars[1].eliminatedAt = 60;
    expect(rankCars(race.cars).map((car) => car.id)).toEqual([2, 3, 4, 5, 1, 0]);
  });
  it('retains boost and drift mechanics without random pickups in time attack', () => {
    const race = createRace(createTrack('coast'), 1, 'time-attack');
    race.phase = 'racing';
    for (let i = 0; i < 30; i++)
      stepRace(race, { ...idle, throttle: 1, boost: true, steer: 0.4, drift: true }, 0.05);
    expect(race.cars[0].boost).toBeLessThan(100);
    expect(race.cars[0].driftCharge).toBeGreaterThan(0);
    expect(race.cars[0].item).toBeNull();
  });
});

it('records only a full checkpoint lap and keeps the best completed lap through the final partial lap', () => {
  const race = createRace(createTrack('coast'), 1, 'time-attack');
  race.phase = 'racing';
  const player = race.cars[0];
  const finish = sampleTrack(race.track, 0.001);
  player.x = finish.x;
  player.z = finish.z;
  player.progress = { checkpoints: 15, lastT: 0.999, value: 0.999, finished: false };
  race.time = 30;
  stepRace(race, idle, 0);
  expect(player.bestLap).toBe(30);
  expect(player.lapStartedAt).toBe(30);
  player.progress = { checkpoints: 31, lastT: 0.999, value: 1.999, finished: false };
  race.time = 55;
  stepRace(race, idle, 0);
  expect(player.bestLap).toBe(25);
  race.time = 119.99;
  stepRace(race, idle, 0.05);
  expect(getRaceResult(race)).toMatchObject({ bestLap: 25, completedLaps: 2, time: 120 });
});

it('removes exactly one participant per interval until the sole survivor wins', () => {
  const race = createRace(createTrack('coast'), 1, 'elimination');
  race.phase = 'racing';
  for (const car of race.cars) car.progress.checkpoints = (6 - car.id) * 16;
  for (let round = 1; round <= 5; round++) {
    race.time = round * 30;
    stepRace(race, idle, 0);
    expect(race.cars.filter((car) => car.eliminatedAt === null)).toHaveLength(6 - round);
    expect(race.cars[6 - round].eliminationPlace).toBe(7 - round);
    expect(race.phase).toBe(round === 5 ? 'finished' : 'racing');
  }
  expect(getRaceResult(race)).toMatchObject({ position: 1, eliminated: false, time: 150 });
});

describe('authoritative multiple drivers', () => {
  function online(format: 'classic' | 'elimination' = 'classic') {
    const race = createRace(createTrack('coast'), 0, format, {
      completion: 'all',
      drivers: Array.from({ length: 6 }, (_, id) => ({
        id,
        kind: id < 2 ? ('human' as const) : ('bot' as const),
        name: `Driver ${id}`,
        customization: { car: id === 1 ? 10 : 0 },
      })),
    });
    race.phase = 'racing';
    return race;
  }
  it('drives each human independently with their own tuning and stable slot identity', () => {
    const race = online();
    for (const car of race.cars.slice(2)) car.didNotFinish = true;
    const start = { ...race.cars[0] };
    for (let i = 0; i < 60; i++)
      stepRaceDrivers(race, { 1: { ...idle, throttle: 1, steer: 0.2 } }, 1 / 60);
    expect(race.cars[0].speed).toBe(0);
    expect(race.cars[0].x).toBe(start.x);
    expect(race.cars[1].speed).toBeGreaterThan(20);
    expect(race.cars[1].tuning.maxSpeed).toBe(95);
    expect(race.cars.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('finishes a whole room with two independent driving controllers', () => {
    const race = online();
    for (let frame = 0; frame < 60 * 180 && race.phase !== 'finished'; frame++) {
      const inputs: Record<number, Controls> = {};
      for (const car of race.cars.filter((c) => c.driverKind === 'human')) {
        const road = projectTrack(race.track, car.x, car.z);
        const target = sampleTrack(race.track, road.t + (10 + car.speed * 0.2) / race.track.length);
        const heading = Math.atan2(target.x - car.x, target.z - car.z);
        inputs[car.id] = {
          ...idle,
          throttle: 1,
          steer: Math.max(-1, Math.min(1, angleDifference(heading, car.heading) * 2.4)),
        };
      }
      stepRaceDrivers(race, inputs, 1 / 60);
    }
    expect(race.phase).toBe('finished');
    expect(race.cars.every((c) => c.progress.finished)).toBe(true);
    expect(race.cars.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(getRaceResult(race, 1).time).toBeLessThan(getRaceResult(race, 0).time);
  });
  it('uses and resets the requested driver, keeping separate power edges and pulse origins', () => {
    const race = online(),
      a = race.cars[0],
      b = race.cars[1];
    a.item = 'shield';
    b.item = 'pulse';
    b.x = a.x + 5;
    b.z = a.z;
    stepRaceDrivers(race, { 0: { ...idle, power: true }, 1: { ...idle, power: true } }, 0);
    expect(a.shield).toBe(6);
    expect(b.item).toBeNull();
    expect(race.pulses[0].sourceCarId).toBe(1);
    b.item = 'turbo';
    stepRaceDrivers(race, { 1: { ...idle, power: true } }, 0);
    expect(b.item).toBe('turbo');
    useCarPower(race, 1);
    expect(b.turbo).toBe(3);
    b.speed = 30;
    resetCar(race, 1);
    expect(b.speed).toBe(0);
    expect(a.shield).toBe(6);
  });
  it('continues after slot zero finishes and freezes finished and DNF cars', () => {
    const race = online();
    const finish = sampleTrack(race.track, 0.001);
    race.cars[0].x = finish.x;
    race.cars[0].z = finish.z;
    race.cars[0].progress = { checkpoints: 47, lastT: 0.999, value: 2.999, finished: false };
    stepRaceDrivers(race, {}, 0);
    expect(race.cars[0].finishTime).toBe(0);
    expect(race.cars[0].progress.finished).toBe(true);
    race.cars[2].didNotFinish = true;
    const before = JSON.stringify(race.cars[2]);
    stepRaceDrivers(race, { 1: { ...idle, throttle: 1 } }, 0.05);
    expect(race.phase).toBe('racing');
    expect(JSON.stringify(race.cars[2])).toBe(before);
    for (const c of race.cars) if (c.id !== 0) c.didNotFinish = true;
    stepRaceDrivers(race, {}, 0);
    expect(race.phase).toBe('finished');
    expect(getCarPosition(race, 0)).toBe(1);
    expect(getRaceResult(race, 1).didNotFinish).toBe(true);
  });
  it('continues elimination after slot zero loses, and ranks DNF by distance', () => {
    const race = online('elimination');
    race.time = 30;
    race.cars[0].progress.checkpoints = -160;
    stepRaceDrivers(race, {}, 0);
    expect(race.cars[0].eliminatedAt).toBe(30);
    expect(race.phase).toBe('racing');
    race.cars[1].didNotFinish = true;
    race.cars[1].progress.value = 10;
    race.cars[2].didNotFinish = true;
    race.cars[2].progress.value = 20;
    expect(
      rankCars(race.cars)
        .filter((c) => c.didNotFinish)
        .map((c) => c.id),
    ).toEqual([2, 1]);
  });
  it('separates overlapping humans symmetrically and ignores retired pulse targets', () => {
    const race = online(),
      a = race.cars[0],
      b = race.cars[1];
    b.x = a.x + 1;
    b.z = a.z;
    const x = a.x,
      y = b.x;
    stepRaceDrivers(race, {}, 0);
    expect(a.x).toBeLessThan(x);
    expect(b.x).toBeGreaterThan(y);
    b.didNotFinish = true;
    a.item = 'pulse';
    const before = JSON.stringify(b);
    useCarPower(race, 0);
    expect(JSON.stringify(b)).toBe(before);
  });
});
