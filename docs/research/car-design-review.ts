// Local visual acceptance fixture. Run Vite and open /docs/research/car-design-review.html.
// Uses the production thumbnail renderer and the real catalog, not substitute artwork.
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductThumbnail } from '../../src/game/ProductThumbnail';
import { Race } from '../../src/game/Race';
import { products } from '../../server/catalog';
import type { Customization } from '../../src/game/types';

const mode = new URLSearchParams(location.search).get('mode') || 'factory';
const cars = products.filter((product) => product.category === 'car');
const customization = (variant: number): Customization | undefined =>
  mode === 'gray'
    ? { car: variant, color: '#b8c4d0', helmet: '#ff794b', suit: '#f8f4e8' }
    : mode === 'equipped'
      ? {
          car: variant,
          color: '#67c7ed',
          body: 20,
          wheels: 20,
          decal: 11,
          plate: 4,
          helmet: '#ffb938',
          suit: '#e64545',
          underglow: '#8b5cf6',
        }
      : undefined;

const root = createRoot(document.getElementById('root')!);
if (mode === 'race') {
  const car = Number(new URLSearchParams(location.search).get('car')) || 1;
  root.render(
    h(Race, {
      trackId: 'coast',
      customization: { car },
      onExit: () => {
        location.search = '?mode=factory';
      },
      onFinish: () => {},
    }),
  );
} else
  root.render(
    h(
      'div',
      null,
      h(
        'header',
        null,
        h(
          'div',
          null,
          h('h1', null, 'FApix / 10 отдельных конструкций'),
          h(
            'p',
            null,
            'Настоящие модели из каталога, гаража и гонки. Одинаковая камера и освещение.',
          ),
        ),
        h(
          'nav',
          null,
          ...[
            ['factory', 'Заводские цвета'],
            ['gray', 'Одинаковая краска'],
            ['equipped', 'С экипировкой'],
          ].map(([value, label]) =>
            h(
              'a',
              {
                href: `?mode=${value}`,
                'aria-current': mode === value ? 'page' : undefined,
              },
              label,
            ),
          ),
        ),
      ),
      h(
        'main',
        null,
        ...cars.map((product) =>
          h(
            'article',
            { key: product.id },
            h(
              'div',
              { className: 'image' },
              h(ProductThumbnail, { product, customization: customization(product.variant) }),
            ),
            h(
              'div',
              { className: 'copy' },
              h('span', { className: 'number' }, String(product.variant).padStart(2, '0')),
              h('h2', null, product.name),
              h('p', null, product.description),
              h(
                'a',
                {
                  href: `?mode=race&car=${product.variant}`,
                  style: {
                    display: 'inline-block',
                    padding: '6px 8px',
                    marginTop: 8,
                    fontSize: 11,
                  },
                },
                'Проверить на трассе',
              ),
            ),
          ),
        ),
      ),
      h(
        'footer',
        null,
        'Контроль: различимость силуэтов, отсутствие обрезания и пересечений, соответствие реальной экипировке. Цены и характеристики не изменяются.',
      ),
    ),
  );
