import * as THREE from 'three';
import { helmetDesigns } from '../shared/helmet-designs';
import { ellipsoid, hull, mesh, rod, rounded, tube } from './vehicle-parts';

type Shell = {
  x: number;
  y: number;
  z: number;
  upper: number;
  lower: number;
  jaw: number;
  sides?: number;
  flat?: number;
};

// Dimensions change the actual shell, aperture and jaw rather than only its paint.
const shells: Shell[] = [
  { x: 0.46, y: 0.47, z: 0.46, upper: 1.28, lower: 1.91, jaw: 0.54 },
  { x: 0.445, y: 0.38, z: 0.55, upper: 1.2, lower: 1.82, jaw: 0.55, flat: 0.94 },
  { x: 0.46, y: 0.47, z: 0.46, upper: 1.17, lower: 1.98, jaw: 0.55 },
  { x: 0.47, y: 0.45, z: 0.46, upper: 1.26, lower: 1.87, jaw: 0.61, sides: 10, flat: 0.82 },
  { x: 0.435, y: 0.41, z: 0.46, upper: 1.2, lower: 1.85, jaw: 0.64 },
  { x: 0.455, y: 0.49, z: 0.45, upper: 1.22, lower: 1.92, jaw: 0.49 },
  { x: 0.43, y: 0.49, z: 0.48, upper: 1.06, lower: 2.04, jaw: 0.5 },
  { x: 0.455, y: 0.43, z: 0.47, upper: 1.39, lower: 1.82, jaw: 0.59, sides: 12, flat: 0.91 },
  { x: 0.44, y: 0.45, z: 0.46, upper: 1.2, lower: 1.97, jaw: 0.66, sides: 14 },
  { x: 0.42, y: 0.45, z: 0.54, upper: 1.25, lower: 1.84, jaw: 0.53 },
  { x: 0.46, y: 0.48, z: 0.45, upper: 1.22, lower: 1.94, jaw: 0.51 },
  { x: 0.465, y: 0.43, z: 0.48, upper: 1.26, lower: 1.81, jaw: 0.56 },
  { x: 0.44, y: 0.45, z: 0.46, upper: 1.27, lower: 1.88, jaw: 0.6, sides: 16 },
  { x: 0.45, y: 0.46, z: 0.47, upper: 1.2, lower: 1.94, jaw: 0.55 },
  { x: 0.465, y: 0.48, z: 0.47, upper: 1.08, lower: 2.02, jaw: 0.51 },
  { x: 0.46, y: 0.45, z: 0.48, upper: 1.26, lower: 1.88, jaw: 0.57, sides: 10, flat: 0.89 },
  { x: 0.45, y: 0.46, z: 0.46, upper: 1.21, lower: 1.95, jaw: 0.62, sides: 14 },
  { x: 0.49, y: 0.4, z: 0.46, upper: 1.32, lower: 1.83, jaw: 0.49, flat: 0.88 },
  { x: 0.455, y: 0.46, z: 0.47, upper: 1.22, lower: 1.94, jaw: 0.57 },
  { x: 0.425, y: 0.4, z: 0.55, upper: 1.41, lower: 1.82, jaw: 0.62, sides: 12, flat: 0.91 },
];

function shellPoint(s: Shell, theta: number, phi: number, offset = 0) {
  return new THREE.Vector3(
    (s.x + offset) * Math.sin(theta) * Math.sin(phi),
    0.035 + (s.y + offset) * Math.min(Math.cos(theta), s.flat ?? 1),
    (s.z + offset) * Math.sin(theta) * Math.cos(phi),
  );
}

