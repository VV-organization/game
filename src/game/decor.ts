import * as THREE from 'three';
import { decorDesigns } from '../shared/decor-designs';
import { ellipsoid, mesh, rod, rounded, tube } from './vehicle-parts';

type Point = [number, number, number];
type DecorMaterials = {
  primary: THREE.MeshStandardMaterial;
  secondary: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  ivory: THREE.MeshStandardMaterial;
};

function cylinder(
  parent: THREE.Group,
  material: THREE.Material,
  top: number,
  bottom: number,
  height: number,
  position: Point,
  sides = 16,
) {
  return mesh(
    parent,
    new THREE.CylinderGeometry(top, bottom, height, sides),
    material,
    ...position,
  );
}

function lathe(
  parent: THREE.Group,
  material: THREE.Material,
  profile: [number, number][],
  position: Point,
  segments = 20,
) {
  return mesh(
    parent,
    new THREE.LatheGeometry(
      profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
      segments,
    ),
    material,
    ...position,
  );
}

function plaque(
  parent: THREE.Group,
  material: THREE.Material,
  points: [number, number][],
  z: number,
  depth = 0.06,
) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return mesh(
    parent,
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 }),
    material,
    0,
    0,
    z - depth / 2,
  );
}

function bowl(parent: THREE.Group, m: DecorMaterials, y: number, width = 1, height = 1) {
  const cup = lathe(
    parent,
    m.primary,
    [
      [0, 0],
      [0.17, 0],
      [0.19, 0.08],
      [0.17, 0.13],
      [0.24, 0.37],
      [0.43, 0.64],
      [0.45, 0.71],
      [0.38, 0.71],
      [0.36, 0.62],
      [0.18, 0.36],
      [0.1, 0.12],
      [0, 0.12],
    ],
    [0, y, 0],
  );
  cup.scale.set(width, height, width);
  return cup;
}

