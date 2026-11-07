import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createTrailEffect } from './trail-effects';
import { trailDesigns } from '../shared/trail-designs';

const emitter = { x: 0, y: 0, z: 0, heading: 0, speed: 22, active: true };
const meshOf = (effect: ReturnType<typeof createTrailEffect>) =>
  effect.object.children[0] as THREE.InstancedMesh;
const matrix = new THREE.Matrix4();
const point = new THREE.Vector3();

describe('pooled world-space trail effects', () => {
  it('defines twenty individual shape and motion families', () => {
    expect(trailDesigns).toHaveLength(20);
    expect(new Set(trailDesigns.map((design) => design.shape)).size).toBe(20);
    expect(new Set(trailDesigns.map((design) => design.description)).size).toBe(20);
    const signatures = trailDesigns.map(({ variant }) => {
      const effect = createTrailEffect(variant);
      const geometry = meshOf(effect).geometry;
      return [...geometry.attributes.position.array].map((v) => v.toFixed(3)).join(',');
    });
    expect(new Set(signatures).size).toBe(20);
  });

  it.each(Array.from({ length: 20 }, (_, index) => index + 1))(
    'keeps effect %i deterministic, bounded and finite, then drains its pool',
    (variant) => {
      const effect = createTrailEffect(variant);
      const copy = createTrailEffect(variant);
      const mesh = meshOf(effect);
      const geometry = mesh.geometry;
      expect(effect.object.parent).toBeNull();
      expect(effect.object.children.length).toBeLessThanOrEqual(3);
      expect(mesh.count).toBeLessThanOrEqual(120);
      expect((mesh.material as THREE.Material).depthWrite).toBe(false);
      for (let step = 0; step < 80; step++) {
        effect.update(1 / 60, emitter);
        copy.update(1 / 60, emitter);
      }
      expect(effect.object.userData.aliveCount).toBeGreaterThan(12);
      expect([...mesh.instanceMatrix.array]).toEqual([...meshOf(copy).instanceMatrix.array]);
      expect([...mesh.instanceMatrix.array].every(Number.isFinite)).toBe(true);
      const alpha = mesh.geometry.getAttribute('particleOpacity');
      let visible = 0;
      for (let index = 0; index < mesh.count; index++) {
        if (alpha.getX(index) <= 0) continue;
        visible++;
        mesh.getMatrixAt(index, matrix);
        point.setFromMatrixPosition(matrix);
        expect(point.z).toBeLessThan(-1.1);
        expect(point.z).toBeGreaterThan(-8);
        expect(Math.abs(point.x)).toBeLessThan(1.65);
        expect(point.y).toBeLessThan(1.8);
      }
      expect(visible).toBe(effect.object.userData.aliveCount);
      for (let step = 0; step < 200; step++) effect.update(1 / 60, { ...emitter, active: false });
      expect(effect.object.userData.aliveCount).toBe(0);
      expect([...alpha.array].every((value) => value === 0)).toBe(true);
      effect.update(NaN, emitter);
      effect.update(Infinity, { ...emitter, heading: NaN, x: Infinity });
      expect([...mesh.instanceMatrix.array].every(Number.isFinite)).toBe(true);
      expect(mesh.geometry).toBe(geometry);
    },
  );

  it.each(Array.from({ length: 20 }, (_, index) => index + 1))(
    'preserves the studio lifetime and relative footprint for moving effect %i',
    (variant) => {
      const studio = createTrailEffect(variant);
      const racing = createTrailEffect(variant);
      const position = { x: 0, z: 0 };
      for (let frame = 0; frame < 120; frame++) {
        position.x = 30;
        position.z = 20 + (frame * 36) / 60;
        studio.update(1 / 60, { ...emitter, speed: 36 });
        racing.update(1 / 60, { ...emitter, ...position, speed: 36 });
      }
      const studioMesh = meshOf(studio);
      const raceMesh = meshOf(racing);
      const studioOpacity = studioMesh.geometry.getAttribute('particleOpacity');
      const raceOpacity = raceMesh.geometry.getAttribute('particleOpacity');
      expect(studio.object.userData.aliveCount).toBeGreaterThan(25);
      expect(racing.object.userData.aliveCount).toBe(studio.object.userData.aliveCount);
      expect([...raceOpacity.array]).toEqual([...studioOpacity.array]);
      const studioMatrix = new THREE.Matrix4();
      const raceMatrix = new THREE.Matrix4();
      for (let index = 0; index < studioMesh.count; index++) {
        if (studioOpacity.getX(index) <= 0) continue;
        studioMesh.getMatrixAt(index, studioMatrix);
        raceMesh.getMatrixAt(index, raceMatrix);
        raceMatrix.elements[12] -= position.x;
        raceMatrix.elements[14] -= position.z;
        for (let component = 0; component < 16; component++)
          expect(raceMatrix.elements[component]).toBeCloseTo(studioMatrix.elements[component], 3);
      }
    },
  );

  it('keeps existing particles moving in their original world direction through a turn', () => {
    const effect = createTrailEffect(1);
    for (let frame = 0; frame < 60; frame++)
      effect.update(1 / 60, { ...emitter, z: frame * 0.6, speed: 36 });
    const mesh = meshOf(effect);
    const alpha = mesh.geometry.getAttribute('particleOpacity');
    let tracked = -1;
    for (let index = 0; index < mesh.count; index++) {
      if (alpha.getX(index) < 0.6) continue;
      mesh.getMatrixAt(index, matrix);
      point.setFromMatrixPosition(matrix);
      if (point.z > 59 * 0.6 - 3.5) {
        tracked = index;
        break;
      }
    }
    expect(tracked).toBeGreaterThanOrEqual(0);
    const before = point.clone();
    effect.update(1 / 60, {
      ...emitter,
      x: 0.6,
      z: 59 * 0.6,
      heading: Math.PI / 2,
      speed: 36,
    });
    mesh.getMatrixAt(tracked, matrix);
    point.setFromMatrixPosition(matrix);
    expect(point.z - before.z).toBeGreaterThan(0.4);
    expect(Math.abs(point.x - before.x)).toBeLessThan(0.08);
    expect(effect.object.position.toArray()).toEqual([0, 0, 0]);
  });

  it('clears the old wake on teleport and starts locally without a velocity spike', () => {
    const effect = createTrailEffect(7);
    for (let frame = 0; frame < 60; frame++)
      effect.update(1 / 60, { ...emitter, z: frame * 0.6, speed: 36 });
    // A five-metre reset is still inside the normal wake radius, but cannot be
    // legitimate motion in one 60 Hz frame. It must clear rather than smear.
    const resetPosition = { x: 5, z: 59 * 0.6 };
    effect.update(1 / 60, { ...emitter, ...resetPosition, active: false });
    expect(effect.object.userData.aliveCount).toBe(0);
    const mesh = meshOf(effect);
    const alpha = mesh.geometry.getAttribute('particleOpacity');
    expect([...alpha.array].every((value) => value === 0)).toBe(true);
    for (let frame = 0; frame < 80; frame++)
      effect.update(1 / 60, { ...emitter, ...resetPosition });
    expect(effect.object.userData.aliveCount).toBeGreaterThan(25);
    for (let index = 0; index < mesh.count; index++) {
      if (alpha.getX(index) <= 0) continue;
      mesh.getMatrixAt(index, matrix);
      point.setFromMatrixPosition(matrix);
      expect(point.z - resetPosition.z).toBeLessThan(-1.1);
      expect(point.z - resetPosition.z).toBeGreaterThan(-8);
      expect(Math.abs(point.x - resetPosition.x)).toBeLessThan(1.65);
    }
  });

  it('treats the first world position as placement, even if it emits immediately', () => {
    const effect = createTrailEffect(1);
    effect.update(0.05, { ...emitter, x: 1000, z: 2000 });
    expect(effect.object.userData.aliveCount).toBeGreaterThan(0);
    const mesh = meshOf(effect);
    const alpha = mesh.geometry.getAttribute('particleOpacity');
    for (let index = 0; index < mesh.count; index++) {
      if (alpha.getX(index) <= 0) continue;
      mesh.getMatrixAt(index, matrix);
      point.setFromMatrixPosition(matrix);
      expect(Math.abs(point.x - 1000)).toBeLessThan(1);
      expect(point.z).toBeGreaterThan(1997);
      expect(point.z).toBeLessThan(1999);
    }
  });

  it('emits behind the kart at quarter-turn headings and remains in world space', () => {
    const effect = createTrailEffect(1);
    for (let step = 0; step < 30; step++)
      effect.update(1 / 60, { ...emitter, x: 20, z: 10, heading: Math.PI / 2 });
    const mesh = meshOf(effect);
    const alpha = mesh.geometry.getAttribute('particleOpacity');
    for (let index = 0; index < mesh.count; index++) {
      if (alpha.getX(index) <= 0) continue;
      mesh.getMatrixAt(index, matrix);
      point.setFromMatrixPosition(matrix);
      expect(point.x).toBeLessThan(18.9);
      expect(Math.abs(point.z - 10)).toBeLessThan(1.65);
    }
    expect(effect.object.position.toArray()).toEqual([0, 0, 0]);
  });
});
