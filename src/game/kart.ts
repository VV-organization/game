import * as THREE from 'three';
import type { Customization } from './types';
import { getCarDesign } from '../shared/car-designs';
import { bodyDesigns } from '../shared/body-designs';
import { buildClassicVehicle } from './vehicles-classic';
import { buildModernVehicle } from './vehicles-modern';
import { mesh, rounded } from './vehicle-parts';
import { buildBodyKit } from './body-kits';
import { surfacePatch } from './vehicle-decals';

export type KartModel = THREE.Group & {
  userData: {
    wheels: THREE.Group[];
    frontWheels: THREE.Group[];
    driver: THREE.Group;
    glow: THREE.Mesh;
    exhaust: THREE.Mesh[];
    shield: THREE.Mesh;
  };
};
const mat = (color: THREE.ColorRepresentation, roughness = 0.48, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function vinylTexture(variant: number) {
  const pattern = (variant - 1) % 20,
    pro = variant > 20;
  const palette = [
    '#f0c77c',
    '#c7b5f4',
    '#afdfef',
    '#f5a5bd',
    '#d9ad70',
    '#6bd8df',
    '#b6a0f4',
    '#f4b27e',
    '#c4d7d4',
    '#f36d4a',
    '#c1b7ff',
    '#f2eecb',
    '#80d9bd',
    '#74b8e7',
    '#d8df93',
    '#a6d7d0',
    '#8ca27d',
    '#f8e9d2',
    '#eacb66',
    '#ff9cac',
  ];
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = palette[pattern];
  ctx.strokeStyle = palette[pattern];
  ctx.lineWidth = pro ? 12 : 8;
  ctx.lineCap = 'round';
  if (pro) {
    ctx.fillStyle = '#152e3c';
    ctx.fillRect(4, 4, 248, 248);
    ctx.strokeRect(10, 10, 236, 236);
    ctx.fillStyle = palette[pattern];
  }
  const line = (points: number[][]) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  if (pattern === 0)
    for (let i = 0; i < 7; i++) ctx.fillRect(15 + i * 33, 70 + (i % 3) * 25, 22, 170);
  else if (pattern === 1 || pattern === 6)
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.arc(18 + ((i * 73) % 222), 17 + ((i * 59) % 222), (i % 3) + 2, 0, Math.PI * 2);
      ctx.fill();
      if (pattern === 6 && i < 3) {
        ctx.beginPath();
        ctx.ellipse(128, 128, 35 + i * 27, 14 + i * 10, 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  else if (pattern === 2)
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 70, 230);
      ctx.lineTo(55 + i * 70, 40 + i * 15);
      ctx.lineTo(115 + i * 70, 230);
      ctx.closePath();
      ctx.fill();
    }
  else if (pattern === 3)
    for (let i = 0; i < 9; i++) {
      const x = 28 + ((i * 73) % 200),
        y = 25 + ((i * 47) % 200);
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        ctx.ellipse(
          x + Math.sin(j * 1.26) * 10,
          y + Math.cos(j * 1.26) * 10,
          7,
          11,
          j * 1.26,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  else if ([4, 5, 13].includes(pattern))
    for (let j = 0; j < 7; j++) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 4) {
        const y = 22 + j * 35 + Math.sin(x / (pattern === 4 ? 70 : 35) + j) * 15;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  else if (pattern === 7)
    for (let i = -2; i < 7; i++)
      line([
        [i * 55, 0],
        [i * 55 + 145, 256],
      ]);
  else if (pattern === 8 || pattern === 17) {
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++)
        if ((i + j) % 2 === 0)
          ctx.fillRect(i * 32, j * 32, pattern === 8 ? 23 : 32, pattern === 8 ? 23 : 32);
  } else if (pattern === 9)
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 50, 250);
      ctx.quadraticCurveTo(i * 50 + 80, 120, i * 50 + 25, 15);
      ctx.quadraticCurveTo(i * 50 + 75, 165, i * 50 + 45, 250);
      ctx.fill();
    }
  else if (pattern === 10 || pattern === 18) {
    ctx.beginPath();
    ctx.moveTo(150, 10);
    ctx.lineTo(55, 140);
    ctx.lineTo(120, 130);
    ctx.lineTo(80, 245);
    ctx.lineTo(211, 95);
    ctx.lineTo(144, 110);
    ctx.closePath();
    ctx.fill();
    if (pattern === 10) {
      line([
        [30, 20],
        [15, 65],
        [40, 55],
        [28, 100],
      ]);
      line([
        [218, 170],
        [205, 205],
        [230, 195],
        [216, 240],
      ]);
    }
  } else if (pattern === 11)
    for (let i = 0; i < 5; i++) ctx.fillRect(28 + i * 43, 10 + (i % 2) * 45, 18, 230);
  else if (pattern === 12)
    for (let j = 0; j < 5; j++)
      line([
        [10, 20 + j * 45],
        [65, 45 + j * 45],
        [125, 20 + j * 45],
        [185, 45 + j * 45],
        [245, 20 + j * 45],
      ]);
  else if (pattern === 14) {
    ctx.fillRect(65, 0, 33, 256);
    ctx.fillRect(158, 0, 33, 256);
  } else if (pattern === 15)
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.roundRect(13 + i * 19, 13 + i * 19, 230 - i * 38, 230 - i * 38, 25);
      ctx.stroke();
    }
  else if (pattern === 16)
    for (let i = 0; i < 13; i++) {
      ctx.beginPath();
      const x = (i * 71) % 230,
        y = (i * 47) % 230;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40, y - 10);
      ctx.lineTo(x + 55, y + 20);
      ctx.lineTo(x + 15, y + 45);
      ctx.lineTo(x - 12, y + 23);
      ctx.closePath();
      ctx.fill();
    }
  else if (pattern === 19)
    for (let i = 0; i < 30; i++)
      ctx.fillRect((i * 73) % 240, (i * 47) % 240, 14 + (i % 3) * 7, 14 + (i % 3) * 7);
  return new THREE.CanvasTexture(canvas);
}

