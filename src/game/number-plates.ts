import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plateDesigns } from '../shared/plate-designs';

type Point = [number, number];
type Style = {
  width: number;
  height: number;
  outline: Point[];
  font: string;
  ink: string;
  layout: 'band' | 'header' | 'split' | 'plain';
  label: string;
};

const polygon = (...points: Point[]) => points;
function roundedRect(radius: number): Point[] {
  const points: Point[] = [];
  for (const [x, y, start] of [
    [1 - radius, 1 - radius, 0],
    [-1 + radius, 1 - radius, 90],
    [-1 + radius, -1 + radius, 180],
    [1 - radius, -1 + radius, 270],
  ]) {
    for (let step = 0; step <= 8; step++) {
      const angle = ((start + (step * 90) / 8) * Math.PI) / 180;
      points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
    }
  }
  return points;
}
const ellipse = (count = 48): Point[] =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index * Math.PI * 2) / count;
    return [Math.cos(angle), Math.sin(angle)];
  });
const race = 'italic 900 132px "Arial Black", Arial, sans-serif';
const slab = 'bold 137px Georgia, serif';
const tech = '900 131px "Courier New", monospace';
const bold = '900 137px "Arial Black", Arial, sans-serif';

// Normalized contours are deliberately different constructions, not scaled rectangles.
const styles: Style[] = [
  {
    width: 1.04,
    height: 0.42,
    outline: polygon(
      [-0.9, 1],
      [0.9, 1],
      [1, 0.65],
      [1, -0.65],
      [0.9, -1],
      [-0.9, -1],
      [-1, -0.65],
      [-1, 0.65],
    ),
    font: race,
    ink: '#262b33',
    layout: 'band',
    label: 'GRID / 01',
  },
  {
    width: 1.08,
    height: 0.39,
    outline: roundedRect(0.94),
    font: bold,
    ink: '#fff1c7',
    layout: 'header',
    label: 'SUNSET CIRCUIT',
  },
  {
    width: 1.0,
    height: 0.44,
    outline: polygon(
      [-0.7, 1],
      [0.7, 1],
      [1, 0.43],
      [1, -0.6],
      [0.83, -1],
      [-0.83, -1],
      [-1, -0.6],
      [-1, 0.43],
    ),
    font: tech,
    ink: '#234d70',
    layout: 'band',
    label: 'ICE / RALLY',
  },
  {
    width: 1.09,
    height: 0.41,
    outline: polygon([-0.79, 1], [0.79, 1], [1, -0.7], [0.91, -1], [-0.91, -1], [-1, -0.7]),
    font: tech,
    ink: '#f3deff',
    layout: 'header',
    label: 'VIOLET / NIGHT RUN',
  },
  {
    width: 0.99,
    height: 0.47,
    outline: polygon(
      [-0.84, 1],
      [0.84, 1],
      [1, 0.65],
      [0.95, -0.55],
      [0.65, -0.85],
      [0, -1],
      [-0.65, -0.85],
      [-0.95, -0.55],
      [-1, 0.65],
    ),
    font: race,
    ink: '#174743',
    layout: 'header',
    label: 'MINT / CLUB SPORT',
  },
  {
    width: 1.08,
    height: 0.4,
    outline: polygon(
      [-0.7, 0.86],
      [-0.46, 1],
      [0.46, 1],
      [0.7, 0.86],
      [0.88, 1],
      [1, 0.58],
      [0.95, 0],
      [1, -0.58],
      [0.88, -1],
      [0.7, -0.86],
      [0.46, -1],
      [-0.46, -1],
      [-0.7, -0.86],
      [-0.88, -1],
      [-1, -0.58],
      [-0.95, 0],
      [-1, 0.58],
      [-0.88, 1],
    ),
    font: slab,
    ink: '#743f55',
    layout: 'plain',
    label: 'SAKURA • TOURING',
  },
  {
    width: 1.06,
    height: 0.44,
    outline: ellipse(),
    font: slab,
    ink: '#fff4d9',
    layout: 'header',
    label: 'PEARL / GRAND TOUR',
  },
  {
    width: 1.09,
    height: 0.4,
    outline: polygon(
      [-0.76, 1],
      [0.76, 1],
      [0.76, 0.78],
      [1, 0.78],
      [1, 0.38],
      [0.94, 0.38],
      [0.94, -0.38],
      [1, -0.38],
      [1, -0.78],
      [0.76, -0.78],
      [0.76, -1],
      [-0.76, -1],
      [-0.76, -0.78],
      [-1, -0.78],
      [-1, -0.38],
      [-0.94, -0.38],
      [-0.94, 0.38],
      [-1, 0.38],
      [-1, 0.78],
      [-0.76, 0.78],
    ),
    font: bold,
    ink: '#f0f4fc',
    layout: 'plain',
    label: 'OBSIDIAN // 08',
  },
  {
    width: 1.07,
    height: 0.4,
    outline: polygon([-0.72, 1], [1, 1], [0.72, -1], [-1, -1]),
    font: race,
    ink: '#f9ffe0',
    layout: 'header',
    label: 'ACID / ATTACK',
  },
  {
    width: 1.12,
    height: 0.44,
    outline: polygon(
      [-0.65, 1],
      [0.65, 1],
      [1, 0.08],
      [0.76, -0.72],
      [0.36, -1],
      [-0.36, -1],
      [-0.76, -0.72],
      [-1, 0.08],
    ),
    font: race,
    ink: '#efffff',
    layout: 'header',
    label: 'NEBULA / HYPERLAP',
  },
  {
    width: 1.01,
    height: 0.43,
    outline: polygon(
      [-0.82, 1],
      [0.82, 1],
      [0.82, 0.75],
      [1, 0.75],
      [1, -0.75],
      [0.82, -0.75],
      [0.82, -1],
      [-0.82, -1],
      [-0.82, -0.75],
      [-1, -0.75],
      [-1, 0.75],
      [-0.82, 0.75],
    ),
    font: slab,
    ink: '#65483e',
    layout: 'plain',
    label: 'COPPER • HISTORIC',
  },
  {
    width: 1.08,
    height: 0.4,
    outline: polygon(
      [-0.91, 1],
      [0.73, 1],
      [1, 0],
      [0.73, -1],
      [-0.91, -1],
      [-1, -0.65],
      [-1, 0.65],
    ),
    font: race,
    ink: '#ffffff',
    layout: 'band',
    label: 'AZURE / SPRINT',
  },
  {
    width: 1.08,
    height: 0.43,
    outline: polygon(
      [-0.92, 1],
      [-0.42, 1],
      [-0.36, 0.72],
      [-0.3, 1],
      [0.92, 1],
      [1, 0.68],
      [1, -0.68],
      [0.92, -1],
      [-0.3, -1],
      [-0.36, -0.72],
      [-0.42, -1],
      [-0.92, -1],
      [-1, -0.68],
      [-1, 0.68],
    ),
    font: bold,
    ink: '#ffe9d9',
    layout: 'split',
    label: 'CRIMSON',
  },
  {
    width: 0.97,
    height: 0.49,
    outline: polygon([-1, 1], [1, 1], [0.89, -0.5], [0, -1], [-0.89, -0.5]),
    font: race,
    ink: '#e6f5c8',
    layout: 'header',
    label: 'JADE / RALLY TEAM',
  },
  {
    width: 1.09,
    height: 0.4,
    outline: polygon(
      [-0.78, 1],
      [-0.38, 0.82],
      [0.38, 0.82],
      [0.78, 1],
      [1, 0.5],
      [0.9, 0],
      [1, -0.5],
      [0.78, -1],
      [0.38, -0.82],
      [-0.38, -0.82],
      [-0.78, -1],
      [-1, -0.5],
      [-0.9, 0],
      [-1, 0.5],
    ),
    font: bold,
    ink: '#5b346c',
    layout: 'plain',
    label: 'ORCHID / CLUB GT',
  },
  {
    width: 1.05,
    height: 0.43,
    outline: polygon(
      [-0.78, 1],
      [0.78, 1],
      [1, 0.58],
      [0.88, 0.22],
      [1, -0.1],
      [1, -0.75],
      [0.7, -1],
      [-0.85, -1],
      [-1, -0.65],
      [-1, -0.1],
      [-0.88, 0.22],
      [-1, 0.58],
    ),
    font: tech,
    ink: '#223846',
    layout: 'plain',
    label: 'STEEL // WORKS',
  },
  {
    width: 1.12,
    height: 0.42,
    outline: polygon(
      [-0.77, 1],
      [0.77, 1],
      [0.77, 0.67],
      [1, 0.67],
      [1, -0.67],
      [0.77, -0.67],
      [0.77, -1],
      [-0.77, -1],
      [-0.77, -0.67],
      [-1, -0.67],
      [-1, 0.67],
      [-0.77, 0.67],
    ),
    font: race,
    ink: '#fff0c7',
    layout: 'header',
    label: 'SAND / EXPEDITION',
  },
  {
    width: 1.05,
    height: 0.44,
    outline: polygon(
      [-0.85, 1],
      [0.85, 1],
      [1, 0.5],
      [0.98, -0.35],
      [0.82, -0.76],
      [0.52, -0.95],
      [0, -1],
      [-0.52, -0.95],
      [-0.82, -0.76],
      [-0.98, -0.35],
      [-1, 0.5],
    ),
    font: slab,
    ink: '#34574c',
    layout: 'header',
    label: 'SAGE / MOTOR CLUB',
  },
  {
    width: 1.08,
    height: 0.43,
    outline: polygon(
      [-0.8, 1],
      [-0.3, 1],
      [-0.2, 0.75],
      [0.2, 0.75],
      [0.3, 1],
      [0.8, 1],
      [1, 0.5],
      [1, -0.5],
      [0.8, -1],
      [0.3, -1],
      [0.2, -0.77],
      [-0.2, -0.77],
      [-0.3, -1],
      [-0.8, -1],
      [-1, -0.5],
      [-1, 0.5],
    ),
    font: tech,
    ink: '#f8db76',
    layout: 'plain',
    label: 'TITANIUM / PROTOTYPE',
  },
  {
    width: 1.11,
    height: 0.44,
    outline: polygon(
      [-0.74, 1],
      [0, 0.84],
      [0.74, 1],
      [1, 0.18],
      [0.83, -0.45],
      [0.42, -0.7],
      [0.16, -0.7],
      [0, -1],
      [-0.16, -0.7],
      [-0.42, -0.7],
      [-0.83, -0.45],
      [-1, 0.18],
    ),
    font: race,
    ink: '#f7edff',
    layout: 'header',
    label: 'MIDNIGHT / AFTER HOURS',
  },
];

