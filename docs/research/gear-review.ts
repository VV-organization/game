// Local visual QA only: production models, thumbnail renderer, preview and race.
import { createElement as h, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { ProductThumbnail } from '../../src/game/ProductThumbnail';
import { createHelmet } from '../../src/game/helmets';
import { createRacingSuit } from '../../src/game/racing-suits';
import { createKart, disposeScene } from '../../src/game/kart';
import { frameObject } from '../../src/game/framing';
import { KartPreview } from '../../src/game/KartPreview';
import { Race } from '../../src/game/Race';
import { products } from '../../server/catalog';
import type { Customization } from '../../src/game/types';

const params = new URLSearchParams(location.search);
const category = params.get('category') === 'suit' ? 'suit' : 'helmet';
const gray = params.get('gray') === '1';
const mode = params.get('mode') || 'catalog';
const variant = Math.max(1, Math.min(20, Number(params.get('variant')) || 1));
const car = Math.max(1, Math.min(10, Number(params.get('car')) || 1));
const href = (values: Record<string, string | number>) => {
  const next = new URLSearchParams(location.search);
  Object.entries(values).forEach(([key, value]) => next.set(key, String(value)));
  return `?${next}`;
};
const worn: Customization = {
  car,
  helmetStyle: variant,
  suitStyle: variant,
  ...(params.get('visor') ? { windowTint: '#f140b2' } : {}),
};

function shots(objects: THREE.Object3D[], neutral: boolean, back = false) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(480, 360);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const result = objects.map((object) => {
    const scene = new THREE.Scene();
    const originals = new Set<THREE.Material>();
    if (neutral) {
      const material = new THREE.MeshStandardMaterial({
        color: '#b5bcc8',
        roughness: 0.6,
        side: THREE.DoubleSide,
      });
      object.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(part.material) ? part.material : [part.material])
          originals.add(m);
        part.material = material;
      });
    }
    if (back) object.rotation.y = Math.PI;
    scene.add(object);
    scene.add(new THREE.HemisphereLight('#fff8ec', '#64758d', 2));
    const sun = new THREE.DirectionalLight('#ffffff', 3);
    sun.position.set(-3, 6, 5);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 80);
    frameObject(camera, object.userData.driver || object, object.userData.driver ? 1.65 : 1.12);
    renderer.render(scene, camera);
    const shot = renderer.domElement.toDataURL('image/webp', 0.9);
    for (const m of originals) m.dispose();
    disposeScene(scene);
    return shot;
  });
  renderer.dispose();
  return result;
}

function Review() {
  const [images, setImages] = useState<string[]>([]);
  const [focus, setFocus] = useState(params.get('focus') !== '0');
  const collection = products.filter((p) => p.category === category);
  useEffect(() => {
    if (mode === 'cars') {
      setImages(
        shots(
          Array.from({ length: 10 }, (_, i) => createKart({ ...worn, car: i + 1 })),
          false,
          params.get('back') === '1',
        ),
      );
    } else if (mode === 'catalog' && (gray || params.get('back'))) {
      setImages(
        shots(
          collection.map((p) =>
            category === 'helmet'
              ? createHelmet(p.variant, p.color)
              : createRacingSuit(p.variant, p.color, 'display'),
          ),
          gray,
          params.get('back') === '1',
        ),
      );
    }
  }, []);
  if (mode === 'race')
    return h(Race, {
      trackId: 'coast',
      customization: worn,
      onExit: () => {
        location.search = href({ mode: 'cars' });
      },
      onFinish: () => {},
    });
  return h(
    'div',
    null,
    h(
      'header',
      null,
      h(
        'h1',
        null,
        `${category === 'helmet' ? 'Шлемы' : 'Комбинезоны'} · ${gray ? 'без цвета' : 'заводской вид'}`,
      ),
      h(
        'nav',
        null,
        ...[
          ['Шлемы', { category: 'helmet', mode: 'catalog', back: 0 }],
          ['Комбинезоны', { category: 'suit', mode: 'catalog', back: 0 }],
          ['Цвет', { gray: 0 }],
          ['Без цвета', { gray: 1 }],
          ['Все машины', { mode: 'cars', gray: 0 }],
          ['Со спины', { back: 1 }],
        ].map(([label, values]) =>
          h('a', { href: href(values as Record<string, string | number>) }, label as string),
        ),
      ),
    ),
    mode === 'preview'
      ? h(
          'div',
          null,
          h(
            'button',
            { onClick: () => setFocus(!focus) },
            focus ? 'Показать весь гараж' : 'Рассмотреть экипировку',
          ),
          h(
            'div',
            { className: 'garage' },
            h(KartPreview, { customization: worn, focus: focus ? category : undefined }),
          ),
        )
      : h(
          'main',
          null,
          ...(mode === 'cars' ? products.filter((p) => p.category === 'car') : collection).map(
            (p, i) =>
              h(
                'article',
                { key: p.id },
                h(
                  'div',
                  { className: 'art' },
                  gray || mode === 'cars' || params.get('back') === '1'
                    ? images[i] && h('img', { src: images[i], alt: p.name })
                    : h(ProductThumbnail, { product: p }),
                ),
                h(
                  'div',
                  { className: 'copy' },
                  h('h2', null, p.name),
                  h(
                    'a',
                    {
                      href: href(
                        mode === 'cars'
                          ? { mode: 'race', car: p.variant }
                          : { mode: 'preview', variant: p.variant },
                      ),
                    },
                    mode === 'cars' ? 'Заезд' : 'Примерка',
                  ),
                ),
              ),
          ),
        ),
  );
}
createRoot(document.getElementById('root')!).render(h(Review));
