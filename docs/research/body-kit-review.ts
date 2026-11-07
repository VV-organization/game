// Local diagnostic fixture. Every image is the actual createKart model used by the game.
import { createElement as h, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { createKart, disposeScene } from '../../src/game/kart';
import { ProductThumbnail } from '../../src/game/ProductThumbnail';
import { KartPreview } from '../../src/game/KartPreview';
import { Race } from '../../src/game/Race';
import { products } from '../../server/catalog';
import { getCarDesign } from '../../src/shared/car-designs';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'catalog';
document.body.dataset.mode = mode;
const car = Math.max(0, Math.min(10, Number(params.get('car')) || 0));
const body = Math.max(0, Math.min(20, Number(params.get('body') ?? 1) || 0));
const start = params.get('start') === '11' ? 11 : 1;
const rear = params.get('rear') === '1';
const gray = params.get('gray') === '1';
const root = createRoot(document.getElementById('root')!);
const href = (values: Record<string, string | number>) => {
  const next = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(values)) next.set(key, String(value));
  return `?${next}`;
};

function renderSheet(entries: { car: number; body: number }[]) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(480, 360);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const shots = entries.map((entry) => {
    const scene = new THREE.Scene();
    const replacedMaterials = new Set<THREE.Material>();
    const kart = createKart({ ...entry, ...(gray ? { color: '#a5b4c2' } : {}) });
    scene.add(kart);
    if (gray) {
      const neutral = new THREE.MeshStandardMaterial({ color: '#a5b4c2', roughness: 0.5 });
      kart.getObjectByName('body-kit')?.traverse((part) => {
        if (part instanceof THREE.Mesh) {
          const material = part.material;
          if (
            material instanceof THREE.MeshStandardMaterial &&
            material.name === 'body-kit-paint'
          ) {
            replacedMaterials.add(material);
            part.material = neutral;
          }
        }
      });
    }
    scene.add(new THREE.HemisphereLight('#fff8ec', '#697f99', 1.8));
    const sun = new THREE.DirectionalLight('#ffffff', 3);
    sun.position.set(-3, 7, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#b1d4ff', 1.8);
    rim.position.set(4, 3, -5);
    scene.add(rim);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.1, 0.1, 48),
      new THREE.MeshStandardMaterial({ color: '#3c465d', roughness: 0.83 }),
    );
    base.position.y = -0.07;
    scene.add(base);
    const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 80);
    camera.position.set(rear ? -5 : 5, 3.2, rear ? -6.4 : 6.4);
    camera.lookAt(0, 1.05, 0);
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL('image/png');
    disposeScene(scene);
    for (const material of replacedMaterials) material.dispose();
    return image;
  });
  renderer.dispose();
  return shots;
}

function Sheet() {
  const entries =
    mode === 'fit'
      ? Array.from({ length: 11 }, (_, car) => ({ car, body }))
      : Array.from({ length: 10 }, (_, i) => ({ car, body: start + i }));
  const [shots, setShots] = useState<string[]>([]);
  const production = mode === 'catalog' && !gray && !rear && car === 0;
  useEffect(() => {
    if (!production) setShots(renderSheet(entries));
  }, []);
  return h(
    'div',
    null,
    h(
      'header',
      null,
      h(
        'div',
        null,
        h(
          'h1',
          null,
          mode === 'fit'
            ? `Обвес ${body} / 11 кузовов`
            : `Обвесы ${start}–${start + 9} / ${getCarDesign(car).name}`,
        ),
        h(
          'p',
          null,
          `${gray ? 'Нейтральные материалы' : 'Заводская окраска'} · ${rear ? 'сзади' : 'спереди'} · реальные игровые модели`,
        ),
      ),
      h(
        'nav',
        null,
        ...[
          ['01–10', { mode: 'catalog', start: 1 }],
          ['11–20', { mode: 'catalog', start: 11 }],
          ['Цвет', { gray: 0 }],
          ['Без цвета', { gray: 1 }],
          ['Спереди', { rear: 0 }],
          ['Сзади', { rear: 1 }],
        ].map(([label, values]) =>
          h('a', { href: href(values as Record<string, string | number>) }, label as string),
        ),
      ),
    ),
    h(
      'main',
      null,
      ...entries.map((entry, index) => {
        const product = products.find((p) => p.category === 'body' && p.variant === entry.body);
        const title = mode === 'fit' ? getCarDesign(entry.car).name : product?.name || 'Без обвеса';
        return h(
          'article',
          { key: `${entry.car}-${entry.body}` },
          h(
            'div',
            { className: 'art' },
            production
              ? h(ProductThumbnail, {
                  product: product || {
                    category: 'body',
                    variant: 0,
                    name: 'Без обвеса',
                    color: '#ff794b',
                  },
                  customization: { car: entry.car, body: entry.body },
                })
              : shots[index]
                ? h('img', { src: shots[index], alt: title })
                : null,
          ),
          h(
            'div',
            { className: 'copy' },
            h('span', { className: 'number' }, String(entry.body).padStart(2, '0')),
            h('h2', null, title),
            h('p', null, product?.description || 'Заводской кузов для сравнения.'),
            h(
              'div',
              { className: 'links' },
              ...[
                ['fit', 'Кузова'],
                ['garage', 'Гараж'],
                ['race', 'Заезд'],
              ].map(([next, label]) =>
                h('a', { href: href({ mode: next, car: entry.car, body: entry.body }) }, label),
              ),
            ),
          ),
        );
      }),
    ),
    h(
      'footer',
      null,
      'Проверка геометрии: различия формы, крепления, просвет колёс, сохранение заводского силуэта. Диагностическая страница не входит в production-сборку.',
    ),
  );
}

if (mode === 'race')
  root.render(
    h(Race, {
      trackId: 'coast',
      customization: { car, body },
      onExit: () => {
        location.search = href({ mode: 'catalog' });
      },
      onFinish: () => {},
    }),
  );
else if (mode === 'garage')
  root.render(
    h(
      'div',
      null,
      h('a', { href: href({ mode: 'fit' }) }, 'Назад к кузовам'),
      h('div', { className: 'garage' }, h(KartPreview, { customization: { car, body } })),
    ),
  );
else root.render(h(Sheet));
