import * as THREE from 'three';
import { suitDesigns } from '../shared/suit-designs';
import { mesh, rounded, ellipsoid } from './vehicle-parts';

type Point = [number, number];
type Vec = [number, number, number];
type Materials = {
  fabric: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  rib: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
};
type Cut = {
  collar: 'stand' | 'split' | 'fold' | 'wrap' | 'shawl';
  shoulder: 'raglan' | 'epaulette' | 'saddle' | 'ribbed' | 'split';
  panels: Point[][];
  piping: Point[][];
  zip: Point[];
  cuff: number;
  knee: 'oval' | 'long' | 'square' | 'split';
  sleeve: 'stripe' | 'bands' | 'split' | 'elbow';
  quilt?: 'horizontal' | 'diamond';
  pockets?: number;
};

// Each edition has its own cutting pattern, rather than a recolored base bib.
const cuts: Cut[] = [
  {
    collar: 'split',
    shoulder: 'raglan',
    panels: [
      [
        [-0.25, 0.54],
        [-0.09, 0.52],
        [0.05, 0.36],
        [0.25, 0.47],
        [0.22, 0.36],
        [0.04, 0.27],
        [-0.13, 0.44],
        [-0.25, 0.45],
      ],
    ],
    piping: [
      [
        [-0.23, 0.55],
        [-0.07, 0.51],
        [0.04, 0.37],
        [0.23, 0.48],
      ],
    ],
    zip: [
      [0, 0.58],
      [0, 0.2],
    ],
    cuff: 0.07,
    knee: 'oval',
    sleeve: 'stripe',
  },
  {
    collar: 'wrap',
    shoulder: 'epaulette',
    panels: [
      [
        [-0.22, 0.51],
        [-0.08, 0.56],
        [0.22, 0.32],
        [0.2, 0.19],
        [-0.08, 0.4],
        [-0.22, 0.38],
      ],
    ],
    piping: [
      [
        [-0.21, 0.19],
        [0.04, 0.4],
        [0.14, 0.57],
      ],
    ],
    zip: [
      [-0.16, 0.2],
      [0.04, 0.4],
      [0.12, 0.58],
    ],
    cuff: 0.1,
    knee: 'square',
    sleeve: 'bands',
    quilt: 'horizontal',
  },
  {
    collar: 'stand',
    shoulder: 'saddle',
    panels: [
      [
        [-0.23, 0.55],
        [0.23, 0.55],
        [0.25, 0.45],
        [0.09, 0.43],
        [0.09, 0.27],
        [-0.09, 0.27],
        [-0.09, 0.43],
        [-0.25, 0.45],
      ],
      [
        [-0.15, 0.39],
        [-0.11, 0.39],
        [-0.11, 0.22],
        [-0.15, 0.22],
      ],
      [
        [0.11, 0.39],
        [0.15, 0.39],
        [0.15, 0.22],
        [0.11, 0.22],
      ],
    ],
    piping: [
      [
        [-0.23, 0.46],
        [-0.1, 0.44],
        [-0.1, 0.28],
        [0.1, 0.28],
        [0.1, 0.44],
        [0.23, 0.46],
      ],
    ],
    zip: [
      [0, 0.58],
      [0, 0.2],
    ],
    cuff: 0.09,
    knee: 'long',
    sleeve: 'split',
  },
  {
    collar: 'fold',
    shoulder: 'split',
    panels: [
      [
        [-0.23, 0.55],
        [-0.1, 0.56],
        [0.23, 0.3],
        [0.2, 0.2],
        [-0.01, 0.35],
        [-0.24, 0.43],
      ],
    ],
    piping: [
      [
        [-0.22, 0.55],
        [0.22, 0.28],
      ],
    ],
    zip: [
      [0.03, 0.58],
      [-0.05, 0.2],
    ],
    cuff: 0.065,
    knee: 'split',
    sleeve: 'split',
  },
  {
    collar: 'stand',
    shoulder: 'raglan',
    panels: [
      [
        [-0.23, 0.54],
        [-0.13, 0.55],
        [0, 0.43],
        [0.13, 0.55],
        [0.23, 0.54],
        [0.1, 0.37],
        [0, 0.4],
        [-0.1, 0.37],
      ],
      [
        [-0.23, 0.34],
        [-0.15, 0.31],
        [-0.16, 0.19],
        [-0.2, 0.19],
      ],
      [
        [0.23, 0.34],
        [0.15, 0.31],
        [0.16, 0.19],
        [0.2, 0.19],
      ],
    ],
    piping: [
      [
        [-0.21, 0.52],
        [0, 0.41],
        [0.21, 0.52],
      ],
    ],
    zip: [
      [0, 0.57],
      [0, 0.2],
    ],
    cuff: 0.12,
    knee: 'long',
    sleeve: 'elbow',
  },
  {
    collar: 'split',
    shoulder: 'saddle',
    panels: [
      [
        [-0.24, 0.55],
        [0.24, 0.55],
        [0.23, 0.47],
        [0.12, 0.44],
        [-0.12, 0.44],
        [-0.23, 0.47],
      ],
      [
        [-0.13, 0.4],
        [0.13, 0.4],
        [0.17, 0.35],
        [0.15, 0.25],
        [-0.15, 0.25],
        [-0.17, 0.35],
      ],
    ],
    piping: [
      [
        [-0.15, 0.38],
        [0.15, 0.38],
      ],
      [
        [-0.14, 0.27],
        [0.14, 0.27],
      ],
    ],
    zip: [
      [0, 0.57],
      [0, 0.21],
    ],
    cuff: 0.08,
    knee: 'oval',
    sleeve: 'bands',
  },
  {
    collar: 'stand',
    shoulder: 'epaulette',
    panels: [
      [
        [-0.17, 0.55],
        [-0.1, 0.56],
        [-0.08, 0.2],
        [-0.15, 0.2],
      ],
      [
        [0.1, 0.56],
        [0.17, 0.55],
        [0.15, 0.2],
        [0.08, 0.2],
      ],
    ],
    piping: [
      [
        [-0.18, 0.54],
        [-0.16, 0.2],
      ],
      [
        [0.18, 0.54],
        [0.16, 0.2],
      ],
    ],
    zip: [
      [0, 0.57],
      [0, 0.2],
    ],
    cuff: 0.075,
    knee: 'square',
    sleeve: 'stripe',
    quilt: 'diamond',
  },
  {
    collar: 'fold',
    shoulder: 'ribbed',
    panels: [
      [
        [-0.23, 0.54],
        [-0.1, 0.55],
        [0, 0.41],
        [0.1, 0.55],
        [0.23, 0.54],
        [0.12, 0.4],
        [0, 0.29],
        [-0.12, 0.4],
      ],
    ],
    piping: [
      [
        [-0.22, 0.53],
        [0, 0.32],
        [0.22, 0.53],
      ],
    ],
    zip: [
      [0, 0.58],
      [0, 0.19],
    ],
    cuff: 0.09,
    knee: 'split',
    sleeve: 'elbow',
    quilt: 'horizontal',
  },
  {
    collar: 'split',
    shoulder: 'epaulette',
    panels: [
      [
        [-0.23, 0.55],
        [0.02, 0.55],
        [0.22, 0.35],
        [0.2, 0.19],
        [-0.05, 0.19],
        [-0.18, 0.34],
      ],
    ],
    piping: [
      [
        [-0.21, 0.53],
        [-0.06, 0.37],
        [0.2, 0.2],
      ],
    ],
    zip: [
      [-0.12, 0.55],
      [0.1, 0.19],
    ],
    cuff: 0.11,
    knee: 'split',
    sleeve: 'bands',
    quilt: 'horizontal',
  },
  {
    collar: 'wrap',
    shoulder: 'split',
    panels: [
      [
        [-0.24, 0.52],
        [0, 0.57],
        [0, 0.41],
        [0.12, 0.41],
        [0.12, 0.22],
        [-0.13, 0.22],
        [-0.13, 0.36],
        [-0.24, 0.36],
      ],
      [
        [0.05, 0.56],
        [0.23, 0.53],
        [0.23, 0.44],
        [0.05, 0.44],
      ],
    ],
    piping: [
      [
        [-0.21, 0.38],
        [-0.11, 0.38],
        [-0.11, 0.24],
        [0.11, 0.24],
        [0.11, 0.42],
        [0.22, 0.42],
      ],
    ],
    zip: [
      [0.05, 0.58],
      [0.05, 0.44],
      [-0.03, 0.4],
      [-0.03, 0.2],
    ],
    cuff: 0.075,
    knee: 'long',
    sleeve: 'split',
  },
  {
    collar: 'fold',
    shoulder: 'ribbed',
    panels: [
      [
        [-0.24, 0.47],
        [0.24, 0.47],
        [0.24, 0.36],
        [-0.24, 0.36],
      ],
      [
        [-0.16, 0.32],
        [0.16, 0.32],
        [0.14, 0.23],
        [-0.14, 0.23],
      ],
    ],
    piping: [
      [
        [-0.23, 0.46],
        [0.23, 0.46],
      ],
      [
        [-0.22, 0.37],
        [0.22, 0.37],
      ],
    ],
    zip: [
      [0, 0.55],
      [0, 0.19],
    ],
    cuff: 0.1,
    knee: 'oval',
    sleeve: 'bands',
    quilt: 'diamond',
  },
  {
    collar: 'stand',
    shoulder: 'epaulette',
    panels: [
      [
        [-0.22, 0.55],
        [-0.13, 0.56],
        [-0.06, 0.25],
        [-0.13, 0.2],
      ],
      [
        [0.13, 0.56],
        [0.22, 0.55],
        [0.13, 0.2],
        [0.06, 0.25],
      ],
    ],
    piping: [
      [
        [-0.21, 0.54],
        [-0.12, 0.21],
      ],
      [
        [0.21, 0.54],
        [0.12, 0.21],
      ],
    ],
    zip: [
      [0, 0.58],
      [0, 0.2],
    ],
    cuff: 0.08,
    knee: 'long',
    sleeve: 'stripe',
  },
  {
    collar: 'split',
    shoulder: 'raglan',
    panels: [
      [
        [-0.23, 0.53],
        [-0.16, 0.55],
        [0.22, 0.31],
        [0.2, 0.24],
      ],
      [
        [0.16, 0.55],
        [0.23, 0.53],
        [-0.21, 0.27],
        [-0.22, 0.35],
      ],
    ],
    piping: [
      [
        [-0.22, 0.52],
        [0.2, 0.26],
      ],
      [
        [0.22, 0.52],
        [-0.2, 0.28],
      ],
    ],
    zip: [
      [0, 0.58],
      [0, 0.19],
    ],
    cuff: 0.055,
    knee: 'square',
    sleeve: 'stripe',
  },
  {
    collar: 'wrap',
    shoulder: 'epaulette',
    panels: [
      [
        [-0.23, 0.54],
        [0.05, 0.56],
        [0.22, 0.4],
        [0.2, 0.23],
        [0.02, 0.19],
        [-0.14, 0.29],
        [-0.23, 0.4],
      ],
    ],
    piping: [
      [
        [-0.21, 0.53],
        [0.04, 0.54],
        [0.2, 0.4],
        [0.02, 0.21],
      ],
    ],
    zip: [
      [0.04, 0.58],
      [0.18, 0.41],
      [0.02, 0.2],
    ],
    cuff: 0.085,
    knee: 'square',
    sleeve: 'elbow',
    pockets: 1,
  },
  {
    collar: 'fold',
    shoulder: 'saddle',
    panels: [
      [
        [-0.24, 0.54],
        [-0.1, 0.56],
        [0.02, 0.49],
        [0.12, 0.54],
        [0.24, 0.52],
        [0.19, 0.43],
        [0.07, 0.43],
        [-0.03, 0.37],
        [-0.14, 0.43],
        [-0.24, 0.44],
      ],
      [
        [0.02, 0.35],
        [0.17, 0.39],
        [0.2, 0.2],
        [0.08, 0.2],
      ],
    ],
    piping: [
      [
        [-0.22, 0.52],
        [-0.12, 0.46],
        [-0.02, 0.4],
        [0.08, 0.46],
        [0.21, 0.5],
      ],
    ],
    zip: [
      [-0.02, 0.57],
      [-0.04, 0.2],
    ],
    cuff: 0.12,
    knee: 'oval',
    sleeve: 'split',
  },
  {
    collar: 'split',
    shoulder: 'saddle',
    panels: [
      [
        [-0.24, 0.55],
        [0.24, 0.55],
        [0.25, 0.46],
        [-0.25, 0.46],
      ],
      [
        [-0.035, 0.45],
        [0.035, 0.45],
        [0.055, 0.2],
        [-0.055, 0.2],
      ],
    ],
    piping: [
      [
        [-0.23, 0.47],
        [0.23, 0.47],
      ],
    ],
    zip: [
      [0, 0.57],
      [0, 0.19],
    ],
    cuff: 0.095,
    knee: 'square',
    sleeve: 'bands',
    pockets: 2,
  },
  {
    collar: 'stand',
    shoulder: 'raglan',
    panels: [
      [
        [-0.14, 0.54],
        [0.14, 0.54],
        [0.2, 0.39],
        [0.14, 0.21],
        [-0.14, 0.21],
        [-0.2, 0.39],
      ],
    ],
    piping: [
      [
        [-0.13, 0.53],
        [-0.18, 0.39],
        [-0.13, 0.23],
        [0.13, 0.23],
        [0.18, 0.39],
        [0.13, 0.53],
      ],
    ],
    zip: [
      [-0.03, 0.58],
      [-0.03, 0.2],
    ],
    cuff: 0.105,
    knee: 'oval',
    sleeve: 'elbow',
    quilt: 'diamond',
    pockets: 1,
  },
  {
    collar: 'wrap',
    shoulder: 'ribbed',
    panels: [
      [
        [-0.24, 0.54],
        [0.24, 0.54],
        [0.23, 0.43],
        [0.14, 0.35],
        [0, 0.31],
        [-0.14, 0.35],
        [-0.23, 0.43],
      ],
    ],
    piping: [
      [
        [-0.22, 0.46],
        [-0.13, 0.38],
        [0, 0.34],
        [0.13, 0.38],
        [0.22, 0.46],
      ],
    ],
    zip: [
      [0, 0.57],
      [0, 0.2],
    ],
    cuff: 0.085,
    knee: 'long',
    sleeve: 'split',
    quilt: 'horizontal',
  },
  {
    collar: 'split',
    shoulder: 'split',
    panels: [
      [
        [-0.24, 0.53],
        [-0.08, 0.56],
        [0.12, 0.46],
        [0.24, 0.5],
        [0.2, 0.34],
        [0.06, 0.31],
        [-0.07, 0.4],
        [-0.2, 0.31],
      ],
    ],
    piping: [
      [
        [-0.22, 0.52],
        [-0.08, 0.54],
        [0.06, 0.43],
        [0.22, 0.48],
      ],
      [
        [-0.19, 0.32],
        [-0.07, 0.41],
        [0.07, 0.33],
        [0.19, 0.35],
      ],
    ],
    zip: [
      [0.02, 0.58],
      [0.02, 0.19],
    ],
    cuff: 0.07,
    knee: 'split',
    sleeve: 'stripe',
  },
  {
    collar: 'shawl',
    shoulder: 'saddle',
    panels: [
      [
        [-0.23, 0.54],
        [-0.12, 0.56],
        [0, 0.51],
        [0.12, 0.56],
        [0.23, 0.54],
        [0.22, 0.44],
        [0.13, 0.4],
        [0, 0.44],
        [-0.13, 0.4],
        [-0.22, 0.44],
      ],
      [
        [-0.17, 0.31],
        [-0.04, 0.32],
        [-0.04, 0.21],
        [-0.14, 0.21],
      ],
      [
        [0.04, 0.32],
        [0.17, 0.31],
        [0.14, 0.21],
        [0.04, 0.21],
      ],
    ],
    piping: [
      [
        [-0.21, 0.51],
        [-0.12, 0.43],
        [0, 0.47],
        [0.12, 0.43],
        [0.21, 0.51],
      ],
    ],
    zip: [
      [0, 0.54],
      [0, 0.19],
    ],
    cuff: 0.115,
    knee: 'oval',
    sleeve: 'elbow',
  },
];