function trophies(parent: THREE.Group, m: DecorMaterials, finish: number) {
  if (finish === 0) {
    rounded(parent, m.secondary, [0.8, 0.2, 0.7], [0, 0.1, 0], 0.035);
    rounded(parent, m.secondary, [0.58, 0.46, 0.5], [0, 0.43, 0], 0.025);
    rounded(parent, m.accent, [0.7, 0.07, 0.61], [0, 0.695, 0], 0.025);
    cylinder(parent, m.primary, 0.13, 0.2, 0.46, [0, 0.95, 0]);
    bowl(parent, m, 1.15);
    for (const side of [-1, 1]) {
      const handle = mesh(
        parent,
        new THREE.TorusGeometry(0.3, 0.065, 8, 20),
        m.primary,
        side * 0.39,
        1.65,
        0,
      );
      handle.scale.x = 0.78;
    }
    rounded(parent, m.accent, [0.31, 0.17, 0.025], [0, 0.44, 0.263], 0.012);
  } else if (finish === 1) {
    cylinder(parent, m.secondary, 0.37, 0.46, 0.42, [0, 0.21, 0], 6);
    cylinder(parent, m.accent, 0.29, 0.32, 0.15, [0, 0.495, 0], 6);
    cylinder(parent, m.primary, 0.105, 0.19, 0.55, [0, 0.83, 0]);
    bowl(parent, m, 1.07, 0.85, 0.9);
    for (const side of [-1, 1])
      for (let feather = 0; feather < 4; feather++) {
        const x = 0.72 + feather * 0.095,
          y = 2.02 - feather * 0.15;
        plaque(
          parent,
          feather % 2 ? m.accent : m.primary,
          [
            [side * 0.12, 1.19],
            [side * 0.18, 1.37],
            [side * x, y],
            [side * (x + 0.045), y - 0.1],
          ],
          -0.025 + feather * 0.018,
          0.085,
        );
      }
    mesh(parent, new THREE.IcosahedronGeometry(0.12, 0), m.accent, 0, 1.8, 0);
  } else if (finish === 2) {
    cylinder(parent, m.secondary, 0.4, 0.52, 0.25, [0, 0.125, 0], 4);
    cylinder(parent, m.secondary, 0.34, 0.4, 0.4, [0, 0.45, 0], 4);
    const crystal = mesh(parent, new THREE.OctahedronGeometry(1, 0), m.primary, 0, 1.6, 0);
    crystal.scale.set(0.48, 0.95, 0.39);
    crystal.rotation.y = Math.PI / 4;
    for (const side of [-1, 1]) {
      const shard = mesh(
        parent,
        new THREE.OctahedronGeometry(1, 0),
        m.accent,
        side * 0.38,
        0.9,
        0.1,
      );
      shard.scale.set(0.18, 0.45, 0.22);
      shard.rotation.z = side * -0.22;
    }
    rounded(parent, m.accent, [0.32, 0.04, 0.03], [0, 0.43, 0.29], 0.01);
  } else if (finish === 3) {
    lathe(
      parent,
      m.secondary,
      [
        [0, 0],
        [0.47, 0],
        [0.47, 0.12],
        [0.32, 0.18],
        [0.2, 0.4],
        [0.17, 0.75],
        [0.25, 0.87],
        [0, 0.87],
      ],
      [0, 0, 0],
    );
    bowl(parent, m, 0.85, 1.22, 0.78);
    for (const side of [-1, 1]) {
      const points: Point[] = [
        [side * 0.24, 0.35, 0],
        [side * 0.66, 0.82, 0],
        [side * 0.76, 1.38, 0],
        [side * 0.6, 1.94, 0],
        [side * 0.38, 2.1, 0],
      ];
      tube(parent, m.primary, points, 0.035);
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      for (let i = 1; i < 10; i++) {
        const point = curve.getPoint(i / 10);
        const leaf = ellipsoid(parent, m.accent, [0.09, 0.19, 0.045], [point.x, point.y, point.z]);
        leaf.rotation.z = side * (i % 2 ? 0.65 : -0.4);
      }
    }
  } else {
    cylinder(parent, m.secondary, 0.42, 0.49, 0.23, [0, 0.115, 0], 8);
    cylinder(parent, m.accent, 0.36, 0.36, 0.055, [0, 0.25, 0], 12);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      tube(
        parent,
        m.primary,
        [
          [Math.sin(a) * 0.31, 0.26, Math.cos(a) * 0.31],
          [Math.sin(a) * 0.21, 0.76, Math.cos(a) * 0.21],
          [0, 1.36, 0],
        ],
        0.055,
      );
      const orbit = mesh(
        parent,
        new THREE.TorusGeometry(0.66, 0.052, 8, 40),
        i === 1 ? m.accent : m.primary,
        0,
        1.62,
        0,
      );
      orbit.rotation.set(0.55 + i * 0.62, i * 0.9, i * 0.38);
      const rim = new THREE.Vector3(0.66, 0, 0).applyEuler(orbit.rotation).add(orbit.position);
      rod(parent, m.primary, [0, 1.62, 0], rim.toArray(), 0.025);
      if (i === 1) {
        const satellite = new THREE.Vector3(Math.cos(0.6) * 0.66, Math.sin(0.6) * 0.66, 0)
          .applyEuler(orbit.rotation)
          .add(orbit.position);
        mesh(parent, new THREE.SphereGeometry(0.09, 12, 8), m.accent, ...satellite.toArray());
      }
    }
    mesh(parent, new THREE.IcosahedronGeometry(0.29, 1), m.primary, 0, 1.62, 0);
  }
}

function crate(
  parent: THREE.Group,
  m: DecorMaterials,
  position: Point,
  size: Point,
  slatted = false,
) {
  const [x, y, z] = position,
    [w, h, d] = size;
  rounded(parent, m.primary, size, position, 0.025);
  for (const side of [-1, 1])
    for (const front of [-1, 1])
      rounded(
        parent,
        m.secondary,
        [0.065, h + 0.012, 0.065],
        [x + side * (w / 2 - 0.02), y + 0.006, z + front * (d / 2 - 0.02)],
        0.012,
      );
  if (slatted)
    for (let i = 0; i < 4; i++)
      for (const side of [-1, 1])
        rounded(
          parent,
          m.accent,
          [w - 0.07, 0.025, 0.03],
          [x, y - h / 2 + 0.12 + (i * (h - 0.2)) / 3, z + side * (d / 2 + 0.012)],
          0.008,
        );
  else
    for (const side of [-1, 1]) {
      const at = x + side * w * 0.28;
      rounded(parent, m.secondary, [0.07, h + 0.02, d + 0.025], [at, y + 0.01, z], 0.015);
    }
}

