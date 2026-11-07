import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { disposeScene } from './kart';
import { createGarageScene } from './garage';
import { frameObject } from './framing';
import type { Customization } from './types';

export function KartPreview({
  customization = {},
  className = '',
  focus,
}: {
  customization?: Customization;
  className?: string;
  focus?: 'decor' | 'helmet' | 'suit';
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
    const { scene, kart, decor } = createGarageScene(config);
    const equipmentFocus = focus === 'helmet' || focus === 'suit';
    const subject =
      focus === 'decor'
        ? decor
        : focus === 'helmet'
          ? kart.userData.driver.getObjectByName('driver-helmet')
          : focus === 'suit'
            ? kart.userData.driver
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
          equipmentFocus ? 1.45 : 1.35,
          // View the buggy's driver through the opening below its overhead crossbar.
          equipmentFocus
            ? [0.3, focus === 'helmet' && config.car === 3 ? -0.35 : 0.12, 1.5]
            : undefined,
        );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    let frame = 0,
      last = performance.now();
    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!equipmentFocus) kart.rotation.y += dt * 0.19;
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
            : 'Твой карт и мастерская в 3D'
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
