import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { disposeScene } from './kart';
import { createGarageScene } from './garage';
import { frameObject } from './framing';
import { updateUnderglow } from './underglow';
import { createEffectStudio, studioEmitter } from './effect-studio';
import type { Customization } from './types';

export function KartPreview({
  customization = {},
  className = '',
  focus,
}: {
  customization?: Customization;
  className?: string;
  focus?: 'decor' | 'helmet' | 'suit' | 'plate' | 'decal' | 'underglow' | 'trail';
}) {
  const host = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const signature = JSON.stringify(customization);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    Object.assign(renderer.domElement.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      position: 'absolute',
      inset: '0',
    });
    element.appendChild(renderer.domElement);
    const config = JSON.parse(signature) as Customization;
    const effectsFocus = focus === 'underglow' || focus === 'trail';
    const stage = effectsFocus ? createEffectStudio(config, focus === 'trail') : null;
    const { scene, kart, decor } = stage ? { ...stage, decor: null } : createGarageScene(config);
    const emitter = studioEmitter();
    if (stage?.trail) for (let i = 0; i < 100; i++) stage.trail.update(1 / 60, emitter);
    if (effectsFocus) renderer.toneMappingExposure = 1.05;
    const equipmentFocus = focus === 'helmet' || focus === 'suit';
    const subject =
      focus === 'decor'
        ? decor
        : focus === 'helmet'
          ? kart.userData.driver.getObjectByName('driver-helmet')
          : focus === 'suit'
            ? kart.userData.driver
            : focus === 'plate'
              ? kart.getObjectByName('number-plate')
              : null;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    camera.position.set(6.6, 4.2, 7.5);
    camera.lookAt(0, 1.05, 0);
    let renderedWidth = 0,
      renderedHeight = 0;
    const resize = () => {
      const width = element.clientWidth,
        height = element.clientHeight;
      if (!width || !height || (width === renderedWidth && height === renderedHeight)) return;
      renderedWidth = width;
      renderedHeight = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (subject)
        frameObject(
          camera,
          subject,
          equipmentFocus ? 1.45 : focus === 'plate' ? 2 : focus === 'decal' ? 1.12 : 1.25,
          // View the buggy's driver through the opening below its overhead crossbar.
          equipmentFocus
            ? [0.3, focus === 'helmet' && config.car === 3 ? -0.35 : 0.12, 1.5]
            : focus === 'plate'
              ? [0.15, 0.14, -1.5]
              : focus === 'decal'
                ? [1, 1.05, 1.2]
                : focus === 'underglow'
                  ? [0.85, 1.1, 1]
                  : undefined,
        );
      if (focus === 'trail') {
        const distance = Math.max(1, 1.25 / camera.aspect);
        camera.position.set(5.6 * distance, 5.8 * distance, -1.8 - 6.8 * distance);
        camera.lookAt(0, 0.65, -1.8);
      }
      if (focus === 'underglow' || focus === 'decal') {
        // Inspect the visible car/light footprint, excluding hidden shield and boost meshes.
        const distance = Math.max(1, 1.25 / camera.aspect);
        camera.position.set(
          (focus === 'underglow' ? 4.4 : 4) * distance,
          (focus === 'underglow' ? 5.7 : 3.8) * distance,
          (focus === 'underglow' ? 5.4 : 5) * distance,
        );
        camera.lookAt(0, focus === 'underglow' ? 0.45 : 0.9, 0);
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    let frame = 0,
      last = performance.now(),
      visualTime = 1.25;
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      visualTime += dt;
      if (!equipmentFocus && !effectsFocus && focus !== 'plate' && focus !== 'decal')
        kart.rotation.y += dt * 0.19;
      updateUnderglow(kart.userData.glow, visualTime);
      stage?.trail?.update(dt, emitter);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [signature, focus]);
  return (
    <div
      ref={host}
      className={className}
      aria-label={
        focus === 'decor'
          ? 'Декор в твоей мастерской в 3D'
          : focus === 'helmet' || focus === 'suit'
            ? 'Экипировка твоего гонщика в 3D'
            : effectsFocusLabel(focus)
      }
      style={{ width: '100%', height: '100%', minHeight: 200, position: 'relative' }}
    >
      {unavailable && (
        <div
          role="status"
          style={{
            height: '100%',
            minHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            background: '#253849',
          }}
        >
          <img
            src="/assets/reference/fapix-hero.png"
            alt="Гоночный карт FApix"
            style={{ width: '55%', maxHeight: 190, objectFit: 'contain' }}
          />
          <strong style={{ fontSize: 15, color: '#f5f1e8', marginTop: 12 }}>
            3D-предпросмотр недоступен
          </strong>
          <p style={{ fontSize: 11, color: '#bac8cd', maxWidth: 280, marginTop: 8 }}>
            Включи аппаратное ускорение браузера, чтобы увидеть свой карт и гараж в 3D.
          </p>
        </div>
      )}
    </div>
  );
}
export default KartPreview;

function effectsFocusLabel(focus?: string) {
  return focus === 'trail'
    ? 'Анимация эффекта за твоим картом в 3D'
    : focus === 'underglow'
      ? 'Подсветка твоего карта в 3D'
      : focus === 'plate'
        ? 'Номер на твоём карте в 3D'
        : 'Твой карт и мастерская в 3D';
}
