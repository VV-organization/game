import source from '../docs/research/prices.json';
import type { CategoryId, Product } from '../src/shared/types';
import { carDesigns } from '../src/shared/car-designs';
import { bodyDesigns } from '../src/shared/body-designs';
import { decorDesigns } from '../src/shared/decor-designs';
import { helmetDesigns } from '../src/shared/helmet-designs';
import { suitDesigns } from '../src/shared/suit-designs';

const definitions: {
  id: CategoryId;
  name: string;
  count: number;
  prefix: string;
  from: number;
  to: number;
}[] = [
  { id: 'car', name: 'Машины', count: 10, prefix: '', from: 98, to: 299 },
  { id: 'color', name: 'Цвет', count: 20, prefix: '', from: 0, to: 78 },
  { id: 'body', name: 'Обвес', count: 20, prefix: 'Аэрокит', from: 100, to: 200 },
  { id: 'wheels', name: 'Диски', count: 20, prefix: 'Диски', from: 120, to: 235 },
  { id: 'garage', name: 'Гараж', count: 10, prefix: '', from: 174, to: 280 },
  { id: 'decor', name: 'Декор', count: 20, prefix: '', from: 0, to: 150 },
  { id: 'helmet', name: 'Шлемы', count: 20, prefix: 'Шлем', from: 45, to: 190 },
  { id: 'suit', name: 'Комбинезоны', count: 20, prefix: 'Комбинезон', from: 60, to: 210 },
  { id: 'plate', name: 'Номера', count: 20, prefix: 'Номер', from: 5, to: 130 },
  { id: 'decal', name: 'Винилы', count: 40, prefix: 'Винил', from: 50, to: 180 },
  { id: 'underglow', name: 'Подсветка', count: 20, prefix: 'Подсветка', from: 50, to: 180 },
  { id: 'trail', name: 'След', count: 20, prefix: 'Дым', from: 80, to: 190 },
  { id: 'profile', name: 'Профиль', count: 20, prefix: 'Аватар', from: 0, to: 130 },
  { id: 'bundle', name: 'Комплекты', count: 20, prefix: 'Комплект', from: 225, to: 299 },
  { id: 'windowTint', name: 'Визоры', count: 20, prefix: 'Визор', from: 30, to: 140 },
];
export const categories = definitions.map(({ id, name }) => ({ id, name }));
const palette = [
  '#ff6231',
  '#ffb938',
  '#71c9ff',
  '#8b5cf6',
  '#22d3b5',
  '#ff5386',
  '#e6e8ee',
  '#252935',
  '#c8e544',
  '#a271f8',
  '#ee9b57',
  '#367cf4',
  '#e64545',
  '#35a68a',
  '#cf7be8',
  '#607489',
  '#f1cc9a',
  '#96c4b7',
  '#aeafbb',
  '#4d295c',
];
const editions = [
  'Ignition',
  'Sunset',
  'Arctic',
  'Violet',
  'Mint',
  'Sakura',
  'Pearl',
  'Obsidian',
  'Acid',
  'Nebula',
  'Copper',
  'Azure',
  'Crimson',
  'Jade',
  'Orchid',
  'Steel',
  'Sand',
  'Sage',
  'Titanium',
  'Midnight',
];
const garageThemes = [
  'Коралловый бокс',
  'Арктический бокс',
  'Бокс Индиго',
  'Песочный бокс',
  'Розовый бокс',
];
const garages = Array.from(
  { length: 10 },
  (_, i) => `${garageThemes[i % 5]}${i >= 5 ? ' Pro' : ''}`,
);
const themes = [
  'Город',
  'Ночь',
  'Альпы',
  'Сакура',
  'Пустыня',
  'Океан',
  'Космос',
  'Ретро',
  'Карбон',
  'Пламя',
  'Шторм',
  'Скорость',
  'Зигзаг',
  'Волна',
  'Двойная полоса',
  'Контур',
  'Камуфляж',
  'Клетка',
  'Молния',
  'Пиксели',
];
const description: Record<CategoryId, string> = {
  car: 'Более быстрый автомобиль с улучшенным разгоном и управляемостью.',
  color: 'Новый цвет кузова. Видно в гараже и во время гонки.',
  body: 'Аэродинамический обвес меняет силуэт автомобиля на трассе.',
  wheels: 'Новый рисунок дисков для автомобиля.',
  garage: 'Тематическое оформление личной мастерской.',
  decor: 'Украшение для личного гаража.',
  helmet: 'Шлем гонщика, который виден за рулём на трассе.',
  suit: 'Комбинезон гонщика для гаража и заезда.',
  plate: 'Стиль регистрационного номера автомобиля.',
  decal: 'Ливрея кузова: линии и графика на машине.',
  underglow: 'Цветная подсветка под днищем автомобиля.',
  trail: 'Цвет дыма от шин при ускорении и дрифте.',
  profile: 'Портрет и цвет рамки личного профиля.',
  bundle:
    'Цвет, винил и подсветка одним комплектом. Фиксированная цена, уже купленные элементы не дублируются.',
  windowTint: 'Цветной визор шлема гонщика. Видно в гараже и на трассе.',
};

