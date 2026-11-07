import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createGarageScene } from './garage';
import { createKart, disposeScene } from './kart';
import { createDecor } from './decor';
import { frameObject } from './framing';
import { createHelmet } from './helmets';
import { createRacingSuit } from './racing-suits';
import { createNumberPlate } from './number-plates';
import { updateUnderglow } from './underglow';
import { createEffectStudio, studioEmitter } from './effect-studio';
import type { Customization } from './types';

export type ThumbnailProduct = { category: string; color: string; variant: number; name: string };
const supported = new Set([
  'car',
  'body',
  'wheels',
  'color',
  'helmet',
  'suit',
  'plate',
  'decal',
  'underglow',
  'windowTint',
  'trail',
  'garage',
  'decor',
]);
const colorCategories = new Set(['color', 'helmet', 'suit', 'underglow', 'windowTint', 'trail']);
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
const queue: Array<() => void> = [];
let renderer: THREE.WebGLRenderer | null = null;
let scheduled = false;
let failed = false;

function sharedRenderer() {
  if (renderer) return renderer;
  if (failed) return null;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(480, 360);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      renderer?.dispose();
      renderer = null;
      failed = true;
    });
    return renderer;
  } catch {
    failed = true;
    return null;
  }
}

function processQueue() {
  // One render per frame keeps scrolling responsive and uses a single GPU context.
  scheduled = false;
  const job = queue.shift();
  job?.();
  if (queue.length) {
    scheduled = true;
    requestAnimationFrame(processQueue);
  }
}

function studioScene(config: Customization) {
  const scene = new THREE.Scene();
  const kart = createKart(config);
  scene.add(kart);
  scene.add(new THREE.HemisphereLight('#fff8ec', '#697f99', 1.8));
  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 25 });
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#b1d4ff', 1.8);
  rim.position.set(4, 3, -5);
  scene.add(rim);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 2.9, 0.1, 48),
    new THREE.MeshStandardMaterial({ color: '#3c465d', roughness: 0.83 }),
  );
  base.position.y = -0.07;
  base.receiveShadow = true;
  scene.add(base);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.14;
  ground.receiveShadow = true;
  scene.add(ground);
  return { scene, kart };
}