function equipmentCase(
  parent: THREE.Group,
  m: DecorMaterials,
  position: Point,
  size: Point,
  neon = false,
) {
  const [x, y, z] = position,
    [w, h, d] = size;
  rounded(parent, m.secondary, size, position, 0.09);
  rounded(parent, m.primary, [w + 0.025, 0.09, d + 0.025], [x, y + h * 0.12, z], 0.035);
  for (const side of [-1, 1]) {
    rounded(
      parent,
      m.metal,
      [0.095, 0.19, 0.035],
      [x + side * w * 0.3, y + h * 0.12, z + d / 2 + 0.02],
      0.025,
    );
    rounded(
      parent,
      m.primary,
      [0.16, 0.16, 0.08],
      [x + side * (w / 2 - 0.07), y - h / 2 + 0.08, z + d / 2],
      0.025,
    );
  }
  tube(
    parent,
    neon ? m.accent : m.metal,
    [
      [x - w * 0.17, y + h / 2, z],
      [x - w * 0.17, y + h / 2 + 0.12, z],
      [x + w * 0.17, y + h / 2 + 0.12, z],
      [x + w * 0.17, y + h / 2, z],
    ],
    0.035,
  );
  if (neon)
    tube(
      parent,
      m.accent,
      [
        [x - w / 2 + 0.04, y - h / 2 + 0.04, z + d / 2 + 0.015],
        [x - w / 2 + 0.04, y + h / 2 - 0.04, z + d / 2 + 0.015],
        [x + w / 2 - 0.04, y + h / 2 - 0.04, z + d / 2 + 0.015],
        [x + w / 2 - 0.04, y - h / 2 + 0.04, z + d / 2 + 0.015],
      ],
      0.018,
      true,
    );
}

function crates(parent: THREE.Group, m: DecorMaterials, finish: number) {
  if (finish === 0) {
    crate(parent, m, [-0.42, 0.38, 0], [0.77, 0.76, 0.7]);
    crate(parent, m, [0.42, 0.3, 0.03], [0.72, 0.6, 0.66]);
    crate(parent, m, [-0.4, 1.06, 0], [0.7, 0.6, 0.65]);
  } else if (finish === 1) {
    equipmentCase(parent, m, [-0.39, 0.72, 0], [0.7, 1.44, 0.62]);
    equipmentCase(parent, m, [0.43, 0.27, 0.15], [0.9, 0.54, 0.75]);
  } else if (finish === 2) {
    rounded(parent, m.secondary, [1.15, 0.72, 0.75], [0, 0.36, 0], 0.055);
    rounded(parent, m.primary, [1.18, 0.1, 0.8], [0, 0.77, 0], 0.035);
    const lid = rounded(parent, m.primary, [1.14, 0.72, 0.08], [0, 1.12, -0.36], 0.05);
    lid.rotation.x = -0.16;
    rounded(parent, m.dark, [0.96, 0.55, 0.025], [0, 1.12, -0.29], 0.03);
    rounded(parent, m.primary, [1.04, 0.16, 0.78], [0, 0.41, 0.28], 0.025);
    rounded(parent, m.secondary, [0.89, 0.06, 0.62], [0, 0.49, 0.3], 0.015);
    rounded(parent, m.metal, [0.38, 0.06, 0.045], [0, 0.41, 0.69], 0.015);
    for (const x of [-0.37, 0, 0.37]) {
      rod(parent, m.metal, [x, 0.81, -0.12], [x, 1.45, -0.11], 0.027);
      rounded(parent, m.accent, [0.12, 0.27, 0.1], [x, 0.96, -0.1], 0.035);
    }
    const wrench = mesh(
      parent,
      new THREE.TorusGeometry(0.11, 0.035, 6, 12, Math.PI * 1.6),
      m.metal,
      -0.37,
      1.49,
      -0.11,
    );
    wrench.rotation.z = 0.32;
    rounded(parent, m.metal, [0.08, 0.18, 0.035], [0.37, 1.49, -0.11], 0.01);
    for (const x of [-0.32, 0.18])
      rod(parent, m.metal, [x, 0.56, 0.14], [x + 0.15, 0.56, 0.54], 0.025);
  } else if (finish === 3) {
    crate(parent, m, [-0.36, 0.35, 0], [1.02, 0.7, 0.76], true);
    const lid = mesh(
      parent,
      new THREE.CylinderGeometry(0.38, 0.38, 1.02, 20, 1, false, 0, Math.PI),
      m.primary,
      -0.36,
      0.7,
      0,
    );
    lid.rotation.z = Math.PI / 2;
    for (const x of [-0.69, -0.04]) {
      const band = mesh(
        parent,
        new THREE.TorusGeometry(0.388, 0.028, 6, 20, Math.PI),
        m.secondary,
        x,
        0.7,
        0,
      );
      band.rotation.y = Math.PI / 2;
      rounded(parent, m.secondary, [0.06, 0.68, 0.8], [x, 0.35, 0], 0.012);
    }
    rounded(parent, m.metal, [0.12, 0.22, 0.045], [-0.36, 0.69, 0.4], 0.02);
    crate(parent, m, [0.54, 0.26, 0.12], [0.61, 0.52, 0.65], true);
  } else {
    for (const x of [-0.58, 0.58])
      for (const z of [-0.34, 0.34]) {
        rounded(parent, m.secondary, [0.14, 0.13, 0.17], [x, 0.065, z], 0.025);
        rod(parent, m.primary, [x, 0.12, z], [x, 1.76, z], 0.045);
      }
    for (const y of [0.2, 1.0, 1.78])
      rounded(parent, m.primary, [1.27, 0.09, 0.8], [0, y, 0], 0.035);
    equipmentCase(parent, m, [0, 0.58, 0], [1.02, 0.67, 0.62], true);
    equipmentCase(parent, m, [0, 1.35, 0], [0.89, 0.6, 0.57], true);
    for (const x of [-0.58, 0.58]) rod(parent, m.accent, [x, 0.2, 0.36], [x, 1.76, 0.36], 0.018);
  }
}

