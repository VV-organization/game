import * as THREE from 'three';
import { createKart } from './kart';
import { createTrailEffect } from './trail-effects';
import type { Customization } from './types';

// Shared night stage: the same lit kart and particle simulation in catalog and try-on.
export function createEffectStudio(config: Customization, showTrail = false) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101725');
  scene.fog = new THREE.Fog('#101725', 16, 38);
  const kart = createKart(config);
  scene.add(kart);
  scene.add(new THREE.HemisphereLight('#adc6ee', '#20273b', 1.1));
  const key = new THREE.DirectionalLight('#e4edff', 2.2);
  key.position.set(-4, 8, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#689bff', 2);
  rim.position.set(4, 3, -6);
  scene.add(rim);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: '#171e2c', roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.04;
  scene.add(floor);
  const trail = showTrail ? createTrailEffect(config.trailStyle, config.trail) : null;
  if (trail) scene.add(trail.object);
  return { scene, kart, trail };
}

export function studioEmitter() {
  return {
    x: 0,
    y: 0.25,
    z: 0,
    heading: 0,
    speed: 24,
    active: true,
    boosting: false,
    drifting: false,
  };
}
