// @vitest-environment happy-dom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createDecor } from './decor';
import { createGarageScene } from './garage';
import { disposeScene } from './kart';

describe('garage decor models', () => {
  it.each([0, -1, 21, 1.5, Infinity, NaN])('rejects invalid decor %s', (variant) => {
    expect(createDecor(variant)).toBeNull();
  });
  it.each(Array.from({ length: 20 }, (_, i) => i + 1))(
    'builds grounded, bounded finite decor %i without a canvas',
    (variant) => {
      const canvas = vi.spyOn(document, 'createElement');
      const decor = createDecor(variant)!;
      expect(decor).not.toBeNull();
      expect(decor.name).toBe('garage-decor');
      expect(canvas).not.toHaveBeenCalled();
      canvas.mockRestore();
      const box = new THREE.Box3().setFromObject(decor);
      const size = box.getSize(new THREE.Vector3());
      expect(box.min.y).toBeCloseTo(0, 5);
      expect(size.x).toBeGreaterThan(0.4);
      expect(size.x).toBeLessThanOrEqual(2.4);
      expect(size.z).toBeLessThanOrEqual(2.4);
      expect(size.y).toBeGreaterThan(0.9);
      expect(size.y).toBeLessThanOrEqual(3.3);
      decor.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        expect([...object.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
        expect(object.castShadow).toBe(true);
      });
      disposeScene(decor);
    },
  );
});

describe('garage decor integration', () => {
  beforeAll(() => {
    const context = new Proxy({}, { get: () => () => {}, set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as CanvasRenderingContext2D,
    );
  });
  afterAll(() => vi.restoreAllMocks());
  it.each([0, 1, 6, 10])('places every decor clear of the rotating kart in garage %i', (garage) => {
    for (let variant = 1; variant <= 20; variant++) {
      const { scene, kart, decor } = createGarageScene({
        garage,
        decor: variant,
        car: 10,
        body: 20,
      });
      expect(decor?.parent === scene).toBe(true);
      const bounds = new THREE.Box3().setFromObject(decor!);
      expect(bounds.min.y).toBeCloseTo(-0.285, 5);
      const nearestX = Math.min(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
      expect(nearestX).toBeGreaterThan(3.5);
      expect(bounds.min.z).toBeGreaterThan(-2.0);
      expect(bounds.max.z).toBeLessThan(1.05);
      expect(kart.parent).toBe(scene);
      disposeScene(scene);
    }
  });
  it.each([undefined, 0, -1, 21, 1.5])('leaves invalid or missing decor %s unequipped', (decor) => {
    const result = createGarageScene({ decor });
    expect(result.decor).toBeNull();
    expect(result.scene.getObjectByName('garage-decor')).toBeUndefined();
    disposeScene(result.scene);
  });
});
