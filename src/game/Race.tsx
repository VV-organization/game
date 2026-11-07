import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Gauge,
  Home,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import * as THREE from 'three';
import { createKart, disposeScene } from './kart';
import { updateUnderglow } from './underglow';
import { createTrailEffect } from './trail-effects';
import { createWorld } from './world';
import {
  angleDifference,
  createRace,
  createTrack,
  getRaceResult,
  getCarPosition,
  rankCars,
  resetPlayer,
  stepRace,
  type Controls,
  type Power,
  type RaceState,
} from './simulation';
import type { Customization } from './types';
import { getCarDesign } from '../shared/car-designs';
import { getRaceFormat, type RaceFormatId, type RaceResult } from '../shared/race-formats';
import type { OnlineRaceRuntime } from '../shared/online-protocol';
import './Race.css';

export type { RaceResult } from '../shared/race-formats';
export type RaceProps = {
  trackId: string;
  formatId?: RaceFormatId;
  customization?: Customization;
  online?: OnlineRaceRuntime;
  onRematch?: () => void;
  onExit: () => void;
  onFinish: (result: RaceResult) => void;
};
const emptyControls: Controls = {
  throttle: 0,
  steer: 0,
  brake: false,
  drift: false,
  boost: false,
  power: false,
};
const formatTime = (value: number) =>
  `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(value % 60)
    .toString()
    .padStart(2, '0')}.${Math.floor((value % 1) * 100)
    .toString()
    .padStart(2, '0')}`;
const powerNames: Record<Power, string> = { turbo: 'ТУРБО', shield: 'ЩИТ', pulse: 'ИМПУЛЬС' };
const ordinal = (position: number) => `${position}-е`;
function PowerIcon({ power, size = 24 }: { power: Power | null; size?: number }) {
  return power === 'shield' ? (
    <Shield size={size} />
  ) : power === 'pulse' ? (
    <Sparkles size={size} />
  ) : (
    <Zap size={size} />
  );
}