function renderProduct(product: ThumbnailProduct, customization?: Customization): string | null {
  const engine = sharedRenderer();
  if (!engine) return null;
  const config: Customization = customization || {
    ...(product.category === 'decal' ? { car: 1, color: '#253747' } : {}),
    [product.category]: colorCategories.has(product.category) ? product.color : product.variant,
    ...(['helmet', 'suit', 'underglow', 'trail'].includes(product.category)
      ? { [`${product.category}Style`]: product.variant }
      : {}),
  };
  const workshop = product.category === 'garage';
  const isolated =
    product.category === 'decor'
      ? createDecor(product.variant)
      : product.category === 'helmet'
        ? createHelmet(product.variant, product.color)
        : product.category === 'suit'
          ? createRacingSuit(product.variant, product.color, 'display')
          : product.category === 'plate'
            ? createNumberPlate(product.variant)
            : null;
  if (product.category === 'decor' && !isolated) return null;
  const effects = product.category === 'underglow' || product.category === 'trail';
  const effectStudio = effects ? createEffectStudio(config, product.category === 'trail') : null;
  const { scene, kart } = isolated
    ? { scene: new THREE.Scene(), kart: null }
    : workshop
      ? createGarageScene(config)
      : effectStudio || studioScene(config);
  const camera = new THREE.PerspectiveCamera(workshop ? 38 : 35, 4 / 3, 0.1, 80);
  camera.position.set(workshop ? 8.6 : 5.8, workshop ? 5.4 : 3.5, workshop ? 10 : 6.8);
  camera.lookAt(0, workshop ? 1.1 : 1.0, 0);
  if (isolated) {
    // Ground the product itself; the catalog uses the same model as the driver/garage.
    isolated.position.y -= new THREE.Box3().setFromObject(isolated).min.y;
    scene.add(isolated);
    scene.add(new THREE.HemisphereLight('#fff7ed', '#61738e', 2.1));
    const key = new THREE.DirectionalLight('#ffffff', 3.2);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    Object.assign(key.shadow.camera, {
      left: -4,
      right: 4,
      top: 5,
      bottom: -3,
      near: 0.1,
      far: 20,
    });
    key.shadow.bias = -0.001;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#adcaff', 2);
    rim.position.set(4, 4, -4);
    scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.25 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);
    frameObject(camera, isolated);
  }
  if (product.category === 'plate') {
    if (isolated) frameObject(camera, isolated, 1.22, [0.25, 0.12, 2]);
  }
  if (product.category === 'windowTint') {
    camera.position.set(3.5, 2.9, 4.8);
    camera.lookAt(0, 1.35, 0.05);
  }
  if (product.category === 'wheels') {
    camera.position.set(6.2, 2.6, 5.6);
    camera.lookAt(0, 0.85, 0);
  }
  if (product.category === 'body') {
    camera.position.set(5, 3.2, 6.4);
    camera.lookAt(0, 1.05, 0);
  }
  if (product.category === 'decal') {
    camera.position.set(4.7, 4.7, 5.8);
    camera.lookAt(0, 1, 0.15);
  }
  if (effectStudio) {
    updateUnderglow(effectStudio.kart.userData.glow, 1.25);
    if (effectStudio.trail) {
      const emitter = studioEmitter();
      for (let i = 0; i < 100; i++) effectStudio.trail.update(1 / 60, emitter);
      camera.fov = 40;
      camera.updateProjectionMatrix();
      camera.position.set(5.6, 5.8, -8.6);
      camera.lookAt(0, 0.65, -2.2);
    } else {
      camera.position.set(4.4, 5.7, 5.4);
      camera.lookAt(0, 0.45, 0);
    }
  }
  try {
    engine.setClearColor(
      workshop ? '#253849' : effects ? '#101725' : '#000000',
      workshop || effects ? 1 : 0,
    );
    engine.render(scene, camera);
    return engine.domElement.toDataURL('image/webp', 0.88);
  } catch {
    return null;
  } finally {
    // The cached result is an ordinary image; the model and GPU resources are released.
    disposeScene(scene);
    engine.renderLists.dispose();
  }
}

function getThumbnail(
  product: ThumbnailProduct,
  key: string,
  customization?: Customization,
): Promise<string | null> {
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = new Promise<string | null>((resolve) => {
    queue.push(() => {
      let result: string | null = null;
      try {
        result = renderProduct(product, customization);
      } catch {
        /* Keep the existing icon if this render is unavailable. */
      }
      if (result) cache.set(key, result);
      pending.delete(key);
      resolve(result);
    });
  });
  pending.set(key, promise);
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(processQueue);
  }
  return promise;
}

export function ProductThumbnail({
  product,
  customization,
}: {
  product: ThumbnailProduct;
  customization?: Customization;
}) {
  const host = useRef<HTMLDivElement>(null);
  const key = `${product.category}:${product.variant}:${product.color}:${JSON.stringify(customization || {})}`;
  const [image, setImage] = useState<{ key: string; src: string } | null>(() => {
    const src = cache.get(key);
    return src ? { key, src } : null;
  });
  const canRender =
    supported.has(product.category) || (product.category === 'bundle' && !!customization);
  useEffect(() => {
    const element = host.current;
    if (!element || !canRender) return;
    let active = true;
    const load = () => {
      void getThumbnail(product, key, customization).then((src) => {
        if (active && src) setImage({ key, src });
      });
    };
    if (cache.has(key) || !('IntersectionObserver' in window)) {
      load();
      return () => {
        active = false;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '160px 0px', threshold: 0.01 },
    );
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [key, canRender]);
  if (!canRender) return null;
  return (
    <div
      ref={host}
      className="product-thumbnail"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {image?.key === key && (
        <img
          src={image.src}
          alt={product.name}
          decoding="async"
          draggable={false}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
    </div>
  );
}
export default ProductThumbnail;
