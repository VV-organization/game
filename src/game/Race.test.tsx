// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Race } from './Race';
import { createRace } from './simulation';
import { createKart } from './kart';
import type { OnlineResult } from '../shared/online-protocol';

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
  createKart: vi.fn(() => {
    const model = new THREE.Group();
    model.userData = {
      frontWheels: [],
      driver: new THREE.Group(),
      exhaust: [],
      glow: new THREE.Group(),
      shield: new THREE.Mesh(),
    };
    return model;
  }),
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
  vi.mocked(createKart).mockClear();
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

describe('race controls', () => {
  function runningRace() {
    const race = simulation.createRace(simulation.createTrack('coast'), 1);
    race.phase = 'racing';
    race.countdown = 0;
    race.cars = race.cars.slice(0, 1);
    vi.mocked(createRace).mockReturnValue(race);
    render(<Race trackId="coast" onExit={() => {}} onFinish={() => {}} />);
    return race;
  }

  it.each([
    ['KeyD', 1],
    ['ArrowRight', 1],
    ['KeyA', -1],
    ['ArrowLeft', -1],
    ['Поворот направо', 1],
    ['Поворот налево', -1],
  ] as const)('moves toward the requested side with %s', (input, side) => {
    const race = runningRace();
    const player = race.cars[0];
    const start = new THREE.Vector3(player.x, 0, player.z);
    // Driver's right is forward × world-up, independent of the simulation's yaw sign.
    const right = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading))
      .cross(new THREE.Vector3(0, 1, 0))
      .normalize();
    if (input.startsWith('Поворот')) {
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Газ' }), { pointerId: 1 });
      fireEvent.pointerDown(screen.getByRole('button', { name: input }), { pointerId: 2 });
    } else {
      fireEvent.keyDown(window, { code: 'KeyW' });
      fireEvent.keyDown(window, { code: input });
    }
    for (let i = 0; i < 20; i++) advanceFrame();
    const displacement = new THREE.Vector3(player.x, 0, player.z).sub(start);
    expect(displacement.dot(right) * side).toBeGreaterThan(0.2);
  });

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

describe('race format presentation', () => {
  it('shows sprint laps and preserves its format on restart', () => {
    render(<Race trackId="coast" formatId="sprint" onExit={() => {}} onFinish={() => {}} />);
    expect(screen.getByText('/ 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Пауза' }));
    fireEvent.click(screen.getByRole('button', { name: 'Начать заново' }));
    expect(vi.mocked(createRace).mock.calls.at(-1)?.[2]).toBe('sprint');
  });

  it('shows solo timed goals without opponents, position or random bonus controls', () => {
    render(<Race trackId="coast" formatId="time-attack" onExit={() => {}} onFinish={() => {}} />);
    expect(screen.getByText('ОСТАЛОСЬ')).toBeTruthy();
    expect(screen.getByText('ЛУЧШИЙ КРУГ: —')).toBeTruthy();
    expect(screen.queryByText('ПОЗИЦИЯ')).toBeNull();
    expect(screen.queryByText('СОПЕРНИКИ')).toBeNull();
    expect(screen.queryByTitle('Использовать бонус (E)')).toBeNull();
    expect(screen.getByText('НИТРО')).toBeTruthy();
    expect(screen.getAllByText('ДРИФТ').length).toBeGreaterThan(0);
  });

  it('reports no complete time-attack lap without inventing a podium and delivers exact fields once', () => {
    const race = simulation.createRace(simulation.createTrack('coast'), 0, 'time-attack');
    race.phase = 'racing';
    race.time = 119.99;
    race.countdown = 0;
    vi.mocked(createRace).mockReturnValue(race);
    const onFinish = vi.fn();
    render(<Race trackId="coast" formatId="time-attack" onExit={() => {}} onFinish={onFinish} />);
    for (let i = 0; i < 5; i++) advanceFrame();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0]).toEqual(simulation.getRaceResult(race));
    expect(onFinish.mock.calls[0][0]).toMatchObject({
      formatId: 'time-attack',
      bestLap: null,
      completedLaps: 0,
      eliminated: false,
    });
    expect(screen.getByRole('heading', { name: 'Нет полного круга.' })).toBeTruthy();
    expect(screen.queryByText('ВОТ ЭТО ПОБЕДА')).toBeNull();
    expect(screen.queryByRole('heading', { name: /место/ })).toBeNull();
  });

  it('shows a completed solo lap as a time result without a podium', () => {
    const race = simulation.createRace(simulation.createTrack('coast'), 0, 'time-attack');
    race.phase = 'finished';
    race.time = 120;
    race.cars[0].bestLap = 42.5;
    race.cars[0].progress.checkpoints = 16;
    vi.mocked(createRace).mockReturnValue(race);
    render(<Race trackId="coast" formatId="time-attack" onExit={() => {}} onFinish={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Круг засчитан.' })).toBeTruthy();
    expect(screen.getByText('00:42.50')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /место/ })).toBeNull();
  });

  it('labels eliminated competitors and counts only active drivers', () => {
    const race = simulation.createRace(simulation.createTrack('coast'), 0, 'elimination');
    race.cars[5].eliminatedAt = 30;
    race.cars[5].eliminationPlace = 6;
    vi.mocked(createRace).mockReturnValue(race);
    render(<Race trackId="coast" formatId="elimination" onExit={() => {}} onFinish={() => {}} />);
    expect(screen.getByText('В ГОНКЕ: 5')).toBeTruthy();
    expect(screen.getByText('ВЫБЫЛ')).toBeTruthy();
  });

  it.each([
    ['elimination', 'ДО ВЫБЫВАНИЯ', 'В ГОНКЕ: 6'],
    ['endurance', 'ОСТАЛОСЬ', 'ДИСТАНЦИЯ: 0 м'],
  ] as const)('shows %s objectives', (formatId, title, detail) => {
    render(<Race trackId="coast" formatId={formatId} onExit={() => {}} onFinish={() => {}} />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(detail)).toBeTruthy();
  });
});

