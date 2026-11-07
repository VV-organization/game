// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createLiveryTextures } from './liveries';
import { liveryDesigns } from '../shared/livery-designs';

type Command = [string, ...unknown[]];
const drawings = new WeakMap<HTMLCanvasElement, Command[]>();

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    const commands: Command[] = [];
    drawings.set(this, commands);
    return new Proxy(
      {},
      {
        get:
          (_target, name) =>
          (...args: unknown[]) =>
            commands.push([String(name), ...args]),
        set: (_target, name, value) => {
          commands.push([`set:${String(name)}`, value]);
          return true;
        },
      },
    ) as CanvasRenderingContext2D;
  });
});
afterEach(() => vi.restoreAllMocks());

function commands(texture: THREE.CanvasTexture) {
  return drawings.get(texture.image as HTMLCanvasElement)!;
}

function shape(texture: THREE.CanvasTexture) {
  // Ignore color differences: a new edition must contain genuinely different drawn geometry.
  return JSON.stringify(commands(texture).filter(([name]) => !name.startsWith('set:')));
}

describe('authored vehicle liveries', () => {
  it('creates forty different hood and side compositions with complete catalog descriptions', () => {
    const hoods = new Set<string>(),
      sides = new Set<string>();
    expect(liveryDesigns).toHaveLength(40);
    for (let variant = 1; variant <= 40; variant++) {
      const { hood, side } = createLiveryTextures(variant);
      expect(liveryDesigns[variant - 1].variant).toBe(variant);
      expect(liveryDesigns[variant - 1].description.length).toBeGreaterThan(45);
      expect(hood.image.width).toBe(512);
      expect(hood.image.height).toBe(512);
      expect(side.image.width).toBe(1024);
      expect(side.image.height).toBe(256);
      for (const texture of [hood, side]) {
        const drawing = commands(texture);
        expect(
          drawing.filter(([name]) => name === 'fill' || name === 'stroke').length,
        ).toBeGreaterThan(4);
        expect(
          drawing.flatMap(([, ...args]) => args).filter((value) => typeof value === 'number'),
        ).toSatisfy((values: number[]) => values.every(Number.isFinite));
        expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
        expect(texture.flipY).toBe(true);
        expect(texture.version).toBeGreaterThan(0);
      }
      hoods.add(shape(hood));
      sides.add(shape(side));
      expect(shape(hood)).not.toBe(shape(side));
      hood.dispose();
      side.dispose();
    }
    expect(hoods.size).toBe(40);
    expect(sides.size).toBe(40);
  });

  it('retains the same twenty themes in each edition and gives Pro new shapes', () => {
    for (let variant = 1; variant <= 20; variant++) {
      expect(liveryDesigns[variant - 1].theme).toBe(liveryDesigns[variant + 19].theme);
      expect(liveryDesigns[variant - 1].edition).toBe('Sport');
      expect(liveryDesigns[variant + 19].edition).toBe('Pro');
      const sport = createLiveryTextures(variant),
        pro = createLiveryTextures(variant + 20);
      expect(shape(sport.hood)).not.toBe(shape(pro.hood));
      expect(shape(sport.side)).not.toBe(shape(pro.side));
    }
  });

  it.each([0, -1, 41, 1.5, NaN, Infinity])('falls back to the first design for %s', (variant) => {
    const fallback = createLiveryTextures(variant),
      first = createLiveryTextures(1);
    expect(commands(fallback.hood)).toEqual(commands(first.hood));
    expect(commands(fallback.side)).toEqual(commands(first.side));
  });

  it('keeps the factory paint visible and does not share disposable textures or canvases', () => {
    for (let variant = 1; variant <= 40; variant++) {
      const first = createLiveryTextures(variant),
        second = createLiveryTextures(variant);
      for (const face of ['hood', 'side'] as const) {
        expect(first[face]).not.toBe(second[face]);
        expect(first[face].image).not.toBe(second[face].image);
        // Artwork consists of open-area decals; never paint a full opaque rectangular base.
        expect(commands(first[face]).some(([name]) => name === 'fillRect')).toBe(false);
        expect(commands(first[face]).some(([name]) => name === 'fillText')).toBe(false);
      }
    }
  });
});
