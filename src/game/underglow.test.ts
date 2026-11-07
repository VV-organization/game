import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createUnderglow, updateUnderglow } from './underglow';
import { underglowDesigns } from '../shared/underglow-designs';

describe('underglow lighting patterns', () => {
  it('leaves unequipped vehicles unlit and preserves color-only equipment', () => {
    expect(createUnderglow().children).toHaveLength(0);
    expect(createUnderglow(undefined, '#ef5522').userData.variant).toBe(1);
  });

  it('defines twenty distinct, described lighting patterns', () => {
    expect(underglowDesigns).toHaveLength(20);
    expect(new Set(underglowDesigns.map((design) => design.pattern)).size).toBe(20);
    expect(new Set(underglowDesigns.map((design) => design.description)).size).toBe(20);
  });

  it.each(Array.from({ length: 20 }, (_, index) => index + 1))(
    'keeps pattern %i flat, transparent, bright and allocation-free while animating',
    (variant) => {
      const light = createUnderglow(variant, '#020305', { width: 3.8, length: 5.1 });
      const mesh = light.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
      expect(light.name).toBe('kart-underglow');
      expect(light.children).toHaveLength(1);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.material.uniforms.style.value).toBe(variant);
      expect(Math.max(...mesh.material.uniforms.primary.value.toArray())).toBeGreaterThan(0.7);
      const geometry = mesh.geometry;
      const bounds = new THREE.Box3().setFromObject(light);
      expect(bounds.min.y).toBeCloseTo(0.04, 5);
      expect(bounds.max.y).toBeCloseTo(0.04, 5);
      expect(bounds.max.x - bounds.min.x).toBeCloseTo(3.8, 5);
      expect(bounds.max.z - bounds.min.z).toBeCloseTo(5.1, 5);
      updateUnderglow(light, 3.2);
      expect(mesh.material.uniforms.time.value).toBe(3.2);
      expect(mesh.geometry).toBe(geometry);
      updateUnderglow(light, NaN);
      expect(Number.isFinite(mesh.material.uniforms.time.value)).toBe(true);
      geometry.dispose();
      mesh.material.dispose();
    },
  );
});
