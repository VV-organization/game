import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type VehicleMaterials = {
  paint: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  light: THREE.MeshStandardMaterial;
};

export type VehicleLayout = {
  axles: [number, number];
  track: number;
  wheelRadius: number;
  wheelWidth: number;
  driverY: number;
  driverZ: number;
  hood: { x: number; y: number; z: number; width: number; length: number; pitch?: number };
  side: { x: number; y: number; z: number; length: number; height: number };
  rear: { y: number; z: number };
  exhaust: { x: number; y: number; z: number };
  bodyWidth: number;
  noseZ: number;
  tailZ: number;
};

export const standardLayout: VehicleLayout = {
  axles: [-1.12, 1.22],
  track: 1.08,
  wheelRadius: 0.46,
  wheelWidth: 0.4,
  driverY: 1.02,
  driverZ: -0.32,
  hood: { x: 0, y: 0.98, z: 1.18, width: 0.72, length: 0.72 },
  side: { x: 0.92, y: 0.78, z: -0.15, length: 1.1, height: 0.3 },
  rear: { y: 0.8, z: -1.72 },
  exhaust: { x: 0.42, y: 0.55, z: -1.72 },
  bodyWidth: 1.8,
  noseZ: 2.05,
  tailZ: -1.75,
};

export function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

export function rounded(
  parent: THREE.Object3D,
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
  radius = 0.08,
) {
  return mesh(
    parent,
    new RoundedBoxGeometry(...size, 1, Math.min(radius, ...size.map((n) => n / 2))),
    material,
    ...position,
  );
}

export function ellipsoid(
  parent: THREE.Object3D,
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
) {
  const part = mesh(parent, new THREE.SphereGeometry(1, 16, 10), material, ...position);
  part.scale.set(...size);
  return part;
}

export function rod(
  parent: THREE.Object3D,
  material: THREE.Material,
  from: [number, number, number],
  to: [number, number, number],
  radius = 0.045,
) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    direction = b.clone().sub(a);
  const part = mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
    material,
  );
  part.position.copy(a.add(b).multiplyScalar(0.5));
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return part;
}

export function tube(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: [number, number, number][],
  radius = 0.06,
  closed = false,
) {
  const path = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    closed,
    'centripetal',
  );
  return mesh(parent, new THREE.TubeGeometry(path, points.length * 4, radius, 6, closed), material);
}

// A longitudinal shell with a bevelled/elliptical cross-section; dimensions are half-extents.
export function hull(
  parent: THREE.Object3D,
  material: THREE.Material,
  sections: Array<{ z: number; width: number; y: number; height: number }>,
  sides = 12,
) {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const section of sections)
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      vertices.push(
        Math.cos(angle) * section.width,
        section.y + Math.sin(angle) * section.height,
        section.z,
      );
    }
  for (let ring = 0; ring < sections.length - 1; ring++)
    for (let i = 0; i < sides; i++) {
      const a = ring * sides + i,
        b = ring * sides + ((i + 1) % sides),
        c = a + sides,
        d = b + sides;
      indices.push(a, b, c, b, d, c);
    }
  for (let i = 1; i < sides - 1; i++) {
    indices.push(0, i + 1, i);
    const end = (sections.length - 1) * sides;
    indices.push(end, end + i, end + i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

export function lamp(
  parent: THREE.Object3D,
  materials: VehicleMaterials,
  x: number,
  y: number,
  z: number,
  radius = 0.14,
) {
  const housing = mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius * 1.08, 0.12, 16),
    materials.dark,
    x,
    y,
    z,
  );
  housing.rotation.x = Math.PI / 2;
  const lens = mesh(
    parent,
    new THREE.CircleGeometry(radius * 0.78, 16),
    materials.light,
    x,
    y,
    z + 0.065,
  );
  return lens;
}

export function suspension(
  parent: THREE.Object3D,
  materials: VehicleMaterials,
  layout: VehicleLayout,
) {
  for (const z of layout.axles)
    for (const side of [-1, 1]) {
      rod(
        parent,
        materials.metal,
        [side * 0.28, 0.48, z - 0.25],
        [side * layout.track, layout.wheelRadius, z],
        0.045,
      );
      rod(
        parent,
        materials.dark,
        [side * 0.35, 0.6, z + 0.22],
        [side * layout.track, layout.wheelRadius, z],
        0.05,
      );
    }
}
