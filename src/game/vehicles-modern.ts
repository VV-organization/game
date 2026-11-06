import * as THREE from 'three';
import {
  ellipsoid,
  hull,
  lamp,
  mesh,
  rod,
  rounded,
  standardLayout,
  suspension,
  tube,
  type VehicleLayout,
  type VehicleMaterials,
} from './vehicle-parts';

function triangle(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-width / 2, -height / 2, 0, width / 2, -height / 2, 0, 0, height / 2, 0],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material, x, y, z);
}

function longitudinalFin(
  parent: THREE.Object3D,
  material: THREE.Material,
  outline: Array<[number, number]>,
  thickness: number,
  x = 0,
) {
  const shape = new THREE.Shape();
  outline.forEach(([z, y], index) => {
    if (index === 0) shape.moveTo(-z, y);
    else shape.lineTo(-z, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-thickness / 2, 0, 0);
  return mesh(parent, geometry, material, x);
}

function tempest(parent: THREE.Group, m: VehicleMaterials): VehicleLayout {
  const layout: VehicleLayout = {
    ...standardLayout,
    axles: [-1.19, 1.24],
    track: 1.12,
    wheelRadius: 0.52,
    wheelWidth: 0.44,
    driverY: 1.08,
    driverZ: -0.46,
    hood: { x: 0.59, y: 1.043, z: 1.18, width: 0.42, length: 0.86 },
    side: { x: 1.035, y: 0.79, z: -0.33, length: 0.91, height: 0.28 },
    rear: { y: 0.82, z: -1.87 },
    exhaust: { x: 0.72, y: 0.48, z: -1.88 },
    bodyWidth: 2.14,
    noseZ: 2.08,
    tailZ: -1.88,
  };

  // A high, flat bonnet and blunt grille give this car a muscle-car mass.
  rounded(parent, m.dark, [1.89, 0.2, 3.74], [0, 0.4, 0.04], 0.06);
  rounded(parent, m.paint, [2.06, 0.41, 1.72], [0, 0.82, 1.19], 0.065);
  rounded(parent, m.paint, [2.08, 0.4, 0.96], [0, 0.83, -1.36], 0.07);
  for (const side of [-1, 1]) {
    rounded(parent, m.paint, [0.32, 0.43, 1.62], [side * 0.88, 0.74, -0.29], 0.055);
    rounded(parent, m.dark, [0.14, 0.08, 1.49], [side * 1.055, 0.43, -0.17], 0.035);
    // Real side pipes are separate from the rear attachment used for boost flames.
    tube(
      parent,
      m.metal,
      [
        [side * 0.91, 0.52, 0.65],
        [side * 1.08, 0.45, 0.45],
        [side * 1.09, 0.44, -0.48],
        [side * 1.15, 0.43, -0.66],
      ],
      0.075,
    );
    const pipeMouth = mesh(
      parent,
      new THREE.CylinderGeometry(0.058, 0.058, 0.035, 12),
      m.dark,
      side * 1.16,
      0.43,
      -0.68,
    );
    pipeMouth.rotation.x = Math.PI / 2;
    lamp(parent, m, side * 0.8, 0.82, 2.045, 0.145);
  }
  rounded(parent, m.dark, [1.28, 0.24, 0.055], [0, 0.8, 2.065], 0.015);
  for (let i = -3; i <= 3; i++) {
    rounded(parent, m.metal, [0.036, 0.19, 0.025], [i * 0.17, 0.8, 2.103], 0.007);
  }
  rounded(parent, m.metal, [1.8, 0.075, 0.11], [0, 0.55, 2.09], 0.025);

  // The exposed blower sits above the bonnet instead of being painted-on detail.
  rounded(parent, m.dark, [0.57, 0.13, 0.82], [0, 1.065, 1.13], 0.035);
  rounded(parent, m.metal, [0.47, 0.29, 0.67], [0, 1.25, 1.12], 0.045);
  rounded(parent, m.paint, [0.59, 0.16, 0.4], [0, 1.455, 1.29], 0.045);
  for (const x of [-0.17, 0, 0.17]) {
    const intake = mesh(parent, new THREE.CircleGeometry(0.058, 12), m.dark, x, 1.455, 1.497);
    intake.rotation.z = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    rounded(parent, m.metal, [0.035, 0.18, 0.6], [side * 0.24, 1.25, 1.12], 0.01);
  }
  const ducktail = rounded(parent, m.paint, [1.98, 0.13, 0.29], [0, 1.09, -1.7], 0.035);
  ducktail.rotation.x = 0.24;
  return layout;
}

function phantom(parent: THREE.Group, m: VehicleMaterials): VehicleLayout {
  const layout: VehicleLayout = {
    ...standardLayout,
    axles: [-1.18, 1.2],
    track: 1.11,
    wheelRadius: 0.43,
    wheelWidth: 0.39,
    driverY: 1.02,
    driverZ: -0.49,
    hood: { x: 0, y: 0.91, z: 0.94, width: 0.66, length: 0.58, pitch: -0.13 },
    side: { x: 1.03, y: 0.75, z: -0.51, length: 0.98, height: 0.22 },
    rear: { y: 0.77, z: -1.91 },
    exhaust: { x: 0.56, y: 0.49, z: -1.92 },
    bodyWidth: 2.48,
    noseZ: 2.25,
    tailZ: -1.92,
  };

  // Four-sided lofts create a continuous diamond-section wedge, not a box with a fin.
  hull(
    parent,
    m.paint,
    [
      { z: -1.91, width: 0.93, y: 0.72, height: 0.23 },
      { z: -0.91, width: 1.24, y: 0.76, height: 0.36 },
      { z: 0.32, width: 1.06, y: 0.7, height: 0.29 },
      { z: 1.83, width: 0.72, y: 0.57, height: 0.13 },
      { z: 2.25, width: 0.07, y: 0.49, height: 0.025 },
    ],
    4,
  );
  hull(
    parent,
    m.dark,
    [
      { z: -1.87, width: 0.95, y: 0.38, height: 0.06 },
      { z: -0.82, width: 1.17, y: 0.38, height: 0.06 },
      { z: 1.68, width: 0.72, y: 0.38, height: 0.04 },
      { z: 2.23, width: 0.08, y: 0.4, height: 0.015 },
    ],
    4,
  );
  for (const side of [-1, 1]) {
    const headlamp = triangle(parent, m.light, side * 0.49, 0.65, 1.925, 0.31, 0.14);
    headlamp.rotation.z = side * 0.22;
    const recess = triangle(parent, m.dark, side * 0.49, 0.65, 1.91, 0.43, 0.21);
    recess.rotation.z = side * 0.22;
    const vent = rounded(parent, m.dark, [0.035, 0.17, 0.67], [side * 1.02, 0.77, -0.5], 0.01);
    vent.rotation.y = side * 0.13;
    for (let i = 0; i < 3; i++) {
      rod(
        parent,
        m.metal,
        [side * 1.046, 0.7, -0.77 + i * 0.2],
        [side * 1.046, 0.83, -0.72 + i * 0.2],
        0.012,
      );
    }
  }
  const windscreen = rounded(parent, m.glass, [0.74, 0.25, 0.045], [0, 1.14, 0.23], 0.025);
  windscreen.rotation.x = -0.48;
  rounded(parent, m.dark, [1.67, 0.17, 0.17], [0, 0.46, -1.93], 0.015);
  for (const x of [-0.64, -0.32, 0, 0.32, 0.64]) {
    longitudinalFin(
      parent,
      m.dark,
      [
        [-1.98, 0.33],
        [-1.56, 0.36],
        [-1.73, 0.53],
      ],
      0.04,
      x,
    );
  }
  rounded(parent, m.light, [1.38, 0.035, 0.035], [0, 0.88, -1.92], 0.012);
  return layout;
}

function zenith(parent: THREE.Group, m: VehicleMaterials): VehicleLayout {
  const layout: VehicleLayout = {
    ...standardLayout,
    axles: [-1.13, 1.2],
    track: 1.075,
    wheelRadius: 0.44,
    wheelWidth: 0.36,
    driverY: 1.03,
    driverZ: -0.3,
    hood: { x: 0, y: 0.895, z: 1.19, width: 0.46, length: 0.7 },
    side: { x: 0.59, y: 0.74, z: -0.1, length: 0.78, height: 0.25 },
    rear: { y: 0.81, z: -1.9 },
    exhaust: { x: 0.41, y: 0.57, z: -1.92 },
    bodyWidth: 2.7,
    noseZ: 2.1,
    tailZ: -1.94,
  };
  const racingBlue = new THREE.MeshStandardMaterial({
    color: '#287bc1',
    roughness: 0.38,
    metalness: 0.12,
  });
  rounded(parent, m.dark, [1.22, 0.16, 3.56], [0, 0.34, 0.06], 0.06);
  hull(parent, m.paint, [
    { z: -1.86, width: 0.35, y: 0.77, height: 0.24 },
    { z: -0.58, width: 0.6, y: 0.75, height: 0.33 },
    { z: 0.55, width: 0.46, y: 0.69, height: 0.27 },
    { z: 1.57, width: 0.3, y: 0.65, height: 0.17 },
    { z: 2.1, width: 0.16, y: 0.53, height: 0.065 },
  ]);

  // Four separate wheel fairings leave air channels beside the narrow center tub.
  for (const side of [-1, 1]) {
    for (const z of [-1.13, 1.2]) {
      ellipsoid(parent, m.paint, [0.34, 0.34, 0.78], [side * 1.01, 0.79, z]);
      tube(
        parent,
        racingBlue,
        [
          [side * 1.01, 0.9, z - 0.67],
          [side * 1.01, 1.075, z - 0.38],
          [side * 1.01, 1.135, z],
          [side * 1.01, 1.075, z + 0.38],
          [side * 1.01, 0.9, z + 0.67],
        ],
        0.032,
      );
    }
    rounded(parent, racingBlue, [0.32, 0.14, 0.79], [side * 0.96, 0.48, 0.04], 0.06);
    rounded(parent, m.light, [0.21, 0.045, 0.12], [side * 1.01, 0.89, 1.88], 0.02);
    rod(parent, m.dark, [side * 0.57, 0.48, -1.1], [side * 0.98, 0.55, -1.1], 0.07);
    rod(parent, m.dark, [side * 0.47, 0.48, 1.18], [side * 0.98, 0.55, 1.18], 0.07);
  }
  rounded(parent, m.paint, [0.52, 0.04, 0.8], [0, 0.87, 1.19], 0.025);
  longitudinalFin(
    parent,
    m.paint,
    [
      [-1.9, 0.9],
      [-1.45, 1.94],
      [-0.69, 1.74],
      [-0.45, 1.11],
    ],
    0.095,
  );
  longitudinalFin(
    parent,
    racingBlue,
    [
      [-1.72, 1.2],
      [-1.43, 1.85],
      [-0.86, 1.69],
      [-0.69, 1.27],
    ],
    0.102,
  );
  const screen = rounded(parent, m.glass, [0.7, 0.2, 0.05], [0, 1.19, 0.3], 0.03);
  screen.rotation.x = -0.36;
  return layout;
}

function nova(parent: THREE.Group, m: VehicleMaterials): VehicleLayout {
  const layout: VehicleLayout = {
    ...standardLayout,
    axles: [-1.15, 1.22],
    track: 1.12,
    wheelRadius: 0.44,
    wheelWidth: 0.36,
    driverY: 1.025,
    driverZ: -0.42,
    hood: { x: 0.62, y: 0.797, z: 1.02, width: 0.3, length: 0.58 },
    side: { x: 0.64, y: 0.77, z: -0.49, length: 0.87, height: 0.24 },
    rear: { y: 0.74, z: -1.88 },
    exhaust: { x: 0.42, y: 0.49, z: -1.89 },
    bodyWidth: 1.9,
    noseZ: 2.23,
    tailZ: -1.89,
  };
  // The chassis ends behind the fork. There is deliberately no front cross-wing.
  rounded(parent, m.dark, [0.94, 0.16, 2.24], [0, 0.34, -0.61], 0.06);
  hull(
    parent,
    m.paint,
    [
      { z: -1.87, width: 0.48, y: 0.66, height: 0.2 },
      { z: -0.52, width: 0.61, y: 0.74, height: 0.34 },
      { z: 0.27, width: 0.45, y: 0.69, height: 0.25 },
      { z: 0.64, width: 0.2, y: 0.59, height: 0.115 },
    ],
    8,
  );
  for (const side of [-1, 1]) {
    const blade = new THREE.Group();
    blade.position.x = side * 0.62;
    parent.add(blade);
    hull(
      blade,
      m.paint,
      [
        { z: 0.35, width: 0.3, y: 0.64, height: 0.18 },
        { z: 1.02, width: 0.24, y: 0.65, height: 0.14 },
        { z: 1.8, width: 0.195, y: 0.56, height: 0.075 },
        { z: 2.23, width: 0.125, y: 0.48, height: 0.04 },
      ],
      8,
    );
    rounded(blade, m.dark, [0.26, 0.045, 0.52], [0, 0.46, 1.86], 0.015);
    rounded(blade, m.light, [0.13, 0.045, 0.07], [0, 0.535, 2.13], 0.015);
    longitudinalFin(
      parent,
      m.paint,
      [
        [-1.87, 0.6],
        [-1.66, 1.18],
        [-1.12, 0.97],
        [-1.12, 0.62],
      ],
      0.15,
      side * 0.55,
    );
    rounded(parent, m.metal, [0.04, 0.12, 0.55], [side * 0.64, 0.66, -0.25], 0.012);
  }
  suspension(parent, m, layout);
  const windscreen = rounded(parent, m.glass, [0.6, 0.2, 0.05], [0, 1.16, 0.15], 0.025);
  windscreen.rotation.x = -0.42;
  return layout;
}

function eclipse(parent: THREE.Group, m: VehicleMaterials): VehicleLayout {
  const layout: VehicleLayout = {
    ...standardLayout,
    axles: [-1.17, 1.19],
    track: 1.08,
    wheelRadius: 0.43,
    wheelWidth: 0.36,
    driverY: 1.025,
    driverZ: -0.27,
    hood: { x: 0, y: 0.987, z: 1.05, width: 0.56, length: 0.55 },
    side: { x: 0.8, y: 0.66, z: -0.08, length: 0.88, height: 0.23 },
    rear: { y: 0.7, z: -1.29 },
    exhaust: { x: 0.76, y: 0.62, z: -2.13 },
    bodyWidth: 2.74,
    noseZ: 2.13,
    tailZ: -2.23,
  };
  rounded(parent, m.dark, [1.14, 0.17, 2.75], [0, 0.32, -0.05], 0.07);
  ellipsoid(parent, m.paint, [0.8, 0.36, 1.24], [0, 0.66, -0.02]);
  rounded(parent, m.paint, [0.65, 0.04, 0.65], [0, 0.96, 1.05], 0.025);
  for (const side of [-1, 1]) {
    const guard = new THREE.Group();
    guard.position.x = side * 1.0;
    parent.add(guard);
    hull(guard, m.paint, [
      { z: 0.37, width: 0.19, y: 0.62, height: 0.18 },
      { z: 1.08, width: 0.37, y: 0.72, height: 0.34 },
      { z: 1.77, width: 0.23, y: 0.61, height: 0.23 },
      { z: 2.13, width: 0.07, y: 0.48, height: 0.065 },
    ]);
    const tail = new THREE.Group();
    tail.position.x = side * 0.76;
    parent.add(tail);
    hull(tail, m.paint, [
      { z: -2.23, width: 0.13, y: 0.85, height: 0.15 },
      { z: -1.57, width: 0.35, y: 0.77, height: 0.29 },
      { z: -0.65, width: 0.28, y: 0.62, height: 0.19 },
    ]);
    rounded(parent, m.dark, [0.32, 0.06, 0.68], [side * 0.76, 1.075, -1.72], 0.025);
    rounded(parent, m.light, [0.19, 0.055, 0.035], [side * 0.76, 0.87, -2.24], 0.015);
    rounded(parent, m.light, [0.14, 0.045, 0.09], [side * 1.0, 0.76, 1.94], 0.015);
    rod(parent, m.dark, [side * 0.63, 0.45, 1.13], [side * 1.08, 0.47, 1.13], 0.055);
  }
  tube(
    parent,
    m.paint,
    [
      [-1.0, 0.67, 1.55],
      [-0.48, 0.81, 1.85],
      [0, 0.88, 1.96],
      [0.48, 0.81, 1.85],
      [1.0, 0.67, 1.55],
    ],
    0.1,
  );

  // One tall, open arch surrounds the cockpit; it remains recognizable in a single color.
  const arch: [number, number, number][] = [
    [-0.96, 0.7, -0.48],
    [-1.035, 1.43, -0.61],
    [-0.79, 2.44, -0.74],
    [0, 2.86, -0.8],
    [0.79, 2.44, -0.74],
    [1.035, 1.43, -0.61],
    [0.96, 0.7, -0.48],
  ];
  tube(parent, m.dark, arch, 0.115);
  tube(
    parent,
    m.paint,
    arch.map(([x, y, z]) => [x, y, z + 0.09]),
    0.043,
  );
  return layout;
}

export function buildModernVehicle(
  variant: number,
  parent: THREE.Group,
  materials: VehicleMaterials,
): VehicleLayout {
  switch (variant) {
    case 6:
      return tempest(parent, materials);
    case 7:
      return phantom(parent, materials);
    case 8:
      return zenith(parent, materials);
    case 9:
      return nova(parent, materials);
    case 10:
      return eclipse(parent, materials);
    default:
      throw new RangeError(`Modern vehicle variant must be 6–10, received ${variant}`);
  }
}
