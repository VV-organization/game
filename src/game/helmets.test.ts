import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHelmet } from './helmets';

function meshes(group: THREE.Group) {
  const result: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) result.push(object);
  });
  return result;
}

describe('driver helmets', () => {
  it('builds finite fitted geometry for every edition', () => {
    for (let variant = 1; variant <= 20; variant++) {
      const helmet = createHelmet(variant);
      expect(helmet.name).toBe('driver-helmet');
      const box = new THREE.Box3().setFromObject(helmet);
      expect(box.min.x).toBeGreaterThanOrEqual(-0.57);
      expect(box.max.x).toBeLessThanOrEqual(0.57);
      expect(box.min.y).toBeGreaterThanOrEqual(-0.49);
      expect(box.max.y).toBeLessThanOrEqual(0.58);
      expect(box.min.z).toBeGreaterThanOrEqual(-0.63);
      expect(box.max.z).toBeLessThanOrEqual(0.75);
      expect(box.getSize(new THREE.Vector3()).y).toBeGreaterThan(0.7);
      for (const part of meshes(helmet)) {
        expect(
          Array.from(part.geometry.getAttribute('position').array).every(Number.isFinite),
        ).toBe(true);
      }
    }
  });

  it('places every customized visor on the forward face', () => {
    for (let variant = 1; variant <= 20; variant++) {
      const helmet = createHelmet(variant, '#333333', '#ff26a0');
      const visors = meshes(helmet).filter(
        (part) => (part.material as THREE.Material).name === 'helmet-visor',
      );
      expect(visors.length).toBeGreaterThan(0);
      for (const visor of visors) {
        expect((visor.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff26a0');
        const box = new THREE.Box3().setFromObject(visor);
        expect(box.min.z).toBeGreaterThan(0.12);
        expect(box.max.z).toBeGreaterThan(0.43);
        expect(box.max.y).toBeGreaterThan(0);
      }
    }
  });

  it('applies a legacy primary paint override without recoloring the visor', () => {
    const helmet = createHelmet(4, '#123456');
    const paint = meshes(helmet).filter(
      (part) => (part.material as THREE.Material).name === 'helmet-shell',
    );
    expect(paint.length).toBeGreaterThan(0);
    for (const part of paint)
      expect((part.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('123456');
    const visor = meshes(helmet).find(
      (part) => (part.material as THREE.Material).name === 'helmet-visor',
    );
    expect((visor!.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe('123456');
  });

  it('falls back to the stock model for missing and invalid styles', () => {
    const stock = new THREE.Box3().setFromObject(createHelmet());
    for (const invalid of [-1, 21, 1.5, NaN, Infinity]) {
      const model = createHelmet(invalid);
      expect(new THREE.Box3().setFromObject(model).equals(stock)).toBe(true);
      expect(meshes(model).length).toBe(meshes(createHelmet(0)).length);
    }
  });

  it('maps the first and last catalog variants to their matching editions', () => {
    for (const [variant, color] of [
      [1, 'ff6231'],
      [20, '4d295c'],
    ] as const) {
      const shell = meshes(createHelmet(variant)).find(
        (part) => (part.material as THREE.Material).name === 'helmet-shell',
      );
      expect((shell!.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(color);
    }
    expect(
      new THREE.Box3()
        .setFromObject(createHelmet(20))
        .equals(new THREE.Box3().setFromObject(createHelmet())),
    ).toBe(false);
  });

  it('gives separate products independently disposable resources', () => {
    const first = meshes(createHelmet(9));
    const second = meshes(createHelmet(9));
    const otherGeometry = new Set(second.map((part) => part.geometry));
    const otherMaterials = new Set(second.flatMap((part) => [part.material].flat()));
    for (const part of first) {
      expect(otherGeometry.has(part.geometry)).toBe(false);
      for (const material of [part.material].flat())
        expect(otherMaterials.has(material)).toBe(false);
    }
  });
});