function checkeredCloth(
  parent: THREE.Group,
  m: DecorMaterials,
  position: Point,
  width: number,
  height: number,
  wave = 0.12,
) {
  const [x, y, z] = position,
    positions: number[] = [],
    indices: number[] = [],
    columns = 12,
    rows = 8;
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= columns; col++) {
      const u = col / columns,
        v = row / rows;
      positions.push(
        x + u * width,
        y + v * height,
        z + Math.sin(u * Math.PI * 2.3 + v * 0.7) * wave * u,
      );
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col,
        b = a + 1,
        c = a + columns + 1,
        d = c + 1,
        start = indices.length;
      indices.push(a, b, c, b, d, c);
      geometry.addGroup(start, 6, (Math.floor(row / 2) + Math.floor(col / 2)) % 2);
    }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cloth = new THREE.Mesh(geometry, [m.ivory, m.secondary]);
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  parent.add(cloth);
  return cloth;
}

function flags(parent: THREE.Group, m: DecorMaterials, finish: number) {
  if (finish === 0) {
    cylinder(parent, m.secondary, 0.34, 0.4, 0.15, [-0.61, 0.075, 0]);
    rod(parent, m.metal, [-0.61, 0.13, 0], [-0.61, 2.83, 0], 0.045);
    mesh(parent, new THREE.SphereGeometry(0.075, 12, 8), m.primary, -0.61, 2.86, 0);
    checkeredCloth(parent, m, [-0.6, 1.72, 0], 1.4, 0.92);
  } else if (finish === 1) {
    rounded(parent, m.secondary, [0.85, 0.16, 0.64], [0, 0.08, 0], 0.07);
    for (const side of [-1, 1]) {
      rod(
        parent,
        m.metal,
        [-side * 0.3, 0.13, side * 0.04],
        [side * 0.62, 2.66, side * 0.04],
        0.045,
      );
      plaque(
        parent,
        m.primary,
        [
          [side * 0.61, 2.62],
          [side * 0.42, 2.12],
          [side * 1.12, 2.23],
        ],
        side * 0.04,
        0.025,
      );
      plaque(
        parent,
        m.ivory,
        [
          [side * 0.54, 2.4],
          [side * 0.5, 2.3],
          [side * 0.87, 2.28],
        ],
        side * 0.04 + 0.02,
        0.01,
      );
    }
    cylinder(parent, m.primary, 0.1, 0.1, 0.12, [0, 1.1, 0], 12).rotation.x = Math.PI / 2;
  } else if (finish === 2) {
    rounded(parent, m.secondary, [0.83, 0.16, 0.65], [-0.12, 0.08, 0], 0.04);
    rod(parent, m.metal, [-0.48, 0.13, 0], [-0.48, 3.0, 0], 0.043);
    rod(parent, m.metal, [-0.48, 2.89, 0], [0.58, 2.89, 0], 0.04);
    plaque(
      parent,
      m.primary,
      [
        [-0.38, 2.85],
        [0.48, 2.85],
        [0.48, 1.04],
        [0.05, 0.8],
        [-0.38, 1.04],
      ],
      0.025,
      0.035,
    );
    for (const y of [1.35, 1.87, 2.39])
      plaque(
        parent,
        m.accent,
        [
          [-0.29, y + 0.13],
          [0.05, y - 0.05],
          [0.39, y + 0.13],
          [0.39, y - 0.04],
          [0.05, y - 0.25],
          [-0.29, y - 0.04],
        ],
        0.051,
        0.015,
      );
    for (const x of [-0.3, 0.39]) rod(parent, m.secondary, [x, 2.78, 0], [x, 2.91, 0], 0.018);
  } else if (finish === 3) {
    cylinder(parent, m.secondary, 0.35, 0.43, 0.12, [0, 0.06, 0], 3);
    rod(parent, m.primary, [0, 0.1, 0], [0, 2.47, 0], 0.06);
    rod(parent, m.primary, [-0.98, 2.42, 0], [0.98, 2.42, 0], 0.045);
    for (let i = 0; i < 4; i++) {
      const x = -0.72 + i * 0.48;
      plaque(
        parent,
        i % 2 ? m.accent : m.primary,
        [
          [x - 0.18, 2.38],
          [x + 0.18, 2.38],
          [x, 1.73 - (i % 2) * 0.09],
        ],
        0.015,
        0.025,
      );
      for (const dx of [-0.13, 0.13])
        rod(parent, m.secondary, [x + dx, 2.37, 0], [x + dx, 2.44, 0], 0.015);
    }
  } else {
    for (const x of [-0.65, 0.65]) {
      rounded(parent, m.secondary, [0.42, 0.13, 0.55], [x, 0.065, 0], 0.035);
      rounded(parent, m.secondary, [0.11, 2.43, 0.15], [x, 1.33, 0], 0.03);
      rod(parent, m.accent, [x, 0.2, 0.085], [x, 2.48, 0.085], 0.018);
    }
    rounded(parent, m.primary, [1.42, 0.16, 0.25], [0, 2.53, 0], 0.045);
    rounded(parent, m.secondary, [1.22, 0.48, 0.22], [0, 2.12, 0], 0.065);
    for (const [i, color] of ['#ed624e', '#f1c74c', '#70df9b'].entries()) {
      const housing = cylinder(
        parent,
        m.dark,
        0.155,
        0.155,
        0.07,
        [-0.38 + i * 0.38, 2.12, 0.14],
        16,
      );
      housing.rotation.x = Math.PI / 2;
      const light = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      });
      light.name = 'decor-light';
      mesh(parent, new THREE.CircleGeometry(0.115, 16), light, -0.38 + i * 0.38, 2.12, 0.181);
    }
    checkeredCloth(parent, m, [-0.54, 1.13, 0.015], 1.08, 0.62, 0.025);
    for (const y of [1.1, 1.77]) rod(parent, m.primary, [-0.65, y, 0], [0.65, y, 0], 0.035);
  }
}

