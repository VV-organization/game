// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Race } from './Race';
import { createRace } from './simulation';

// Only rendering is replaced: race state, progress, input listeners, React effects and
// finish callbacks are the production implementations. A headless DOM cannot run WebGL.
vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: class {
    domElement = document.createElement('canvas');
    shadowMap = {};
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  },
}));
vi.mock('./world', () => ({
  createWorld: () => ({
    scene: new THREE.Scene(),
    pickups: [],
    water: new THREE.Mesh(),
    pulse: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()),
    sun: new THREE.DirectionalLight(),
  }),
}));
vi.mock('./kart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./kart')>()),
  createKart: () => {
    const model = new THREE.Group();
    model.userData = {
      frontWheels: [],
      driver: new THREE.Group(),
      exhaust: [],
      shield: new THREE.Mesh(),
    };
    return model;
  },
}));
vi.mock('./simulation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./simulation')>();
  return { ...actual, createRace: vi.fn(actual.createRace) };
});
const simulation = await vi.importActual<typeof import('./simulation')>('./simulation');
let clock = 0;
let frameId = 0;
const frames = new Map<number, FrameRequestCallback>();

function advanceFrame() {
  clock += 50;
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => {
    for (const callback of callbacks) callback(clock);
  });
}
function finishReadyRace(time = 60) {
  const race = simulation.createRace(simulation.createTrack('coast'), 1);
  race.phase = 'racing';
  race.time = time;
  const player = race.cars[0];
  const point = simulation.sampleTrack(race.track, 0.9995);
  Object.assign(player, {
    x: point.x,
    z: point.z,
    heading: Math.atan2(point.tx, point.tz),
    speed: 32,
    vx: point.tx * 32,
    vz: point.tz * 32,
  });
  player.progress = { checkpoints: 47, lastT: 0.9995, value: 2.9995, finished: false };
  return race;
}

beforeEach(() => {
  clock = 0;
  frameId = 0;
  frames.clear();
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(720);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.mocked(createRace).mockImplementation(simulation.createRace);
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.hasPointerCapture = () => false;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  frames.clear();
});

describe('race finish lifecycle', () => {
  it('delivers one result per race across HUD updates, callback changes and restart', () => {
    vi.mocked(createRace).mockReturnValue(finishReadyRace());
    const firstFinish = vi.fn(),
      nextFinish = vi.fn();
    const view = render(<Race trackId="coast" onExit={() => {}} onFinish={firstFinish} />);
    advanceFrame();
    advanceFrame();
    expect(firstFinish).toHaveBeenCalledTimes(1);
    expect(firstFinish.mock.calls[0][0]).toMatchObject({ position: 1, trackId: 'coast' });
    expect(firstFinish.mock.calls[0][0].time).toBeGreaterThan(60);
    expect(firstFinish.mock.calls[0][0].time).toBeLessThan(61);
    expect(screen.getByRole('heading', { name: '1-е место.' })).toBeTruthy();
    view.rerender(<Race trackId="coast" onExit={() => {}} onFinish={nextFinish} />);
    for (let i = 0; i < 10; i++) advanceFrame();
    expect(firstFinish).toHaveBeenCalledTimes(1);
    expect(nextFinish).not.toHaveBeenCalled();
    vi.mocked(createRace).mockReturnValue(finishReadyRace(90));
    fireEvent.click(screen.getByRole('button', { name: 'ЕЩЁ ОДИН ЗАЕЗД' }));
    advanceFrame();
    advanceFrame();
    expect(nextFinish).toHaveBeenCalledTimes(1);
    expect(nextFinish.mock.calls[0][0].time).toBeGreaterThan(90);
  });

  it('does not schedule another frame when the finish callback unmounts the race', () => {
    vi.mocked(createRace).mockReturnValue(finishReadyRace());
    let view: ReturnType<typeof render>;
    view = render(<Race trackId="coast" onExit={() => {}} onFinish={() => view.unmount()} />);
    advanceFrame();
    expect(frames.size).toBe(0);
  });
});

describe('touch control lifecycle', () => {
  function runningRace() {
    const race = simulation.createRace(simulation.createTrack('coast'), 1);
    race.phase = 'racing';
    race.countdown = 0;
    race.cars = race.cars.slice(0, 1);
    vi.mocked(createRace).mockReturnValue(race);
    render(<Race trackId="coast" onExit={() => {}} onFinish={() => {}} />);
    return race;
  }

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])(
    'releases the throttle on %s',
    (eventType) => {
      const race = runningRace();
      const gas = screen.getByRole('button', { name: 'Газ' });
      fireEvent.pointerDown(gas, { pointerId: 1 });
      advanceFrame();
      const speedWhenHeld = race.cars[0].speed;
      expect(speedWhenHeld).toBeGreaterThan(0);
      fireEvent(gas, new PointerEvent(eventType, { bubbles: true, pointerId: 1 }));
      advanceFrame();
      expect(race.cars[0].speed).toBeLessThan(speedWhenHeld);
    },
  );

  it('clears both keyboard and touch input when focus is lost', () => {
    const race = runningRace();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Газ' }), { pointerId: 1 });
    fireEvent.keyDown(window, { code: 'KeyW' });
    advanceFrame();
    const speedWhenHeld = race.cars[0].speed;
    fireEvent.blur(window);
    expect(race.phase).toBe('paused');
    fireEvent.click(screen.getByRole('button', { name: 'ВЕРНУТЬСЯ В ГОНКУ' }));
    advanceFrame();
    expect(race.cars[0].speed).toBeLessThan(speedWhenHeld);
  });

  it.each(['metaKey', 'ctrlKey', 'altKey'])(
    'leaves browser shortcuts with %s available without driving the kart',
    (modifier) => {
      const race = runningRace();
      const shortcut = new KeyboardEvent('keydown', {
        code: 'KeyW',
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(window, shortcut);
      advanceFrame();
      expect(shortcut.defaultPrevented).toBe(false);
      expect(race.cars[0].speed).toBe(0);
      fireEvent.keyDown(window, { code: 'KeyP', [modifier]: true });
      expect(race.phase).toBe('racing');
    },
  );

  it('keeps a held touch pedal active when a second pedal is released', () => {
    const race = runningRace();
    const gas = screen.getByRole('button', { name: 'Газ' });
    const brake = screen.getByRole('button', { name: 'Тормоз и задний ход' });
    fireEvent.pointerDown(gas, { pointerId: 1 });
    fireEvent.pointerDown(brake, { pointerId: 2 });
    fireEvent.pointerUp(brake, { pointerId: 2 });
    advanceFrame();
    expect(race.cars[0].speed).toBeGreaterThan(0);
    fireEvent.pointerUp(gas, { pointerId: 1 });
    const speedWhenHeld = race.cars[0].speed;
    advanceFrame();
    expect(race.cars[0].speed).toBeLessThan(speedWhenHeld);
  });

  it('prevents a browser context menu on the touch throttle', () => {
    runningRace();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('button', { name: 'Газ' }), event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('starts the audio session from a mobile driving gesture', () => {
    let sessions = 0;
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        currentTime = 0;
        destination = {};
        constructor() {
          sessions++;
        }
        createOscillator() {
          return { frequency: { setTargetAtTime() {} }, connect() {}, start() {} };
        }
        createGain() {
          return { gain: { value: 0, setTargetAtTime() {} }, connect() {} };
        }
        createBiquadFilter() {
          return { frequency: { value: 0 }, connect() {} };
        }
        close() {
          return Promise.resolve();
        }
      },
    );
    runningRace();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Газ' }), { pointerId: 1 });
    expect(sessions).toBe(1);
  });
});
