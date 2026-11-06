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

export function buildClassicVehicle(
  variant: number,
  parent: THREE.Group,
  m: VehicleMaterials,
): VehicleLayout {
  if (variant === 0) {
    const layout: VehicleLayout = {
      ...standardLayout,
      axles: [-0.92, 1.02],
      track: 0.96,
      wheelRadius: 0.4,
      wheelWidth: 0.33,
      driverY: 0.91,
      driverZ: -0.25,
      hood: { x: 0, y: 0.79, z: 1.15, width: 0.68, length: 0.48 },
      side: { x: 0.7, y: 0.49, z: -0.12, length: 0.85, height: 0.22 },
      rear: { y: 0.63, z: -1.39 },
      exhaust: { x: 0.33, y: 0.47, z: -1.42 },
      bodyWidth: 1.4,
      noseZ: 1.58,
      tailZ: -1.42,
    };
    rounded(parent, m.dark, [1.25, 0.13, 2.3], [0, 0.34, -0.05], 0.06);
    tube(
      parent,
      m.metal,
      [
        [-0.74, 0.43, -1.25],
        [-0.82, 0.43, 0.8],
        [-0.65, 0.43, 1.5],
        [0.65, 0.43, 1.5],
        [0.82, 0.43, 0.8],
        [0.74, 0.43, -1.25],
      ],
      0.065,
    );
    hull(parent, m.paint, [
      { z: 0.73, width: 0.38, y: 0.62, height: 0.19 },
      { z: 1.15, width: 0.6, y: 0.62, height: 0.16 },
      { z: 1.46, width: 0.53, y: 0.53, height: 0.1 },
    ]);
    rounded(parent, m.dark, [0.8, 0.3, 0.5], [0, 0.59, -1.08]);
    for (let i = 0; i < 5; i++)
      rounded(parent, m.metal, [0.8, 0.035, 0.035], [0, 0.76, -0.88 - i * 0.085], 0.01);
    suspension(parent, m, layout);
    return layout;
  }
  if (variant === 1) {
    const layout: VehicleLayout = {
      ...standardLayout,
      axles: [-1.02, 1.15],
      track: 1.11,
      driverY: 0.97,
      hood: { x: 0, y: 0.94, z: 1.22, width: 1.06, length: 0.64 },
      side: { x: 0.96, y: 0.72, z: -0.28, length: 1.1, height: 0.28 },
      bodyWidth: 1.95,
      noseZ: 2.0,
    };
    rounded(parent, m.dark, [1.8, 0.16, 2.7], [0, 0.35, -0.08]);
    hull(parent, m.paint, [
      { z: 0.5, width: 0.48, y: 0.68, height: 0.22 },
      { z: 1.1, width: 0.82, y: 0.72, height: 0.22 },
      { z: 1.74, width: 1.03, y: 0.57, height: 0.16 },
      { z: 1.9, width: 0.85, y: 0.5, height: 0.1 },
    ]);
    for (const side of [-1, 1]) {
      const pod = hull(parent, m.paint, [
        { z: -1.08, width: 0.24, y: 0.64, height: 0.27 },
        { z: -0.65, width: 0.27, y: 0.69, height: 0.29 },
        { z: 0.6, width: 0.21, y: 0.62, height: 0.2 },
      ]);
      pod.position.x = side * 0.76;
      rounded(parent, m.dark, [0.3, 0.22, 0.5], [side * 0.78, 0.72, 0.33], 0.07);
      rod(parent, m.metal, [side * 0.65, 0.45, -1.27], [side * 0.65, 0.85, -1.28], 0.055);
    }
    tube(
      parent,
      m.metal,
      [
        [-1.2, 0.43, 1.68],
        [-1.1, 0.43, 1.96],
        [0, 0.43, 2.06],
        [1.1, 0.43, 1.96],
        [1.2, 0.43, 1.68],
      ],
      0.065,
    );
    tube(
      parent,
      m.metal,
      [
        [-1.12, 0.46, -1.38],
        [-0.85, 0.46, -1.67],
        [0.85, 0.46, -1.67],
        [1.12, 0.46, -1.38],
      ],
      0.065,
    );
    rounded(parent, m.paint, [1.5, 0.18, 0.43], [0, 0.88, -1.26]);
    for (const side of [-1, 1])
      rounded(parent, m.accent, [0.13, 0.025, 0.64], [side * 0.49, 0.95, 1.16], 0.01);
    suspension(parent, m, layout);
    return layout;
  }
  if (variant === 2) {
    const layout: VehicleLayout = {
      ...standardLayout,
      axles: [-1.28, 1.24],
      track: 1.13,
      wheelRadius: 0.44,
      driverY: 0.9,
      driverZ: -0.43,
      hood: { x: 0, y: 0.94, z: 1.22, width: 0.38, length: 0.7 },
      side: { x: 0.91, y: 0.65, z: -0.55, length: 0.9, height: 0.22 },
      rear: { y: 0.71, z: -1.91 },
      exhaust: { x: 0.3, y: 0.53, z: -1.86 },
      bodyWidth: 1.82,
      noseZ: 2.23,
      tailZ: -1.92,
    };
    hull(parent, m.paint, [
      { z: -1.7, width: 0.32, y: 0.65, height: 0.22 },
      { z: -0.9, width: 0.49, y: 0.65, height: 0.3 },
      { z: 0.48, width: 0.43, y: 0.7, height: 0.31 },
      { z: 1.5, width: 0.22, y: 0.75, height: 0.13 },
      { z: 2.12, width: 0.13, y: 0.58, height: 0.1 },
    ]);
    for (const side of [-1, 1]) {
      const pod = hull(parent, m.paint, [
        { z: -1.6, width: 0.16, y: 0.59, height: 0.19 },
        { z: -0.85, width: 0.3, y: 0.62, height: 0.27 },
        { z: 0.28, width: 0.28, y: 0.62, height: 0.25 },
        { z: 0.5, width: 0.16, y: 0.62, height: 0.17 },
      ]);
      pod.position.x = side * 0.7;
      rounded(parent, m.dark, [0.37, 0.25, 0.07], [side * 0.74, 0.66, 0.47], 0.03);
      rounded(parent, m.dark, [0.1, 0.37, 0.54], [side * 1.28, 0.4, 1.92], 0.035);
      rod(parent, m.dark, [side * 0.55, 0.64, -1.52], [side * 0.55, 1.43, -1.64], 0.06);
      rounded(parent, m.paint, [0.1, 0.42, 0.64], [side * 1.04, 1.43, -1.69], 0.035);
    }
    const wing = rounded(parent, m.paint, [2.56, 0.11, 0.53], [0, 0.36, 1.94], 0.045);
    wing.rotation.x = -0.07;
    rounded(parent, m.accent, [2.4, 0.045, 0.12], [0, 0.45, 1.77], 0.02);
    rounded(parent, m.paint, [2.1, 0.14, 0.64], [0, 1.48, -1.66], 0.055);
    rounded(parent, m.dark, [1.86, 0.06, 0.4], [0, 1.4, -1.65], 0.03);
    const intake = ellipsoid(parent, m.paint, [0.28, 0.45, 0.37], [0, 1.4, -1.01]);
    intake.rotation.x = -0.2;
    rounded(parent, m.dark, [0.28, 0.2, 0.07], [0, 1.56, -0.68], 0.05);
    suspension(parent, m, layout);
    return layout;
  }
  if (variant === 3) {
    const layout: VehicleLayout = {
      ...standardLayout,
      axles: [-1.2, 1.3],
      track: 1.11,
      wheelRadius: 0.61,
      wheelWidth: 0.5,
      driverY: 1.16,
      driverZ: -0.32,
      hood: { x: 0, y: 1.16, z: 1.15, width: 0.92, length: 0.63 },
      side: { x: 0.88, y: 0.97, z: -0.35, length: 0.95, height: 0.33 },
      rear: { y: 0.99, z: -1.76 },
      exhaust: { x: 0.47, y: 0.83, z: -1.76 },
      bodyWidth: 1.8,
      noseZ: 1.97,
      tailZ: -1.8,
    };
    rounded(parent, m.dark, [1.5, 0.24, 2.75], [0, 0.69, -0.05]);
    hull(
      parent,
      m.paint,
      [
        { z: 0.32, width: 0.7, y: 0.96, height: 0.29 },
        { z: 1.32, width: 0.84, y: 0.94, height: 0.23 },
        { z: 1.82, width: 0.63, y: 0.85, height: 0.18 },
      ],
      8,
    );
    rounded(parent, m.dark, [1.15, 0.32, 0.09], [0, 0.87, 1.89], 0.05);
    for (const side of [-1, 1]) {
      rounded(parent, m.paint, [0.18, 0.5, 1.45], [side * 0.81, 0.97, -0.4], 0.07);
      tube(
        parent,
        m.dark,
        [
          [side * 0.84, 0.85, 0.65],
          [side * 0.78, 2.5, 0.44],
          [side * 0.62, 2.82, -0.15],
          [side * 0.62, 2.78, -0.97],
          [side * 0.82, 0.85, -1.4],
        ],
        0.085,
      );
      rod(parent, m.dark, [side * 0.82, 0.92, -1.35], [side * 0.77, 2.44, 0.43], 0.06);
      rod(parent, m.metal, [side * 0.64, 0.8, 1.1], [side * 1.05, 0.73, 1.3], 0.07);
      lamp(parent, m, side * 0.64, 1.2, 1.7, 0.22);
      rounded(parent, m.paint, [0.62, 0.13, 0.7], [side * 1.03, 1.28, -1.18], 0.06);
    }
    rod(parent, m.dark, [-0.78, 2.5, 0.44], [0.78, 2.5, 0.44], 0.085);
    rod(parent, m.dark, [-0.62, 2.78, -0.97], [0.62, 2.78, -0.97], 0.085);
    rounded(parent, m.paint, [1.45, 0.13, 1.03], [0, 2.84, -0.55], 0.07);
    for (const x of [-0.46, 0, 0.46]) lamp(parent, m, x, 2.68, 0.49, 0.13);
    tube(
      parent,
      m.metal,
      [
        [-0.9, 0.71, 1.85],
        [-0.7, 0.63, 2.02],
        [0.7, 0.63, 2.02],
        [0.9, 0.71, 1.85],
      ],
      0.09,
    );
    suspension(parent, m, layout);
    return layout;
  }
  if (variant === 4) {
    const layout: VehicleLayout = {
      ...standardLayout,
      axles: [-1.26, 1.28],
      track: 1.03,
      wheelRadius: 0.5,
      wheelWidth: 0.3,
      driverY: 1.01,
      driverZ: -0.35,
      hood: { x: 0, y: 1.22, z: 1.04, width: 0.55, length: 0.8 },
      side: { x: 0.62, y: 0.83, z: -0.15, length: 1.1, height: 0.3 },
      rear: { y: 0.83, z: -1.84 },
      exhaust: { x: 0.34, y: 0.56, z: -1.81 },
      bodyWidth: 1.3,
      noseZ: 2.17,
      tailZ: -1.85,
    };
    hull(
      parent,
      m.paint,
      [
        { z: -1.85, width: 0.16, y: 0.68, height: 0.18 },
        { z: -1.4, width: 0.5, y: 0.76, height: 0.39 },
        { z: -0.55, width: 0.64, y: 0.8, height: 0.44 },
        { z: 0.65, width: 0.63, y: 0.81, height: 0.44 },
        { z: 1.56, width: 0.43, y: 0.81, height: 0.35 },
        { z: 2.06, width: 0.28, y: 0.77, height: 0.26 },
      ],
      16,
    );
    const grille = mesh(parent, new THREE.CircleGeometry(0.26, 20), m.dark, 0, 0.77, 2.075);
    grille.scale.x = 0.92;
    const ring = mesh(parent, new THREE.TorusGeometry(0.268, 0.045, 6, 20), m.metal, 0, 0.77, 2.07);
    ring.scale.x = 0.95;
    for (const x of [-0.15, -0.075, 0, 0.075, 0.15])
      rod(parent, m.metal, [x, 0.58, 2.09], [x, 0.96, 2.09], 0.012);
    tube(
      parent,
      m.metal,
      [
        [-0.51, 1.11, 0.25],
        [-0.57, 1.1, -0.6],
        [0, 1.13, -0.9],
        [0.57, 1.1, -0.6],
        [0.51, 1.11, 0.25],
      ],
      0.045,
    );
    const screen = mesh(
      parent,
      new THREE.SphereGeometry(0.53, 16, 8, 0, Math.PI, 0, Math.PI / 2),
      m.glass,
      0,
      1.1,
      0.27,
    );
    screen.scale.set(1, 0.48, 0.44);
    for (const side of [-1, 1]) {
      rod(parent, m.metal, [side * 0.59, 0.8, -0.55], [side * 0.75, 0.74, 1.19], 0.055);
      for (let i = 0; i < 6; i++) {
        const vent = rounded(
          parent,
          m.dark,
          [0.018, 0.16, 0.05],
          [side * 0.57, 0.9, 0.53 + i * 0.12],
          0.009,
        );
        vent.rotation.z = side * 0.25;
      }
    }
    suspension(parent, m, layout);
    return layout;
  }
  // Stellar: voluptuous wheel arches and a wide rear deck surround the open roadster cockpit.
  const layout: VehicleLayout = {
    ...standardLayout,
    axles: [-1.12, 1.22],
    track: 1.02,
    wheelRadius: 0.43,
    wheelWidth: 0.37,
    driverY: 1.08,
    driverZ: -0.28,
    hood: { x: 0, y: 1.14, z: 1.25, width: 0.84, length: 0.68 },
    side: { x: 1.12, y: 0.85, z: -0.05, length: 0.82, height: 0.32 },
    rear: { y: 0.87, z: -1.88 },
    exhaust: { x: 0.65, y: 0.51, z: -1.88 },
    bodyWidth: 2.25,
    noseZ: 2.05,
    tailZ: -1.92,
  };
  rounded(parent, m.dark, [2.15, 0.16, 3.42], [0, 0.4, -0.02], 0.07);
  hull(parent, m.paint, [
    { z: 0.46, width: 0.77, y: 0.85, height: 0.3 },
    { z: 1.2, width: 0.88, y: 0.86, height: 0.3 },
    { z: 1.9, width: 0.78, y: 0.71, height: 0.23 },
    { z: 2.05, width: 0.57, y: 0.65, height: 0.14 },
  ]);
  hull(
    parent,
    m.paint,
    [
      { z: -1.92, width: 0.79, y: 0.68, height: 0.22 },
      { z: -1.5, width: 1.06, y: 0.77, height: 0.32 },
      { z: -0.8, width: 0.95, y: 0.8, height: 0.3 },
    ],
    16,
  );
  for (const side of [-1, 1]) {
    for (const z of layout.axles)
      ellipsoid(parent, m.paint, [0.38, 0.42, 0.74], [side * 0.99, 0.82, z]);
    rounded(parent, m.paint, [0.3, 0.47, 1.45], [side * 0.98, 0.77, -0.08], 0.14);
    lamp(parent, m, side * 0.77, 1.0, 1.82, 0.19);
    rounded(parent, m.light, [0.32, 0.075, 0.04], [side * 0.76, 0.75, -1.92], 0.025);
    rounded(parent, m.metal, [0.07, 0.075, 1.15], [side * 1.16, 0.52, -0.04], 0.025);
  }
  rounded(parent, m.dark, [1.18, 0.2, 0.06], [0, 0.58, 2.08], 0.06);
  const windscreen = rounded(parent, m.glass, [1.38, 0.32, 0.07], [0, 1.29, 0.51], 0.035);
  windscreen.rotation.x = 0.23;
  tube(
    parent,
    m.metal,
    [
      [-0.69, 1.16, 0.49],
      [-0.66, 1.45, 0.54],
      [0.66, 1.45, 0.54],
      [0.69, 1.16, 0.49],
    ],
    0.027,
  );
  return layout;
}
