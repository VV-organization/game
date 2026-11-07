import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createRacingSuit } from './racing-suits';
import { suitDesigns } from '../shared/suit-designs';

function meshes(model: THREE.Object3D) {
  const result: THREE.Mesh[] = [];
  model.traverse((part) => {
    if (part instanceof THREE.Mesh) result.push(part);
  });
  return result;
}

function shape(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  return meshes(model).map((part) => ({
    position: [...part.geometry.attributes.position.array].map((n) => Number(n.toFixed(5))),
    transform: part.matrixWorld.elements.map((n) => Number(n.toFixed(5))),
  }));
}

function dispose(model: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  for (const part of meshes(model)) {
    part.geometry.dispose();
    for (const material of Array.isArray(part.material) ? part.material : [part.material])
      materials.add(material);
  }
  materials.forEach((material) => material.dispose());
}

describe('racing suit model', () => {
  it('fits every edition in the seated driver envelope with steering hands and a helmet opening', () => {
    for (let variant = 0; variant <= 20; variant++) {
      const model = createRacingSuit(variant);
      expect(model.name).toBe('driver-suit');
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      expect(bounds.max.x - bounds.min.x, `width ${variant}`).toBeLessThanOrEqual(1.12);
      expect(bounds.max.z, `front ${variant}`).toBeLessThanOrEqual(1.12);
      expect(bounds.max.y, `neck ${variant}`).toBeLessThanOrEqual(0.65);
      expect(bounds.min.y, `feet ${variant}`).toBeGreaterThan(-0.55);
      for (const [side, x] of [
        ['left', -0.35],
        ['right', 0.35],
      ] as const) {
        const hand = model.getObjectByName(`suit-glove-${side}`)!;
        expect(hand).toBeDefined();
        expect(
          hand.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(x, 0.25, 0.59)),
        ).toBeLessThan(0.025);
      }
      for (const part of meshes(model)) {
        expect([...part.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
        expect(part.matrixWorld.elements.every(Number.isFinite)).toBe(true);
      }
      dispose(model);
    }
  });

  it('stands on its boot soles and retains the same authored clothing in product and race poses', () => {
    for (let variant = 1; variant <= 20; variant++) {
      const seated = createRacingSuit(variant);
      const display = createRacingSuit(variant, undefined, 'display');
      display.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(display);
      expect(bounds.min.y).toBeCloseTo(0, 4);
      expect(bounds.max.y).toBeGreaterThan(1.55);
      expect(display.getObjectByName('suit-head')).toBeUndefined();
      const seatedParts = meshes(seated),
        displayParts = meshes(display);
      expect(displayParts.map((part) => part.name)).toEqual(seatedParts.map((part) => part.name));
      const seatedTorso = seated.getObjectByName('suit-torso')!,
        displayTorso = display.getObjectByName('suit-torso')!;
      expect(shape(seatedTorso)).toEqual(
        shape(displayTorso).map((part) => ({
          ...part,
          transform: part.transform.map((n, index) =>
            index === 13 ? Number((n - 0.97).toFixed(5)) : n,
          ),
        })),
      );
      for (const side of ['left', 'right']) {
        const glove = display.getObjectByName(`suit-glove-${side}`)!;
        const boot = display.getObjectByName(`suit-boot-${side}`)!;
        expect(glove.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(0.75);
        expect(boot.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(0.2);
      }
      dispose(seated);
      dispose(display);
    }
  });

  it('gives all twenty editions different clothing geometry even with the same fabric color', () => {
    const signatures = new Set<string>();
    for (let variant = 1; variant <= 20; variant++) {
      const model = createRacingSuit(variant, '#888888');
      signatures.add(JSON.stringify(shape(model)));
      expect(
        meshes(model).some(
          (part) => (part.material as THREE.MeshStandardMaterial).name === 'suit-fabric',
        ),
      ).toBe(true);
      dispose(model);
    }
    expect(signatures.size).toBe(20);
    expect(suitDesigns).toHaveLength(20);
    expect(suitDesigns[0].name).toBe('Комбинезон Ignition');
    expect(suitDesigns[19].name).toBe('Комбинезон Midnight');
  });

  it.each([-1, 21, 1.5, NaN, Infinity])('uses stock geometry for invalid edition %s', (variant) => {
    const invalid = createRacingSuit(variant),
      stock = createRacingSuit();
    expect(shape(invalid)).toEqual(shape(stock));
    dispose(invalid);
    dispose(stock);
  });

  it('keeps chest panels on the outside of the curved fabric instead of burying their middles', () => {
    const model = createRacingSuit(12);
    model.updateMatrixWorld(true);
    const fabric = model.getObjectByName('suit-body-fabric')!;
    const ray = new THREE.Raycaster();
    for (const panel of meshes(model).filter((part) => part.name.startsWith('suit-chest-panel'))) {
      const positions = panel.geometry.attributes.position;
      const indices = panel.geometry.index!;
      for (let triangle = 0; triangle < indices.count; triangle += 3) {
        const center = new THREE.Vector3();
        for (let corner = 0; corner < 3; corner++)
          center.add(
            new THREE.Vector3().fromBufferAttribute(positions, indices.getX(triangle + corner)),
          );
        center.multiplyScalar(1 / 3).applyMatrix4(panel.matrixWorld);
        ray.set(new THREE.Vector3(center.x, center.y, 1), new THREE.Vector3(0, 0, -1));
        const outerFabric = ray.intersectObject(fabric, false)[0];
        expect(outerFabric).toBeDefined();
        expect(center.z - outerFabric.point.z).toBeGreaterThan(0.004);
      }
    }
    dispose(model);
  });

  it('honors the primary color and gives independently disposable resources to each build', () => {
    const a = createRacingSuit(4, '#123456'),
      b = createRacingSuit(4, '#abcdef');
    const aParts = meshes(a),
      bParts = meshes(b);
    const aGeometry = new Set(aParts.map((part) => part.geometry));
    const aMaterials = new Set(
      aParts.flatMap((part) => (Array.isArray(part.material) ? part.material : [part.material])),
    );
    expect(bParts.every((part) => !aGeometry.has(part.geometry))).toBe(true);
    expect(
      bParts.every((part) =>
        (Array.isArray(part.material) ? part.material : [part.material]).every(
          (material) => !aMaterials.has(material),
        ),
      ),
    ).toBe(true);
    for (const part of aParts)
      if ((part.material as THREE.Material).name === 'suit-fabric')
        expect((part.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('123456');
    dispose(a);
    dispose(b);
  });
});
