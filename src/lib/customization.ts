import type { Customization } from '../game/types';
import type { Product } from './api';

const colorCategories = new Set(['color', 'helmet', 'suit', 'trail', 'underglow', 'windowTint']);

export function customizationFor(
  equipped: Readonly<Record<string, string>> | undefined,
  products: readonly Product[],
  preview?: Product | null,
): Customization {
  const catalog = new Map(products.map((product) => [product.id, product]));
  const chosen = new Map<string, Product>();
  const include = (product: Product) => {
    if (product.category === 'bundle') {
      for (const id of product.bundle || []) {
        const member = catalog.get(id);
        if (member && member.category !== 'bundle') chosen.set(member.category, member);
      }
    } else {
      chosen.set(product.category, product);
    }
  };
  for (const id of Object.values(equipped || {})) {
    const product = catalog.get(id);
    if (product) include(product);
  }
  if (preview) include(preview);
  const result: Record<string, string | number> = {};
  for (const product of chosen.values()) {
    result[product.category] = colorCategories.has(product.category)
      ? product.color
      : product.variant;
    if (product.category === 'helmet' || product.category === 'suit')
      result[`${product.category}Style`] = product.variant;
  }
  return result as Customization;
}