describe('authoritative online race', () => {
  function runtime() {
    const race = simulation.createRace(simulation.createTrack('coast'), 1);
    race.phase = 'racing';
    race.countdown = 0;
    race.cars[1].speed = 20;
    const online = {
      race,
      localCarId: 1,
      roster: race.cars.map((car) => ({
        id: car.id,
        name: car.name,
        kind: car.id < 2 ? ('human' as const) : ('bot' as const),
        customization: {},
        connected: true,
      })),
      connectionState: 'connected' as const,
      finishDeadline: null,
      update: vi.fn(),
      reset: vi.fn(),
      getResult: vi.fn(() => null as ReturnType<typeof simulation.getRaceResult> | null),
      getResults: vi.fn(() => null as OnlineResult[] | null),
    };
    return online;
  }
  it('uses slot one HUD and sends input without stepping the snapshot', () => {
    const online = runtime();
    const start = online.race.cars[0].x;
    render(<Race trackId="coast" online={online} onExit={() => {}} onFinish={() => {}} />);
    expect(screen.getByText('072')).toBeTruthy();
    fireEvent.keyDown(window, { code: 'KeyW' });
    advanceFrame();
    expect(online.update).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 1 }), 0.05);
    expect(online.race.cars[0].x).toBe(start);
    expect(createRace).not.toHaveBeenCalled();
  });
  it('clears input and keeps remote state running through menu and blur', () => {
    const online = runtime();
    render(<Race trackId="coast" online={online} onExit={() => {}} onFinish={() => {}} />);
    fireEvent.keyDown(window, { code: 'KeyW' });
    fireEvent.blur(window);
    expect(online.race.phase).toBe('racing');
    expect(screen.getByText('Гонка продолжается')).toBeTruthy();
    advanceFrame();
    expect(online.update).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0 }), 0.05);
  });
  it('creates every stable slot from server cosmetics, including both human drivers', () => {
    const online = runtime();
    online.roster[0].customization = { car: 2, color: '#ff1122' };
    online.roster[1].customization = { car: 3, color: '#aabbcc' };
    render(<Race trackId="coast" online={online} onExit={() => {}} onFinish={() => {}} />);
    expect(createKart).toHaveBeenCalledTimes(6);
    expect(createKart).toHaveBeenNthCalledWith(1, online.roster[0].customization, 1);
    expect(createKart).toHaveBeenNthCalledWith(2, online.roster[1].customization, 2);
    expect(screen.getAllByText('AI')).toHaveLength(4);
  });
  it('sends reset commands and never changes authoritative cars', () => {
    const online = runtime();
    const before = JSON.stringify(online.race);
    render(<Race trackId="coast" online={online} onExit={() => {}} onFinish={() => {}} />);
    fireEvent.keyDown(window, { code: 'KeyR' });
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть карт на трассу' }));
    expect(online.reset).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(online.race)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
    advanceFrame();
    expect(online.race.phase).toBe('racing');
    expect(online.update).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0 }), 0.05);
  });
  it('orders final standings by place without mutating the server result array', () => {
    const online = runtime();
    online.race.phase = 'finished';
    const result = simulation.getRaceResult(online.race);
    const results: OnlineResult[] = [
      { carId: 0, result: { ...result, position: 3 } },
      { carId: 1, result: { ...result, position: 1 } },
      { carId: 2, result: { ...result, position: 2, didNotFinish: true } },
    ];
    online.getResult.mockReturnValue(results[1].result);
    online.getResults.mockReturnValue(results);
    render(<Race trackId="coast" online={online} onExit={() => {}} onFinish={() => {}} />);
    const rows = screen.getByRole('list', { name: 'Итоги гонки' }).querySelectorAll('li');
    expect([...rows].map((row) => row.querySelector('span')?.textContent)).toEqual([
      `1. ${online.roster[1].name}`,
      `2. ${online.roster[2].name}`,
      `3. ${online.roster[0].name}`,
    ]);
    expect(rows[0].textContent).toContain('ТЫ');
    expect(rows[1].textContent).toContain('AI');
    expect(rows[1].textContent).toContain('DNF');
    expect(results.map((entry) => entry.carId)).toEqual([0, 1, 2]);
  });
  it('waits for server final result and rematches through the callback', () => {
    const online = runtime(),
      onFinish = vi.fn(),
      onRematch = vi.fn();
    render(
      <Race
        trackId="coast"
        online={online}
        onExit={() => {}}
        onFinish={onFinish}
        onRematch={onRematch}
      />,
    );
    online.race.phase = 'finished';
    advanceFrame();
    expect(onFinish).not.toHaveBeenCalled();
    const result = simulation.getRaceResult(online.race);
    online.getResult.mockReturnValue(result);
    for (let i = 0; i < 3; i++) advanceFrame();
    expect(onFinish).toHaveBeenCalledExactlyOnceWith(result);
    fireEvent.click(screen.getByRole('button', { name: 'ЕЩЁ ОДИН ЗАЕЗД' }));
    expect(onRematch).toHaveBeenCalledOnce();
    expect(createRace).not.toHaveBeenCalled();
  });
});
