import * as THREE from 'three';
import { trailDesigns } from '../shared/trail-designs';

export interface TrailEmitter {
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  active: boolean;
  boosting?: boolean;
  drifting?: boolean;
}
export interface TrailEffect {
  /** Add directly to the scene, never to the kart: particles stay in world space. */
  object: THREE.Group;
  update(dt: number, emitter: TrailEmitter): void;
}

const CAPACITY = 96;
const TAU = Math.PI * 2;
const vertexShader = `
attribute float particleOpacity;
attribute float particlePhase;
attribute vec3 particleTint;
uniform float time;
uniform int style;
varying float vOpacity;
varying float vFacing;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv=uv;
  vOpacity=particleOpacity;
  vTint=particleTint;
  vec3 p=position;
  if(style==2) p.x+=sin(uv.y*7.0+time*3.0+particlePhase)*0.10;
  if(style==15) p.y+=abs(p.x)*sin(time*13.0+particlePhase)*0.58;
  if(style==18) p.y+=sin(uv.y*5.0+time*4.0+particlePhase)*0.07;
  vec4 world=modelMatrix*instanceMatrix*vec4(p,1.0);
  vec3 worldNormal=normalize(mat3(modelMatrix*instanceMatrix)*normal);
  vFacing=abs(dot(worldNormal,normalize(cameraPosition-world.xyz)));
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const fragmentShader = `
precision highp float;
uniform int style;
uniform float time;
varying float vOpacity;
varying float vFacing;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float alpha=vOpacity;
  vec3 tint=vTint;
  if(style==0 || style==8) {
    vec2 p=vUv-0.5;
    float r=length(p)*2.0;
    alpha*=pow(max(0.0,1.0-r),1.6);
    if(style==8) {
      float swirl=0.56+0.44*sin(atan(p.y,p.x)*3.0+r*13.0-time*2.5);
      alpha*=swirl;
      tint=mix(tint,vec3(0.90,0.80,1.0),swirl*0.35);
    }
  } else if(style==7) {
    float rim=pow(1.0-vFacing,2.0);
    alpha*=0.12+rim*0.88;
    tint=mix(tint,vec3(1.0),rim*0.6);
  } else {
    tint*=0.78+vFacing*0.22;
  }
  if(alpha<0.005) discard;
  gl_FragColor=vec4(tint,alpha);
}`;

function flatShape(shape: THREE.Shape) {
  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function polygon(points: number[][]) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

function radialShape(points: number, outer: number, inner: number, phase = 0) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points + phase;
    const r = i % 2 ? inner : outer;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return shape;
}

function ringPolygon(sides: number, outer: number, inner: number, phase = 0) {
  const points: number[][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * TAU) / sides + phase;
    points.push([Math.cos(angle) * outer, Math.sin(angle) * outer]);
  }
  const shape = polygon(points);
  const hole = new THREE.Path();
  for (let i = sides - 1; i >= 0; i--) {
    const angle = (i * TAU) / sides + phase;
    if (i === sides - 1) hole.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    else hole.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
  }
  hole.closePath();
  shape.holes.push(hole);
  return flatShape(shape);
}

/** Each edition owns a genuinely different silhouette; all geometry is factory-only. */
function particleGeometry(style: number): THREE.BufferGeometry {
  switch (style) {
    case 1:
      return new THREE.OctahedronGeometry(0.2, 0);
    case 2:
      return new THREE.PlaneGeometry(0.16, 1.2, 1, 8).rotateX(-Math.PI / 2);
    case 3:
      return new THREE.ConeGeometry(0.2, 0.69, 3);
    case 4:
      return new THREE.TorusGeometry(0.28, 0.035, 5, 18).rotateX(-Math.PI / 2);
    case 5:
      return flatShape(radialShape(3, 0.28, 0.065, Math.PI / 2));
    case 6: {
      const petal = new THREE.Shape();
      petal.moveTo(0, -0.24);
      petal.bezierCurveTo(-0.32, -0.02, -0.22, 0.3, 0, 0.2);
      petal.bezierCurveTo(0.22, 0.3, 0.32, -0.02, 0, -0.24);
      return flatShape(petal);
    }
    case 7:
      return new THREE.SphereGeometry(0.28, 12, 8);
    case 8:
      return new THREE.CircleGeometry(0.58, 18).rotateX(-Math.PI / 2);
    case 9:
      return flatShape(
        polygon([
          [-0.02, 0.42],
          [-0.22, 0.02],
          [-0.03, 0.04],
          [-0.12, -0.39],
          [0.25, 0.12],
          [0.04, 0.08],
        ]),
      );
    case 10:
      return flatShape(radialShape(5, 0.29, 0.12, Math.PI / 2));
    case 11: {
      const gear = radialShape(10, 0.27, 0.21);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.09, 0, TAU, true);
      gear.holes.push(hole);
      return flatShape(gear);
    }
    case 12: {
      const drop = new THREE.Shape();
      drop.moveTo(0, 0.38);
      drop.bezierCurveTo(-0.14, 0.13, -0.3, -0.2, 0, -0.24);
      drop.bezierCurveTo(0.3, -0.2, 0.14, 0.13, 0, 0.38);
      return flatShape(drop);
    }
    case 13: {
      const shapes = [-0.2, 0, 0.2].map((x) =>
        polygon([
          [x - 0.04, -0.42],
          [x + 0.11, 0.41],
          [x + 0.05, 0.3],
          [x - 0.1, -0.24],
        ]),
      );
      return new THREE.ShapeGeometry(shapes).rotateX(-Math.PI / 2);
    }
    case 14:
      return ringPolygon(4, 0.34, 0.21);
    case 15: {
      const butterfly = new THREE.Shape();
      butterfly.moveTo(0, 0.1);
      butterfly.bezierCurveTo(-0.44, 0.48, -0.5, -0.03, -0.17, -0.04);
      butterfly.bezierCurveTo(-0.45, -0.39, -0.09, -0.37, 0, -0.12);
      butterfly.bezierCurveTo(0.09, -0.37, 0.45, -0.39, 0.17, -0.04);
      butterfly.bezierCurveTo(0.5, -0.03, 0.44, 0.48, 0, 0.1);
      return flatShape(butterfly);
    }
    case 16:
      return new THREE.BoxGeometry(0.22, 0.22, 0.22);
    case 17:
      return flatShape(
        polygon([
          [0, 0],
          [-0.04, 0.36],
          [0.23, 0.25],
          [0.04, 0.04],
          [0.35, -0.13],
          [0.13, -0.33],
          [-0.01, -0.05],
          [-0.31, -0.23],
          [-0.35, 0.06],
        ]),
      );
    case 18: {
      const leaves = new THREE.Shape();
      leaves.moveTo(0, -0.32);
      leaves.bezierCurveTo(-0.37, -0.26, -0.36, 0.04, -0.03, 0.04);
      leaves.bezierCurveTo(0.36, 0.12, 0.3, 0.37, 0, 0.34);
      leaves.lineTo(0.03, 0.04);
      leaves.closePath();
      return flatShape(leaves);
    }
    case 19:
      return ringPolygon(4, 0.34, 0.275, Math.PI / 4);
    case 20: {
      const crescent = new THREE.Shape();
      crescent.moveTo(0.14, 0.28);
      crescent.bezierCurveTo(-0.36, 0.38, -0.39, -0.34, 0.15, -0.27);
      crescent.bezierCurveTo(-0.12, -0.18, -0.12, 0.16, 0.14, 0.28);
      return flatShape(crescent);
    }
    default:
      return new THREE.CircleGeometry(0.46, 14).rotateX(-Math.PI / 2);
  }
}

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

/** 96 preallocated particles, one instanced draw call, no per-frame geometry,
 * objects, arrays or random-number allocations. Seeded emission is deterministic.
 * Inactive emitters drain naturally; the owning scene disposes mesh resources.
 */
export function createTrailEffect(variant?: number, color?: string): TrailEffect {
  const style = Number.isInteger(variant) && variant! >= 1 && variant! <= 20 ? variant! : 0;
  const design = style ? trailDesigns[style - 1] : undefined;
  const primary = new THREE.Color(color || design?.primary || '#d6c7ad');
  const maximum = Math.max(primary.r, primary.g, primary.b);
  if (maximum < 0.2 && design) primary.set(design.primary);
  else if (maximum > 0 && maximum < 0.8) primary.multiplyScalar(0.8 / maximum);
  const secondary = new THREE.Color(design?.secondary || color || '#ebe0c8');
  const geometry = particleGeometry(style);
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1);
  const phases = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1);
  const tints = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
  opacity.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('particleOpacity', opacity);
  geometry.setAttribute('particlePhase', phases);
  geometry.setAttribute('particleTint', tints);
  const material = new THREE.ShaderMaterial({
    name: `trail-${design?.shape || 'dust'}`,
    vertexShader,
    fragmentShader,
    uniforms: { style: { value: style }, time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: style === 0 ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
  mesh.name = `trail-${design?.shape || 'dust'}`;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const object = new THREE.Group();
  object.name = 'kart-trail';
  object.userData.variant = style;
  object.userData.capacity = CAPACITY;
  object.userData.aliveCount = 0;
  object.add(mesh);

  // Particle state is structure-of-arrays and never grows.
  const age = new Float32Array(CAPACITY).fill(-1);
  const life = new Float32Array(CAPACITY);
  const originX = new Float32Array(CAPACITY);
  const originY = new Float32Array(CAPACITY);
  const originZ = new Float32Array(CAPACITY);
  const forwardX = new Float32Array(CAPACITY);
  const forwardZ = new Float32Array(CAPACITY);
  const inheritedX = new Float32Array(CAPACITY);
  const inheritedZ = new Float32Array(CAPACITY);
  const lateral = new Float32Array(CAPACITY);
  const velocity = new Float32Array(CAPACITY);
  const seed = new Float32Array(CAPACITY);
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  let randomState = 7937 + style * 104729;
  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  };
  for (let i = 0; i < CAPACITY; i++) {
    seed[i] = random();
    phases.setX(i, seed[i] * TAU);
    tint.copy(primary).lerp(secondary, i % 3 === 0 ? 0.9 : seed[i] * 0.3);
    tints.setXYZ(i, tint.r, tint.g, tint.b);
    transform.scale.setScalar(0);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  }
  let cursor = 0;
  let serial = 0;
  let accumulator = 0;
  let time = 0;
  let previousX = 0;
  let previousZ = 0;
  let hasPreviousPosition = false;

  return {
    object,
    update(dt, emitter) {
      const step = Math.min(0.05, Math.max(0, finite(dt)));
      if (step === 0) return;
      time += step;
      material.uniforms.time.value = time;
      const x = finite(emitter.x);
      const y = finite(emitter.y);
      const z = finite(emitter.z);
      let observedX = 0;
      let observedZ = 0;
      if (hasPreviousPosition) {
        const dx = x - previousX;
        const dz = z - previousZ;
        // Observe actual displacement: a stationary studio emitter still reports
        // driving speed. A discontinuity resets the wake instead of launching it.
        const maximumDistance = 100 * step;
        if (dx * dx + dz * dz <= maximumDistance * maximumDistance) {
          observedX = dx / step;
          observedZ = dz / step;
        } else {
          age.fill(-1);
          opacity.array.fill(0);
          accumulator = 0;
        }
      }
      previousX = x;
      previousZ = z;
      hasPreviousPosition = true;
      const heading = finite(emitter.heading);
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const speed = Math.min(100, Math.max(0, finite(emitter.speed)));
      const active = emitter.active && speed > 0.1;
      if (active)
        accumulator += step * (emitter.boosting ? 61 : style === 8 || style === 0 ? 35 : 48);
      else accumulator = 0;
      while (accumulator >= 1) {
        const i = cursor;
        cursor = (cursor + 1) % CAPACITY;
        serial++;
        const side = serial % 2 ? -1 : 1;
        const jitter = (random() - 0.5) * 0.2;
        age[i] = 0;
        life[i] = 0.78 + seed[i] * 0.4;
        // The update below advances every newborn by this step. Backdate only
        // the inherited displacement so it begins at the current rear axle.
        originX[i] = x - fx * 1.9 + fz * (side * 0.54 + jitter) - observedX * step;
        originY[i] = y + 0.12;
        originZ[i] = z - fz * 1.9 - fx * (side * 0.54 + jitter) - observedZ * step;
        inheritedX[i] = observedX;
        inheritedZ[i] = observedZ;
        forwardX[i] = fx;
        forwardZ[i] = fz;
        lateral[i] = side;
        velocity[i] = 2.25 + Math.min(speed, 30) * 0.038 + seed[i] * 0.6;
        accumulator--;
      }
      let aliveCount = 0;
      for (let i = 0; i < CAPACITY; i++) {
        if (age[i] < 0) continue;
        age[i] += step;
        const t = age[i];
        const progress = t / life[i];
        if (progress >= 1) {
          age[i] = -1;
          opacity.setX(i, 0);
          continue;
        }
        const s = seed[i];
        const side = lateral[i];
        const phase = s * TAU;
        let sway = side * progress * 0.24;
        let height = 0.08;
        let scale = 0.65 + s * 0.62;
        let stretch = 1;
        let spin = phase + t * 2;
        let tilt = 0.12;
        let fade = Math.pow(1 - progress, 0.65) * Math.min(1, progress * 14);
        switch (style) {
          case 1:
            height = Math.max(0.02, t * (2.0 + s) - t * t * 2.7);
            sway = side * progress * 0.52;
            stretch = 1.5;
            spin = phase + t * 9;
            scale *= 1 - progress * 0.55;
            break;
          case 2:
            sway = Math.sin(t * 5 + phase) * 0.27 + side * 0.12;
            height = 0.13 + Math.sin(t * 3 + phase) * 0.09;
            stretch = 1.1 + progress * 0.5;
            spin = Math.sin(t * 4 + phase) * 0.16;
            scale *= 1 - progress * 0.5;
            break;
          case 3:
            height = Math.max(0.04, Math.sin(progress * Math.PI) * (0.5 + s * 0.3));
            sway = side * progress * 0.46;
            spin = phase + t * 5;
            tilt = t * 4 + phase;
            break;
          case 4:
            height = 0.15 + t * 0.4;
            scale *= 0.4 + progress * 1.5;
            spin = phase - t * 2;
            tilt = 0.35 + Math.sin(t * 3 + phase) * 0.25;
            break;
          case 5:
            sway = Math.sin(t * 9 + phase) * 0.27;
            height = 0.2 + Math.cos(t * 9 + phase) * 0.15;
            spin = side * t * 9;
            break;
          case 6:
            sway = Math.sin(t * 4 + phase) * 0.42;
            height = 0.18 + Math.sin(progress * Math.PI) * 0.4;
            spin = phase + t * 2.6;
            tilt = Math.sin(t * 5 + phase) * 0.7;
            break;
          case 7:
            sway = Math.sin(t * 3 + phase) * 0.23;
            height = 0.12 + t * (0.55 + s * 0.3);
            scale *= 0.55 + progress * 1.1;
            fade = Math.min(1, progress * 15) * Math.pow(1 - progress, 0.35);
            break;
          case 8:
          case 0:
            sway = Math.sin(t * 3 + phase) * 0.27 + side * progress * 0.12;
            height = 0.08 + t * 0.16;
            scale *= 0.7 + progress * 1.1;
            spin = phase + side * t * 0.7;
            fade *= style ? 0.64 : 0.38;
            break;
          case 9:
            sway = Math.sin(Math.floor(t * 12) + phase) * 0.39;
            height = 0.11 + Math.abs(Math.sin(t * 10 + phase)) * 0.17;
            spin = side * 0.3 + Math.sin(Math.floor(t * 9)) * 0.2;
            fade *= 0.7 + 0.3 * Math.sin(t * 26 + phase);
            break;
          case 10:
            sway = Math.sin(t * 5 + phase) * progress * 0.45;
            height = 0.24 + Math.cos(t * 5 + phase) * 0.16;
            spin = phase + side * t * 3;
            scale *= 0.8 + 0.2 * Math.sin(t * 12 + phase);
            break;
          case 11:
            sway = side * progress * 0.3;
            height = 0.04 + Math.abs(Math.sin(t * 7 + s)) * (1 - progress) * 0.35;
            spin = phase + side * t * 11;
            tilt = 0.28;
            break;
          case 12:
            sway = side * progress * 0.5;
            height = Math.max(0.01, t * 1.5 - t * t * 1.7);
            spin = side * 0.28;
            stretch = 1.2 - progress * 0.6;
            scale *= 1 - progress * 0.4;
            break;
          case 13:
            sway = side * progress * 0.3;
            height = 0.13;
            spin = side * 0.28;
            stretch = 1.2;
            scale *= 1.4 - progress;
            fade *= 0.7 + 0.3 * Math.cos(t * 15);
            break;
          case 14:
            sway = side * 0.13 + Math.sin(t * 2 + phase) * 0.14;
            height = 0.2 + Math.sin(t * 4 + phase) * 0.1;
            spin = phase + t * 1.5;
            tilt = Math.sin(t * 4 + phase) * 0.65;
            break;
          case 15:
            sway = side * progress * 0.25 + Math.sin(t * 4 + phase) * 0.23;
            height = 0.25 + Math.sin(progress * Math.PI) * 0.45;
            spin = Math.sin(t * 4 + phase) * 0.35;
            break;
          case 16:
            sway = side * Math.floor(progress * 5) * 0.09;
            height = 0.06 + Math.floor((1 - progress) * 3) * 0.09;
            spin = 0;
            tilt = 0;
            scale = progress < 0.75 ? scale : scale * 0.5;
            fade = progress < 0.9 ? 0.85 : 0.35;
            break;
          case 17:
            sway = Math.sin(t * 6 + phase) * progress * 0.25;
            height = 0.045;
            spin = phase + t * 8;
            scale *= 0.45 + progress * 1.2;
            break;
          case 18:
            sway = Math.sin(t * 3 + phase) * 0.37;
            height = 0.15 + Math.sin(progress * Math.PI) * 0.38;
            spin = phase + Math.sin(t * 3) * 1.0;
            tilt = Math.cos(t * 4 + phase) * 0.45;
            break;
          case 19:
            sway = side * progress * 0.15;
            height = 0.1;
            scale *= 0.4 + progress * 1.6;
            spin = progress * 0.7;
            fade *= 0.72 + 0.28 * Math.sin(progress * 20);
            break;
          case 20:
            sway = Math.sin(t * 3 + phase) * 0.32;
            height = 0.18 + t * 0.27;
            spin = phase - t * 1.8;
            tilt = Math.sin(t * 2 + phase) * 0.5;
            break;
        }
        const px =
          originX[i] + inheritedX[i] * t - forwardX[i] * velocity[i] * t + forwardZ[i] * sway;
        const pz =
          originZ[i] + inheritedZ[i] * t - forwardZ[i] * velocity[i] * t - forwardX[i] * sway;
        // Keep a moving vehicle's wake local too, without reparenting old particles.
        if ((px - x) ** 2 + (pz - z) ** 2 > 58) {
          age[i] = -1;
          opacity.setX(i, 0);
          continue;
        }
        transform.position.set(px, originY[i] + height, pz);
        transform.rotation.set(
          tilt,
          Math.atan2(forwardX[i], forwardZ[i]) + spin,
          style === 3 ? t * 3 : 0,
        );
        transform.scale.set(scale, scale, scale * stretch);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
        opacity.setX(i, Math.max(0, fade));
        aliveCount++;
      }
      opacity.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
      object.userData.aliveCount = aliveCount;
    },
  };
}
