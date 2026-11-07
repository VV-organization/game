// Local visual fixture; all geometry and product thumbnails come from production builders.
import { createElement as h, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { ProductThumbnail } from '../../src/game/ProductThumbnail';
import { KartPreview } from '../../src/game/KartPreview';
import { createDecor } from '../../src/game/decor';
import { disposeScene } from '../../src/game/kart';
import { frameObject } from '../../src/game/framing';
import { products } from '../../server/catalog';

const params = new URLSearchParams(location.search);
const page = params.get('page') === '2' ? 2 : 1;
const gray = params.get('gray') === '1';
const decor = Math.max(1, Math.min(20, Number(params.get('decor')) || 1));
const garage = Math.max(0, Math.min(10, Number(params.get('garage')) || 0));
const href = (values: Record<string, string | number>) => {
  const next = new URLSearchParams(location.search);
  Object.entries(values).forEach(([key, value]) => next.set(key, String(value)));
  return `?${next}`;
};

function neutralShots(variants: number[]) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(480, 360);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const shots = variants.map((variant) => {
    const scene = new THREE.Scene();
    const object = createDecor(variant)!;
    scene.add(object);
    const originals = new Set<THREE.Material>();
    const neutral = new THREE.MeshStandardMaterial({
      color: '#b5bcc8',
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    object.traverse((part) => {
      if (part instanceof THREE.Mesh) {
        for (const material of Array.isArray(part.material) ? part.material : [part.material])
          originals.add(material);
        part.material = neutral;
      }
    });
    scene.add(new THREE.HemisphereLight('#ffffff', '#59677d', 2));
    const light = new THREE.DirectionalLight('#ffffff', 3);
    light.position.set(-3, 6, 5);
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 80);
    frameObject(camera, object);
    renderer.render(scene, camera);
    const result = renderer.domElement.toDataURL('image/png');
    for (const material of originals) material.dispose();
    disposeScene(scene);
    return result;
  });
  renderer.dispose();
  return shots;
}

function Review() {
  const [focus, setFocus] = useState(params.get('focus') !== '0');
  const [shots, setShots] = useState<string[]>([]);
  const variants = [page === 1 ? 1 : 3, page === 1 ? 2 : 4].flatMap((kind) =>
    Array.from({ length: 5 }, (_, i) => kind + i * 4),
  );
  useEffect(() => {
    if (gray && params.get('mode') !== 'garage') setShots(neutralShots(variants));
  }, []);
  if (params.get('mode') === 'garage')
    return h(
      'div',
      null,
      h(
        'div',
        { className: 'controls' },
        h('a', { href: href({ mode: 'catalog' }) }, 'К каталогу'),
        h(
          'button',
          { onClick: () => setFocus(!focus) },
          focus ? 'Показать весь гараж' : 'Рассмотреть декор',
        ),
        h(
          'a',
          { href: href({ garage: garage ? 0 : 6 }) },
          garage ? 'Стандартный гараж' : 'Гараж Pro',
        ),
      ),
      h('h1', null, products.find((p) => p.category === 'decor' && p.variant === decor)?.name),
      h(
        'div',
        { className: 'garage' },
        h(KartPreview, { customization: { decor, garage }, focus: focus ? 'decor' : undefined }),
      ),
    );
  return h(
    'div',
    null,
    h(
      'header',
      null,
      h(
        'h1',
        null,
        `${page === 1 ? 'Кубки и ящики' : 'Флаги и пальмы'} · ${gray ? 'нейтральные материалы' : 'заводские материалы'}`,
      ),
      h(
        'nav',
        null,
        ...[
          ['Кубки / ящики', { page: 1 }],
          ['Флаги / пальмы', { page: 2 }],
          ['Цвет', { gray: 0 }],
          ['Без цвета', { gray: 1 }],
        ].map(([label, values]) =>
          h('a', { href: href(values as Record<string, number>) }, label as string),
        ),
      ),
    ),
    h(
      'main',
      null,
      ...variants.map((variant, index) => {
        const product = products.find((p) => p.category === 'decor' && p.variant === variant)!;
        return h(
          'article',
          { key: variant },
          h(
            'div',
            { className: 'art' },
            gray
              ? shots[index] && h('img', { src: shots[index], alt: product.name })
              : h(ProductThumbnail, { product }),
          ),
          h(
            'div',
            { className: 'copy' },
            h('h2', null, product.name),
            h('p', null, product.description),
            h('a', { href: href({ mode: 'garage', decor: variant }) }, 'Примерка'),
          ),
        );
      }),
    ),
  );
}
createRoot(document.getElementById('root')!).render(h(Review));
