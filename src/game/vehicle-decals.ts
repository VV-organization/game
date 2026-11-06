import * as THREE from 'three';

// Follow the real painted shell so the same bought livery fits a cigar, wedge or split nose.
export function surfacePatch(
  surfaces: THREE.Mesh[],
  material: THREE.Material,
  center: [number, number, number],
  width: number,
  length: number,
  side = 0,
) {
  const columns = 10,
    rows = 10,
    positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [],
    valid: boolean[] = [];
  const ray = new THREE.Raycaster();
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= columns; col++) {
      const u = col / columns,
        v = row / rows;
      const origin = side
        ? new THREE.Vector3(side * 4, center[1] + (v - 0.5) * length, center[2] + (u - 0.5) * width)
        : new THREE.Vector3(center[0] + (u - 0.5) * width, 4, center[2] + (v - 0.5) * length);
      ray.set(origin, side ? new THREE.Vector3(-side, 0, 0) : new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(surfaces, false)[0];
      valid.push(Boolean(hit));
      if (hit) {
        const point = hit.point;
        positions.push(point.x + side * 0.012, point.y + (side ? 0 : 0.012), point.z);
      } else positions.push(0, 0, 0);
      uvs.push(u, v);
    }
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col,
        b = a + 1,
        c = a + columns + 1,
        d = c + 1;
      if (valid[a] && valid[b] && valid[c]) indices.push(a, c, b);
      if (valid[b] && valid[c] && valid[d]) indices.push(b, c, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}
