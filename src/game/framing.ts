import * as THREE from 'three';

/** Fit every corner of a world-space object to the actual viewport, including tall decor. */
export function frameObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  padding = 1.18,
  viewDirection: [number, number, number] = [1, 0.65, 1.5],
) {
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(...viewDirection).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanX = tanY * camera.aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(center);
        const depth = offset.dot(direction);
        distance = Math.max(
          distance,
          depth + (Math.abs(offset.dot(right)) * padding) / tanX,
          depth + (Math.abs(offset.dot(up)) * padding) / tanY,
        );
      }
  camera.position.copy(center).addScaledVector(direction, Math.max(1, distance));
  camera.lookAt(center);
  camera.updateMatrixWorld();
}
