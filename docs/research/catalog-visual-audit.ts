/**
 * Reproduce: npx tsx docs/research/catalog-visual-audit.ts
 *
 * Executes the real catalog -> customizationFor -> createKart/createGarageScene pipeline.
 * Hashes renderable geometry, world transforms, material values, and painted Canvas2D
 * commands. Product IDs, names, UUIDs and hidden geometry never enter render hashes.
 * This is a structural visual audit, not a WebGL screenshot/perceptual acceptance test.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { products } from '../../server/catalog';
import { customizationFor } from '../../src/lib/customization';
import { createKart, disposeScene } from '../../src/game/kart';
import { createGarageScene } from '../../src/game/garage';
import { ProductArt } from '../../src/components/Catalog';
import type { Customization } from '../../src/game/types';

const root = resolve(import.meta.dirname, '../..');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const round = (value: number) => Math.round(value * 1e7) / 1e7;
const window = new Window();
const doc = window.document;
const originalCreateElement = doc.createElement.bind(doc);
const painted = new WeakMap<object, unknown[]>();

function recordingContext(canvas: object) {
  const operations: unknown[] = [];
  painted.set(canvas, operations);
  let path: unknown[] = [];
  const state: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };
  const ctx: Record<string, unknown> = {
    beginPath: () => {
      path = [];
    },
    fill: () => operations.push(['fill', [...path], state.fillStyle]),
    stroke: () =>
      operations.push(['stroke', [...path], state.strokeStyle, state.lineWidth, state.lineCap]),
    fillRect: (...args: unknown[]) => operations.push(['fillRect', args, state.fillStyle]),
    strokeRect: (...args: unknown[]) =>
      operations.push(['strokeRect', args, state.strokeStyle, state.lineWidth]),
    fillText: (...args: unknown[]) =>
      operations.push([
        'fillText',
        args,
        state.fillStyle,
        state.font,
        state.textAlign,
        state.textBaseline,
      ]),
    clearRect: (...args: unknown[]) => operations.push(['clearRect', args]),
  };
  for (const method of [
    'moveTo',
    'lineTo',
    'arc',
    'ellipse',
    'roundRect',
    'quadraticCurveTo',
    'closePath',
  ]) {
    ctx[method] = (...args: unknown[]) => path.push([method, ...args]);
  }
  return new Proxy(ctx, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key in state) return state[key];
      throw new Error(`Audit recorder must implement Canvas2D member ${String(key)}`);
    },
    set(_target, key: string, value) {
      state[key] = value;
      return true;
    },
  });
}
// The only substituted drawing surface records actual painted commands rather than no-op
// contexts. Geometry/material builders and all customization lookup code remain unchanged.
Object.defineProperty(doc, 'createElement', {
  value: (tag: string, ...args: unknown[]) => {
    const element = originalCreateElement(tag, ...(args as []));
    if (tag.toLowerCase() === 'canvas') {
      const ctx = recordingContext(element);
      Object.defineProperty(element, 'getContext', {
        value: (type: string) => {
          if (type !== '2d') throw new Error('This audit does not create WebGL contexts');
          return ctx;
        },
      });
    }
    return element;
  },
});
Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });

function geometrySignature(geometry: THREE.BufferGeometry) {
  const attributes: Record<string, unknown> = {};
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const bytes = Buffer.from(
      attribute.array.buffer,
      attribute.array.byteOffset,
      attribute.array.byteLength,
    );
    attributes[name] = {
      size: attribute.itemSize,
      data: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  const index = geometry.getIndex();
  return {
    type: geometry.type,
    attributes,
    index: index ? digest(Array.from(index.array)) : null,
    groups: geometry.groups,
  };
}
function textureSignature(texture: THREE.Texture) {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const operations = image && painted.get(image);
  if (image && !operations) throw new Error(`Unrecorded texture image in ${texture.type}`);
  return {
    dimensions: image ? [image.width, image.height] : null,
    paintedCommands: operations || null,
    repeat: texture.repeat.toArray(),
    offset: texture.offset.toArray(),
    rotation: texture.rotation,
    wrap: [texture.wrapS, texture.wrapT],
    colorSpace: texture.colorSpace,
  };
}
function materialSignature(material: THREE.Material) {
  const value = material as THREE.MeshStandardMaterial;
  const record: Record<string, unknown> = {};
  for (const key of [
    'type',
    'visible',
    'transparent',
    'opacity',
    'side',
    'roughness',
    'metalness',
    'emissiveIntensity',
    'depthWrite',
    'wireframe',
  ]) {
    record[key] = (value as unknown as Record<string, unknown>)[key];
  }
  for (const key of ['color', 'emissive'] as const)
    if (value[key]) record[key] = value[key].toArray().map(round);
  for (const key of ['map', 'alphaMap', 'emissiveMap'] as const)
    if (value[key]) record[key] = textureSignature(value[key]);
  return record;
}
function renderSignature(rootObject: THREE.Object3D) {
  rootObject.updateMatrixWorld(true);
  const objects: unknown[] = [];
  const visit = (object: THREE.Object3D, parentVisible = true) => {
    const visible = parentVisible && object.visible;
    if (!visible) return;
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      const materials = (
        Array.isArray(object.material) ? object.material : [object.material]
      ).filter((material) => material.visible && material.opacity > 0);
      if (materials.length)
        objects.push({
          type: object.type,
          world: object.matrixWorld.toArray().map(round),
          geometry: geometrySignature(object.geometry),
          materials: materials.map(materialSignature),
          castShadow: object.castShadow,
          receiveShadow: object.receiveShadow,
        });
    } else if (object instanceof THREE.Light) {
      objects.push({
        type: object.type,
        world: object.matrixWorld.toArray().map(round),
        color: object.color.toArray().map(round),
        intensity: object.intensity,
      });
    }
    for (const child of object.children) visit(child, visible);
  };
  visit(rootObject);
  return { hash: digest(objects), renderableObjects: objects.length };
}
function kartSnapshot(config: Customization, boostVisible = false) {
  const kart = createKart(config);
  if (boostVisible)
    kart.userData.exhaust.forEach((flame) => {
      flame.visible = true;
    });
  const signature = renderSignature(kart);
  disposeScene(kart);
  return signature;
}
function garageSnapshot(config: Customization) {
  const { scene } = createGarageScene(config);
  const signature = renderSignature(scene);
  disposeScene(scene);
  return signature;
}
function profileSnapshot(product: (typeof products)[number]) {
  const markup = renderToStaticMarkup(createElement(ProductArt, { product, products }));
  const host = originalCreateElement('div');
  host.innerHTML = markup;
  const avatar = host.querySelector('.art-profile > div[style]');
  if (!avatar) throw new Error(`Missing actual profile art for ${product.id}`);
  const visibleArt = {
    style: avatar.getAttribute('style'),
    svg: avatar.querySelector('svg')?.outerHTML,
  };
  if (!visibleArt.svg) throw new Error(`Missing actual profile SVG for ${product.id}`);
  // Excludes the numbered SKU badge outside the avatar.
  return { hash: digest(visibleArt), visibleArt };
}

const baseConfig: Customization = { car: 1 };
const baseline = {
  freeOrigin: kartSnapshot({}),
  kart: kartSnapshot(baseConfig),
  boost: kartSnapshot(baseConfig, true),
  garage: garageSnapshot(baseConfig),
};
const observedEarlier = [
  {
    id: 'live-preview-trail',
    observedAtCommit: 'ee94ac4',
    classification: 'historical-source-review',
    resolutionReviewId: 'preview-routing-2026-11-06',
    categories: ['trail'],
    description:
      'At ee94ac4, all 20 trail variants were routed into a visibly unchanged KartPreview: flames were hidden and the live preview had no particle emitter. Race and static cards consumed the color.',
    references: [
      'src/game/kart.ts:342-351',
      'src/game/KartPreview.tsx:63-68',
      'src/game/Race.tsx:139',
      'src/game/ProductThumbnail.tsx:136-156',
    ],
  },
  {
    id: 'live-preview-profile',
    observedAtCommit: 'ee94ac4',
    classification: 'historical-source-review',
    resolutionReviewId: 'preview-routing-2026-11-06',
    categories: ['profile'],
    description:
      'At ee94ac4, trying a profile routed it into an unchanged kart, while the header read equipped.profile only. The profile card and equipped header avatar consumed all 20 variants.',
    references: [
      'src/App.tsx:168-181',
      'src/App.tsx:340-352',
      'src/App.tsx:526',
      'src/components/Catalog.tsx:93-116',
    ],
  },
];
const rows = products.map((product) => {
  const config = customizationFor({ car: 'car-01' }, products, product);
  const liveKart = kartSnapshot(config);
  const liveGarage =
    product.category === 'garage' || product.category === 'decor' ? garageSnapshot(config) : null;
  const profile = product.category === 'profile' ? profileSnapshot(product) : null;
  const activeBoost = product.category === 'trail' ? kartSnapshot(config, true) : null;
  const target = liveGarage
    ? 'garage-scene'
    : profile
      ? 'actual-profile-card-dom'
      : activeBoost
        ? 'kart-during-boost'
        : 'visible-kart';
  const targetSignature = liveGarage || profile || activeBoost || liveKart;
  return {
    id: product.id,
    category: product.category,
    name: product.name,
    customization: config,
    intendedTarget: target,
    targetHash: targetSignature.hash,
    targetChangedFromBaseline: profile
      ? true
      : targetSignature.hash !==
        (liveGarage
          ? baseline.garage.hash
          : activeBoost
            ? baseline.boost.hash
            : baseline.kart.hash),
    unanimatedKartHash: liveKart.hash,
    unanimatedKartChangedFromBaseline: liveKart.hash !== baseline.kart.hash,
    changedFromFreeOrigin:
      product.category === 'car' ? liveKart.hash !== baseline.freeOrigin.hash : null,
    renderableKartObjects: liveKart.renderableObjects,
    textureAudit:
      product.category === 'decal' || product.category === 'plate' || product.category === 'garage'
        ? 'actual-painted-canvas-commands'
        : null,
    bundleMembers:
      product.bundle?.map((id) => ({
        id,
        resolved: products.some((member) => member.id === id),
      })) || null,
    profileArt: profile?.visibleArt || null,
    note:
      product.category === 'trail'
        ? 'Boost visibility is applied as Race does; Race particle color wiring is additionally source-verified.'
        : product.category === 'profile'
          ? 'Actual ProductArt DOM rendered by React SSR; equipped-header consumption additionally source-verified.'
          : null,
  };
});
const categories = [...new Set(products.map((product) => product.category))].map((category) => {
  const selected = rows.filter((row) => row.category === category);
  const groups = new Map<string, string[]>();
  for (const row of selected)
    groups.set(row.targetHash, [...(groups.get(row.targetHash) || []), row.id]);
  return {
    category,
    count: selected.length,
    uniqueTargetRenders: groups.size,
    duplicateGroups: [...groups.values()].filter((ids) => ids.length > 1),
    sameAsBaseline: selected.filter((row) => !row.targetChangedFromBaseline).map((row) => row.id),
    unchangedInUnanimatedKartSnapshot: selected
      .filter((row) => !row.unanimatedKartChangedFromBaseline)
      .map((row) => row.id),
  };
});
const sourcePaths = [
  'server/catalog.ts',
  'src/lib/customization.ts',
  'src/game/kart.ts',
  'src/game/garage.ts',
  'src/game/KartPreview.tsx',
  'src/game/Race.tsx',
  'src/game/ProductThumbnail.tsx',
  'src/components/Catalog.tsx',
  'src/App.tsx',
];
const sourceSha256 = Object.fromEntries(
  sourcePaths.map((path) => [
    path,
    createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex'),
  ]),
);
// This is a dated, manual source-review record, not a freshly discovered finding.
// Future reruns explicitly invalidate its currentness when App.tsx changes.
const previewRoutingReview = {
  id: 'preview-routing-2026-11-06',
  reviewedAt: '2026-11-06T11:35:09.257Z',
  baseCommit: 'ee94ac4',
  reviewedAppSha256: 'f785f0a43f13d634c205144ea6f654e40e81721c43fe4c3682f3fe0d3ca42440',
  resolution:
    'The profile/trail preview branch renders ProductArt(product=preview, products=products) and labels it ПРЕДПРОСМОТР; other products retain KartPreview.',
  reference: 'src/App.tsx:525-539',
  verification:
    'Manual source review of the conditional branch. This audit did not execute that App branch in a browser or compare pixels.',
  currentAppSha256: sourceSha256['src/App.tsx'],
  status:
    sourceSha256['src/App.tsx'] ===
    'f785f0a43f13d634c205144ea6f654e40e81721c43fe4c3682f3fe0d3ca42440'
      ? 'resolution-source-matches-reviewed-version'
      : 'App-source-changed-resolution-needs-re-review',
};
const automatedFindings = categories.flatMap((category) =>
  category.duplicateGroups.map((ids) => ({
    type: 'duplicate-render-target',
    category: category.category,
    ids,
  })),
);
const report = {
  generatedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: 'npx tsx docs/research/catalog-visual-audit.ts',
  method:
    'Real render builders, geometry/material/world transforms and recorded painted texture commands; actual profile card React SSR; hidden geometry and SKU metadata excluded.',
  limitations: [
    'No WebGL rasterization, screenshots, perceptual color-distance threshold, lighting/occlusion review, or 300-item manual before/after acceptance.',
    'Trail boost visibility is a declared Race-state snapshot. Runtime particle-color and equipped profile-header wiring were source-reviewed, not browser-executed here.',
    'Unanimated kart snapshots omit dynamic trail particles and profile/garage/decor UI. An unchanged kart hash does not by itself identify a current defect or prove which preview component App renders.',
    'observedEarlier contains dated manual observations, not findings rediscovered by this run. sourceReviews report whether the reviewed resolution matches the current App source hash.',
    'Comparisons isolate each SKU against a controlled car-01 base; matching colors across independently equipped categories can intentionally produce the same appearance in some combinations.',
    'Different painted command streams are structural evidence of different textures, not a pixel-level equivalence proof.',
    'car-01 is the controlled base for isolating accessory effects. Therefore car-01 alone is identical to this audit baseline, not to the free Origin.',
  ],
  sourceSha256,
  sourceWorkingTreeChanges: execFileSync('git', ['diff', '--name-only', '--', ...sourcePaths], {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean),
  totalSku: rows.length,
  uniqueTargetRenders: new Set(rows.map((row) => row.targetHash)).size,
  categories,
  automatedFindings,
  observedEarlier,
  sourceReviews: [previewRoutingReview],
  baseline,
  products: rows,
};
const outputPath = resolve(root, 'docs/research/catalog-visual-audit.json');
writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      output: 'docs/research/catalog-visual-audit.json',
      commit: report.commit,
      totalSku: rows.length,
      uniqueTargetRenders: report.uniqueTargetRenders,
      categories: categories.map(({ category, count, uniqueTargetRenders, duplicateGroups }) => ({
        category,
        count,
        uniqueTargetRenders,
        duplicateGroups,
      })),
      automatedFindings,
      observedEarlier: observedEarlier.map((observation) => observation.id),
      previewRoutingReviewStatus: previewRoutingReview.status,
    },
    null,
    2,
  ),
);
if (rows.length !== 300 || categories.some((category) => category.duplicateGroups.length))
  process.exitCode = 1;
