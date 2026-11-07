import * as THREE from 'three';
import type { Customization } from './types';
import { getCarDesign } from '../shared/car-designs';
import { bodyDesigns } from '../shared/body-designs';
import { buildClassicVehicle } from './vehicles-classic';
import { buildModernVehicle } from './vehicles-modern';
import { mesh, rounded } from './vehicle-parts';
import { buildBodyKit } from './body-kits';
import { surfacePatch } from './vehicle-decals';
import { createHelmet } from './helmets';
import { createRacingSuit } from './racing-suits';
import { createNumberPlate } from './number-plates';
import { createLiveryTextures } from './liveries';
import { createUnderglow } from './underglow';

export type KartModel = THREE.Group & {
  userData: {
    wheels: THREE.Group[];
    frontWheels: THREE.Group[];
    driver: THREE.Group;
    glow: THREE.Group;
    exhaust: THREE.Mesh[];
    shield: THREE.Mesh;
  };
};
const mat = (color: THREE.ColorRepresentation, roughness = 0.48, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

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
  driver.add(createRacingSuit(customization.suitStyle, customization.suit));
  const helmet = createHelmet(
    customization.helmetStyle,
    customization.helmet || (customization.helmetStyle ? undefined : color),
    customization.windowTint,
  );
  helmet.position.set(0, 1.02, 0.04);
  driver.add(helmet);
  const steering = add(
    new THREE.TorusGeometry(0.27, 0.045, 5, 12),
    dark,
    0,
    layout.driverY + 0.25,
    layout.driverZ + 0.6,
  );
  steering.rotation.x = -0.75;
  const glow = createUnderglow(customization.underglowStyle, customization.underglow, {
    width: layout.track * 2 + 2.4,
    length: layout.noseZ - layout.tailZ + 1.9,
  });
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
    pipe.name = 'exhaust-pipe';
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
    const textures = createLiveryTextures(customization.decal);
    const material = (map: THREE.Texture) =>
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    const hoodVinyl = material(textures.hood);
    const sideVinyl = material(textures.side);
    // Expand the badge region into a composition, but keep motifs on painted panels.
    // Split noses and the muscle car's blower need a complete motif on each side.
    const centers = hood.x ? [-Math.abs(hood.x), Math.abs(hood.x)] : [0];
    for (const x of centers) {
      const patch = surfacePatch(
        shell,
        hoodVinyl,
        [x, hood.y, hood.z],
        Math.min(layout.bodyWidth * 1.04, hood.width * (hood.x ? 1.4 : 1.75)),
        hood.length * (hood.x ? 1.6 : 2),
      );
      patch.name = 'livery-hood';
      kart.add(patch);
    }
    for (const side of [-1, 1]) {
      const patch = surfacePatch(
        shell,
        sideVinyl,
        [side * layout.side.x, layout.side.y, (layout.noseZ + layout.tailZ) / 2],
        layout.noseZ - layout.tailZ,
        Math.max(0.55, layout.side.height * 1.6),
        side,
      );
      patch.name = 'livery-side';
      kart.add(patch);
    }
    badge.visible = false;
  }
  const plate = createNumberPlate(customization.plate);
  if (plate) {
    const plateBottom = new THREE.Box3().setFromObject(plate).min.y;
    // Keep the entire plate above the exhaust mouths, including tall frames.
    const mountY = Math.max(layout.rear.y, layout.exhaust.y + 0.2 - plateBottom);
    plate.position.set(0, mountY, layout.rear.z - 0.055);
    plate.rotation.y = Math.PI;
    kart.add(plate);
  }
  kart.userData = { wheels, frontWheels, driver, glow, exhaust, shield };
  return kart;
}

export function disposeScene(scene: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (object instanceof THREE.Light && 'shadow' in object) object.shadow?.dispose();
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.LineSegments) &&
      !(object instanceof THREE.Points)
    )
      return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
}
