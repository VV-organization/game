import * as THREE from 'three';
import { bodyDesigns } from '../shared/body-designs';
import {
  ellipsoid,
  hull,
  mesh,
  rod,
  rounded,
  tube,
  type VehicleLayout,
  type VehicleMaterials,
} from './vehicle-parts';

type Point = [number, number, number];
type PlanPoint = [number, number];
type BodyKitOptions = {
  variant: number;
  carVariant: number;
  layout: VehicleLayout;
  shell: THREE.Mesh[];
  materials: VehicleMaterials;
};

function solidPlate(
  parent: THREE.Group,
  material: THREE.Material,
  outline: PlanPoint[],
  y: number,
  thickness = 0.1,
) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return mesh(parent, geometry, material, 0, y - thickness / 2, 0);
}

function sidePlate(
  parent: THREE.Group,
  material: THREE.Material,
  outline: PlanPoint[],
  x: number,
  thickness = 0.1,
) {
  const shape = new THREE.Shape();
  outline.forEach(([z, y], i) => (i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geometry.rotateY(Math.PI / 2);
  return mesh(parent, geometry, material, x - thickness / 2, 0, 0);
}

function clipHalf(outline: PlanPoint[], side: number, gap: number) {
  const output: PlanPoint[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const insideA = a[0] * side >= gap,
      insideB = b[0] * side >= gap;
    if (insideA) output.push(a);
    if (insideA !== insideB) {
      const t = (side * gap - a[0]) / (b[0] - a[0]);
      output.push([side * gap, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return output;
}

export function buildBodyKit({ variant, carVariant, layout: l, shell, materials }: BodyKitOptions) {
  const group = new THREE.Group();
  group.name = 'body-kit';
  const design = bodyDesigns[variant - 1];
  if (!design) return group;
  const paint = new THREE.MeshStandardMaterial({
    color: design.color,
    roughness: 0.36,
    metalness: 0.23,
  });
  paint.name = 'body-kit-paint';
  const accent = new THREE.MeshStandardMaterial({
    color: '#263440',
    roughness: 0.52,
    metalness: 0.32,
  });
  accent.name = 'body-kit-accent';
  const metal = materials.metal;
  const split = carVariant === 9;
  const tireZ = l.wheelRadius + l.wheelWidth * 0.18;
  const front = Math.max(l.noseZ - 0.08, l.axles[1] + tireZ + 0.12);
  const rear = Math.min(l.tailZ - 0.07, l.axles[0] - tireZ - 0.12);
  const frontY = Math.max(0.31, l.wheelRadius * 0.58);
  const rearY = Math.max(0.42, l.rear.y - 0.16);
  const width = Math.min(2.98, Math.max(2.5, l.track * 2 + 0.55));
  const half = width / 2;
  const sideRear = l.axles[0] + l.wheelRadius + 0.2;
  const sideFront = l.axles[1] - l.wheelRadius - 0.2;
  const sideLength = sideFront - sideRear;
  const sideZ = (sideRear + sideFront) / 2;
  const sideX = Math.min(1.24, Math.max(0.9, l.side.x + 0.16));
  const sideY = Math.max(0.52, l.side.y);
  const wingZ = l.tailZ - 0.25;
  const wingY = Math.min(l.driverY + 1.12, Math.max(l.rear.y + 0.9, l.wheelRadius * 2 + 0.32));
  const triangle = new THREE.Triangle(),
    candidate = new THREE.Vector3();
  const closest = (position: Point): Point => {
    const query = new THREE.Vector3(...position),
      contact = query.clone();
    let distance = Infinity;
    for (const surface of shell) {
      let visible = true;
      for (let node: THREE.Object3D | null = surface; node; node = node.parent)
        visible &&= node.visible;
      if (!visible) continue;
      const p = surface.geometry.attributes.position,
        indices = surface.geometry.index;
      for (let i = 0, count = indices?.count || p.count; i < count; i += 3) {
        for (const [offset, vertex] of [triangle.a, triangle.b, triangle.c].entries())
          vertex
            .fromBufferAttribute(p, indices ? indices.getX(i + offset) : i + offset)
            .applyMatrix4(surface.matrixWorld);
        triangle.closestPointToPoint(query, candidate);
        const d = query.distanceToSquared(candidate);
        if (d < distance) {
          distance = d;
          contact.copy(candidate);
        }
      }
    }
    return contact.toArray();
  };
  const support = (target: Point, bodyPoint: Point, radius = 0.055) => {
    const root = new THREE.Vector3(...closest(bodyPoint)),
      tip = new THREE.Vector3(...target);
    root.addScaledVector(root.clone().sub(tip).normalize(), 0.025);
    rod(group, metal, root.toArray(), target, radius);
  };
  const frontSupport = (y = frontY, z = front + 0.18) => {
    for (const side of [-1, 1])
      support([side * 0.56, y, z], [side * (split ? 0.62 : 0.46), l.hood.y - 0.22, l.noseZ - 0.22]);
  };
  const rearSupport = (y: number, z = wingZ, x = 0.64) => {
    for (const side of [-1, 1])
      support([side * x, y, z], [side * Math.min(x, 0.62), l.rear.y, l.tailZ + 0.15]);
  };
  const sideSupport = (side: number, y = sideY, x = sideX) => {
    for (const z of [sideRear + 0.12, sideFront - 0.12])
      support([side * x, y, z], [side * l.side.x, l.side.y, z], 0.045);
  };
  const frontPlate = (outline: PlanPoint[], y = frontY, thickness = 0.1) => {
    const points = outline.map(([x, z]) => [x, front + z] as PlanPoint);
    if (split)
      for (const side of [-1, 1]) {
        const halfPoints = clipHalf(points, side, 0.35);
        if (halfPoints.length >= 3) solidPlate(group, paint, halfPoints, y, thickness);
      }
    else solidPlate(group, paint, points, y, thickness);
  };
  const frontRail = (points: Point[], radius = 0.075) => {
    const absolute = points.map(([x, y, z]) => [x, y, front + z] as Point);
    if (!split) {
      tube(group, paint, absolute, radius);
      return;
    }
    // Independent clipped rail segments keep Nova's central opening physically empty.
    for (let i = 0; i < absolute.length - 1; i++)
      for (const side of [-1, 1]) {
        let a = absolute[i],
          b = absolute[i + 1];
        const insideA = a[0] * side >= 0.44,
          insideB = b[0] * side >= 0.44;
        if (!insideA && !insideB) continue;
        if (insideA !== insideB) {
          const t = (side * 0.44 - a[0]) / (b[0] - a[0]);
          const cut: Point = [side * 0.44, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
          if (insideA) b = cut;
          else a = cut;
        }
        rod(group, paint, a, b, radius);
      }
  };
  const splitter = (y = frontY, depth = 0.5) => {
    frontPlate(
      [
        [-half, 0],
        [-half, depth * 0.68],
        [-half * 0.77, depth],
        [half * 0.77, depth],
        [half, depth * 0.68],
        [half, 0],
      ],
      y,
    );
    frontSupport(y);
  };
  const wing = (y = wingY, w = width, depth = 0.49, z = wingZ) => {
    const part = rounded(group, paint, [w, 0.13, depth], [0, y, z], 0.055);
    rearSupport(y - 0.04, z);
    return part;
  };
  const rearDeck = (depth = 0.48, y = rearY, w = width) => {
    solidPlate(
      group,
      paint,
      [
        [-w / 2, rear + 0.04],
        [-w / 2, rear - depth],
        [w / 2, rear - depth],
        [w / 2, rear + 0.04],
      ],
      y,
      0.1,
    );
    rearSupport(y, rear - 0.12);
  };
  const sideWedges = (height = 0.34) => {
    for (const side of [-1, 1]) {
      const pod = hull(
        group,
        paint,
        [
          { z: sideRear, width: 0.22, y: sideY, height: height / 2 },
          { z: sideZ, width: 0.28, y: sideY, height: height / 2 },
          { z: sideFront, width: 0.13, y: sideY - 0.08, height: height * 0.3 },
        ],
        4,
      );
      pod.position.x = side * sideX;
      sideSupport(side);
    }
  };
  const frontChannels = (channels: number, roundedCorners = false) => {
    const h = 0.48,
      y = frontY + 0.2,
      post = 0.12,
      usable = width - post;
    frontPlate(
      [
        [-half, 0],
        [-half, 0.4],
        [half, 0.4],
        [half, 0],
      ],
      frontY - 0.06,
      0.09,
    );
    if (split) {
      for (const side of [-1, 1]) {
        rounded(
          group,
          paint,
          [half - 0.35, 0.13, 0.32],
          [(side * (half + 0.35)) / 2, y + h / 2, front + 0.2],
          0.05,
        );
        for (const x of [side * 0.42, side * (half - 0.06)])
          rounded(group, paint, [0.12, h, 0.32], [x, y, front + 0.2], 0.05);
      }
    } else {
      rounded(
        group,
        paint,
        [width, 0.13, 0.32],
        [0, y + h / 2, front + 0.2],
        roundedCorners ? 0.065 : 0.02,
      );
      for (let i = 0; i <= channels; i++)
        rounded(
          group,
          paint,
          [post, h, 0.32],
          [-usable / 2 + (i * usable) / channels, y, front + 0.2],
          roundedCorners ? 0.06 : 0.015,
        );
    }
    frontSupport(frontY - 0.06, front + 0.2);
  };
  const roundBumper = (forward: boolean) => {
    const divided = forward && split;
    for (const side of divided ? [-1, 1] : [0]) {
      const center = divided ? (side * (half + 0.36)) / 2 : 0;
      const radiusX = divided ? (half - 0.36) / 2 : half;
      const shape = new THREE.Shape();
      shape.absellipse(0, 0, radiusX, 0.35, 0, Math.PI * 2, false, 0);
      for (const x of divided ? [0] : [-width * 0.29, 0, width * 0.29]) {
        const window = new THREE.Path();
        window.absellipse(
          x,
          0,
          divided ? radiusX * 0.57 : width * 0.105,
          0.18,
          0,
          Math.PI * 2,
          true,
          0,
        );
        shape.holes.push(window);
      }
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.16,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.045,
        bevelThickness: 0.04,
        curveSegments: 12,
      });
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        positions.setZ(
          i,
          (forward ? 1 : -1) * (positions.getZ(i) + 0.16 * (1 - (x / radiusX) ** 2)),
        );
      }
      geometry.computeVertexNormals();
      mesh(
        group,
        geometry,
        paint,
        center,
        forward ? frontY + 0.23 : rearY + 0.22,
        forward ? front + 0.06 : rear - 0.08,
      );
    }
    if (forward) frontSupport(frontY - 0.07, front + 0.22);
    else rearSupport(rearY - 0.08, rear - 0.21);
  };
  const diffusers = (channels: number, height = 0.43, depth = 0.48) => {
    rearDeck(depth, rearY + 0.17);
    for (let i = 0; i <= channels; i++)
      sidePlate(
        group,
        accent,
        [
          [rear + 0.02, rearY + 0.2],
          [rear - depth, rearY + 0.2],
          [rear - depth, rearY - height * 0.6],
          [rear + 0.02, rearY - 0.12],
        ],
        -half + (i * width) / channels,
        0.085,
      );
  };
  const wheelShellTop = (side: number, z: number) => {
    let height = 0;
    for (const surface of shell) {
      const bounds = new THREE.Box3().setFromObject(surface);
      const centerX = (bounds.min.x + bounds.max.x) / 2;
      // Low, separate side shells include curved fenders but exclude cages, halos and the cockpit.
      if (centerX * side < 0.45 || bounds.max.y > l.driverY + 0.55) continue;
      if (bounds.max.z < z - tireZ - 0.1 || bounds.min.z > z + tireZ + 0.1) continue;
      height = Math.max(height, bounds.max.y);
    }
    return height;
  };
  const squareArches = (chunky = false) => {
    for (const z of l.axles)
      for (const side of [-1, 1]) {
        const radius = l.wheelRadius * (carVariant === 6 && z === l.axles[0] ? 1.08 : 1);
        const sweptX = Math.sin(0.35) * radius + (Math.cos(0.35) * l.wheelWidth) / 2;
        const x = side * Math.min(1.59, l.track + sweptX + 0.055),
          top = Math.max(radius * 2 + (chunky ? 0.29 : 0.22), wheelShellTop(side, z) + 0.15);
        const extent = tireZ + 0.18;
        // A U-shaped extrusion leaves the entire steering envelope open below the roof.
        sidePlate(
          group,
          paint,
          [
            [z - extent, 0.37],
            [z - extent, top],
            [z + extent, top],
            [z + extent, 0.37],
            [z + tireZ + 0.065, 0.37],
            [z + tireZ + 0.065, top - 0.16],
            [z - tireZ - 0.065, top - 0.16],
            [z - tireZ - 0.065, 0.37],
          ],
          x,
          chunky ? 0.11 : 0.075,
        );
        const roof = rounded(
          group,
          paint,
          [Math.abs(x) - 0.55, 0.14, extent * 2],
          [(side * (Math.abs(x) + 0.55)) / 2, top - 0.01, z],
          0.035,
        );
        const safeX = side * 0.52;
        support([safeX, top - 0.01, z], [safeX, l.side.y, z], 0.06);
        rod(group, metal, [safeX, top - 0.01, z], [x, top - 0.01, z], 0.05);
        if (chunky) {
          rod(
            group,
            metal,
            [side * l.track, 0.67, z - radius - 0.19],
            [side * l.track, top - 0.01, z - radius - 0.19],
            0.045,
          );
          rounded(
            group,
            accent,
            [l.wheelWidth + 0.18, 0.52, 0.08],
            [side * l.track, 0.43, z - radius - 0.19],
            0.02,
          );
        }
        roof.name = 'arch-roof';
      }
  };

  switch (variant) {
    case 1: {
      // Trapezoidal nose, sharp sill masses and a low ducktail.
      splitter();
      sideWedges(0.35);
      const duckZ = Math.min(l.tailZ + 0.04, l.axles[0] - l.wheelRadius - 0.12);
      sidePlate(
        group,
        paint,
        [
          [duckZ, l.rear.y + 0.05],
          [duckZ - 0.06, l.rear.y - 0.08],
          [duckZ - 0.42, l.rear.y + 0.07],
          [duckZ - 0.45, l.rear.y + 0.25],
          [duckZ - 0.32, l.rear.y + 0.23],
        ],
        0,
        Math.min(2.6, Math.max(1.85, l.bodyWidth + 0.3)),
      );
      rearSupport(l.rear.y + 0.02, duckZ - 0.05, 0.5);
      break;
    }
    case 2: {
      // A visibly open perimeter, no solid aerodynamic planes.
      for (const y of [frontY, frontY + 0.32])
        frontRail(
          [
            [-half, y, 0],
            [-half, y, 0.3],
            [-0.85, y, 0.48],
            [0.85, y, 0.48],
            [half, y, 0.3],
            [half, y, 0],
          ],
          0.075,
        );
      for (const side of [-1, 1])
        rod(
          group,
          paint,
          [side * 0.56, frontY, front + 0.48],
          [side * 0.56, frontY + 0.32, front + 0.48],
          0.06,
        );
      frontSupport(frontY + 0.16, front + 0.48);
      for (const side of [-1, 1]) {
        for (const y of [sideY - 0.19, sideY + 0.19])
          tube(
            group,
            paint,
            [
              [side * l.side.x, y, sideRear],
              [side * (sideX + 0.12), y, sideRear + 0.17],
              [side * (sideX + 0.12), y, sideFront - 0.17],
              [side * l.side.x, y, sideFront],
            ],
            0.075,
          );
        for (const z of [sideRear + 0.17, sideFront - 0.17]) {
          rod(
            group,
            paint,
            [side * (sideX + 0.12), sideY - 0.19, z],
            [side * (sideX + 0.12), sideY + 0.19, z],
            0.06,
          );
          support([side * (sideX + 0.12), sideY, z], [side * l.side.x, l.side.y, z]);
        }
      }
      tube(
        group,
        paint,
        [
          [-half, rearY + 0.15, rear + 0.04],
          [-half, rearY + 0.15, rear - 0.28],
          [half, rearY + 0.15, rear - 0.28],
          [half, rearY + 0.15, rear + 0.04],
        ],
        0.09,
      );
      rearSupport(rearY + 0.15, rear - 0.28);
      break;
    }
    case 3: {
      // Four floating-looking visors now have explicit inward roof brackets.
      for (const z of l.axles)
        for (const side of [-1, 1]) {
          const y = Math.max(l.wheelRadius * 2 + 0.18, wheelShellTop(side, z) + 0.1),
            x = side * l.track;
          const visor = hull(
            group,
            paint,
            [
              { z: z - tireZ - 0.09, width: 0.31, y: y - 0.02, height: 0.08 },
              { z, width: 0.43, y: y + 0.09, height: 0.12 },
              { z: z + tireZ + 0.09, width: 0.32, y: y - 0.02, height: 0.08 },
            ],
            4,
          );
          visor.position.x = x;
          rod(group, metal, [side * 0.52, y, z], [x, y, z], 0.055);
          support([side * 0.52, y, z], [side * 0.52, l.side.y, z]);
        }
      for (const side of [-1, 1])
        frontPlate([
          [side * 0.42, 0.03],
          [side * half, 0.06],
          [side * (half - 0.2), 0.52],
          [side * 0.58, 0.36],
        ]);
      frontSupport();
      for (let i = 0; i < 3; i++) {
        const w = width - i * 0.36;
        rearDeck(0.48 - i * 0.1, rearY + i * 0.16, w);
      }
      break;
    }
    case 4: {
      splitter(frontY, 0.54);
      splitter(frontY + 0.3, 0.41);
      for (const side of [-1, 1])
        rounded(
          group,
          paint,
          [0.12, 0.58, 0.6],
          [side * (half - 0.05), frontY + 0.2, front + 0.23],
          0.025,
        );
      wing(wingY - 0.4, width, 0.48);
      wing(wingY, width, 0.5);
      for (const side of [-1, 1])
        rounded(
          group,
          paint,
          [0.12, 0.63, 0.6],
          [side * (half - 0.06), wingY - 0.21, wingZ],
          0.025,
        );
      break;
    }
    case 5: {
      for (const side of [-1, 1]) {
        const x = side * (sideX + 0.02),
          y = sideY + 0.02,
          w = 0.52,
          h = 0.55;
        rounded(group, paint, [w, 0.1, sideLength], [x, y + h / 2, sideZ], 0.04);
        rounded(group, paint, [w, 0.1, sideLength], [x, y - h / 2, sideZ], 0.04);
        for (const edge of [-1, 1])
          rounded(group, paint, [0.09, h, sideLength], [x + edge * (w / 2 - 0.04), y, sideZ], 0.03);
        for (const end of [sideFront, sideRear]) {
          rounded(group, accent, [w + 0.08, 0.08, 0.09], [x, y + h / 2, end], 0.02);
          rounded(group, accent, [w + 0.08, 0.08, 0.09], [x, y - h / 2, end], 0.02);
        }
        sideSupport(side, y, sideX - 0.2);
      }
      for (const side of [-1, 1])
        frontPlate(
          [
            [side * 0.45, 0.04],
            [side * half, 0.04],
            [side * half, 0.38],
            [side * 0.68, 0.25],
          ],
          frontY,
        );
      frontSupport();
      rearDeck(0.31, rearY, width * 0.82);
      break;
    }
    case 6: {
      squareArches();
      for (const side of [-1, 1])
        frontPlate(
          [
            [side * 0.38, 0.03],
            [side * half, 0.2],
            [side * (half - 0.1), 0.55],
            [side * 0.6, 0.36],
          ],
          frontY + 0.06,
        );
      frontSupport(frontY + 0.06);
      wing(l.rear.y + 0.5, width * 0.72, 0.42);
      for (const side of [-1, 1]) {
        const tip = rounded(
          group,
          paint,
          [0.62, 0.14, 0.47],
          [side * (half - 0.22), l.rear.y + 0.59, wingZ],
          0.05,
        );
        tip.rotation.z = side * 0.27;
      }
      break;
    }
    case 7: {
      roundBumper(true);
      for (const side of [-1, 1]) {
        ellipsoid(group, paint, [0.29, 0.26, sideLength * 0.53], [side * sideX, sideY, sideZ]);
        sideSupport(side);
      }
      roundBumper(false);
      break;
    }
    case 8: {
      frontPlate(
        [
          [-half, 0],
          [-half, 0.35],
          [-0.65, 0.57],
          [0, 0.31],
          [0.65, 0.57],
          [half, 0.35],
          [half, 0],
          [0.53, 0.13],
          [0, 0.04],
          [-0.53, 0.13],
        ],
        frontY,
        0.16,
      );
      frontSupport();
      for (const side of [-1, 1]) {
        sidePlate(
          group,
          paint,
          [
            [sideRear, sideY],
            [sideZ, sideY + 0.32],
            [sideFront, sideY],
            [sideZ, sideY - 0.24],
          ],
          side * (sideX + 0.12),
          0.17,
        );
        sideSupport(side, sideY, sideX + 0.12);
      }
      solidPlate(
        group,
        paint,
        [
          [-half, rear + 0.04],
          [0, rear - 0.5],
          [half, rear + 0.04],
          [half - 0.3, rear + 0.15],
          [0, rear - 0.25],
          [-half + 0.3, rear + 0.15],
        ],
        rearY,
        0.16,
      );
      rearSupport(rearY, rear - 0.18);
      break;
    }
    case 9: {
      for (let i = 0; i < 3; i++)
        for (const side of [-1, 1])
          frontPlate(
            [
              [side * 0.43, 0.02 + i * 0.1],
              [side * (half - i * 0.13), 0.08 + i * 0.1],
              [side * (half - i * 0.13), 0.4 + i * 0.1],
              [side * 0.57, 0.28 + i * 0.1],
            ],
            frontY + i * 0.14,
            0.075,
          );
      for (let level = 0; level < 3; level++)
        frontSupport(frontY + level * 0.14, front + 0.18 + level * 0.1);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const z = sideRear + (i * sideLength) / 3;
          sidePlate(
            group,
            paint,
            [
              [z, sideY - 0.22],
              [z + sideLength / 3, sideY - 0.22],
              [z + sideLength / 3, sideY + 0.13],
              [z + 0.1, sideY + 0.29],
            ],
            side * (sideX + 0.1),
            0.17,
          );
        }
        sideSupport(side, sideY, sideX + 0.1);
      }
      rearDeck(0.48, rearY);
      for (const x of [-0.8, 0, 0.8])
        sidePlate(
          group,
          paint,
          [
            [rear - 0.43, rearY],
            [rear - 0.43, rearY + 0.93],
            [rear + 0.02, rearY + 0.37],
            [rear + 0.02, rearY],
          ],
          x,
          0.12,
        );
      break;
    }
    case 10: {
      for (const side of [-1, 1])
        frontPlate([
          [side * 0.4, 0],
          [side * half, 0.07],
          [side * (half - 0.14), 0.52],
          [side * 0.5, 0.47],
        ]);
      frontSupport();
      for (const side of [-1, 1]) {
        const intake = mesh(
          group,
          new THREE.CylinderGeometry(0.25, 0.31, sideLength * 0.85, 14, 1, true),
          paint,
          side * sideX,
          sideY + 0.08,
          sideZ,
        );
        intake.rotation.x = Math.PI / 2;
        mesh(
          group,
          new THREE.TorusGeometry(0.25, 0.06, 6, 16),
          accent,
          side * sideX,
          sideY + 0.08,
          sideZ + sideLength * 0.425,
        );
        sideSupport(side, sideY + 0.08, sideX - 0.26);
      }
      rounded(group, paint, [width, 0.15, 0.52], [0, wingY, wingZ], 0.055);
      const stem: Point = [0, l.rear.y + 0.25, l.tailZ - 0.12];
      support(stem, [0, l.rear.y, l.tailZ + 0.12], 0.09);
      for (const side of [-1, 1])
        rod(group, paint, stem, [side * 0.86, wingY - 0.05, wingZ], 0.085);
      break;
    }
    case 11: {
      frontRail(
        [
          [-half, frontY, 0],
          [0, frontY + 0.38, 0.5],
          [half, frontY, 0],
          [-half, frontY, 0],
        ],
        0.075,
      );
      for (const side of [-1, 1])
        frontRail(
          [
            [side * half, frontY, 0],
            [side * 0.65, frontY + 0.1, 0.3],
            [side * 0.5, frontY, 0],
          ],
          0.055,
        );
      for (const side of [-1, 1])
        support(
          [side * 0.65, frontY + 0.1, front + 0.3],
          [side * (split ? 0.62 : 0.46), l.hood.y - 0.22, l.noseZ - 0.22],
        );
      for (const side of [-1, 1]) {
        for (const flip of [-1, 1])
          rod(
            group,
            paint,
            [side * (sideX + 0.1), sideY + flip * 0.21, sideRear],
            [side * (sideX + 0.1), sideY - flip * 0.21, sideFront],
            0.075,
          );
        for (const z of [sideRear + 0.12, sideFront - 0.12]) {
          const y = sideY + 0.21 * (1 - (2 * (z - sideRear)) / sideLength);
          support([side * (sideX + 0.1), y, z], [side * l.side.x, l.side.y, z]);
        }
      }
      for (const flip of [-1, 1])
        rod(
          group,
          paint,
          [-half, rearY + flip * 0.32, rear - 0.18],
          [half, rearY - flip * 0.32, rear - 0.18],
          0.085,
        );
      for (const side of [-1, 1])
        support(
          [side * 0.64, rearY - side * 0.32 * (0.64 / half), rear - 0.18],
          [side * 0.6, l.rear.y, l.tailZ + 0.15],
        );
      break;
    }
    case 12: {
      frontPlate([
        [-half, 0],
        [-1.1, 0.33],
        [-0.55, 0.5],
        [0.55, 0.5],
        [1.1, 0.33],
        [half, 0],
        [0.84, 0.13],
        [0.4, 0.25],
        [-0.4, 0.25],
        [-0.84, 0.13],
      ]);
      frontSupport(frontY, front + 0.36);
      for (const side of [-1, 1]) {
        solidPlate(
          group,
          paint,
          [
            [side * (sideX - 0.18), sideRear],
            [side * (sideX + 0.29), sideZ],
            [side * (sideX - 0.05), sideFront],
            [side * (sideX - 0.19), sideFront - 0.1],
          ],
          sideY,
          0.2,
        );
        sideSupport(side);
      }
      for (const side of [-1, 1]) {
        const tail = hull(
          group,
          paint,
          [
            { z: rear - 0.56, width: 0.13, y: rearY + 0.18, height: 0.1 },
            { z: rear - 0.15, width: 0.43, y: rearY + 0.21, height: 0.24 },
            { z: rear + 0.08, width: 0.39, y: rearY + 0.14, height: 0.19 },
          ],
          8,
        );
        tail.position.x = side * 0.52;
        sidePlate(
          group,
          paint,
          [
            [rear - 0.53, rearY + 0.2],
            [rear - 0.43, rearY + 0.91],
            [rear + 0.04, rearY + 0.49],
            [rear + 0.12, rearY + 0.18],
          ],
          side * 0.63,
          0.12,
        );
      }
      rearSupport(rearY + 0.2, rear - 0.18, 0.52);
      break;
    }
    case 13: {
      splitter(frontY, 0.52);
      for (const side of [-1, 1])
        rod(
          group,
          metal,
          [side * 0.56, frontY, front + 0.42],
          closest([side * 0.5, l.hood.y, l.noseZ - 0.22]),
          0.038,
        );
      wing(wingY, 3.08, 0.62);
      for (const side of [-1, 1])
        rounded(group, paint, [0.13, 0.41, 0.7], [side * 1.48, wingY + 0.08, wingZ], 0.025);
      diffusers(3, 0.6, 0.53);
      break;
    }
    case 14: {
      squareArches(true);
      frontPlate(
        [
          [-half * 0.85, 0],
          [-half, 0.29],
          [-0.8, 0.54],
          [0.8, 0.54],
          [half, 0.29],
          [half * 0.85, 0],
        ],
        frontY + 0.14,
        0.22,
      );
      frontSupport(frontY + 0.14);
      for (const side of [-1, 1]) {
        rounded(group, paint, [0.44, 0.23, sideLength], [side * sideX, sideY - 0.13, sideZ], 0.05);
        sideSupport(side, sideY - 0.13);
      }
      rearDeck(0.36, rearY + 0.1);
      break;
    }
    case 15: {
      for (const side of [-1, 1]) {
        frontPlate(
          [
            [side * 0.38, 0],
            [side * 1.08, 0.05],
            [side * half, 0.27],
            [side * (half - 0.1), 0.54],
            [side * 0.87, 0.37],
            [side * 0.48, 0.3],
          ],
          frontY,
          0.12,
        );
        sidePlate(
          group,
          paint,
          [
            [sideRear, sideY - 0.18],
            [sideRear, sideY + 0.23],
            [sideFront, sideY + 0.03],
            [sideFront, sideY - 0.1],
          ],
          side * (sideX + 0.13),
          0.19,
        );
        sideSupport(side, sideY, sideX + 0.13);
      }
      frontSupport();
      solidPlate(
        group,
        paint,
        [
          [-half, wingZ - 0.27],
          [0, wingZ + 0.14],
          [half, wingZ - 0.27],
          [half, wingZ + 0.12],
          [0, wingZ + 0.48],
          [-half, wingZ + 0.12],
        ],
        wingY - 0.12,
        0.14,
      );
      rearSupport(wingY - 0.12, wingZ + 0.08);
      break;
    }
    case 16: {
      frontChannels(2);
      for (const side of [-1, 1]) {
        rounded(group, paint, [0.54, 0.59, sideLength], [side * sideX, sideY, sideZ], 0.045);
        rounded(
          group,
          accent,
          [0.045, 0.28, sideLength * 0.68],
          [side * (sideX + 0.278), sideY, sideZ],
          0.015,
        );
        sideSupport(side);
      }
      rearDeck(0.48, rearY + 0.16);
      rounded(group, paint, [width, 0.27, 0.24], [0, rearY + 0.34, rear - 0.35], 0.055);
      break;
    }
    case 17: {
      frontPlate(
        [
          [-half, 0],
          [0, 0.58],
          [half, 0],
        ],
        frontY + 0.1,
        0.2,
      );
      frontSupport(frontY + 0.1);
      for (const side of [-1, 1]) {
        rounded(group, paint, [0.6, 0.13, sideLength], [side * sideX, sideY - 0.18, sideZ], 0.04);
        for (let i = 0; i < 4; i++)
          rounded(
            group,
            metal,
            [0.44, 0.025, 0.035],
            [side * sideX, sideY - 0.106, sideRear + 0.12 + (i * (sideLength - 0.24)) / 3],
            0.01,
          );
        sideSupport(side, sideY - 0.18);
        tube(
          group,
          paint,
          [
            [side * 0.45, rearY, rear - 0.18],
            [side * 0.45, rearY + 0.82, rear - 0.18],
            [side * 1.0, rearY + 0.82, rear - 0.18],
            [side * 1.0, rearY, rear - 0.18],
          ],
          0.09,
        );
      }
      rearSupport(rearY + 0.08, rear - 0.18, 0.45);
      break;
    }
    case 18: {
      frontPlate(
        [
          [-half, 0],
          [-half, 0.32],
          [-1.02, 0.56],
          [1.02, 0.56],
          [half, 0.32],
          [half, 0],
          [half - 0.22, 0.07],
          [half - 0.22, 0.24],
          [0.92, 0.35],
          [-0.92, 0.35],
          [-half + 0.22, 0.24],
          [-half + 0.22, 0.07],
        ],
        frontY,
        0.12,
      );
      frontSupport(frontY, front + 0.45);
      for (const side of [-1, 1]) {
        const x = side * sideX;
        tube(
          group,
          paint,
          [
            [x - 0.24, sideY, sideRear],
            [x + 0.24, sideY, sideRear],
            [x + 0.24, sideY, sideFront],
            [x - 0.24, sideY, sideFront],
          ],
          0.065,
          true,
        );
        sideSupport(side, sideY, sideX - 0.24);
      }
      for (const y of [wingY - 0.55, wingY])
        rounded(group, paint, [width, 0.15, 0.32], [0, y, wingZ], 0.055);
      for (const side of [-1, 1])
        rounded(
          group,
          paint,
          [0.16, 0.62, 0.32],
          [side * (half - 0.05), wingY - 0.28, wingZ],
          0.055,
        );
      rearSupport(wingY - 0.55, wingZ);
      break;
    }
    case 19: {
      for (const side of [-1, 1]) {
        frontPlate(
          [
            [side * 0.4, 0],
            [side * half, 0.04],
            [side * (half - 0.07), 0.54],
            [side * 0.46, 0.54],
          ],
          frontY,
          0.14,
        );
        const x = side * 0.82;
        rounded(group, paint, [1.24, 0.15, 0.6], [x, wingY, wingZ], 0.05);
        support([x, wingY, wingZ], [side * 0.61, l.rear.y, l.tailZ + 0.12], 0.075);
        sidePlate(
          group,
          paint,
          [
            [sideRear, sideY - 0.15],
            [sideRear, sideY + 0.5],
            [sideFront, sideY + 0.03],
            [sideFront, sideY - 0.15],
          ],
          side * (sideX + 0.17),
          0.13,
        );
        sideSupport(side, sideY, sideX + 0.17);
      }
      frontSupport();
      break;
    }
    case 20: {
      frontPlate(
        [
          [-0.42, 0],
          [-0.37, 0.58],
          [0.37, 0.58],
          [0.42, 0],
        ],
        frontY,
        0.12,
      );
      for (const side of [-1, 1])
        frontPlate(
          [
            [side * 0.55, 0],
            [side * half, 0.04],
            [side * (half - 0.05), 0.36],
            [side * 0.6, 0.4],
          ],
          frontY,
          0.12,
        );
      for (const side of [-1, 1])
        support(
          [side * 0.8, frontY, front + 0.18],
          [side * (split ? 0.62 : 0.46), l.hood.y - 0.22, l.noseZ - 0.22],
        );
      for (const x of split ? [-0.385, 0.385] : [-0.22, 0.22])
        support(
          [x, frontY, front + 0.22],
          [split ? Math.sign(x) * 0.62 : x, l.hood.y - 0.22, l.noseZ - 0.22],
          0.04,
        );
      diffusers(5, 0.62, 0.56);
      for (const side of [-1, 1]) {
        sidePlate(
          group,
          paint,
          [
            [sideRear, sideY - 0.2],
            [sideRear, sideY + 0.08],
            [sideFront, sideY + 0.08],
            [sideFront, sideY - 0.2],
          ],
          side * (sideX + 0.09),
          0.11,
        );
        sideSupport(side, sideY - 0.06, sideX + 0.09);
      }
      break;
    }
  }
  return group;
}