const stock: Cut = {
  collar: 'stand',
  shoulder: 'raglan',
  panels: [],
  piping: [],
  zip: [
    [0, 0.57],
    [0, 0.19],
  ],
  cuff: 0.075,
  knee: 'oval',
  sleeve: 'stripe',
};
const rings = [
  { y: 0.035, width: 0.235, depth: 0.178 },
  { y: 0.19, width: 0.245, depth: 0.19 },
  { y: 0.46, width: 0.305, depth: 0.21 },
  { y: 0.55, width: 0.29, depth: 0.185 },
  { y: 0.6, width: 0.15, depth: 0.135 },
];

function material(color: string, name: string, roughness = 0.88) {
  const result = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  result.name = name;
  return result;
}

function depthAt(y: number) {
  for (let index = 1; index < rings.length; index++) {
    const a = rings[index - 1],
      b = rings[index];
    if (y <= b.y) return THREE.MathUtils.lerp(a.depth, b.depth, (y - a.y) / (b.y - a.y));
  }
  return rings[rings.length - 1].depth;
}

function torsoShell(parent: THREE.Group, fabric: THREE.Material) {
  const positions: number[] = [],
    indices: number[] = [];
  for (const ring of rings) {
    const w = ring.width,
      d = ring.depth,
      bevel = 0.042;
    for (const [x, z] of [
      [-w + bevel, d],
      [w - bevel, d],
      [w, d - bevel],
      [w, -d + bevel],
      [w - bevel, -d],
      [-w + bevel, -d],
      [-w, -d + bevel],
      [-w, d - bevel],
    ])
      positions.push(x, ring.y, z);
  }
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let side = 0; side < 8; side++) {
      const a = ring * 8 + side,
        b = ring * 8 + ((side + 1) % 8);
      indices.push(a, b, a + 8, b, b + 8, a + 8);
    }
  for (let side = 1; side < 7; side++) {
    indices.push(0, side + 1, side);
    const top = (rings.length - 1) * 8;
    indices.push(top, top + side, top + side + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  mesh(parent, geometry, fabric).name = 'suit-body-fabric';
}

// Clip individual pattern triangles at the torso's contour changes, keeping sewn
// fabric flush across the chest bulge instead of letting a large flat face sink in.
function clipHorizontal(points: Point[], height: number, above: boolean): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < points.length; index++) {
    const a = points[index],
      b = points[(index + 1) % points.length];
    const aInside = above ? a[1] >= height : a[1] <= height;
    const bInside = above ? b[1] >= height : b[1] <= height;
    if (aInside) result.push(a);
    if (aInside !== bInside) {
      const fraction = (height - a[1]) / (b[1] - a[1]);
      result.push([THREE.MathUtils.lerp(a[0], b[0], fraction), height]);
    }
  }
  return result;
}

