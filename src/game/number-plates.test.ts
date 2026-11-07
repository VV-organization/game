// @vitest-environment happy-dom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createNumberPlate } from './number-plates';
import { createKart, disposeScene } from './kart';
import { plateDesigns } from '../shared/plate-designs';

beforeAll(() => {
  const context = new Proxy({}, { get: () => () => {}, set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as CanvasRenderingContext2D,
  );
});
afterAll(() => vi.restoreAllMocks());

function parts(model: THREE.Group) {
  const result: THREE.Mesh[] = [];
  model.traverse((part) => {
    if (part instanceof THREE.Mesh) result.push(part);
  });
  return result;
}

describe('number plate collection', () => {
  it('keeps all fitted frames clear of the exhaust mouths on every chassis', () => {
    for (let car = 0; car <= 10; car++) {
      for (const plate of [5, 8, 14, 19]) {
        const model = createKart({ car, plate });
        const number = new THREE.Box3().setFromObject(model.getObjectByName('number-plate')!);
        for (const pipe of model.children.filter((part) => part.name === 'exhaust-pipe')) {
          const mouth = new THREE.Box3().setFromObject(pipe);
          expect(number.min.y - mouth.max.y, `car ${car}, plate ${plate}`).toBeGreaterThan(0.04);
        }
        disposeScene(model);
      }
    }
  });
  it('leaves the factory rear clear when no valid plate is selected', () => {
    for (const value of [undefined, 0, -1, 21, 1.5, NaN, Infinity])
      expect(createNumberPlate(value)).toBeNull();
  });

  it('keeps all twenty editions inside the rear mounting envelope with real thickness', () => {
    expect(plateDesigns.map((design) => design.variant)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    for (const design of plateDesigns) {
      const model = createNumberPlate(design.variant)!;
      expect(model.name).toBe('number-plate');
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(0.85);
      expect(size.x).toBeLessThanOrEqual(1.25);
      expect(size.y).toBeGreaterThanOrEqual(0.38);
      expect(size.y).toBeLessThanOrEqual(0.52);
      expect(size.z).toBeGreaterThanOrEqual(0.04);
      expect(size.z).toBeLessThanOrEqual(0.1);
      expect(Math.abs(box.getCenter(new THREE.Vector3()).x)).toBeLessThan(0.035);
      expect(Math.abs(box.getCenter(new THREE.Vector3()).y)).toBeLessThan(0.035);
      expect(parts(model).length).toBeLessThanOrEqual(10);
      for (const part of parts(model))
        expect(
          Array.from(part.geometry.getAttribute('position').array).every(Number.isFinite),
        ).toBe(true);
      disposeScene(model);
    }
  });

  it('provides twenty different physical outlines after removing size and paint differences', () => {
    const signatures = new Set<string>();
    const ray = new THREE.Raycaster();
    for (let variant = 1; variant <= 20; variant++) {
      const model = createNumberPlate(variant)!;
      const shell = model.getObjectByName('plate-shell')!;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(shell);
      const size = bounds.getSize(new THREE.Vector3());
      let signature = '';
      for (let y = 0; y < 19; y++)
        for (let x = 0; x < 39; x++) {
          ray.set(
            new THREE.Vector3(
              bounds.min.x + ((x + 0.5) / 39) * size.x,
              bounds.min.y + ((y + 0.5) / 19) * size.y,
              1,
            ),
            new THREE.Vector3(0, 0, -1),
          );
          signature += ray.intersectObject(shell, false).length ? '1' : '0';
        }
      signatures.add(signature);
      disposeScene(model);
    }
    expect(signatures.size).toBe(20);
  });

  it('puts legible artwork on the front with UVs confined to the shaped face', () => {
    for (let variant = 1; variant <= 20; variant++) {
      const model = createNumberPlate(variant)!;
      const face = model.getObjectByName('plate-artwork') as THREE.Mesh;
      expect(face).toBeInstanceOf(THREE.Mesh);
      const material = face.material as THREE.MeshStandardMaterial;
      expect(material.map).toBeInstanceOf(THREE.CanvasTexture);
      expect(material.map!.image.width).toBe(512);
      expect(material.map!.image.height).toBe(256);
      expect(new THREE.Box3().setFromObject(face).min.z).toBeGreaterThan(0.02);
      for (const coordinate of face.geometry.getAttribute('uv').array) {
        expect(coordinate).toBeGreaterThanOrEqual(0);
        expect(coordinate).toBeLessThanOrEqual(1);
      }
      const normal = face.geometry.getAttribute('normal');
      for (let vertex = 0; vertex < normal.count; vertex++)
        expect(normal.getZ(vertex)).toBeGreaterThan(0.99);
      disposeScene(model);
    }
  });

  it('owns and disposes every GPU resource without damaging another copy', () => {
    const first = createNumberPlate(19)!;
    const second = createNumberPlate(19)!;
    const resources = (group: THREE.Group) =>
      new Set(
        parts(group).flatMap((part) => {
          const materials = [part.material].flat();
          return [
            part.geometry,
            ...materials,
            ...materials.flatMap((material) =>
              Object.values(material).filter(
                (value): value is THREE.Texture => value instanceof THREE.Texture,
              ),
            ),
          ];
        }),
      );
    const firstResources = resources(first),
      secondResources = resources(second);
    for (const resource of firstResources) expect(secondResources.has(resource)).toBe(false);
    const disposed = new Set<unknown>();
    for (const resource of firstResources)
      resource.addEventListener('dispose', () => disposed.add(resource));
    const secondDisposals = vi.fn();
    for (const resource of secondResources) resource.addEventListener('dispose', secondDisposals);
    disposeScene(first);
    expect(disposed.size).toBe(firstResources.size);
    expect(secondDisposals).not.toHaveBeenCalled();
    disposeScene(second);
  });
});
