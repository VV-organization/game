import { describe, expect, it } from 'vitest';
import { customizationFor } from './customization';
import type { Product } from './api';

const item = (
  id: string,
  category: string,
  variant: number,
  color: string,
  bundle?: string[],
): Product => ({ id, category, variant, color, bundle, name: id, description: '', price: 100 });
const products: readonly Product[] = Object.freeze([
  item('car-4', 'car', 4, '#112233'),
  item('color-old', 'color', 1, '#ff3300'),
  item('color-new', 'color', 2, '#22aaff'),
  item('decal-old', 'decal', 3, '#abcdef'),
  item('decal-new', 'decal', 9, '#ffcc11'),
  item('wheels-5', 'wheels', 5, '#445566'),
  item('glow-new', 'underglow', 2, '#cc66ff'),
  item('bundle-new', 'bundle', 7, '#123456', ['color-new', 'decal-new', 'glow-new']),
]);
const equipped = Object.freeze({
  car: 'car-4',
  color: 'color-old',
  decal: 'decal-old',
  wheels: 'wheels-5',
});

describe('customizationFor', () => {
  it('preserves equipment geometry as well as colors through equip and temporary preview', () => {
    const gear = [
      item('helmet-03', 'helmet', 3, '#3388bb'),
      item('helmet-12', 'helmet', 12, '#1122aa'),
      item('suit-08', 'suit', 8, '#443344'),
      item('visor-02', 'windowTint', 2, '#66ccee'),
    ];
    const worn = Object.freeze({ helmet: 'helmet-03', suit: 'suit-08', windowTint: 'visor-02' });
    expect(customizationFor(worn, gear, gear[1])).toEqual({
      helmet: '#1122aa',
      helmetStyle: 12,
      suit: '#443344',
      suitStyle: 8,
      windowTint: '#66ccee',
    });
    expect(customizationFor(worn, gear)).toEqual({
      helmet: '#3388bb',
      helmetStyle: 3,
      suit: '#443344',
      suitStyle: 8,
      windowTint: '#66ccee',
    });
    expect(customizationFor({ helmet: 'default', suit: 'missing' }, gear)).toEqual({});
  });

  it('expands a preview bundle into its component categories while preserving other equipped items', () => {
    expect(customizationFor(equipped, products, products[7])).toEqual({
      car: 4,
      color: '#22aaff',
      decal: 9,
      wheels: 5,
      underglow: '#cc66ff',
    });
  });

  it('leaves equipped selections and the catalog unchanged after trying a bundle', () => {
    const catalogBefore = JSON.stringify(products);
    customizationFor(equipped, products, products[7]);
    expect(equipped).toEqual({
      car: 'car-4',
      color: 'color-old',
      decal: 'decal-old',
      wheels: 'wheels-5',
    });
    expect(JSON.stringify(products)).toBe(catalogBefore);
    expect(customizationFor(equipped, products)).toEqual({
      car: 4,
      color: '#ff3300',
      decal: 3,
      wheels: 5,
    });
  });

  it('replaces only the selected category for a single item preview', () => {
    expect(customizationFor(equipped, products, products[2])).toEqual({
      car: 4,
      color: '#22aaff',
      decal: 3,
      wheels: 5,
    });
  });

  it('ignores missing bundle members and never emits a bundle property', () => {
    const incomplete = item('bundle-incomplete', 'bundle', 99, '#ffffff', [
      'missing-item',
      'color-new',
    ]);
    expect(customizationFor(undefined, products, incomplete)).toEqual({ color: '#22aaff' });
  });
});
