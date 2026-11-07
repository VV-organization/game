// Local visual QA. Uses the production catalog, builders, thumbnails, preview and race.
import { createElement as h, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { createKart, disposeScene } from '../../src/game/kart';
import { frameObject } from '../../src/game/framing';
import { ProductThumbnail } from '../../src/game/ProductThumbnail';
import { KartPreview } from '../../src/game/KartPreview';
import { Race } from '../../src/game/Race';
import { products } from '../../server/catalog';
import { customizationFor } from '../../src/lib/customization';
import type { Customization } from '../../src/game/types';

const params = new URLSearchParams(location.search);
const categories = ['plate', 'decal', 'underglow', 'trail'] as const;
const category = categories.find((c) => c === params.get('category')) || 'plate';
const mode = params.get('mode') || 'catalog';
const variant = Math.max(
  1,
  Math.min(category === 'decal' ? 40 : 20, Number(params.get('variant')) || 1),
);
const car = Math.max(0, Math.min(10, Number(params.get('car')) || 0));
const item = products.find((p) => p.category === category && p.variant === variant)!;
const worn: Customization = {
  ...customizationFor({}, products, item),
  car,
  ...(params.get('paint')
    ? { color: params.get('paint') === 'light' ? '#eee9dd' : '#162130' }
    : {}),
};
const href = (values: Record<string, string | number>) => {
  const next = new URLSearchParams(location.search);
  Object.entries(values).forEach(([key, value]) => next.set(key, String(value)));
  return `?${next}`;
};

function Review() {
  const [focus, setFocus] = useState(true);
  const [carImages, setCarImages] = useState<string[]>([]);
  useEffect(() => {
    if (mode !== 'cars' || category !== 'plate') return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(480, 360);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const images = Array.from({ length: 11 }, (_, car) => {
      const scene = new THREE.Scene();
      const kart = createKart({ ...worn, car });
      scene.add(kart, new THREE.HemisphereLight('#ffffff', '#617388', 2));
      const light = new THREE.DirectionalLight('#fff8eb', 3);
      light.position.set(-3, 6, -5);
      scene.add(light);
      const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 80);
      frameObject(camera, kart, 1.1, [0.4, 0.45, -1]);
      renderer.render(scene, camera);
      const image = renderer.domElement.toDataURL('image/webp', 0.9);
      disposeScene(scene);
      return image;
    });
    setCarImages(images);
    renderer.dispose();
  }, []);
  const collection = products.filter(
    (p) =>
      p.category === category &&
      (category !== 'decal' || (params.get('pro') === '1' ? p.variant > 20 : p.variant <= 20)),
  );
  if (mode === 'race')
    return h(Race, {
      trackId: params.get('track') || 'coast',
      customization: {
        ...worn,
        underglow: '#8b5cf6',
        underglowStyle: 4,
        trail: item.category === 'trail' ? item.color : '#71c9ff',
        trailStyle: item.category === 'trail' ? variant : 3,
        plate: 8,
        decal: 27,
      },
      onExit: () => {
        location.search = href({ mode: 'preview' });
      },
      onFinish: () => {},
    });
  return h(
    'div',
    null,
    h(
      'header',
      null,
      h('h1', null, `${category} · ${mode} · ${params.get('pro') === '1' ? 'Pro' : 'Sport'}`),
      h(
        'nav',
        null,
        ...categories.map((c) =>
          h('a', { href: href({ category: c, mode: 'catalog' }), key: c }, c),
        ),
        h('a', { href: href({ pro: params.get('pro') === '1' ? 0 : 1 }) }, 'Sport / Pro'),
        h('a', { href: href({ mode: 'cars' }) }, 'Все машины'),
        h(
          'a',
          { href: href({ paint: params.get('paint') === 'light' ? 'dark' : 'light' }) },
          'Светлый / тёмный',
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
            focus ? 'Показать весь гараж' : 'Рассмотреть предмет',
          ),
          h('a', { href: href({ mode: 'race' }) }, 'Заезд'),
          h(
            'div',
            { className: 'garage' },
            h(KartPreview, { customization: worn, focus: focus ? category : undefined }),
          ),
        )
      : h(
          'main',
          null,
          ...(mode === 'cars'
            ? [
                { variant: 0, name: 'Origin', id: 'default' },
                ...products.filter((p) => p.category === 'car'),
              ]
            : collection
          ).map((p) => {
            const demo =
              mode === 'cars'
                ? { ...worn, car: p.variant }
                : params.get('paint')
                  ? {
                      ...customizationFor({}, products, p as typeof item),
                      car: 1,
                      color: worn.color,
                    }
                  : undefined;
            return h(
              'article',
              { key: p.id },
              h(
                'div',
                { className: 'art' },
                mode === 'cars' && category === 'plate'
                  ? carImages[p.variant] && h('img', { src: carImages[p.variant], alt: p.name })
                  : h(ProductThumbnail, {
                      product:
                        mode === 'cars'
                          ? { ...item, category: category === 'plate' ? 'car' : category }
                          : (p as typeof item),
                      customization: demo,
                    }),
              ),
              h(
                'div',
                { className: 'copy' },
                h('h2', null, p.name),
                h(
                  'a',
                  {
                    href: href({
                      mode: 'preview',
                      ...(mode === 'cars' ? { car: p.variant } : { variant: p.variant }),
                    }),
                  },
                  'Примерка',
                ),
              ),
            );
          }),
        ),
  );
}
createRoot(document.getElementById('root')!).render(h(Review));