export function Race({
  trackId,
  formatId = 'classic',
  customization = {},
  onExit,
  onFinish,
  online,
  onRematch,
}: RaceProps) {
  const format = getRaceFormat(formatId);
  const host = useRef<HTMLDivElement>(null),
    minimap = useRef<HTMLCanvasElement>(null),
    raceRef = useRef<RaceState | null>(null),
    controlsRef = useRef<Controls>({ ...emptyControls }),
    touchPointers = useRef(new Map<number, { control: keyof Controls; value: number | boolean }>());
  const callbacks = useRef({ onExit, onFinish });
  callbacks.current = { onExit, onFinish };
  const [restart, setRestart] = useState(0),
    [hud, setHud] = useState<RaceState | null>(null),
    [muted, setMuted] = useState(false),
    [error, setError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(false);
  const clearKeysRef = useRef(() => {});
  const localCarId = online?.localCarId ?? 0;
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const signature = JSON.stringify(customization);
  const togglePause = useCallback(() => {
    const race = raceRef.current;
    if (!race) return;
    if (online) {
      menuRef.current = !menuRef.current;
      setMenuOpen(menuRef.current);
      controlsRef.current = { ...emptyControls };
      touchPointers.current.clear();
      clearKeysRef.current();
      online.update({ ...emptyControls }, 0);
      return;
    }
    if (race.phase === 'racing' || race.phase === 'countdown') {
      race.phase = 'paused';
      controlsRef.current = { ...emptyControls };
      touchPointers.current.clear();
    } else if (race.phase === 'paused') {
      race.phase = race.countdown > 0 ? 'countdown' : 'racing';
    }
    setHud({ ...race, cars: race.cars.map((c) => ({ ...c, progress: { ...c.progress } })) });
  }, [online]);
  const restartRace = () => {
    controlsRef.current = { ...emptyControls };
    touchPointers.current.clear();
    if (online) {
      onRematch?.();
      return;
    }
    setRestart((n) => n + 1);
  };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const saved = JSON.parse(signature) as Customization;
    const race = online?.race ?? createRace(createTrack(trackId), saved.car, formatId);
    raceRef.current = race;
    setHud({ ...race });
    if (!online) race.cars[0].color = saved.color || getCarDesign(saved.car).color;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    element.appendChild(renderer.domElement);
    const world = createWorld(race.track),
      scene = world.scene;
    const modelCarIds = race.cars.map((car) => car.id);
    const models = race.cars.map((car, i) => {
      const model = createKart(
        online
          ? (online.roster.find((entry) => entry.id === car.id)?.customization ??
              car.customization ??
              {})
          : i
            ? {
                car: [2, 3, 4, 6, 9][i - 1],
                color: car.color,
                helmet: car.color,
                suit: i % 2 ? '#f6efdf' : '#3a4650',
              }
            : saved,
        i + 1,
      );
      scene.add(model);
      model.position.set(car.x, 0.2, car.z);
      model.rotation.y = car.heading;
      return model;
    });
    const pulseModels = online
      ? race.cars.map(() => {
          const mesh = world.pulse.clone();
          mesh.material = (world.pulse.material as THREE.MeshBasicMaterial).clone();
          mesh.visible = false;
          scene.add(mesh);
          return mesh;
        })
      : [];
    const localStyle =
      online?.roster.find((entry) => entry.id === localCarId)?.customization ?? saved;
    const trail = createTrailEffect(localStyle.trailStyle, localStyle.trail);
    scene.add(trail.object);
    const emitter = {
      x: 0,
      y: 0.3,
      z: 0,
      heading: 0,
      speed: 0,
      active: false,
      boosting: false,
      drifting: false,
    };
    const camera = new THREE.PerspectiveCamera(59, 1, 0.1, 700),
      cameraPosition = new THREE.Vector3(),
      cameraLook = new THREE.Vector3();
    const player = race.cars.find((car) => car.id === localCarId)!;
    let cameraHeading = player.heading;
    cameraPosition.set(
      player.x - Math.sin(cameraHeading) * 10.5,
      6.8,
      player.z - Math.cos(cameraHeading) * 10.5,
    );
    camera.position.copy(cameraPosition);
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const keys = new Set<string>();
    clearKeysRef.current = () => keys.clear();
    let audioContext: AudioContext | null = null,
      oscillator: OscillatorNode | null = null,
      gain: GainNode | null = null;
    const startAudio = () => {
      if (!audioContext) {
        try {
          audioContext = new AudioContext();
          oscillator = audioContext.createOscillator();
          oscillator.type = 'triangle';
          gain = audioContext.createGain();
          gain.gain.value = 0;
          const filter = audioContext.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 450;
          oscillator.connect(filter);
          filter.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start();
        } catch {
          /* Sound is optional on browsers without Web Audio. */
        }
      }
      if (audioContext?.state === 'suspended') void audioContext.resume();
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
          'ShiftLeft',
          'ShiftRight',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyE',
          'KeyR',
          'Escape',
          'KeyP',
        ].includes(e.code)
      ) {
        e.preventDefault();
        startAudio();
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        togglePause();
        return;
      }
      if (e.code === 'KeyR' && !e.repeat && race.phase === 'racing') {
        if (online) online.reset();
        else resetPlayer(race);
      }
      keys.add(e.code);
    };
    const keyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    const blur = () => {
      keys.clear();
      controlsRef.current = { ...emptyControls };
      touchPointers.current.clear();
      if (online) {
        menuRef.current = true;
        setMenuOpen(true);
        online.update({ ...emptyControls }, 0);
      } else if (race.phase === 'racing' || race.phase === 'countdown') {
        race.phase = 'paused';
        setHud({ ...race });
      }
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    const inputSurface = element.parentElement;
    inputSurface?.addEventListener('pointerdown', startAudio);
    let frame = 0,
      last = performance.now(),
      hudTime = 0,
      notified = false,
      disposed = false,
      visualTime = 0;
    const drawMap = () => {
      const canvas = minimap.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 210, 210);
      const scale = 0.48,
        ox = 105,
        oz = 107;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      race.track.points.forEach((p, i) => {
        if (!i) ctx.moveTo(ox + p.x * scale, oz + p.z * scale);
        else ctx.lineTo(ox + p.x * scale, oz + p.z * scale);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const start = race.track.points[0];
      ctx.fillStyle = '#fff';
      ctx.fillRect(ox + start.x * scale - 3, oz + start.z * scale - 4, 6, 8);
      [...race.cars]
        .reverse()
        .filter((car) => car.eliminatedAt === null && !car.didNotFinish)
        .forEach((car) => {
          ctx.beginPath();
          ctx.arc(
            ox + car.x * scale,
            oz + car.z * scale,
            car.id === localCarId ? 5 : 3.6,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = car.color;
          ctx.fill();
          if (car.id === localCarId) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
    };
    const animate = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const touch = controlsRef.current;
      const controls: Controls = {
        throttle:
          keys.has('ArrowUp') || keys.has('KeyW')
            ? 1
            : keys.has('ArrowDown') || keys.has('KeyS')
              ? -1
              : touch.throttle,
        // Positive world-Y yaw turns left when driving along the model's +Z axis.
        steer: -(
          (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
            (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0) || touch.steer
        ),
        brake: keys.has('ArrowDown') || keys.has('KeyS') || touch.brake,
        drift: keys.has('Space') || touch.drift,
        boost: keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.boost,
        power: keys.has('KeyE') || touch.power,
      };
      if (online) online.update(menuRef.current ? { ...emptyControls } : controls, dt);
      else stepRace(race, controls, dt);
      const moving = race.phase === 'racing' || race.phase === 'countdown';
      if (moving) visualTime += dt;
      for (let i = 0; i < models.length; i++) {
        const car = race.cars.find((car) => car.id === modelCarIds[i])!,
          model = models[i];
        model.visible = car.eliminatedAt === null && !car.didNotFinish;
        const blend =
          online && Math.hypot(model.position.x - car.x, model.position.z - car.z) <= 15
            ? Math.min(1, dt * 14)
            : 1;
        model.position.set(
          model.position.x + (car.x - model.position.x) * blend,
          0.2 + Math.sin(visualTime * 22 + i) * Math.min(0.025, car.speed * 0.0006),
          model.position.z + (car.z - model.position.z) * blend,
        );
        model.rotation.y += angleDifference(car.heading, model.rotation.y) * blend;
        model.rotation.z = -car.steer * Math.min(0.06, Math.abs(car.speed) * 0.002);
        // Ground projection stays level while the chassis leans and bounces.
        model.userData.glow.rotation.z = -model.rotation.z;
        model.userData.glow.position.y = 0.15 - model.position.y;
        model.userData.frontWheels.forEach((w) => (w.rotation.y = car.steer * 0.35));
        model.userData.driver.rotation.z = car.steer * 0.1;
        model.userData.exhaust.forEach((f, j) => {
          f.visible = car.boosting && race.phase === 'racing';
          f.scale.y = 0.7 + Math.sin(visualTime * 40 + j) * 0.3;
        });
        model.userData.shield.visible = car.shield > 0;
        updateUnderglow(model.userData.glow, visualTime);
      }
      emitter.x = player.x;
      emitter.z = player.z;
      emitter.heading = player.heading;
      emitter.speed = player.speed;
      emitter.active =
        race.phase === 'racing' &&
        player.speed > 8 &&
        Boolean(localStyle.trail || localStyle.trailStyle || player.drifting || player.boosting);
      emitter.boosting = player.boosting;
      emitter.drifting = player.drifting;
      if (race.phase !== 'paused') trail.update(dt, emitter);
      world.pickups.forEach((item, i) => {
        item.rotation.y = visualTime * 1.5 + i;
        item.position.y = 1.7 + Math.sin(visualTime * 2 + i) * 0.25;
        item.visible =
          format.pickups &&
          (player.pickupCooldown < 5.5 ||
            Math.hypot(item.position.x - player.x, item.position.z - player.z) > 18);
      });
      world.pulse.visible = !online && race.pulse > 0;
      if (!online && race.pulse > 0) {
        world.pulse.position.set(player.x, 0.3, player.z);
        world.pulse.scale.setScalar((1 - race.pulse) * 42 + 2);
        (world.pulse.material as THREE.MeshBasicMaterial).opacity = race.pulse * 0.6;
      }
      pulseModels.forEach((mesh, index) => {
        const pulse = race.pulses?.[index];
        mesh.visible = Boolean(pulse && pulse.remaining > 0);
        if (!pulse) return;
        mesh.position.set(pulse.x, 0.3, pulse.z);
        mesh.scale.setScalar((1 - pulse.remaining) * 42 + 2);
        (mesh.material as THREE.MeshBasicMaterial).opacity = pulse.remaining * 0.6;
      });
      const follow =
        online && (player.eliminatedAt !== null || player.didNotFinish)
          ? (rankCars(race.cars).find((car) => car.eliminatedAt === null && !car.didNotFinish) ??
            player)
          : player;
      cameraHeading +=
        angleDifference(follow.heading, cameraHeading) *
        Math.min(1, dt * (player.drifting ? 3.8 : 6));
      const distance = 10.6 + (follow.boosting ? 1 : 0);
      cameraPosition.set(
        follow.x - Math.sin(cameraHeading) * distance,
        6.7,
        follow.z - Math.cos(cameraHeading) * distance,
      );
      camera.position.lerp(cameraPosition, Math.min(1, dt * 9));
      cameraLook.set(
        follow.x + Math.sin(cameraHeading) * 11,
        1.9,
        follow.z + Math.cos(cameraHeading) * 11,
      );
      camera.lookAt(cameraLook);
      const fov = 59 + (follow.boosting ? 7 : 0);
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
      world.sun.position.set(follow.x - 90, 150, follow.z + 70);
      world.sun.target.position.set(follow.x, 0, follow.z);
      if (oscillator && gain && audioContext) {
        oscillator.frequency.setTargetAtTime(
          40 + Math.abs(player.speed) * 3.7,
          audioContext.currentTime,
          0.08,
        );
        gain.gain.setTargetAtTime(
          mutedRef.current || race.phase !== 'racing' ? 0 : 0.022 + Math.abs(player.speed) * 0.0004,
          audioContext.currentTime,
          0.1,
        );
      }
      renderer.render(scene, camera);
      hudTime += dt;
      if (hudTime > 0.075) {
        setHud({ ...race, cars: race.cars.map((c) => ({ ...c, progress: { ...c.progress } })) });
        drawMap();
        hudTime = 0;
      }
      const finalResult = online
        ? online.getResult()
        : race.phase === 'finished'
          ? getRaceResult(race)
          : null;
      if (finalResult && !notified) {
        notified = true;
        callbacks.current.onFinish(finalResult);
      }
      if (!disposed) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      controlsRef.current = { ...emptyControls };
      touchPointers.current.clear();
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      inputSurface?.removeEventListener('pointerdown', startAudio);
      if (audioContext) void audioContext.close();
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
      raceRef.current = null;
    };
  }, [trackId, formatId, restart, signature, togglePause, online, localCarId]);
  const setTouch =
    (control: keyof Controls, value: number | boolean) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      touchPointers.current.set(e.pointerId, { control, value });
      controlsRef.current = { ...controlsRef.current, [control]: value };
    };
  const releaseTouch =
    (control: keyof Controls, value: number | boolean) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      touchPointers.current.delete(e.pointerId);
      const held = [...touchPointers.current.values()]
        .filter((pointer) => pointer.control === control)
        .at(-1);
      controlsRef.current = { ...controlsRef.current, [control]: held?.value ?? value };
    };
  const touchProps = (control: keyof Controls, on: number | boolean, off: number | boolean) => ({
    onPointerDown: setTouch(control, on),
    onPointerUp: releaseTouch(control, off),
    onPointerCancel: releaseTouch(control, off),
    onLostPointerCapture: releaseTouch(control, off),
  });
  const player = hud?.cars.find((car) => car.id === localCarId),
    phase = hud?.phase || 'countdown';
  const result = online ? online.getResult() : hud ? getRaceResult(hud) : null;
  const position = online && hud ? getCarPosition(hud, localCarId) : hud?.position || 1;
  const solo = format.opponents === 0;
  const activeCount =
    hud?.cars.filter((car) => car.eliminatedAt === null && !car.didNotFinish).length ??
    format.opponents + 1;
  const remaining = Math.max(0, (format.duration ?? 0) - (hud?.time ?? 0));
  const untilElimination = Math.max(
    0,
    (hud?.nextEliminationAt ?? format.eliminationInterval ?? 0) - (hud?.time ?? 0),
  );
  return (
    <div
      className={`race-screen race-${trackId} ${format.laps === null ? 'race-timed' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="race-canvas"
        ref={host}
        role="img"
        aria-label={`${hud?.track.name || 'Kart'} 3D-гонка. Управляй клавишами W A S D или стрелками.`}
      />
      <div className="race-vignette" />
      {online && (
        <div className="race-online-status" role="status">
          {online.connectionState === 'connected'
            ? 'ОНЛАЙН'
            : online.connectionState === 'reconnecting' || online.connectionState === 'connecting'
              ? 'ВОССТАНАВЛИВАЕМ СВЯЗЬ…'
              : 'СВЯЗЬ ПОТЕРЯНА'}
          {format.laps && online.finishDeadline !== null && !result && (
            <span>
              До конца: {Math.max(0, Math.ceil(online.finishDeadline - (hud?.time ?? 0)))} с
            </span>
          )}
          {online &&
            !result &&
            (player?.eliminatedAt != null || player?.didNotFinish || player?.progress.finished) && (
              <span>Ожидаем итогов гонки</span>
            )}
        </div>
      )}
      <header className="race-topbar">
        <div className="race-lap">
          <span className="race-eyebrow">
            {format.laps ? 'КРУГ' : format.eliminationInterval ? 'ДО ВЫБЫВАНИЯ' : 'ОСТАЛОСЬ'}
          </span>
          <strong>
            {format.laps ? (
              <>
                {Math.min(format.laps, Math.floor((player?.progress.checkpoints || 0) / 16) + 1)}
                <small>/ {format.laps}</small>
              </>
            ) : (
              formatTime(format.eliminationInterval ? untilElimination : remaining)
            )}
          </strong>
          <div className="race-clock">
            {solo
              ? `ЛУЧШИЙ КРУГ: ${player?.bestLap == null ? '—' : formatTime(player.bestLap)}`
              : format.eliminationInterval
                ? `В ГОНКЕ: ${activeCount}`
                : format.id === 'endurance'
                  ? `ДИСТАНЦИЯ: ${Math.round(result?.distance ?? 0)} м`
                  : formatTime(hud?.time || 0)}
          </div>
        </div>
        <div className="race-track-label">
          <span className="race-live-dot" /> {hud?.track.name || 'ЛАЗУРНЫЙ БЕРЕГ'}{' '}
          <span className="race-track-divider">/</span>
          <span>{format.name}</span>
        </div>
        <div className="race-tools">
          <button
            title={muted ? 'Включить звук' : 'Выключить звук'}
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}
            onClick={() => setMuted((v) => !v)}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button
            title={online ? 'Меню (Esc)' : 'Пауза (Esc)'}
            aria-label={online ? 'Меню' : 'Пауза'}
            onClick={togglePause}
          >
            <Pause size={19} />
          </button>
          <button title="Выйти из гонки" aria-label="Выйти из гонки" onClick={onExit}>
            <X size={19} />
          </button>
        </div>
      </header>
      {!solo && (
        <aside className="race-standings">
          <div className="race-position">
            <strong>{position}</strong>
            <span>
              / {hud?.cars.length ?? format.opponents + 1}
              <small>ПОЗИЦИЯ</small>
            </span>
          </div>
          {hud &&
            rankCars(hud.cars).map((car, i) => (
              <div
                className={`race-standing ${car.id === localCarId ? 'is-you' : ''} ${car.eliminatedAt !== null ? 'is-eliminated' : ''}`}
                key={car.id}
              >
                <span>{i + 1}</span>
                <i style={{ background: car.color }} />
                <b>{car.name}</b>
                <small>
                  {online?.roster.find((entry) => entry.id === car.id)?.kind === 'bot' && (
                    <em className="race-ai-badge">AI</em>
                  )}
                  {car.eliminatedAt !== null
                    ? 'ВЫБЫЛ'
                    : car.didNotFinish
                      ? 'DNF'
                      : car.id === localCarId
                        ? 'ТЫ'
                        : car.finishTime
                          ? 'ФИН'
                          : online
                            ? ''
                            : 'БОТ'}
                </small>
              </div>
            ))}
        </aside>
      )}
      <div className="race-minimap">
        <canvas
          ref={minimap}
          width={210}
          height={210}
          aria-label="Карта трассы и позиции гонщиков"
        />
        <span>
          <i /> ТЫ{' '}
          {!solo && (
            <>
              <span>●</span> СОПЕРНИКИ
            </>
          )}
        </span>
      </div>
      {player && (
        <>
          {format.pickups && (
            <div className={`race-power ${player.item ? 'has-power' : ''}`}>
              <button
                onClick={() => {
                  controlsRef.current.power = true;
                  setTimeout(() => {
                    controlsRef.current.power = false;
                  }, 100);
                }}
                disabled={!player.item || phase !== 'racing'}
                title="Использовать бонус (E)"
              >
                <PowerIcon power={player.item} />
                {player.item && <kbd>E</kbd>}
              </button>
              <div>
                <span>{player.item ? 'БОНУС ГОТОВ' : 'СОБИРАЙ БОНУСЫ'}</span>
                <strong>{player.item ? powerNames[player.item] : 'СЕКРЕТНЫЙ БОКС'}</strong>
              </div>
            </div>
          )}
          <div className="race-boost">
            <div className="race-boost-label">
              <Zap size={13} />
              <b>{player.drifting ? 'ЗАРЯД ДРИФТА' : player.boosting ? 'ПОЛНЫЙ ГАЗ!' : 'НИТРО'}</b>
              <kbd>SHIFT</kbd>
            </div>
            <div className="race-boost-track">
              <div style={{ width: `${player.boost}%` }} />
            </div>
            {player.drifting && (
              <div className="race-drift-bar">
                <div style={{ width: `${(player.driftCharge / 1.6) * 100}%` }} />
              </div>
            )}
          </div>
          <div className={`race-speed ${player.boosting ? 'is-boosting' : ''}`}>
            <div className="race-speed-ticks">╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱</div>
            <strong>
              {Math.round(Math.abs(player.speed) * 3.6)
                .toString()
                .padStart(3, '0')}
            </strong>
            <span>КМ/Ч</span>
            <div>
              <Gauge size={13} />
              {player.offroad
                ? 'ОБОЧИНА'
                : player.drifting
                  ? 'ДРИФТ'
                  : player.boosting
                    ? 'УСКОРЕНИЕ'
                    : 'ЖМИ НА ГАЗ'}
            </div>
          </div>
        </>
      )}
      <div className="race-key-hints">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> Ехать
        </span>
        <span>
          <kbd>SPACE</kbd> Дрифт
        </span>
        <span>
          <kbd>R</kbd> На трассу
        </span>
        <span>
          <kbd>ESC</kbd> {online ? 'Меню' : 'Пауза'}
        </span>
      </div>
      <button
        className="race-reset-button"
        title="Вернуть карт на трассу (R)"
        aria-label="Вернуть карт на трассу"
        onClick={() => {
          if (raceRef.current?.phase === 'racing') {
            if (online) online.reset();
            else resetPlayer(raceRef.current);
          }
        }}
      >
        <RotateCcw size={16} />
        <span>НА ТРАССУ</span>
      </button>
      <div className="race-touch">
        <div className="race-touch-steer">
          <button aria-label="Поворот налево" {...touchProps('steer', -1, 0)}>
            <ArrowLeft />
          </button>
          <button aria-label="Поворот направо" {...touchProps('steer', 1, 0)}>
            <ArrowRight />
          </button>
        </div>
        <div className="race-touch-drive">
          <button
            className="race-touch-brake"
            aria-label="Тормоз и задний ход"
            {...touchProps('throttle', -1, 0)}
          >
            ТОРМОЗ
          </button>
          <button className="race-touch-drift" {...touchProps('drift', true, false)}>
            ДРИФТ
          </button>
          <button
            className="race-touch-boost"
            aria-label="Нитро"
            {...touchProps('boost', true, false)}
          >
            <Zap />
          </button>
          <button className="race-touch-gas" aria-label="Газ" {...touchProps('throttle', 1, 0)}>
            <ArrowUp />
          </button>
        </div>
      </div>
      {phase === 'countdown' && hud && (
        <div className="race-countdown" aria-live="assertive">
          <span>ГОТОВ ДАТЬ ГАЗУ?</span>
          <strong key={Math.ceil(hud.countdown)}>
            {Math.ceil(hud.countdown) > 3 ? 'ГОТОВ?' : Math.ceil(hud.countdown)}
          </strong>
          <p>
            Зажми <kbd>W</kbd> или <kbd>↑</kbd> — и вперёд
          </p>
        </div>
      )}
      {phase === 'racing' && hud && hud.time < 1 && <div className="race-go">ГАЗ!</div>}
      {(online ? menuOpen && !result : phase === 'paused') && (
        <div className="race-overlay">
          <div className="race-modal">
            <div className="race-modal-icon">
              <Pause />
            </div>
            <span className="race-eyebrow">МОЖНО ВЫДОХНУТЬ</span>
            <h1>
              {online ? 'Меню' : 'Пауза'}
              <span>.</span>
            </h1>
            <p>{online ? 'Гонка продолжается' : 'Трасса подождёт. Продолжим?'}</p>
            <button className="race-primary" onClick={togglePause}>
              <Play size={18} />
              ВЕРНУТЬСЯ В ГОНКУ
            </button>
            <button className="race-secondary" onClick={restartRace}>
              <RotateCcw size={17} />
              {online ? 'Найти другую гонку' : 'Начать заново'}
            </button>
            <button className="race-text-button" onClick={onExit}>
              <Home size={16} />В паддок
            </button>
            <small>Нажми ESC, чтобы продолжить</small>
          </div>
        </div>
      )}
      {(online ? Boolean(result) : phase === 'finished') && hud && (
        <div className="race-overlay">
          <div className="race-modal race-results">
            <div className="race-modal-icon">{solo ? <Flag /> : <Trophy />}</div>
            <span className="race-eyebrow">
              {solo
                ? 'ТАЙМ-АТАКА ЗАВЕРШЕНА'
                : result?.didNotFinish
                  ? 'ГОНКА НЕ ЗАВЕРШЕНА'
                  : result?.eliminated
                    ? 'ТЫ ВЫБЫЛ ИЗ ГОНКИ'
                    : position === 1
                      ? 'ВОТ ЭТО ПОБЕДА'
                      : 'ФИНИШНАЯ ЧЕРТА ПОЗАДИ'}
            </span>
            <h1>
              {solo ? (
                result?.bestLap == null ? (
                  'Нет полного круга.'
                ) : (
                  'Круг засчитан.'
                )
              ) : (
                <>
                  {ordinal(result?.position ?? position)}
                  <span> место.</span>
                </>
              )}
            </h1>
            <p>
              {solo
                ? result?.bestLap == null
                  ? 'Заверши полный круг в следующей попытке, чтобы получить время.'
                  : 'Твой лучший полный круг сохранён. Попробуем быстрее?'
                : result?.didNotFinish
                  ? 'Ты не завершил заезд до его окончания.'
                  : result?.eliminated
                    ? 'Последняя позиция на отсечке. Попробуй удержаться в следующем заезде.'
                    : position === 1
                      ? 'Каждый поворот был твоим. Отличный заезд!'
                      : 'Ещё один заезд? Следующая победа может быть твоей.'}
            </p>
            <div className="race-results-stats">
              <div>
                <span>ФОРМАТ</span>
                <strong>{format.name}</strong>
              </div>
              {solo && (
                <div>
                  <span>ЛУЧШИЙ КРУГ</span>
                  <strong>
                    {result?.bestLap == null ? 'Нет полного круга' : formatTime(result.bestLap)}
                  </strong>
                </div>
              )}
              {format.laps === null && (
                <div>
                  <span>ПОЛНЫЕ КРУГИ</span>
                  <strong>{result?.completedLaps ?? 0}</strong>
                </div>
              )}
              {format.id === 'endurance' && (
                <div>
                  <span>ДИСТАНЦИЯ</span>
                  <strong>{Math.round(result?.distance ?? 0)} м</strong>
                </div>
              )}
              <div>
                <span>ВРЕМЯ ГОНКИ</span>
                <strong>{formatTime(hud.time)}</strong>
              </div>
              <div>
                <span>ТРАССА</span>
                <strong>{hud.track.name}</strong>
              </div>
            </div>
            {online && (
              <ol className="race-online-results" aria-label="Итоги гонки">
                {[...(online.getResults() ?? [])]
                  .sort((a, b) => a.result.position - b.result.position)
                  .map(({ carId, result: entry }) => {
                    const driver = online.roster.find((driver) => driver.id === carId);
                    return (
                      <li key={carId}>
                        <span>
                          {entry.position}. {driver?.name ?? `Гонщик ${carId + 1}`}
                        </span>
                        {carId === localCarId && <small>ТЫ</small>}
                        {driver?.kind === 'bot' && <small>AI</small>}
                        <b>
                          {entry.didNotFinish
                            ? 'DNF'
                            : entry.eliminated
                              ? 'ВЫБЫЛ'
                              : formatTime(entry.time)}
                        </b>
                      </li>
                    );
                  })}
              </ol>
            )}
            <button className="race-primary" onClick={restartRace}>
              <Flag size={18} />
              ЕЩЁ ОДИН ЗАЕЗД
            </button>
            <button className="race-secondary" onClick={onExit}>
              <Home size={17} />В паддок
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="race-overlay">
          <div className="race-modal">
            <h1>Давай вернёмся на трассу.</h1>
            <p>Браузер не запустил 3D-сцену. Включи аппаратное ускорение и попробуй снова.</p>
            <button className="race-primary" onClick={onExit}>
              В ГАРАЖ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default Race;