function shellPatch(
  parent: THREE.Group,
  s: Shell,
  material: THREE.Material,
  top: number,
  bottom: number,
  left: number,
  right: number,
  offset = 0,
  lean = 0,
) {
  const columns = s.sides ?? 20,
    rows = 7;
  const positions: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const theta = top + ((bottom - top) * row) / rows;
    for (let col = 0; col <= columns; col++) {
      const point = shellPoint(
        s,
        theta,
        left + ((right - left) * col) / columns + (lean * row) / rows,
        offset,
      );
      positions.push(point.x, point.y, point.z);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col,
          c = a + columns + 1;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

export function createHelmet(variant = 0, color?: string, visorColor?: string): THREE.Group {
  const index = Number.isInteger(variant) && variant >= 1 && variant <= 20 ? variant - 1 : 0;
  const design = helmetDesigns[index],
    s = shells[index];
  const group = new THREE.Group();
  group.name = 'driver-helmet';
  const material = (value: string, roughness = 0.35, metalness = 0.12) =>
    new THREE.MeshStandardMaterial({ color: value, roughness, metalness });
  const paint = material(color ?? design.primary);
  paint.name = 'helmet-shell';
  const secondary = material(design.secondary),
    accent = material(design.accent);
  const rubber = material('#20252c', 0.82, 0),
    vent = material('#10171d', 0.7, 0);
  const metal = material('#b8c3cd', 0.3, 0.65);
  const visor = material(visorColor ?? '#263a50', 0.16, 0.48);
  visor.name = 'helmet-visor';

  // Three adjoining patches leave a real opening in the shell for the curved visor.
  shellPatch(group, s, paint, 0, s.upper, -Math.PI, Math.PI);
  shellPatch(group, s, paint, s.upper, 2.65, 1.12, Math.PI * 2 - 1.12);
  shellPatch(group, s, paint, s.lower, 2.65, -1.12, 1.12);
  shellPatch(group, s, rubber, s.upper - 0.025, s.lower + 0.025, -1.125, 1.125, 0.008);
  shellPatch(group, s, visor, s.upper + 0.025, s.lower - 0.025, -1.09, 1.09, 0.018);

  // Large, surface-fitted painted shell sections stay readable at shop-card scale.
  // All artwork stops above the aperture or starts behind its side seals.
  secondary.polygonOffset = accent.polygonOffset = true;
  secondary.polygonOffsetFactor = -2;
  accent.polygonOffsetFactor = -4;
  const panel = (
    top: number,
    bottom: number,
    left: number,
    right: number,
    mat: THREE.Material = secondary,
    lean = 0,
  ) => {
    const part = shellPatch(group, s, mat, top, bottom, left, right, 0.012, lean);
    part.name = 'helmet-shell-panel';
  };
  const stripe = (width: number, mat: THREE.Material = secondary, shift = 0) => {
    panel(0.035, s.upper - 0.025, -width + shift, width + shift, mat);
    panel(0.035, 2.52, Math.PI - width + shift, Math.PI + width + shift, mat);
  };
  const flanks = (
    top: number,
    bottom: number,
    start: number,
    end: number,
    mat: THREE.Material = secondary,
    sweep = 0,
  ) => {
    panel(top, bottom, start, end, mat, sweep);
    panel(top, bottom, -end, -start, mat, -sweep);
  };
  switch (index) {
    case 0:
      stripe(0.23);
      flanks(1.96, 2.42, 1.2, 2.72);
      break;
    case 1:
      panel(0.79, s.upper - 0.025, -Math.PI, Math.PI);
      flanks(1.2, 2.25, 1.2, 2.9, secondary, 0.2);
      stripe(0.17, accent);
      break;
    case 2:
      flanks(0.22, 1.12, 0.68, 1.6, secondary, 0.3);
      flanks(1.18, 2.4, 1.4, 2.1, accent);
      break;
    case 3:
      stripe(0.42);
      flanks(0.35, 1.2, 0.62, 1.0, accent, 0.42);
      flanks(1.45, 2.4, 1.3, 2.55);
      break;
    case 4:
      flanks(0.12, 1.16, 0.52, 1.13, secondary, 0.45);
      flanks(1.25, 2.45, 1.25, 2.4);
      break;
    case 5:
      stripe(0.4, secondary);
      stripe(0.12, accent);
      flanks(1.91, 2.4, 1.25, 2.7, secondary);
      break;
    case 6:
      panel(0.55, 0.94, -Math.PI, Math.PI);
      flanks(1.12, 2.5, 1.22, 2.75);
      break;
    case 7:
      flanks(0.15, 1.34, 0.65, 1.3, secondary, 0.4);
      flanks(1.8, 2.5, 1.2, 2.95, accent);
      break;
    case 8:
      stripe(0.36);
      flanks(0.6, 1.17, 0.6, 1.4, accent);
      flanks(1.4, 2.5, 1.4, 2.3);
      break;
    case 9:
      stripe(0.3, accent);
      flanks(0.8, 1.2, 0.55, 1.7, secondary, 0.45);
      flanks(1.3, 2.45, 1.2, 1.8);
      break;
    case 10:
      panel(0.04, 0.68, -Math.PI, Math.PI);
      flanks(1.12, 2.25, 1.23, 1.8, accent, 0.15);
      break;
    case 11:
      flanks(0.05, 1.23, 0.38, 0.95, secondary, 0.35);
      flanks(1.65, 2.42, 1.2, 2.6, accent);
      break;
    case 12:
      panel(0.7, 1.23, -Math.PI, Math.PI);
      stripe(0.17, accent);
      flanks(1.4, 2.5, 1.4, 2.5);
      break;
    case 13:
      stripe(0.34);
      flanks(0.4, 1.16, 0.8, 1.5, accent, 0.3);
      flanks(1.7, 2.4, 1.3, 2.7);
      break;
    case 14:
      flanks(0.12, 1.04, 0.5, 1.4, secondary, 0.2);
      panel(0.13, 0.55, -Math.PI, Math.PI, accent);
      break;
    case 15:
      panel(0.03, 0.66, -Math.PI, Math.PI);
      flanks(0.86, 1.23, 0.3, 1.65, accent, 0.25);
      break;
    case 16:
      flanks(0.05, 1.18, 0.5, 1.3, secondary, 0.35);
      flanks(1.22, 2.45, 1.5, 2.65);
      break;
    case 17:
      panel(0.02, 0.8, -Math.PI, Math.PI);
      panel(1.02, 1.28, -Math.PI, Math.PI, accent);
      break;
    case 18:
      stripe(0.36, secondary);
      flanks(1.3, 2.42, 1.23, 2.2, secondary, 0.28);
      flanks(0.7, 1.18, 0.7, 1.15, accent);
      break;
    case 19:
      flanks(0.18, 1.37, 0.38, 0.85, accent, 0.45);
      flanks(1.45, 2.5, 1.3, 2.8);
      stripe(0.14);
      break;
  }
  // A low gasket meets the suit neck; it is not a second head inside the helmet.
  const gasket = mesh(group, new THREE.TorusGeometry(0.285, 0.039, 6, 20), rubber, 0, -0.384, 0);
  gasket.rotation.x = Math.PI / 2;

  const trim = (theta: number, mat: THREE.Material, radius: number) => {
    const points = Array.from({ length: 13 }, (_, i) => {
      const p = shellPoint(s, theta, -1.12 + (i / 12) * 2.24, 0.022);
      return [p.x, p.y, p.z] as [number, number, number];
    });
    tube(group, mat, points, radius);
  };
  trim(s.upper, index === 10 ? metal : secondary, 0.018);
  trim(s.lower, rubber, 0.018);

  // The jaw joins both cheek walls. Its width tapers as it reaches the face.
  hull(
    group,
    index === 6 || index === 17 ? secondary : paint,
    [
      { z: 0.14, width: s.x * 0.89, y: -0.25, height: 0.12 },
      { z: s.jaw - 0.09, width: 0.29, y: -0.255, height: 0.105 },
      {
        z: s.jaw,
        width: index === 8 || index === 19 ? 0.15 : index === 4 ? 0.29 : 0.23,
        y: -0.23,
        height: index === 4 ? 0.105 : 0.075,
      },
    ],
    index === 15 || index === 7 ? 6 : 8,
  );

  const bar = (
    mat: THREE.Material,
    size: [number, number, number],
    pos: [number, number, number],
    radius = 0.025,
  ) => rounded(group, mat, size, pos, radius);
  const chinVent = (width = 0.2, height = 0.065, y = -0.23) => {
    bar(secondary, [width + 0.055, height + 0.04, 0.025], [0, y, s.jaw + 0.003]);
    bar(vent, [width, height, 0.026], [0, y, s.jaw + 0.018], 0.012);
  };
  const hinges = (radius = 0.07, mat: THREE.Material = secondary, polygon = 12) => {
    for (const side of [-1, 1]) {
      const pivot = mesh(
        group,
        new THREE.CylinderGeometry(radius, radius, 0.045, polygon),
        mat,
        side * (s.x * 0.88),
        0.015,
        0.15,
      );
      pivot.rotation.z = Math.PI / 2;
      const screw = mesh(
        group,
        new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.049, 8),
        metal,
        side * (s.x * 0.88 + 0.012),
        0.015,
        0.15,
      );
      screw.rotation.z = Math.PI / 2;
    }
  };
  const surfaceY = (x: number, z: number) =>
    0.035 +
    s.y * Math.min(s.flat ?? 1, Math.sqrt(Math.max(0, 1 - (x / s.x) ** 2 - (z / s.z) ** 2)));
  const scoop = (x: number, width = 0.1, z = 0.05, length = 0.26) => {
    const duct = new THREE.Group();
    duct.position.x = x;
    group.add(duct);
    hull(
      duct,
      secondary,
      [-0.5, 0, 0.5].map((portion) => ({
        z: z + length * portion,
        width: width / 2,
        y: surfaceY(x, z + length * portion) + 0.012,
        height: 0.032,
      })),
      8,
    );
    bar(
      vent,
      [width * 0.65, 0.026, 0.012],
      [x, surfaceY(x, z + length / 2) + 0.013, z + length / 2],
    );
  };
  const spoiler = (z = -0.43, width = 0.66, y = 0.12, depth = 0.14) => {
    bar(secondary, [width * 0.75, 0.12, 0.1], [0, y - 0.04, z + 0.035]);
    bar(accent, [width, 0.035, depth], [0, y + 0.025, z]);
  };
  const peak = (length: number, width: number, y = 0.28) => {
    hull(
      group,
      secondary,
      [
        { z: 0.23, width: width * 0.48, y, height: 0.03 },
        { z: length - 0.07, width: width * 0.5, y: y + 0.01, height: 0.025 },
        { z: length, width: width * 0.38, y: y + 0.015, height: 0.012 },
      ],
      8,
    );
    for (const side of [-1, 1])
      rod(group, paint, [side * 0.33, 0.16, 0.22], [side * 0.34, y, 0.36], 0.028);
  };
  const cheekDucts = (width = 0.1, length = 0.25, y = -0.12) => {
    for (const side of [-1, 1]) {
      const duct = bar(secondary, [width, 0.13, length], [side * 0.395, y, 0.19]);
      duct.rotation.y = side * -0.25;
      bar(vent, [width * 0.63, 0.065, 0.025], [side * 0.395, y, 0.19 + length / 2]);
    }
  };
  const crownStripe = (x: number, width: number, mat: THREE.Material = secondary) =>
    tube(
      group,
      mat,
      [-0.39, -0.27, -0.12, 0.06, 0.23, 0.3].map(
        (z) => [x, surfaceY(x, z) + 0.003, z] as [number, number, number],
      ),
      width,
    );
  const ridge = (x: number, width: number, height: number, rear = -0.36, front = 0.28) => {
    const fin = new THREE.Group();
    fin.position.x = x;
    group.add(fin);
    hull(
      fin,
      secondary,
      [rear, -0.1, 0.12, front].map((z, i) => ({
        z,
        width: width * (i === 0 || i === 3 ? 0.32 : 0.5),
        y: surfaceY(x, z) + 0.012,
        height: i === 0 || i === 3 ? height * 0.5 : height,
      })),
      6,
    );
  };

  switch (index) {
    case 0:
      hinges();
      for (const x of [-0.115, 0, 0.115])
        bar(vent, [0.062, 0.045, 0.026], [x, -0.23, s.jaw + 0.013]);
      crownStripe(0, 0.025);
      break;
    case 1:
      hinges(0.055);
      ridge(0, 0.17, 0.065, -0.42, 0.31);
      for (const side of [-1, 1])
        ellipsoid(group, secondary, [0.075, 0.075, 0.23], [side * 0.395, 0.015, -0.14]);
      spoiler(-0.49, 0.72, 0.08, 0.22);
      chinVent(0.23, 0.045);
      break;
    case 2:
      hinges(0.07);
      peak(0.61, 0.85, 0.29);
      cheekDucts(0.12, 0.23);
      chinVent(0.17, 0.075);
      break;
    case 3:
      hinges(0.067, accent, 6);
      ridge(-0.16, 0.13, 0.09, -0.33, 0.3);
      ridge(0.16, 0.13, 0.09, -0.33, 0.3);
      for (const side of [-1, 1]) {
        const guard = bar(secondary, [0.12, 0.17, 0.3], [side * 0.39, -0.18, 0.21]);
        guard.rotation.y = side * -0.3;
      }
      chinVent(0.25, 0.065);
      spoiler(-0.43, 0.57, 0.12, 0.12);
      break;
    case 4:
      hinges(0.054);
      chinVent(0.3, 0.095);
      spoiler(-0.4, 0.62, 0.03, 0.12);
      hull(
        group,
        secondary,
        [
          { z: 0.27, width: 0.35, y: 0.245, height: 0.045 },
          { z: 0.49, width: 0.3, y: 0.22, height: 0.025 },
        ],
        8,
      );
      cheekDucts(0.12, 0.3, -0.13);
      break;
    case 5:
      hinges(0.12, secondary);
      chinVent(0.1, 0.035);
      crownStripe(-0.09, 0.02, accent);
      crownStripe(0.09, 0.02, accent);
      break;
    case 6:
      hinges(0.055, metal);
      for (const side of [-1, 1]) {
        ellipsoid(group, secondary, [0.075, 0.15, 0.19], [side * 0.415, 0.045, -0.12]);
        bar(vent, [0.09, 0.03, 0.1], [side * 0.45, 0.105, -0.13]);
      }
      chinVent(0.26, 0.035);
      spoiler(-0.45, 0.55, 0.02, 0.13);
      break;
    case 7:
      hinges(0.085, accent, 6);
      cheekDucts(0.12, 0.29, -0.15);
      chinVent(0.23, 0.045);
      bar(secondary, [0.5, 0.2, 0.055], [0, -0.02, -0.45]);
      break;
    case 8:
      hinges(0.065);
      peak(0.73, 0.88, 0.31);
      chinVent(0.26, 0.1);
      for (const x of [-0.08, 0, 0.08])
        bar(secondary, [0.018, 0.105, 0.018], [x, -0.23, s.jaw + 0.034], 0.003);
      cheekDucts(0.1, 0.27, -0.16);
      break;
    case 9:
      hinges(0.05);
      scoop(0, 0.16, -0.02, 0.38);
      spoiler(-0.53, 0.55, 0.02, 0.15);
      chinVent(0.17, 0.055);
      crownStripe(-0.19, 0.016, accent);
      crownStripe(0.19, 0.016, accent);
      break;
    case 10:
      hinges(0.085, metal);
      chinVent(0.24, 0.095);
      for (const x of [-0.09, -0.03, 0.03, 0.09])
        bar(metal, [0.015, 0.1, 0.018], [x, -0.23, s.jaw + 0.035], 0.004);
      for (const side of [-1, 1]) bar(accent, [0.035, 0.14, 0.15], [side * 0.395, -0.18, 0.12]);
      break;
    case 11:
      hinges(0.055);
      scoop(0, 0.21, 0.16, 0.2);
      spoiler(-0.45, 0.69, 0.1, 0.13);
      spoiler(-0.42, 0.55, 0.19, 0.1);
      chinVent(0.27, 0.045);
      break;
    case 12:
      hinges(0.065, metal);
      cheekDucts(0.14, 0.32, -0.15);
      scoop(0, 0.085, -0.05, 0.23);
      for (const x of [-0.1, 0.1]) bar(vent, [0.115, 0.08, 0.026], [x, -0.225, s.jaw + 0.018]);
      break;
    case 13:
      hinges(0.06);
      peak(0.58, 0.71, 0.29);
      scoop(0, 0.075, -0.04, 0.4);
      cheekDucts(0.09, 0.21, -0.22);
      chinVent(0.19, 0.055);
      break;
    case 14:
      hinges(0.105, accent);
      chinVent(0.16, 0.04);
      for (const side of [-1, 1])
        ellipsoid(group, secondary, [0.065, 0.12, 0.15], [side * 0.435, -0.1, -0.07]);
      crownStripe(0, 0.015, accent);
      break;
    case 15:
      hinges(0.08, secondary, 4);
      cheekDucts(0.1, 0.2, -0.13);
      for (const y of [-0.19, -0.26]) bar(vent, [0.28, 0.035, 0.025], [0, y, s.jaw + 0.015]);
      bar(secondary, [0.25, 0.028, 0.3], [0, 0.45, -0.02]);
      break;
    case 16:
      hinges(0.08);
      peak(0.68, 0.96, 0.29);
      chinVent(0.29, 0.11);
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          bar(accent, [0.032, 0.13, 0.035], [side * (0.37 - i * 0.018), -0.16, 0.13 + i * 0.07]);
      scoop(0, 0.13, -0.04, 0.22);
      break;
    case 17:
      hinges(0.055);
      cheekDucts(0.14, 0.29, -0.045);
      chinVent(0.24, 0.035);
      for (const side of [-1, 1])
        ellipsoid(group, secondary, [0.07, 0.09, 0.2], [side * 0.45, 0.1, -0.16]);
      bar(accent, [0.5, 0.1, 0.12], [0, 0.16, -0.395]);
      bar(vent, [0.34, 0.025, 0.02], [0, 0.16, -0.46]);
      break;
    case 18:
      hinges(0.095, secondary, 8);
      chinVent(0.21, 0.07);
      scoop(-0.14, 0.08, -0.14, 0.19);
      scoop(0.14, 0.08, -0.14, 0.19);
      for (const side of [-1, 1]) {
        rod(group, secondary, [side * 0.405, -0.02, 0.18], [side * 0.3, -0.32, 0.39], 0.032);
        bar(accent, [0.075, 0.075, 0.025], [side * 0.31, -0.28, 0.405]);
      }
      break;
    case 19:
      hinges(0.06, accent, 6);
      ridge(-0.105, 0.075, 0.1, -0.4, 0.3);
      ridge(0.105, 0.075, 0.1, -0.4, 0.3);
      spoiler(-0.51, 0.64, 0.04, 0.18);
      spoiler(-0.47, 0.51, 0.15, 0.16);
      chinVent(0.15, 0.055);
      cheekDucts(0.085, 0.29, -0.17);
      break;
  }
  return group;
}