export function createKart(customization: Customization = {}, number = 1): KartModel {
  const kart = new THREE.Group() as KartModel;
  const design = getCarDesign(customization.car);
  const bodyVariant = customization.body ?? 0;
  const hasBodyKit =
    Number.isInteger(bodyVariant) && bodyVariant >= 1 && bodyVariant <= bodyDesigns.length;
  const color = customization.color || design.color;
  const paint = mat(color, 0.33, 0.18),
    dark = mat('#182329'),
    rubber = mat('#151b22', 0.9),
    silver = mat('#b1c4cd', 0.27, 0.75);
  paint.name = 'vehicle-paint';
  const accent = mat('#f4f0dd', 0.38),
    seatMat = mat('#26313c', 0.8),
    glass = mat('#294b5e', 0.2, 0.48),
    light = mat('#fff1bd', 0.24);
  light.emissive.set('#ffe2a1');
  light.emissiveIntensity = 0.3;
  const materials = { paint, dark, metal: silver, accent, glass, light };
  const layout =
    design.variant <= 5
      ? buildClassicVehicle(design.variant, kart, materials)
      : buildModernVehicle(design.variant, kart, materials);
  if (hasBodyKit)
    kart.traverse((part) => {
      if (part.name === 'stock-front-wing' || part.name === 'stock-rear-wing') part.visible = false;
    });
  const shell: THREE.Mesh[] = [];
  kart.traverseVisible((part) => {
    if (part instanceof THREE.Mesh && part.material === paint) shell.push(part);
  });
  kart.updateMatrixWorld(true);
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = kart,
  ) => mesh(parent, geometry, material, x, y, z);
  const wheels: THREE.Group[] = [],
    frontWheels: THREE.Group[] = [];
  for (const z of layout.axles)
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      const rearMuscle = design.variant === 6 && z === layout.axles[0];
      const radius = layout.wheelRadius * (rearMuscle ? 1.08 : 1);
      const tireWidth = layout.wheelWidth * (rearMuscle ? 1.15 : 1);
      wheel.position.set(side * layout.track, radius, z);
      kart.add(wheel);
      const tire = add(
        new THREE.CylinderGeometry(radius, radius, tireWidth, 20),
        rubber,
        0,
        0,
        0,
        wheel,
      );
      tire.rotation.z = Math.PI / 2;
      const wheelStyle = customization.wheels || 0;
      const rimMaterial = wheelStyle
        ? mat(['#d9c69a', '#171e29', '#d5e7f0', color, '#a6a0ff'][wheelStyle % 5], 0.23, 0.72)
        : design.variant === 4
          ? silver
          : mat('#c2cbd1', 0.22, 0.78);
      const rimRadius = radius * (wheelStyle % 3 === 1 ? 0.71 : 0.59);
      const rim = add(
        new THREE.CylinderGeometry(
          rimRadius,
          rimRadius,
          tireWidth + 0.014,
          wheelStyle % 3 === 2 ? 5 : 12,
        ),
        rimMaterial,
        0,
        0,
        0,
        wheel,
      );
      rim.rotation.z = Math.PI / 2;
      const hub = add(
        new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, tireWidth + 0.035, 8),
        paint,
        0,
        0,
        0,
        wheel,
      );
      hub.rotation.z = Math.PI / 2;
      if (wheelStyle > 0) {
        const spoke = add(
          new THREE.BoxGeometry(tireWidth + 0.046, 0.08, rimRadius * 1.85),
          rimMaterial,
          0,
          0,
          0,
          wheel,
        );
        spoke.rotation.x = wheelStyle * 0.4;
      }
      if (design.variant === 3)
        for (let i = 0; i < 12; i++) {
          const angle = (i * Math.PI) / 6;
          const tread = add(
            new THREE.BoxGeometry(tireWidth + 0.045, 0.13, 0.22),
            rubber,
            0,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            wheel,
          );
          tread.rotation.x = angle;
        }
      if (design.variant === 4 && !wheelStyle)
        for (let i = 0; i < 8; i++) {
          const spoke = add(
            new THREE.BoxGeometry(tireWidth + 0.025, 0.033, rimRadius * 1.8),
            silver,
            0,
            0,
            0,
            wheel,
          );
          spoke.rotation.x = (i * Math.PI) / 8;
        }
      wheels.push(wheel);
      if (z === layout.axles[1]) frontWheels.push(wheel);
    }
  rounded(kart, seatMat, [0.76, 0.25, 0.7], [0, layout.driverY, layout.driverZ - 0.05], 0.1);
  const seat = rounded(
    kart,
    seatMat,
    [0.77, 0.72, 0.2],
    [0, layout.driverY + 0.3, layout.driverZ - 0.42],
    0.09,
  );
  seat.rotation.x = -0.1;
  const driver = new THREE.Group();
  driver.position.set(0, layout.driverY, layout.driverZ);
  driver.scale.setScalar(0.88);
  kart.add(driver);
  const suit = mat(customization.suit || '#f8f4e8');
  add(new THREE.CapsuleGeometry(0.34, 0.4, 3, 8), suit, 0, 0.37, 0, driver);
  const helmet = add(
    new THREE.SphereGeometry(0.48, 16, 12),
    mat(customization.helmet || color, 0.26),
    0,
    1.02,
    0.04,
    driver,
  );
  helmet.scale.set(1, 1.07, 1);
  // Sphere phi = PI / 2 faces the kart's +Z front; keep the rear of the helmet clear.
  const visor = add(
    new THREE.SphereGeometry(0.495, 20, 8, Math.PI / 2 - 1.08, 2.16, 1.19, 0.74),
    mat(customization.windowTint || '#163544', 0.16, 0.6),
    0,
    1.02,
    0.04,
    driver,
  );
  visor.scale.y = 1.07;
  add(new THREE.BoxGeometry(0.16, 0.035, 0.7), accent, 0, 1.53, 0.03, driver);
  for (const side of [-1, 1]) {
    const arm = add(
      new THREE.CapsuleGeometry(0.13, 0.44, 2, 6),
      suit,
      side * 0.36,
      0.37,
      0.33,
      driver,
    );
    arm.rotation.x = -0.8;
    arm.rotation.z = side * 0.3;
    add(new THREE.SphereGeometry(0.16, 8, 6), dark, side * 0.35, 0.25, 0.59, driver);
  }
  const steering = add(
    new THREE.TorusGeometry(0.27, 0.045, 5, 12),
    dark,
    0,
    layout.driverY + 0.25,
    layout.driverZ + 0.6,
  );
  steering.rotation.x = -0.75;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 4.1),
    new THREE.MeshBasicMaterial({
      color: customization.underglow || color,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.07;
  kart.add(glow);
  const exhaust: THREE.Mesh[] = [];
  for (const x of [-layout.exhaust.x, layout.exhaust.x]) {
    const pipe = add(
      new THREE.CylinderGeometry(0.13, 0.15, 0.45, 8),
      silver,
      x,
      layout.exhaust.y,
      layout.exhaust.z,
    );
    pipe.rotation.x = Math.PI / 2;
    const flame = add(
      new THREE.ConeGeometry(0.24, 1.5, 7),
      new THREE.MeshBasicMaterial({
        color: customization.trail || '#64f7ff',
        transparent: true,
        opacity: 0.9,
      }),
      x,
      layout.exhaust.y,
      layout.exhaust.z - 0.56,
    );
    flame.rotation.x = -Math.PI / 2;
    flame.visible = false;
    exhaust.push(flame);
  }
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(2.15, 24, 16),
    new THREE.MeshBasicMaterial({
      color: '#79ecff',
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      depthWrite: false,
    }),
  );
  shield.position.y = 1;
  shield.visible = false;
  kart.add(shield);
  // Distinct liveries and number plates remain legible at race distance.
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f9f7e8';
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 120, 28);
  ctx.fill();
  ctx.fillStyle = '#142c2e';
  ctx.font = '900 78px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(number).padStart(2, '0'), 64, 92);
  const hood = layout.hood;
  const badge = surfacePatch(
    shell,
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      side: THREE.DoubleSide,
    }),
    [hood.x, hood.y, hood.z],
    Math.min(0.42, hood.width * 0.7),
    Math.min(0.42, hood.length * 0.7),
  );
  kart.add(badge);
  if (hasBodyKit) {
    kart.add(
      buildBodyKit({
        variant: bodyVariant,
        carVariant: design.variant,
        layout,
        shell,
        materials,
      }),
    );
  }
  if (customization.decal) {
    const vinyl = new THREE.MeshBasicMaterial({
      map: vinylTexture(customization.decal),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    kart.add(surfacePatch(shell, vinyl, [hood.x, hood.y, hood.z], hood.width, hood.length));
    for (const side of [-1, 1])
      kart.add(
        surfacePatch(
          shell,
          vinyl,
          [side * layout.side.x, layout.side.y, layout.side.z],
          layout.side.length,
          layout.side.height,
          side,
        ),
      );
    badge.visible = false;
  }
  if (customization.plate) {
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 256;
    plateCanvas.height = 96;
    const pc = plateCanvas.getContext('2d')!;
    pc.fillStyle = customization.plate % 2 ? '#f7f4dc' : '#142d37';
    pc.fillRect(0, 0, 256, 96);
    pc.fillStyle = customization.plate % 2 ? '#193d43' : '#f7f4dc';
    pc.font = 'bold 48px monospace';
    pc.textAlign = 'center';
    pc.fillText(`FP ${String(customization.plate * 37).padStart(3, '0')}`, 128, 65);
    const plate = add(
      new THREE.PlaneGeometry(0.85, 0.32),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(plateCanvas) }),
      0,
      layout.rear.y,
      layout.rear.z - 0.025,
    );
    plate.rotation.y = Math.PI;
  }
  kart.userData = { wheels, frontWheels, driver, glow, exhaust, shield };
  return kart;
}

export function disposeScene(scene: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
}