export const products: Product[] = definitions.flatMap((def) =>
  Array.from({ length: def.count }, (_, i) => {
    const index = Math.round(def.from + ((def.to - def.from) * i) / Math.max(1, def.count - 1));
    const edition = editions[i % 20];
    const name =
      def.id === 'car'
        ? carDesigns[i].name
        : def.id === 'garage'
          ? garages[i]
          : def.id === 'decor'
            ? decorDesigns[i].name
            : def.id === 'color'
              ? `${edition} ${i < 10 ? 'Metallic' : 'Satin'}`
              : def.id === 'decal'
                ? `Ливрея «${themes[i % 20]} ${i < 20 ? 'Sport' : 'Pro'}»`
                : `${def.prefix} ${edition}`;
    const productDescription =
      def.id === 'car'
        ? carDesigns[i].description
        : def.id === 'body'
          ? bodyDesigns[i].description
          : def.id === 'decor'
            ? decorDesigns[i].description
            : def.id === 'helmet'
              ? helmetDesigns[i].description
              : def.id === 'suit'
                ? suitDesigns[i].description
                : def.id === 'garage'
                  ? i < 5
                    ? 'Цветное оформление мастерской: подиум, панельная стена и световые акценты.'
                    : 'Мастерская Pro: два инструментальных шкафа, верхняя световая балка и клетчатая разметка пола.'
                  : description[def.id];
    return {
      id: `${def.id}-${String(i + 1).padStart(2, '0')}`,
      name,
      description: productDescription,
      category: def.id,
      price: source.prices[index].fapix,
      color: def.id === 'car' ? carDesigns[i].color : palette[i % 20],
      variant: i + 1,
      ...(def.id === 'car'
        ? { stats: { speed: 180 + i * 18, acceleration: 40 + i * 5, handling: 45 + i * 5 } }
        : {}),
      ...(def.id === 'bundle'
        ? {
            bundle: [
              `color-${String(i + 1).padStart(2, '0')}`,
              `decal-${String(i + 1).padStart(2, '0')}`,
              `underglow-${String(i + 1).padStart(2, '0')}`,
            ],
          }
        : {}),
    };
  }),
);
// Explicit denominations from VV-136 override category tier selection. 5205 RUB is source D34.
export const popularIds = ['color-01', 'decal-01', 'car-01', 'garage-01', 'wheels-01', 'bundle-01'];
source.quickTopups.forEach((q, i) => {
  products.find((p) => p.id === popularIds[i])!.price = q.fapix;
});
export const productById = new Map(products.map((p) => [p.id, p]));
export const defaultEquipped: Record<string, string> = {
  car: 'default',
  color: 'default',
  body: 'default',
  wheels: 'default',
  garage: 'default',
  helmet: 'default',
  suit: 'default',
};
