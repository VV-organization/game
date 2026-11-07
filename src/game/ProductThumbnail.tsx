import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createGarageScene } from './garage';
import { createKart, disposeScene } from './kart';
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
    [product.category]: colorCategories.has(product.category) ? product.color : product.variant,
  };
  const workshop = product.category === 'garage' || product.category === 'decor';
  const { scene, kart } = workshop ? createGarageScene(config) : studioScene(config);
  const camera = new THREE.PerspectiveCamera(workshop ? 38 : 35, 4 / 3, 0.1, 80);
  camera.position.set(workshop ? 8.6 : 5.8, workshop ? 5.4 : 3.5, workshop ? 10 : 6.8);
  camera.lookAt(0, workshop ? 1.1 : 1.0, 0);
  if (product.category === 'plate') {
    camera.position.set(-5.4, 2.9, -6.4);
    camera.lookAt(0, 0.95, 0);
  }
  if (['helmet', 'suit', 'windowTint'].includes(product.category)) {
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
  if (config.underglow) {
    const glowLight = new THREE.PointLight(config.underglow, 3, 4, 1.5);
    glowLight.position.set(0, 0.25, 0);
    scene.add(glowLight);
  }
  if (product.category === 'trail') {
    kart.userData.exhaust.forEach((flame) => {
      flame.visible = true;
    });
    camera.position.set(-5.6, 3.4, -6.8);
    camera.lookAt(0, 0.8, -0.6);
    // A still of the same colored sparkles emitted behind a moving kart in Race.
    const geometry = new THREE.IcosahedronGeometry(0.16, 0);
    const material = new THREE.MeshBasicMaterial({
      color: product.color,
      transparent: true,
      opacity: 0.7,
    });
    for (let i = 0; i < 18; i++) {
      const spark = new THREE.Mesh(geometry, material);
      spark.position.set((i % 2 ? -1 : 1) * (0.7 + i * 0.012), 0.3 + i * 0.035, -1.7 - i * 0.13);
      spark.scale.setScalar(1 - i * 0.035);
      scene.add(spark);
    }
  }
  try {
    engine.setClearColor(workshop ? '#253849' : '#000000', workshop ? 1 : 0);
    engine.render(scene, camera);
    return engine.domElement.toDataURL('image/webp', 0.88);
  } catch {
    return null;
  } finally {
    // The cached result is an ordinary image; the model and GPU resources are released.
    scene.traverse((object) => {
      if (object instanceof THREE.Light && 'shadow' in object) object.shadow?.dispose();
    });
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
