// @vitest-environment happy-dom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createKart, disposeScene } from './kart';
import { surfacePatch } from './vehicle-decals';

beforeAll(() => {
  const context = new Proxy({}, { get: () => () => {}, set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as CanvasRenderingContext2D,
  );
});
afterAll(() => vi.restoreAllMocks());

describe('livery fit', () => {
  it('puts the complete central motif on both fork blades, away from the empty nose slot', () => {
    const kart = createKart({ car: 9, decal: 24 });
    kart.updateMatrixWorld(true);
    const patches = kart.children.filter((part) => part.name === 'livery-hood');
    expect(patches).toHaveLength(2);
    for (const side of [-1, 1]) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(side * 0.62, 3, 1.02),
        new THREE.Vector3(0, -1, 0),
      );
      const hit = ray.intersectObjects(patches)[0];
      expect(hit).toBeDefined();
      expect(hit.uv!.x).toBeCloseTo(0.5, 2);
      expect(hit.uv!.y).toBeCloseTo(0.5, 2);
    }
    const centerRay = new THREE.Raycaster(
      new THREE.Vector3(0, 3, 1.02),
      new THREE.Vector3(0, -1, 0),
    );
    expect(centerRay.intersectObjects(patches)).toHaveLength(0);
    disposeScene(kart);
  });

  it('does not stretch triangles between adjacent panels at different heights', () => {
    const surfaces = [-1, 1].map((side) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 2), new THREE.MeshBasicMaterial());
      panel.position.set(side * 0.5, side < 0 ? 0.3 : 0.9, 0);
      panel.updateMatrixWorld(true);
      return panel;
    });
    const patch = surfacePatch(surfaces, new THREE.MeshBasicMaterial(), [0, 0, 0], 2, 2);
    const position = patch.geometry.getAttribute('position'),
      indices = patch.geometry.getIndex()!;
    expect(indices.count).toBeGreaterThan(30);
    for (let i = 0; i < indices.count; i += 3) {
      const heights = [0, 1, 2].map((offset) => position.getY(indices.getX(i + offset)));
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.001);
    }
    for (const object of [...surfaces, patch]) disposeScene(object);
  });
});