function shape(points: Point[]) {
  const result = new THREE.Shape();
  result.moveTo(...points[0]);
  for (const point of points.slice(1)) result.lineTo(...point);
  result.closePath();
  return result;
}
function solid(points: Point[], depth: number, z: number) {
  const geometry = new THREE.ExtrudeGeometry(shape(points), {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geometry.translate(0, 0, z);
  return geometry;
}

function artwork(variant: number, style: Style) {
  if (typeof document === 'undefined') return null;
  const design = plateDesigns[variant - 1];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = design.secondary;
  ctx.fillRect(0, 0, 512, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const line = (color: string, x: number, y: number, width: number, height: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  };
  const text = (
    value: string,
    x: number,
    y: number,
    font: string,
    color: string,
    width: number,
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, width);
  };
  const number = String(variant * 37).padStart(3, '0');
  let center = 256,
    width = 302,
    y = 139;
  if (style.layout === 'band') {
    line(design.primary, 30, 20, 69, 216);
    text('FP', 64, 94, '900 30px Arial, sans-serif', design.secondary, 53);
    text('RACE', 64, 160, 'bold 15px Arial, sans-serif', design.secondary, 52);
    center = 291;
    width = 310;
    y = 133;
  } else if (style.layout === 'split') {
    line(design.primary, 166, 0, 14, 256);
    text('FP', 104, 129, '900 55px Arial, sans-serif', '#ffffff', 95);
    text('RACING', 104, 184, 'bold 18px Arial, sans-serif', design.primary, 105);
    center = 322;
    width = 263;
    y = 133;
  } else {
    text('FP / ' + style.label, 256, 51, 'bold 17px Arial, sans-serif', style.ink, 330);
  }
  if (variant === 1) {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 2; col++)
        line(
          (row + col) % 2 ? design.secondary : design.accent,
          36 + col * 26,
          34 + row * 47,
          26,
          47,
        );
    text('FP', 290, 47, '900 20px Arial, sans-serif', design.primary, 80);
  }
  if (variant === 2)
    for (let i = 0; i < 4; i++)
      line(['#ff6c5d', '#ff9c57', '#ffb938', '#fff1c7'][i], 100, 192 + i * 6, 312, 3);
  if (variant === 6) {
    line(design.primary, 112, 43, 13, 172);
    line(design.primary, 387, 43, 13, 172);
    line(design.accent, 133, 43, 4, 172);
    line(design.accent, 375, 43, 4, 172);
    width = 224;
  }
  if (variant === 7 || variant === 18) {
    ctx.strokeStyle = variant === 7 ? design.accent : design.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(256, 129, 208, 98, 0, 0, Math.PI * 2);
    ctx.stroke();
    width = 270;
  }
  if (variant === 8 || variant === 16 || variant === 19) {
    for (const x of [67, 435])
      for (let row = 0; row < 3; row++) line(design.accent, x, 89 + row * 24, 10, 12);
  }
  if (variant === 9) {
    ctx.fillStyle = design.primary;
    for (let stripe = 0; stripe < 3; stripe++) {
      const x = 61 + stripe * 18;
      ctx.beginPath();
      ctx.moveTo(x, 193);
      ctx.lineTo(x + 13, 193);
      ctx.lineTo(x - 4, 223);
      ctx.lineTo(x - 17, 223);
      ctx.closePath();
      ctx.fill();
    }
    line(design.primary, 356, 34, 57, 8);
  }
  if (variant === 10 || variant === 20) {
    line('#64dbc9', 128, 208, 67, 4);
    line('#64dbc9', 317, 208, 67, 4);
    width = 267;
  }
  if (variant === 11) {
    ctx.strokeStyle = design.primary;
    ctx.lineWidth = 3;
    ctx.strokeRect(79, 30, 354, 196);
    width = 275;
  }
  if (variant === 12)
    for (let row = 0; row < 3; row++) line('#71c9ff', 133, 188 + row * 8, 231 - row * 34, 3);
  if (variant === 14) {
    line(design.accent, 65, 27, 382, 35);
    text('FP / JADE RALLY', 256, 46, 'bold 17px Arial, sans-serif', design.secondary, 300);
    y = 130;
  }
  if (variant === 15) {
    line(design.primary, 81, 194, 350, 7);
    line(design.accent, 81, 207, 350, 3);
  }
  text(number, center, y, style.font, style.ink, width);
  if (![2, 6, 10, 12, 14, 15, 20].includes(variant)) {
    const caption =
      style.layout === 'band'
        ? style.label
        : style.layout === 'split'
          ? style.label
          : 'FAPIX • COMPETITION';
    text(caption, center, 211, 'bold 15px Arial, sans-serif', style.ink, width);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Rear-facing equipment in local XY; the caller turns +Z towards the rear of the car. */
export function createNumberPlate(variant?: number): THREE.Group | null {
  if (variant === undefined || !Number.isInteger(variant) || variant < 1 || variant > 20)
    return null;
  const style = styles[variant - 1],
    design = plateDesigns[variant - 1];
  const group = new THREE.Group();
  group.name = 'number-plate';
  group.userData.variant = variant;
  const points: Point[] = style.outline.map(([x, y]) => [
    (x * style.width) / 2,
    (y * style.height) / 2,
  ]);
  const inner: Point[] = points.map(([x, y]) => [x * 0.936, y * 0.8]);
  const material = (color: string, metalness = 0.25, roughness = 0.34) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const part = new THREE.Mesh(geometry, mat);
    part.name = name;
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
    return part;
  };
  add(
    solid(points, 0.06, -0.03),
    material(design.primary, [7, 11, 16, 19].includes(variant) ? 0.72 : 0.3),
    'plate-shell',
  );
  const rim = shape(points);
  rim.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y))));
  const rimGeometry = new THREE.ExtrudeGeometry(rim, {
    depth: 0.016,
    bevelEnabled: false,
    curveSegments: 1,
  });
  rimGeometry.translate(0, 0, 0.03);
  add(
    rimGeometry,
    material([7, 10].includes(variant) ? design.accent : design.primary, 0.6),
    'plate-raised-frame',
  );
  const faceGeometry = new THREE.ShapeGeometry(shape(inner));
  const positions = faceGeometry.getAttribute('position');
  const uv = faceGeometry.getAttribute('uv');
  for (let vertex = 0; vertex < positions.count; vertex++)
    uv.setXY(
      vertex,
      positions.getX(vertex) / style.width + 0.5,
      positions.getY(vertex) / style.height + 0.5,
    );
  faceGeometry.translate(0, 0, 0.031);
  const map = artwork(variant, style);
  const faceMaterial = material(map ? '#ffffff' : design.secondary, 0.08, 0.5);
  faceMaterial.map = map;
  add(faceGeometry, faceMaterial, 'plate-artwork');

  // Repeated fittings share one draw call per finish, but never resources between products.
  const batches = new Map<string, THREE.BufferGeometry[]>();
  const queue = (color: string, geometry: THREE.BufferGeometry) => {
    const list = batches.get(color) ?? [];
    list.push(geometry);
    batches.set(color, list);
  };
  const bar = (x: number, y: number, width: number, height: number, color: string, angle = 0) => {
    const geometry = new THREE.BoxGeometry(width, height, 0.019).toNonIndexed();
    geometry.rotateZ(angle);
    geometry.translate(x, y, 0.047);
    queue(color, geometry);
  };
  const bolt = (x: number, y: number, radius = 0.014, color = '#d3dce3') => {
    const geometry = new THREE.CylinderGeometry(radius, radius, 0.014, 8).toNonIndexed();
    geometry.rotateX(Math.PI / 2);
    geometry.translate(x, y, 0.052);
    queue(color, geometry);
    bar(x, y, radius * 0.9, 0.003, '#313844', Math.PI / 4);
  };
  const x = style.width / 2,
    y = style.height / 2;
  const fourBolts = (span = 0.83, height = 0.77, color = '#d3dce3') => {
    for (const side of [-1, 1])
      for (const row of [-1, 1]) bolt(side * x * span, row * y * height, 0.012, color);
  };
  switch (variant) {
    case 1:
      for (const side of [-1, 1]) bolt(side * x * 0.7, y * 0.83, 0.016);
      bar(0, -y * 0.88, 0.33, 0.018, design.accent);
      break;
    case 2:
      for (const side of [-1, 1]) bolt(side * x * 0.9, 0, 0.028, design.primary);
      bar(0, y * 0.88, 0.49, 0.014, '#ff705f');
      break;
    case 3:
      fourBolts(0.79, 0.71);
      for (const side of [-1, 1])
        bar(side * x * 0.83, y * 0.64, 0.1, 0.025, '#ffffff', side * -0.5);
      break;
    case 4:
      for (const side of [-1, 1]) bar(side * x * 0.89, 0, 0.026, 0.14, design.accent, side * 0.26);
      bar(0, -y * 0.93, 0.2, 0.039, '#f09bff');
      break;
    case 5:
      for (const side of [-1, 1]) bolt(side * x * 0.76, y * 0.83, 0.02, design.accent);
      bar(0, -y * 0.78, 0.24, 0.02, '#a3ffe8');
      break;
    case 6:
      for (const side of [-1, 1]) {
        bolt(side * x * 0.9, 0, 0.027, design.primary);
        bar(side * x * 0.76, 0, 0.018, 0.21, design.accent);
      }
      break;
    case 7:
      for (const side of [-1, 1]) bolt(side * x * 0.89, 0, 0.024, design.accent);
      bar(0, y * 0.86, 0.13, 0.021, design.accent);
      break;
    case 8:
      for (const side of [-1, 1])
        for (const row of [-1, 1]) bar(side * x * 0.87, row * y * 0.64, 0.12, 0.055, '#687486');
      bar(-x * 0.74, y * 0.85, 0.15, 0.018, design.accent);
      break;
    case 9:
      for (const side of [-1, 1]) bar(side * x * 0.82, 0, 0.025, 0.23, design.primary, -0.35);
      bolt(-x * 0.74, -y * 0.81);
      bolt(x * 0.74, y * 0.81);
      break;
    case 10:
      for (const side of [-1, 1]) {
        bar(side * x * 0.84, 0, 0.025, 0.11, '#64dbc9', side * 0.38);
        bolt(side * x * 0.53, y * 0.87, 0.012);
      }
      break;
    case 11:
      fourBolts(0.73, 0.77, '#e1b66f');
      bar(0, -y * 0.89, 0.37, 0.012, design.accent);
      break;
    case 12:
      for (let row = 0; row < 3; row++)
        bar(-x * 0.86, 0.064 - row * 0.064, 0.048, 0.018, '#e7f3ff');
      bolt(x * 0.69, y * 0.78);
      bolt(x * 0.69, -y * 0.78);
      break;
    case 13:
      bar(-x * 0.36, 0, 0.025, 0.36, design.primary);
      fourBolts(0.84, 0.77);
      break;
    case 14:
      for (const side of [-1, 1]) {
        bar(side * x * 0.82, y * 0.82, 0.085, 0.05, design.accent);
        bolt(side * x * 0.82, y * 0.82, 0.017, design.primary);
      }
      break;
    case 15:
      for (const side of [-1, 1])
        for (const row of [-1, 1]) bolt(side * x * 0.9, row * y * 0.35, 0.023, '#f9dcff');
      break;
    case 16:
      for (const side of [-1, 1])
        for (const row of [-1, 1])
          bar(side * x * 0.78, row * y * 0.72, 0.069, 0.055, design.accent);
      break;
    case 17:
      for (const row of [-1, 1]) bar(0, row * y * 0.87, 0.7, 0.028, design.primary);
      for (const side of [-1, 1]) bolt(side * x * 0.9, 0, 0.023, design.accent);
      break;
    case 18:
      for (const side of [-1, 1]) {
        bar(side * x * 0.9, 0, 0.025, 0.12, design.accent);
        bolt(side * x * 0.9, 0, 0.012, design.primary);
      }
      break;
    case 19:
      for (const side of [-1, 1]) {
        bar(side * x * 0.85, 0, 0.024, 0.19, 'light');
        bolt(side * x * 0.66, y * 0.81, 0.012);
        bolt(side * x * 0.66, -y * 0.81, 0.012);
      }
      break;
    case 20:
      for (const side of [-1, 1]) bar(side * x * 0.78, 0.01, 0.022, 0.09, '#64dbc9', side * -0.4);
      bar(0, -y * 0.7, 0.31, 0.018, 'light');
      break;
  }
  for (const [color, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false)!;
    for (const source of geometries) source.dispose();
    const mat = material(
      color === 'light' ? design.accent : color,
      color === 'light' ? 0.05 : 0.55,
    );
    if (color === 'light') {
      mat.emissive.set(design.accent);
      mat.emissiveIntensity = 1.3;
    }
    add(geometry, mat, color === 'light' ? 'plate-light-strip' : 'plate-fittings');
  }
  return group;
}
