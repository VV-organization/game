import * as THREE from 'three';
import { createKart } from './kart';
import type { Customization } from './types';

export function createGarageScene(config: Customization = {}) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#faffec', '#737f71', 3));
  const sun = new THREE.DirectionalLight('#ffffff', 4);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#b1d4ff', 2);
  fill.position.set(4, 3, -5);
  scene.add(fill);
  const kart = createKart(config);
  scene.add(kart);
  const garage = config.garage || 0,
    decor = config.decor || 0;
  const themes = [
    ['#52616a', '#30424c', '#ff976b'],
    ['#697e84', '#435a62', '#b4e5e9'],
    ['#393d65', '#202843', '#a39aff'],
    ['#726858', '#4b4d42', '#e6c874'],
    ['#667579', '#354c59', '#e8879b'],
  ];
  const theme = garage ? themes[(garage - 1) % themes.length] : ['#626b70', '#424b51', '#b6c0c4'];
  const build = (
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    emissive = false,
  ) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      ...(emissive ? { emissive: color, emissiveIntensity: 2 } : {}),
    });
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    return object;
  };
  build(new THREE.CylinderGeometry(3.2, 3.35, 0.24, 64), theme[0], 0, -0.14, 0);
  build(new THREE.CylinderGeometry(3.22, 3.22, 0.045, 64), theme[2], 0, -0.07, 0);
  build(new THREE.CylinderGeometry(3.17, 3.17, 0.09, 64), theme[0], 0, -0.015, 0);
  const floor = build(new THREE.PlaneGeometry(35, 35), theme[1], 0, -0.29, 0);
  floor.rotation.x = -Math.PI / 2;
  build(new THREE.BoxGeometry(17, 6, 0.25), theme[1], 0, 2.7, -5.5);
  for (const x of [-7.5, -3.8, 0, 3.8, 7.5])
    build(new THREE.BoxGeometry(0.12, 6, 0.3), theme[0], x, 2.7, -5.3);
  for (let i = 0; i < 6; i++)
    build(new THREE.BoxGeometry(16, 0.022, 0.04), theme[0], 0, 0.2 + i * 0.75, -5.34);
  build(new THREE.BoxGeometry(12, 0.07, 0.12), theme[2], 0, 4.2, -5.1, true);
  for (const x of [-6.5, 6.5]) {
    const bar = build(new THREE.BoxGeometry(0.09, 3.3, 0.12), theme[2], x, 2.1, -5.15, true);
    bar.rotation.z = x > 0 ? -0.13 : 0.13;
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.43, 3.46, 64),
    new THREE.MeshBasicMaterial({ color: theme[2], transparent: true, opacity: 0.5 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.27;
  scene.add(ring);
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 1024;
  wallCanvas.height = 256;
  const ctx = wallCanvas.getContext('2d')!;
  ctx.fillStyle = theme[1];
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#dbe4df';
  ctx.font = '900 75px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FApix  /  GARAGE', 512, 108);
  ctx.fillStyle = theme[2];
  ctx.font = '500 36px sans-serif';
  ctx.fillText(String(garage + 1).padStart(2, '0') + '     •     BUILT FOR THE NEXT LAP', 512, 174);
  const wallSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 1.45),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(wallCanvas) }),
  );
  wallSign.position.set(0, 2.75, -5.3);
  scene.add(wallSign);
  if (garage > 5) {
    for (const side of [-1, 1]) {
      build(new THREE.BoxGeometry(1.1, 2.9, 0.7), theme[0], side * 5.9, 1.15, -4.7);
      build(new THREE.BoxGeometry(0.92, 2.65, 0.05), theme[2], side * 5.9, 1.15, -4.31);
      build(new THREE.BoxGeometry(0.045, 0.6, 0.06), '#d5e0df', side * 5.9 + 0.25, 1.15, -4.26);
    }
    build(new THREE.BoxGeometry(12, 0.2, 0.35), theme[0], 0, 4.9, -2.2);
    build(new THREE.BoxGeometry(10, 0.055, 0.38), theme[2], 0, 4.77, -2.2, true);
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 2; j++)
        build(
          new THREE.BoxGeometry(0.45, 0.015, 0.45),
          (i + j) % 2 ? theme[2] : theme[1],
          (i - 6.5) * 0.45,
          -0.275,
          3.9 + j * 0.45,
        );
  }
  // Workshop props make each room a tangible place, with optional collectible decor.
  for (let j = 0; j < 3; j++) {
    const tire = build(
      new THREE.TorusGeometry(0.58, 0.2, 8, 16),
      '#1b2931',
      -4.7,
      0.05 + j * 0.37,
      -2.9,
    );
    tire.rotation.x = Math.PI / 2;
  }
  build(new THREE.BoxGeometry(1.5, 1.2, 0.8), theme[2], 4.5, 0.3, -3.5);
  for (let j = 0; j < 4; j++) {
    build(new THREE.BoxGeometry(1.36, 0.025, 0.025), theme[1], 4.5, 0.05 + j * 0.24, -3.08);
    build(new THREE.BoxGeometry(0.35, 0.035, 0.04), '#c2d0d0', 4.5, 0.17 + j * 0.24, -3.05);
  }
  for (const x of [-4.8, 4.8]) {
    build(new THREE.BoxGeometry(0.65, 0.09, 0.65), '#22333e', x, -0.2, 1.4);
    build(new THREE.ConeGeometry(0.27, 0.8, 8), theme[2], x, 0.22, 1.4);
  }
  if (decor) {
    const prop = decor % 4,
      finish = Math.min(4, Math.floor((decor - 1) / 4));
    const finishes = [
      ['#e8be55', '#9caaa2', '#79ac8c'],
      ['#ed876b', '#e2b2a4', '#64a899'],
      ['#a99aeb', '#777caf', '#8ca9d0'],
      ['#d2b17b', '#9b8e75', '#b6ad78'],
      ['#84e3b8', '#526d68', '#9edc6d'],
    ];
    const [primary, secondary, leafColor] = finishes[finish];
    if (prop === 0) {
      build(new THREE.CylinderGeometry(0.45, 0.32, 0.65, 8), primary, -3.9, 0.08, -1.6);
      build(new THREE.CylinderGeometry(0.46, 0.46, 0.055, 8), secondary, -3.9, 0.33, -1.6);
      for (let i = 0; i < 6; i++) {
        const leaf = build(
          new THREE.ConeGeometry(0.25, 1.7 + finish * 0.06, 4),
          leafColor,
          -3.9 + Math.sin(i) * 0.25,
          1,
          -1.6 + Math.cos(i) * 0.25,
        );
        leaf.rotation.z = Math.sin(i) * 0.4;
      }
    }
    if (prop === 1) {
      build(new THREE.BoxGeometry(0.85, 0.9, 0.85), secondary, 3.9, 0.2, -1.7);
      build(new THREE.CylinderGeometry(0.23, 0.32, 0.15, 12), primary, 3.9, 0.74, -1.7);
      build(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8), primary, 3.9, 1, -1.7);
      const cup = build(new THREE.ConeGeometry(0.36, 0.6, 12), primary, 3.9, 1.5, -1.7);
      cup.rotation.z = Math.PI;
      for (const side of [-1, 1]) {
        const handle = build(
          new THREE.TorusGeometry(0.24, 0.045, 6, 12),
          primary,
          3.9 + side * 0.3,
          1.42,
          -1.7,
        );
        handle.scale.x = 0.7;
      }
    }
    if (prop === 2) {
      for (let i = 0; i < 3; i++) {
        const x = 3.9 + (i % 2) * 0.8,
          y = 0.12 + Math.floor(i / 2) * 0.8;
        build(new THREE.BoxGeometry(0.75, 0.75, 0.75), i === 1 ? secondary : primary, x, y, -1.7);
        for (const offset of [-0.23, 0.23])
          build(new THREE.BoxGeometry(0.075, 0.78, 0.78), theme[1], x + offset, y, -1.7);
      }
    }
    if (prop === 3) {
      build(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 8), '#d8e3dd', -4, 1.35, -1.4);
      build(new THREE.CylinderGeometry(0.35, 0.4, 0.1, 12), secondary, -4, -0.22, -1.4);
      const flag = build(new THREE.BoxGeometry(1.15, 0.8, 0.035), primary, -3.45, 2.5, -1.4);
      flag.rotation.y = 0.2;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++)
          if ((i + j) % 2 === 0) {
            const square = build(
              new THREE.BoxGeometry(0.26, 0.25, 0.045),
              secondary,
              -3.85 + i * 0.27,
              2.25 + j * 0.25,
              -1.37,
            );
            square.rotation.y = 0.2;
          }
    }
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: 0.18 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = -0.03;
  scene.add(ground);
  return { scene, kart };
}
