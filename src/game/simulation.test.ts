import { describe, expect, it } from 'vitest';
import {
  advanceProgress,
  angleDifference,
  createRace,
  createTrack,
  rankCars,
  projectTrack,
  sampleTrack,
  stepRace,
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