function panel(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: Point[],
  name: string,
  back = false,
  lift = 0.006,
) {
  const vectors = points.map(([x, y]) => new THREE.Vector2(x, y));
  const triangles = THREE.ShapeUtils.triangulateShape(vectors, []);
  const positions: number[] = [],
    indices: number[] = [];
  const boundaries = [-1, ...rings.slice(1, -1).map((ring) => ring.y), 1];
  for (const triangle of triangles)
    for (let band = 0; band < boundaries.length - 1; band++) {
      const polygon = clipHorizontal(
        clipHorizontal(
          triangle.map((index) => points[index]),
          boundaries[band],
          true,
        ),
        boundaries[band + 1],
        false,
      );
      if (polygon.length < 3) continue;
      const offset = positions.length / 3;
      for (const [x, y] of polygon) positions.push(x, y, (depthAt(y) + lift) * (back ? -1 : 1));
      for (let index = 1; index < polygon.length - 1; index++)
        indices.push(
          offset,
          offset + (back ? index + 1 : index),
          offset + (back ? index : index + 1),
        );
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  mesh(parent, geometry, material).name = name;
}

function seam(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: Point[],
  name: string,
  back = false,
  radius = 0.006,
) {
  const projected: THREE.Vector3[] = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const a = points[segment],
      b = points[segment + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.025));
    for (let step = 0; step < steps; step++) {
      const x = THREE.MathUtils.lerp(a[0], b[0], step / steps);
      const y = THREE.MathUtils.lerp(a[1], b[1], step / steps);
      projected.push(new THREE.Vector3(x, y, (depthAt(y) + 0.012) * (back ? -1 : 1)));
    }
  }
  const [x, y] = points[points.length - 1];
  projected.push(new THREE.Vector3(x, y, (depthAt(y) + 0.012) * (back ? -1 : 1)));
  const path = new THREE.CatmullRomCurve3(projected, false, 'centripetal');
  mesh(
    parent,
    new THREE.TubeGeometry(path, projected.length * 2, radius, 4, false),
    material,
  ).name = name;
}

