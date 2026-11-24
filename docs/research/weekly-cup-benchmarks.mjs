import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createTrack,
  createRace,
  stepRaceDrivers,
  projectTrack,
  sampleTrack,
  angleDifference,
} from '../../src/game/simulation.ts';
// Run from the repository root with node --import tsx docs/research/weekly-cup-benchmarks.mjs
const dataset = JSON.parse(
  readFileSync(new URL('./weekly-cup-benchmarks.json', import.meta.url), 'utf8'),
);
function simulate(circuit, nickname) {
  const digest = createHash('sha256')
    .update(circuit.id + '-sprint-v1/' + nickname)
    .digest();
  const targetSpeed = 23 + (20 * digest.readUInt16BE(0)) / 65535;
  const lookAhead = 8 + (6 * digest[2]) / 255;
  const race = createRace(circuit, dataset.carVariant, dataset.formatId);
  const car = race.cars[0];
  let cutoff = 300;
  while (race.time < cutoff && car.finishTime === null) {
    const road = projectTrack(circuit, car.x, car.z);
    const target = sampleTrack(circuit, road.t + (lookAhead + car.speed * 0.2) / circuit.length);
    const angle = Math.atan2(target.x - car.x, target.z - car.z);
    const controls = {
      throttle: car.speed < targetSpeed ? 1 : 0,
      steer: Math.max(-1, Math.min(1, angleDifference(angle, car.heading) * 2.4)),
      brake: false,
      drift: false,
      boost: false,
      power: false,
    };
    stepRaceDrivers(race, { 0: controls }, 1 / 60);
    if (race.cars.some((c) => c.finishTime !== null)) cutoff = Math.min(cutoff, race.time + 30);
    if (race.phase === 'finished') break;
  }
  if (car.finishTime === null || car.progress.checkpoints < 16) throw Error('DNF: ' + nickname);
  const finishMs = Math.round(car.finishTime * 1000);
  return finishMs;
}

const tracks = ['coast', 'neon', 'canyon', 'sky'].map(createTrack);
for (const row of dataset.benchmarks) {
  const times = Object.fromEntries(
    tracks.map((track) => [track.id, simulate(track, row.nickname)]),
  );
  if (row.finishMs !== times.coast) throw new Error('Coast benchmark changed for ' + row.nickname);
  if (process.argv.includes('--write')) row.timesMs = times;
  else if (JSON.stringify(times) !== JSON.stringify(row.timesMs))
    throw new Error('Track benchmarks changed for ' + row.nickname);
}
if (process.argv.includes('--write')) {
  const { benchmarks, ...metadata } = dataset;
  const encoded =
    JSON.stringify(metadata, null, 2).slice(0, -2) +
    ',\n  "benchmarks": [\n' +
    benchmarks.map((row) => '    ' + JSON.stringify(row)).join(',\n') +
    '\n  ]\n}\n';
  writeFileSync(new URL('./weekly-cup-benchmarks.json', import.meta.url), encoded);
}
console.log('Verified ' + dataset.benchmarks.length * tracks.length + ' timed sprints.');
