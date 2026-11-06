import * as THREE from 'three';
import { projectTrack, sampleTrack, type Track } from './simulation';

export type RaceWorld = {
  scene: THREE.Scene;
  pickups: THREE.Group[];
  water: THREE.Mesh;
  pulse: THREE.Mesh;
  sun: THREE.DirectionalLight;
};
const palettes = {
  coast: {
    sky: '#a7e3ec',
    fog: '#a7e3ec',
    water: '#26b7cd',
    sand: '#f2dda2',
    land: '#78c877',
    road: '#547071',
    curb: '#fb785f',
    mountain: '#97bf94',
  },
  neon: {
    sky: '#10172f',
    fog: '#19263c',
    water: '#152b45',
    sand: '#344256',
    land: '#25384c',
    road: '#324259',
    curb: '#f279ff',
    mountain: '#25344e',
  },
  canyon: {
    sky: '#f8d7ad',
    fog: '#f1cba1',
    water: '#4bbaaa',
    sand: '#e9aa70',
    land: '#ca835c',
    road: '#79665d',
    curb: '#f3dc96',
    mountain: '#b9684e',
  },
  sky: {
    sky: '#bac5f4',
    fog: '#c6cdf4',
    water: '#c4d2f4',
    sand: '#e5dffb',
    land: '#b2c6ad',
    road: '#7d879f',
    curb: '#a9efef',
    mountain: '#d9ddf8',
  },
};
const standard = (color: THREE.ColorRepresentation) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  scale = 1,
) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.setScalar(scale);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function strip(
  track: Track,
  inner: number,
  outer: number,
  height: number,
  color: string,
  striped = false,
) {
  const positions: number[] = [],
    colors: number[] = [];
  const aColor = new THREE.Color(color),
    bColor = new THREE.Color('#fff4dd');
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i],
      b = track.points[(i + 1) % track.points.length];
    const v = [
      a.x + a.tz * inner,
      height,
      a.z - a.tx * inner,
      a.x + a.tz * outer,
      height,
      a.z - a.tx * outer,
      b.x + b.tz * inner,
      height,
      b.z - b.tx * inner,
      b.x + b.tz * inner,
      height,
      b.z - b.tx * inner,
      a.x + a.tz * outer,
      height,
      a.z - a.tx * outer,
      b.x + b.tz * outer,
      height,
      b.z - b.tx * outer,
    ];
    positions.push(...v);
    const c = striped && Math.floor(i / 5) % 2 ? bColor : aColor;
    for (let k = 0; k < 6; k++) colors.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.98 }),
  );
  m.receiveShadow = true;
  return m;
}
function island(track: Track, offset: number, y: number, color: string) {
  const shape = new THREE.Shape();
  track.points
    .filter((_, i) => i % 5 === 0)
    .forEach((p, i) => {
      const x = p.x - p.tz * offset,
        z = -(p.z + p.tx * offset);
      if (!i) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 6,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y - 6, 0);
  const m = new THREE.Mesh(geo, standard(color));
  m.receiveShadow = true;
  return m;
}
function palm(rand: () => number) {
  const group = new THREE.Group(),
    height = 7 + rand() * 5;
  const trunk = mesh(
    new THREE.CylinderGeometry(0.25, 0.55, height, 6),
    standard('#a88d64'),
    0,
    height / 2,
    0,
  );
  trunk.rotation.z = (rand() - 0.5) * 0.2;
  group.add(trunk);
  const top = new THREE.Group();
  top.position.set(-Math.sin(trunk.rotation.z) * height, height - 0.1, 0);
  group.add(top);
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, 0, 0, -0.8, 0.35, 2.1, 0, -1.2, 5.3, 0, 0, 0, 0, -1.2, 5.3, 0.8, 0.35, 2.1],
      3,
    ),
  );
  leafGeo.computeVertexNormals();
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#39955f',
    roughness: 1,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(leafGeo, leafMat, 0, 0, 0);
    leaf.rotation.y = (i * Math.PI * 2) / 7;
    leaf.rotation.x = (rand() - 0.5) * 0.25;
    leaf.scale.setScalar(0.8 + rand() * 0.4);
    top.add(leaf);
  }
  for (let i = 0; i < 3; i++)
    top.add(
      mesh(
        new THREE.DodecahedronGeometry(0.38, 0),
        standard('#8b644b'),
        Math.cos(i * 2) * 0.5,
        -0.25,
        Math.sin(i * 2) * 0.5,
      ),
    );
  return group;
}
function cactus(rand: () => number) {
  const group = new THREE.Group(),
    material = standard('#699e75'),
    h = 5 + rand() * 5;
  group.add(mesh(new THREE.CapsuleGeometry(0.65, h, 4, 6), material, 0, h / 2 + 0.3, 0));
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.42, 2, 3, 6), material, side * 1.1, h * 0.6, 0);
    arm.rotation.z = side * 1.1;
    group.add(arm);
    group.add(
      mesh(new THREE.CapsuleGeometry(0.43, 2.3, 3, 6), material, side * 1.8, h * 0.7 + 0.7, 0),
    );
  }
  return group;
}
function sign(text: string, background: string, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#f5f9e8';
  ctx.font = '900 106px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 133);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide }),
  );
}
export function createWorld(track: Track): RaceWorld {
  const p = palettes[track.id as keyof typeof palettes] || palettes.coast,
    rand = random(
      track.id === 'coast' ? 17 : track.id === 'neon' ? 29 : track.id === 'canyon' ? 47 : 71,
    );
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(p.sky);
  scene.fog = new THREE.Fog(p.fog, 160, 500);
  scene.add(
    new THREE.HemisphereLight(
      track.id === 'neon' ? '#a8baff' : '#fff9d8',
      track.id === 'neon' ? '#253253' : '#729b91',
      track.id === 'neon' ? 2 : 2.4,
    ),
  );
  const sun = new THREE.DirectionalLight(
    track.id === 'neon' ? '#c4c6ff' : '#fff4d8',
    track.id === 'neon' ? 1.4 : 3.1,
  );
  sun.position.set(-100, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 350;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.15;
  scene.add(sun);
  scene.add(sun.target);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 2200, 1, 1),
    new THREE.MeshStandardMaterial({ color: p.water, roughness: 0.34, metalness: 0.08 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = track.id === 'sky' ? -25 : -3.7;
  water.receiveShadow = true;
  scene.add(water);
  scene.add(island(track, 30, -0.5, p.sand));
  scene.add(island(track, 15, -0.12, p.land));
  scene.add(strip(track, -track.width / 2 - 2, track.width / 2 + 2, 0.04, p.sand));
  scene.add(strip(track, -track.width / 2, track.width / 2, 0.13, p.road));
  scene.add(strip(track, -track.width / 2 - 1.15, -track.width / 2, 0.17, p.curb, true));
  scene.add(strip(track, track.width / 2, track.width / 2 + 1.15, 0.17, p.curb, true));
  scene.add(strip(track, -track.width / 2 + 1, -track.width / 2 + 1.17, 0.15, '#e0e9cc'));
  scene.add(strip(track, track.width / 2 - 1.17, track.width / 2 - 1, 0.15, '#e0e9cc'));
  // Subtle central road dashes are one draw call.
  const dashPositions: number[] = [];
  for (let i = 0; i < 600; i += 12) {
    const a = track.points[i],
      b = track.points[(i + 4) % 600],
      w = 0.12;
    dashPositions.push(
      a.x - a.tz * w,
      0.155,
      a.z + a.tx * w,
      a.x + a.tz * w,
      0.155,
      a.z - a.tx * w,
      b.x - b.tz * w,
      0.155,
      b.z + b.tx * w,
      b.x - b.tz * w,
      0.155,
      b.z + b.tx * w,
      a.x + a.tz * w,
      0.155,
      a.z - a.tx * w,
      b.x + b.tz * w,
      0.155,
      b.z - b.tx * w,
    );
  }
  const dashGeo = new THREE.BufferGeometry();
  dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashPositions, 3));
  scene.add(
    new THREE.Mesh(
      dashGeo,
      new THREE.MeshBasicMaterial({
        color: '#ced8cd',
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
    ),
  );
  // Alternating start grid and a sponsor gantry.
  const start = sampleTrack(track, 0),
    startGroup = new THREE.Group();
  startGroup.position.set(start.x, 0.19, start.z);
  startGroup.rotation.y = Math.atan2(start.tx, start.tz);
  scene.add(startGroup);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 14; col++) {
      const cell = mesh(
        new THREE.BoxGeometry(track.width / 14, 0.025, 1),
        standard((row + col) % 2 ? '#253b3c' : '#fbf6dc'),
        ((col - 6.5) * track.width) / 14,
        0,
        row - 1,
      );
      startGroup.add(cell);
    }
  const metal = standard('#304d53');
  for (const side of [-1, 1]) {
    startGroup.add(
      mesh(new THREE.BoxGeometry(0.6, 9, 0.6), metal, side * (track.width / 2 + 1.9), 4.3, 0),
    );
    startGroup.add(
      mesh(
        new THREE.BoxGeometry(2, 0.6, 2),
        standard(p.sand),
        side * (track.width / 2 + 1.9),
        0.3,
        0,
      ),
    );
  }
  startGroup.add(
    mesh(new THREE.BoxGeometry(track.width + 4.2, 2.8, 0.7), standard('#243f40'), 0, 9, 0),
  );
  const title = sign('FAPIX  /  СТАРТ', '#243f40', track.width + 3, 2.5);
  title.position.set(0, 9, -0.38);
  title.rotation.y = Math.PI;
  startGroup.add(title);
  const titleBack = title.clone();
  titleBack.position.z = 0.38;
  titleBack.rotation.y = 0;
  startGroup.add(titleBack);
  // Island objects are deterministic, and never obstruct the racing line.
  const rockGeo = new THREE.DodecahedronGeometry(1, 0),
    rockMat = standard(track.id === 'canyon' ? '#c47753' : '#a9bfb0');
  for (let i = 0; i < 83; i++) {
    const t = rand(),
      sample = sampleTrack(track, t),
      side = rand() > 0.64 ? -1 : 1,
      offset = (track.width / 2 + 5 + rand() * 19) * side;
    const x = sample.x + sample.tz * offset,
      z = sample.z - sample.tx * offset;
    if (projectTrack(track, x, z).distance < track.width / 2 + 3) continue;
    if (i < 48) {
      if (track.id === 'neon') {
        const h = 7 + rand() * 35,
          w = 4 + rand() * 7;
        const building = mesh(
          new THREE.BoxGeometry(w, h, w),
          standard(['#304960', '#273b54', '#46516e'][i % 3]),
          x,
          h / 2,
          z,
        );
        scene.add(building);
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(building.geometry),
          new THREE.LineBasicMaterial({
            color: i % 2 ? '#65e6ed' : '#c278ff',
            transparent: true,
            opacity: 0.65,
          }),
        );
        edge.position.copy(building.position);
        scene.add(edge);
      } else {
        const tree = track.id === 'canyon' ? cactus(rand) : palm(rand);
        tree.position.set(x, 0, z);
        if (track.id === 'sky') {
          tree.scale.set(0.8, 0.8, 0.8);
          tree.traverse((o) => {
            if (
              o instanceof THREE.Mesh &&
              o.material instanceof THREE.MeshStandardMaterial &&
              o.material.color.getHexString() === '39955f'
            )
              o.material.color.set('#8a9ed1');
          });
        }
        tree.rotation.y = rand() * Math.PI * 2;
        scene.add(tree);
      }
    } else {
      const rock = mesh(rockGeo, rockMat, x, rand(), z, 2 + rand() * 4);
      rock.scale.y *= 0.6 + rand();
      rock.rotation.set(rand(), rand(), rand());
      scene.add(rock);
    }
  }
  // A sculptural central mountain anchors the island; far islands frame the horizon.
  for (let i = 0; i < 6; i++) {
    const mountain = mesh(
      new THREE.ConeGeometry(15 + rand() * 16, 15 + rand() * 35, 5),
      standard(p.mountain),
      -20 + (rand() - 0.5) * 65,
      7,
      -10 + (rand() - 0.5) * 60,
    );
    mountain.rotation.y = rand() * 6;
    scene.add(mountain);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2,
      d = 320 + rand() * 200;
    const mountain = mesh(
      new THREE.ConeGeometry(40 + rand() * 35, 25 + rand() * 70, 5),
      standard(p.mountain),
      Math.cos(a) * d,
      -10,
      Math.sin(a) * d,
    );
    scene.add(mountain);
  }
  // Puffy polygon clouds and gentle sea highlights add depth without external assets.
  const cloudMat = new THREE.MeshBasicMaterial({
    color: track.id === 'neon' ? '#354762' : '#fff9ec',
    transparent: true,
    opacity: 0.88,
  });
  for (let i = 0; i < 22; i++) {
    const cloud = new THREE.Group();
    cloud.position.set((rand() - 0.5) * 1050, 55 + rand() * 80, (rand() - 0.5) * 1050);
    for (let j = 0; j < 3; j++) {
      const puff = mesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, j * 13, rand() * 4, 0);
      puff.scale.set(18 + rand() * 8, 7 + rand() * 5, 9 + rand() * 4);
      puff.castShadow = false;
      cloud.add(puff);
    }
    scene.add(cloud);
  }
  if (track.id !== 'neon' && track.id !== 'sky') {
    const foam = new THREE.MeshBasicMaterial({
      color: '#b7f3df',
      transparent: true,
      opacity: 0.22,
    });
    for (let i = 0; i < 90; i++) {
      const x = (rand() - 0.5) * 1100,
        z = (rand() - 0.5) * 1100;
      if (Math.hypot(x, z) < 205) continue;
      const wave = mesh(
        new THREE.PlaneGeometry(8 + rand() * 22, 0.35 + rand() * 0.5),
        foam,
        x,
        -3.62,
        z,
      );
      wave.rotation.x = -Math.PI / 2;
      wave.castShadow = false;
      scene.add(wave);
    }
  }
  // Orange turn markers alternate with trackside racing banners.
  for (let i = 0; i < 17; i++) {
    const point = sampleTrack(track, 0.06 + i * 0.055),
      side = i % 2 ? 1 : -1,
      off = (track.width / 2 + 3) * side;
    const group = new THREE.Group();
    group.position.set(point.x + point.tz * off, 0, point.z - point.tx * off);
    group.rotation.y = Math.atan2(point.tx, point.tz);
    scene.add(group);
    for (const x of [-1.7, 1.7])
      group.add(mesh(new THREE.BoxGeometry(0.15, 3, 0.15), metal, x, 1.5, 0));
    const banner = sign(i % 3 ? '› › ›' : 'ПОЛНЫЙ ГАЗ', i % 3 ? '#e8b75d' : '#314e50', 4.7, 1.4);
    banner.position.y = 2.7;
    banner.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(banner);
  }
  // Collectible power cubes span the lane so every player can reach them.
  const pickups: THREE.Group[] = [];
  for (const t of [0.13, 0.39, 0.65, 0.88])
    for (const lane of [-5, 0, 5]) {
      const point = sampleTrack(track, t),
        group = new THREE.Group();
      group.position.set(point.x + point.tz * lane, 1.8, point.z - point.tx * lane);
      scene.add(group);
      const cube = mesh(
        new THREE.BoxGeometry(1.35, 1.35, 1.35),
        new THREE.MeshStandardMaterial({
          color: '#b6efff',
          emissive: '#5ccbea',
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.75,
          metalness: 0.2,
          roughness: 0.2,
        }),
        0,
        0,
        0,
      );
      group.add(cube);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(cube.geometry),
        new THREE.LineBasicMaterial({ color: '#efffff' }),
      );
      group.add(edges);
      const face = sign('?', '#59bfd6', 0.85, 0.85);
      face.position.z = 0.69;
      group.add(face);
      const back = face.clone();
      back.position.z = -0.69;
      back.rotation.y = Math.PI;
      group.add(back);
      pickups.push(group);
    }
  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1, 64),
    new THREE.MeshBasicMaterial({
      color: '#b8c6ff',
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.visible = false;
  scene.add(pulse);
  return { scene, pickups, water, pulse, sun };
}