function collar(parent: THREE.Group, materials: Materials, style: Cut['collar']) {
  const height = style === 'stand' ? 0.075 : style === 'wrap' ? 0.067 : 0.052;
  const geometry = new THREE.CylinderGeometry(
    0.142,
    0.153,
    height,
    12,
    1,
    true,
    0.28,
    Math.PI * 2 - 0.56,
  );
  const part = mesh(parent, geometry, materials.panel, 0, 0.64 - height / 2, 0);
  part.name = 'suit-collar';
  const edge = new THREE.TorusGeometry(0.142, 0.007, 4, 12, Math.PI * 2 - 0.56);
  const rim = mesh(parent, edge, materials.trim, 0, 0.64, 0);
  rim.rotation.x = Math.PI / 2;
  rim.rotation.z = 0.28;
  rim.name = 'suit-collar-edge';
  if (style === 'fold' || style === 'shawl') {
    for (const side of [-1, 1]) {
      const points: Point[] =
        style === 'fold'
          ? [
              [side * 0.04, 0.59],
              [side * 0.13, 0.6],
              [side * 0.19, 0.53],
              [side * 0.08, 0.49],
            ]
          : [
              [side * 0.025, 0.59],
              [side * 0.13, 0.6],
              [side * 0.16, 0.52],
              [side * 0.045, 0.43],
            ];
      panel(parent, materials.trim, points, `suit-collar-lapel-${side}`, false, 0.018);
    }
  } else if (style === 'split' || style === 'wrap') {
    const flap = rounded(
      parent,
      materials.trim,
      [style === 'wrap' ? 0.115 : 0.067, 0.032, 0.023],
      [style === 'wrap' ? 0.025 : -0.035, 0.611, 0.145],
      0.008,
    );
    flap.rotation.z = style === 'wrap' ? -0.18 : 0.1;
    flap.name = 'suit-throat-tab';
  }
}