function frond(
  parent: THREE.Group,
  material: THREE.Material,
  origin: Point,
  angle: number,
  length: number,
  width: number,
  lift = 0.18,
  drop = 0.48,
) {
  const positions: number[] = [],
    indices: number[] = [],
    segments = 8;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      d = t * length,
      w = Math.sin(Math.PI * t) * width * (i % 2 ? 0.85 : 1);
    const y = origin[1] + Math.sin(t * Math.PI) * lift - drop * t * t;
    const x = origin[0] + Math.sin(angle) * d,
      z = origin[2] + Math.cos(angle) * d;
    positions.push(
      x + Math.cos(angle) * w,
      y,
      z - Math.sin(angle) * w,
      x,
      y + 0.025 * Math.sin(t * Math.PI),
      z,
      x - Math.cos(angle) * w,
      y,
      z + Math.sin(angle) * w,
    );
  }
  for (let i = 0; i < segments; i++)
    for (let edge = 0; edge < 2; edge++) {
      const a = i * 3 + edge,
        b = a + 1,
        c = a + 3,
        d = b + 3;
      indices.push(a, b, c, b, d, c);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

function crown(
  parent: THREE.Group,
  m: DecorMaterials,
  origin: Point,
  count: number,
  length: number,
  phase = 0,
  lift = 0.18,
  drop = 0.48,
) {
  for (let i = 0; i < count; i++)
    frond(
      parent,
      m.leaf,
      origin,
      phase + (i * Math.PI * 2) / count,
      length * (i % 2 ? 0.9 : 1),
      0.19,
      lift,
      drop,
    );
}

function pot(parent: THREE.Group, m: DecorMaterials, height = 0.65, radius = 0.42, sides = 16) {
  cylinder(parent, m.primary, radius, radius * 0.72, height, [0, height / 2, 0], sides);
  cylinder(parent, m.secondary, radius + 0.025, radius + 0.025, 0.08, [0, height - 0.04, 0], sides);
  cylinder(parent, m.dark, radius - 0.035, radius - 0.035, 0.025, [0, height - 0.035, 0], sides);
}

function fan(
  parent: THREE.Group,
  material: THREE.Material,
  origin: Point,
  angle: number,
  radius = 0.78,
) {
  const positions: number[] = [...origin],
    indices: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -1.25 + i * 0.25,
      reach = radius * (i % 2 ? 0.86 : 1),
      x = Math.sin(a) * reach,
      y = Math.cos(a) * reach;
    positions.push(
      origin[0] + Math.cos(angle) * x,
      origin[1] + y,
      origin[2] + Math.sin(angle) * x + (i % 2 ? 0.055 : 0),
    );
  }
  for (let i = 1; i < 11; i++) indices.push(0, i, i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

function palms(parent: THREE.Group, m: DecorMaterials, finish: number) {
  if (finish === 0) {
    pot(parent, m);
    tube(
      parent,
      m.secondary,
      [
        [0, 0.58, 0],
        [0.06, 1.35, 0],
        [0.2, 2.28, 0.04],
      ],
      0.095,
    );
    crown(parent, m, [0.2, 2.28, 0.04], 8, 1.0, 0.15, 0.17, 0.48);
  } else if (finish === 1) {
    const planter = lathe(
      parent,
      m.primary,
      [
        [0, 0],
        [0.32, 0],
        [0.46, 0.58],
        [0.48, 0.64],
        [0.4, 0.64],
        [0.38, 0.57],
        [0, 0.57],
      ],
      [0, 0, 0],
    );
    planter.scale.x = 1.25;
    ellipsoid(parent, m.dark, [0.49, 0.025, 0.35], [0, 0.59, 0]);
    for (const side of [-1, 1]) {
      const top: Point = [side * 0.38, side < 0 ? 2.1 : 2.5, 0];
      tube(
        parent,
        m.secondary,
        [[side * 0.18, 0.56, 0], [side * 0.15, 1.25, 0], [side * 0.35, 1.72, 0], top],
        0.07,
      );
      crown(parent, m, top, 6, 0.72, side * 0.4, 0.12, 0.35);
    }
  } else if (finish === 2) {
    pot(parent, m, 0.98, 0.42, 6);
    tube(
      parent,
      m.secondary,
      [
        [0, 0.92, 0],
        [0, 1.55, 0],
        [0.03, 1.94, 0],
      ],
      0.075,
    );
    for (const [x, y, z, a] of [
      [0, 1.96, 0, 0],
      [-0.27, 1.68, 0.1, -0.5],
      [0.28, 1.63, -0.06, 0.65],
    ]) {
      rod(parent, m.secondary, [0.02, 1.57, 0], [x, y, z], 0.035);
      fan(parent, m.leaf, [x, y, z], a, 0.79);
    }
  } else if (finish === 3) {
    lathe(
      parent,
      m.primary,
      [
        [0, 0],
        [0.29, 0],
        [0.39, 0.12],
        [0.46, 0.5],
        [0.46, 0.65],
        [0.4, 0.68],
        [0.37, 0.6],
        [0, 0.6],
      ],
      [0, 0, 0],
    );
    cylinder(parent, m.dark, 0.38, 0.38, 0.025, [0, 0.615, 0]);
    rod(parent, m.secondary, [0, 0.6, 0], [0.07, 2.2, 0], 0.11);
    for (let i = 0; i < 10; i++)
      cylinder(parent, m.primary, 0.115, 0.125, 0.065, [i * 0.007, 0.7 + i * 0.145, 0], 10);
    crown(parent, m, [0.07, 2.2, 0], 10, 0.95, 0.2, 0.48, 0.2);
    for (let bunch = 0; bunch < 3; bunch++) {
      const angle = (bunch * Math.PI * 2) / 3,
        x = Math.sin(angle) * 0.23,
        z = Math.cos(angle) * 0.23;
      rod(parent, m.secondary, [0.07, 2.2, 0], [x, 1.89, z], 0.025);
      for (let i = 0; i < 7; i++)
        ellipsoid(
          parent,
          m.primary,
          [0.055, 0.09, 0.055],
          [
            x + Math.sin(i * 2.4) * 0.08,
            1.92 - Math.floor(i / 2) * 0.08,
            z + Math.cos(i * 2.4) * 0.08,
          ],
        );
    }
  } else {
    rounded(parent, m.secondary, [0.86, 0.72, 0.86], [0, 0.36, 0], 0.08);
    rounded(parent, m.primary, [0.91, 0.08, 0.91], [0, 0.7, 0], 0.035);
    rounded(parent, m.dark, [0.75, 0.025, 0.75], [0, 0.74, 0], 0.02);
    for (const side of [-1, 1])
      for (const front of [-1, 1])
        rod(
          parent,
          m.accent,
          [side * 0.38, 0.12, front * 0.38],
          [side * 0.38, 0.63, front * 0.38],
          0.018,
        );
    tube(
      parent,
      m.primary,
      [
        [0, 0.73, 0],
        [-0.1, 1.22, 0],
        [0.12, 1.78, 0.02],
        [0, 2.5, 0],
      ],
      0.075,
    );
    crown(parent, m, [0.1, 1.77, 0.02], 5, 0.94, 0.2, 0.12, 0.25);
    crown(parent, m, [0, 2.5, 0], 5, 0.75, 0.8, 0.08, 0.32);
  }
}

export function createDecor(variant: number): THREE.Group | null {
  if (!Number.isInteger(variant) || variant < 1 || variant > decorDesigns.length) return null;
  const definition = decorDesigns[variant - 1],
    finish = Math.floor((variant - 1) / 4),
    family = (variant - 1) % 4;
  const material = (color: string, name: string, metalness = 0.1) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.43, metalness });
    result.name = name;
    return result;
  };
  const m: DecorMaterials = {
    primary: material(definition.primary, 'decor-primary', family === 0 ? 0.7 : 0.12),
    secondary: material(definition.secondary, 'decor-secondary'),
    accent: material(definition.accent, 'decor-accent', 0.45),
    leaf: material(definition.leaf, 'decor-foliage', 0),
    metal: material('#adbdc6', 'decor-metal', 0.75),
    dark: material('#213338', 'decor-dark'),
    ivory: material('#f4f0d8', 'decor-ivory'),
  };
  m.leaf.side = THREE.DoubleSide;
  m.primary.side = THREE.DoubleSide;
  m.secondary.side = THREE.DoubleSide;
  m.ivory.side = THREE.DoubleSide;
  m.accent.side = THREE.DoubleSide;
  if (finish === 4) {
    m.accent.emissive.set(definition.accent);
    m.accent.emissiveIntensity = 0.55;
  }
  const group = new THREE.Group();
  group.name = 'garage-decor';
  if (family === 0) trophies(group, m, finish);
  else if (family === 1) crates(group, m, finish);
  else if (family === 2) flags(group, m, finish);
  else palms(group, m, finish);
  return group;
}