function shoulderYoke(parent: THREE.Group, materials: Materials, cut: Cut) {
  for (const side of [-1, 1]) {
    const sign = side < 0 ? 'left' : 'right';
    const group = new THREE.Group();
    parent.add(group);
    group.position.set(side * 0.282, 0.51, 0);
    group.rotation.z = -side * 0.3;
    const dark = cut.shoulder === 'split' && side > 0 ? materials.trim : materials.panel;
    const top = rounded(group, dark, [0.17, 0.11, 0.31], [side * 0.015, 0.035, 0], 0.038);
    top.name = `suit-shoulder-${sign}`;
    if (cut.shoulder === 'epaulette') {
      rounded(group, materials.trim, [0.075, 0.018, 0.25], [0, 0.093, 0.005], 0.009).name =
        `suit-epaulette-${sign}`;
      rounded(group, materials.leather, [0.042, 0.018, 0.045], [0, 0.105, 0.08], 0.005).name =
        `suit-epaulette-tab-${sign}`;
    } else if (cut.shoulder === 'ribbed') {
      for (let rib = 0; rib < 3; rib++)
        rounded(
          group,
          materials.trim,
          [0.125, 0.014, 0.016],
          [0, 0.093, -0.085 + rib * 0.075],
          0.006,
        ).name = `suit-shoulder-seam-${sign}-${rib}`;
    } else if (cut.shoulder === 'saddle') {
      rounded(group, materials.trim, [0.16, 0.017, 0.1], [0, 0.092, -0.04], 0.014).name =
        `suit-shoulder-saddle-${sign}`;
    } else {
      rounded(group, materials.trim, [0.017, 0.012, 0.275], [side * 0.055, 0.091, 0], 0.005).name =
        `suit-shoulder-piping-${sign}`;
    }
  }
}

function upperBody(parent: THREE.Group, materials: Materials, cut: Cut, edition: number) {
  torsoShell(parent, materials.fabric);
  // Thin side gussets are sewn stretch fabric, following the waist rather than external armor.
  for (const side of [-1, 1]) {
    panel(
      parent,
      materials.panel,
      [
        [side * 0.25, 0.43],
        [side * 0.2, 0.38],
        [side * 0.17, 0.19],
        [side * 0.2, 0.1],
        [side * 0.215, 0.19],
      ],
      `suit-side-insert-${side}`,
    );
    panel(
      parent,
      materials.panel,
      [
        [side * 0.25, 0.43],
        [side * 0.2, 0.38],
        [side * 0.17, 0.19],
        [side * 0.2, 0.1],
        [side * 0.215, 0.19],
      ],
      `suit-back-side-insert-${side}`,
      true,
    );
  }
  cut.panels.forEach((points, index) =>
    panel(
      parent,
      index % 2 ? materials.panel : materials.trim,
      points,
      `suit-chest-panel-${index}`,
    ),
  );
  cut.piping.forEach((points, index) =>
    seam(parent, materials.panel, points, `suit-chest-piping-${index}`),
  );
  seam(parent, materials.rib, cut.zip, 'suit-front-zip', false, 0.011);
  const zipEnd = cut.zip[Math.min(1, cut.zip.length - 1)];
  rounded(
    parent,
    materials.trim,
    [0.022, 0.045, 0.013],
    [zipEnd[0], zipEnd[1] + 0.015, depthAt(zipEnd[1]) + 0.023],
    0.004,
  ).name = 'suit-zip-pull';
  collar(parent, materials, cut.collar);
  shoulderYoke(parent, materials, cut);
  const backY = cut.shoulder === 'saddle' ? 0.38 : cut.shoulder === 'ribbed' ? 0.43 : 0.47;
  const back: Point[] =
    cut.shoulder === 'split'
      ? [
          [-0.24, 0.54],
          [-0.02, 0.56],
          [0.02, 0.47],
          [0.24, 0.52],
          [0.24, 0.43],
          [0.02, 0.39],
          [-0.04, 0.47],
          [-0.24, 0.44],
        ]
      : [
          [-0.24, 0.54],
          [-0.12, 0.57],
          [0.12, 0.57],
          [0.24, 0.54],
          [0.24, backY + 0.015],
          [0, backY - 0.055],
          [-0.24, backY + 0.015],
        ];
  panel(parent, materials.panel, back, 'suit-back-yoke', true);
  seam(
    parent,
    materials.trim,
    [
      [-0.22, backY + 0.025],
      [0, backY - 0.035],
      [0.22, backY + 0.025],
    ],
    'suit-back-yoke-seam',
    true,
  );
  // The lower back seam and lumbar ribs remain visible above the vehicle seat.
  if (cut.quilt) {
    for (let row = 0; row < 3; row++) {
      const y = 0.235 + row * 0.04;
      seam(
        parent,
        materials.rib,
        [
          [-0.155, y],
          [0, y - 0.014],
          [0.155, y],
        ],
        `suit-lumbar-stitch-${row}`,
        true,
        0.004,
      );
      if (cut.quilt === 'diamond') {
        seam(
          parent,
          materials.panel,
          [
            [-0.105, y - 0.015],
            [-0.05, y + 0.025],
            [0.005, y - 0.015],
            [0.06, y + 0.025],
            [0.115, y - 0.015],
          ],
          `suit-front-quilt-${row}`,
          false,
          0.0035,
        );
      }
    }
  }
  // Belt wraps the entire waist; it remains garment thickness, with a flexible front flap.
  const belt = rounded(parent, materials.panel, [0.482, 0.066, 0.385], [0, 0.16, 0], 0.032);
  belt.name = 'suit-waist-belt';
  const beltX = cut.collar === 'wrap' ? 0.09 : 0;
  rounded(parent, materials.trim, [0.115, 0.048, 0.018], [beltX, 0.162, 0.202], 0.012).name =
    'suit-belt-tab';
  rounded(parent, materials.rib, [0.025, 0.041, 0.021], [beltX + 0.028, 0.162, 0.215], 0.005).name =
    'suit-belt-stitch';
  for (let pocket = 0; pocket < (cut.pockets ?? 0); pocket++) {
    const x = pocket ? -0.12 : 0.12;
    panel(
      parent,
      materials.panel,
      [
        [x - 0.062, 0.43],
        [x + 0.062, 0.43],
        [x + 0.056, 0.34],
        [x - 0.054, 0.34],
      ],
      `suit-pocket-${pocket}`,
      false,
      0.014,
    );
    seam(
      parent,
      materials.trim,
      [
        [x - 0.057, 0.423],
        [x + 0.057, 0.423],
      ],
      `suit-pocket-lip-${pocket}`,
      false,
      0.006,
    );
  }
  // Small original race insignia, constructed as sewn geometric patches without fonts/textures.
  if (edition) {
    const x = cut.pockets ? -0.115 : 0.15,
      y = cut.collar === 'fold' ? 0.43 : 0.48;
    panel(
      parent,
      materials.panel,
      [
        [x - 0.038, y + 0.027],
        [x + 0.038, y + 0.027],
        [x + 0.034, y - 0.022],
        [x - 0.034, y - 0.022],
      ],
      'suit-team-patch',
      false,
      0.021,
    );
    const shape: Point[] =
      edition % 3 === 0
        ? [
            [x - 0.023, y],
            [x, y + 0.017],
            [x + 0.023, y],
            [x, y - 0.014],
          ]
        : edition % 3 === 1
          ? [
              [x - 0.024, y - 0.01],
              [x - 0.012, y + 0.015],
              [x, y - 0.005],
              [x + 0.012, y + 0.015],
              [x + 0.024, y - 0.01],
            ]
          : [
              [x - 0.025, y + 0.012],
              [x + 0.025, y + 0.012],
              [x + 0.015, y - 0.012],
              [x - 0.015, y - 0.012],
            ];
    panel(parent, materials.trim, shape, 'suit-team-insignia', false, 0.026);
  }
}

/** Local sleeve/trouser axis points downward (-Y); joint rotations alone change pose. */
function segment(
  parent: THREE.Group,
  start: Vec,
  end: Vec,
  upperRadius: number,
  lowerRadius: number,
  material: THREE.Material,
  name: string,
) {
  const group = new THREE.Group();
  group.name = name;
  parent.add(group);
  group.position.set(...start);
  const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
  const length = direction.length();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction.normalize());
  mesh(
    group,
    new THREE.CylinderGeometry(upperRadius, lowerRadius, length, 8),
    material,
    0,
    -length / 2,
    0,
  ).name = `${name}-fabric`;
  return { group, length };
}

function band(
  parent: THREE.Group,
  material: THREE.Material,
  y: number,
  height: number,
  radius: number,
  name: string,
) {
  mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius * 0.97, height, 8),
    material,
    0,
    y,
    0,
  ).name = name;
}

function limbPanel(
  parent: THREE.Group,
  material: THREE.Material,
  width: number,
  length: number,
  y: number,
  z: number,
  name: string,
  shape: Cut['knee'] = 'long',
) {
  const points: Point[] =
    shape === 'square'
      ? [
          [-width, 0.5 * length],
          [width, 0.5 * length],
          [width, -0.5 * length],
          [-width, -0.5 * length],
        ]
      : shape === 'split'
        ? [
            [-width, 0.5 * length],
            [width * 0.55, 0.5 * length],
            [width, 0],
            [width * 0.3, -0.5 * length],
            [-width, -0.36 * length],
          ]
        : [
            [-width * 0.7, 0.5 * length],
            [width * 0.7, 0.5 * length],
            [width, 0.2 * length],
            [width * 0.7, -0.5 * length],
            [-width * 0.7, -0.5 * length],
            [-width, -0.2 * length],
          ];
  const geometry = new THREE.ShapeGeometry(
    new THREE.Shape(points.map(([x, yy]) => new THREE.Vector2(x, yy))),
  );
  mesh(parent, geometry, material, 0, y, z).name = name;
}

function arm(parent: THREE.Group, materials: Materials, cut: Cut, side: number, display: boolean) {
  const sign = side < 0 ? 'left' : 'right';
  const shoulder: Vec = [side * 0.292, 0.51, 0];
  const elbow: Vec = display ? [side * 0.378, 0.204, 0.018] : [side * 0.425, 0.305, 0.235];
  const wrist: Vec = display ? [side * 0.392, -0.095, 0.055] : [side * 0.35, 0.25, 0.545];
  const glove: Vec = display ? [side * 0.397, -0.151, 0.062] : [side * 0.35, 0.25, 0.59];
  const sleeveMaterial = cut.sleeve === 'split' && side < 0 ? materials.trim : materials.fabric;
  ellipsoid(parent, sleeveMaterial, [0.112, 0.114, 0.111], shoulder).name = `suit-armhole-${sign}`;
  const upper = segment(
    parent,
    shoulder,
    elbow,
    0.109,
    0.09,
    sleeveMaterial,
    `suit-upper-sleeve-${sign}`,
  );
  const forearm = segment(
    parent,
    elbow,
    wrist,
    0.091,
    0.072,
    sleeveMaterial,
    `suit-lower-sleeve-${sign}`,
  );
  ellipsoid(parent, sleeveMaterial, [0.093, 0.092, 0.093], elbow).name = `suit-elbow-joint-${sign}`;
  if (cut.sleeve === 'bands') {
    band(
      upper.group,
      materials.panel,
      -upper.length * 0.36,
      0.045,
      0.111,
      `suit-sleeve-band-${sign}`,
    );
    band(
      upper.group,
      materials.trim,
      -upper.length * 0.55,
      0.019,
      0.105,
      `suit-sleeve-band-edge-${sign}`,
    );
  } else {
    limbPanel(
      upper.group,
      cut.sleeve === 'elbow' ? materials.panel : materials.trim,
      0.026,
      upper.length * 0.72,
      -upper.length * 0.48,
      0.103,
      `suit-sleeve-stripe-${sign}`,
    );
  }
  limbPanel(
    forearm.group,
    materials.panel,
    0.058,
    0.115,
    -0.055,
    0.085,
    `suit-elbow-reinforcement-${sign}`,
    cut.knee,
  );
  for (let row = 0; row < (cut.quilt ? 3 : 1); row++)
    rounded(
      forearm.group,
      materials.rib,
      [0.086, 0.006, 0.007],
      [0, -0.035 - row * 0.028, 0.091],
      0.002,
    ).name = `suit-elbow-stitch-${sign}-${row}`;
  band(
    forearm.group,
    materials.panel,
    -forearm.length + cut.cuff * 0.4,
    cut.cuff,
    0.079,
    `suit-wrist-cuff-${sign}`,
  );
  band(
    forearm.group,
    materials.trim,
    -forearm.length + cut.cuff * 0.82,
    0.013,
    0.081,
    `suit-wrist-cuff-edge-${sign}`,
  );
  const hand = new THREE.Group();
  parent.add(hand);
  hand.position.set(...glove);
  hand.name = `suit-glove-${sign}`;
  if (display) hand.rotation.x = -0.16;
  else hand.rotation.x = -Math.PI * 0.35;
  ellipsoid(hand, materials.leather, [0.083, 0.101, 0.076], [0, 0, 0]).name =
    `suit-glove-leather-${sign}`;
  rounded(hand, materials.trim, [0.09, 0.068, 0.013], [0, 0.01, 0.071], 0.018).name =
    `suit-glove-knuckles-${sign}`;
  ellipsoid(hand, materials.leather, [0.036, 0.058, 0.042], [-side * 0.065, -0.006, 0.025]).name =
    `suit-glove-thumb-${sign}`;
}

function leg(parent: THREE.Group, materials: Materials, cut: Cut, side: number, display: boolean) {
  const sign = side < 0 ? 'left' : 'right';
  const hip: Vec = [side * 0.132, 0.07, 0.015];
  const knee: Vec = display ? [side * 0.142, -0.376, 0.012] : [side * 0.17, -0.085, 0.43];
  const ankle: Vec = display ? [side * 0.153, -0.8, 0.025] : [side * 0.17, -0.345, 0.735];
  const upper = segment(
    parent,
    hip,
    knee,
    0.129,
    0.108,
    materials.fabric,
    `suit-upper-trouser-${sign}`,
  );
  ellipsoid(parent, materials.fabric, [0.111, 0.11, 0.111], knee).name = `suit-knee-joint-${sign}`;
  const lower = segment(
    parent,
    knee,
    ankle,
    0.107,
    0.075,
    materials.fabric,
    `suit-lower-trouser-${sign}`,
  );
  limbPanel(
    upper.group,
    materials.panel,
    0.038,
    upper.length * 0.76,
    -upper.length * 0.48,
    0.118,
    `suit-thigh-insert-${sign}`,
    cut.knee,
  );
  limbPanel(
    lower.group,
    materials.panel,
    cut.knee === 'long' ? 0.066 : 0.078,
    cut.knee === 'long' ? 0.22 : 0.145,
    -0.066,
    0.098,
    `suit-knee-reinforcement-${sign}`,
    cut.knee,
  );
  if (cut.knee === 'split')
    limbPanel(lower.group, materials.trim, 0.023, 0.16, -0.08, 0.104, `suit-knee-split-${sign}`);
  else
    rounded(lower.group, materials.trim, [0.102, 0.013, 0.008], [0, -0.017, 0.104], 0.003).name =
      `suit-knee-seam-${sign}`;
  band(lower.group, materials.panel, -lower.length + 0.038, 0.075, 0.08, `suit-ankle-cuff-${sign}`);
  band(
    lower.group,
    materials.trim,
    -lower.length + 0.073,
    0.012,
    0.082,
    `suit-ankle-cuff-edge-${sign}`,
  );
  const boot = new THREE.Group();
  parent.add(boot);
  boot.name = `suit-boot-${sign}`;
  boot.position.set(ankle[0], display ? -0.86 : -0.375, ankle[2] + 0.042);
  rounded(boot, materials.leather, [0.177, 0.17, 0.3], [0, 0, 0.035], 0.045).name =
    `suit-boot-leather-${sign}`;
  rounded(boot, materials.rib, [0.184, 0.025, 0.31], [0, -0.0975, 0.037], 0.015).name =
    `suit-boot-sole-${sign}`;
  rounded(boot, materials.panel, [0.123, 0.098, 0.03], [0, 0.01, 0.184], 0.025).name =
    `suit-boot-toe-${sign}`;
  rounded(boot, materials.trim, [0.13, 0.024, 0.025], [0, 0.068, 0.1], 0.006).name =
    `suit-boot-fastener-${sign}`;
}

/** Builds its own resources, so a shop preview can be disposed without affecting the racer. */
export function createRacingSuit(
  variant = 0,
  color?: string,
  pose: 'seated' | 'display' = 'seated',
): THREE.Group {
  const edition =
    Number.isInteger(variant) && variant >= 1 && variant <= suitDesigns.length ? variant : 0;
  const design = edition
    ? suitDesigns[edition - 1]
    : { primary: '#f8f4e8', secondary: '#354348', accent: '#d69e62' };
  const cut = edition ? cuts[edition - 1] : stock;
  const materials: Materials = {
    fabric: material(color || design.primary, 'suit-fabric'),
    panel: material(design.secondary, 'suit-panel'),
    trim: material(design.accent, 'suit-trim'),
    rib: material('#34373b', 'suit-stitch'),
    leather: material('#242a30', 'suit-glove-boot', 0.72),
  };
  const suit = new THREE.Group();
  suit.name = 'driver-suit';
  const garment = new THREE.Group();
  garment.name = 'suit-garment';
  suit.add(garment);
  const display = pose === 'display';
  garment.position.y = display ? 0.97 : 0;
  const torso = new THREE.Group();
  torso.name = 'suit-torso';
  garment.add(torso);
  upperBody(torso, materials, cut, edition);
  for (const side of [-1, 1]) {
    arm(garment, materials, cut, side, display);
    leg(garment, materials, cut, side, display);
  }
  return suit;
}
