// @vitest-environment happy-dom
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createKart, disposeScene } from './kart';

beforeAll(() => {
  // Canvas paint is irrelevant to physical fit; retain real Three.js geometry and transforms.
  const context = new Proxy({}, { get: () => () => {}, set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as CanvasRenderingContext2D,
  );
});
afterAll(() => vi.restoreAllMocks());

describe('body kit vehicle compatibility', () => {
  it.each([-1, 21, 1.5, Infinity])('keeps factory aero when body variant %s is invalid', (body) => {
    const model = createKart({ car: 2, body });
    expect(model.getObjectByName('stock-front-wing')?.visible).toBe(true);
    expect(model.getObjectByName('stock-rear-wing')?.visible).toBe(true);
    expect(model.getObjectByName('body-kit')).toBeUndefined();
    disposeScene(model);
  });

  it.each([3, 6, 14])('fits kit %i above the real curved Stellar fenders', (body) => {
    const model = createKart({ car: 5, body });
    model.updateMatrixWorld(true);
    const kit = model.getObjectByName('body-kit')!;
    const factory: THREE.Mesh[] = [],
      panels: THREE.Mesh[] = [];
    model.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if ((object.material as THREE.Material).name === 'vehicle-paint') factory.push(object);
    });
    kit.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        (object.material as THREE.Material).name === 'body-kit-paint'
      )
        panels.push(object);
    });
    const ray = new THREE.Raycaster();
    for (const side of [-1, 1])
      for (const axle of [-1.12, 1.22])
        for (const dx of [-0.2, 0, 0.2])
          for (const dz of [-0.3, 0, 0.3]) {
            const x = side * 0.99 + dx,
              z = axle + dz;
            ray.set(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
            const shellTop = ray.intersectObjects(factory, false)[0]?.point.y;
            ray.set(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 1, 0));
            const panelBottom = ray.intersectObjects(panels, false)[0]?.point.y;
            expect(shellTop).toBeDefined();
            expect(panelBottom).toBeDefined();
            expect(panelBottom! - shellTop!, `body ${body}, x=${x}, z=${z}`).toBeGreaterThan(0.02);
          }
    disposeScene(model);
  });

  it('does not project livery onto removed factory wings', () => {
    let queriedHidden = 0;
    const original = THREE.Raycaster.prototype.intersectObjects;
    const raycasts = vi
      .spyOn(THREE.Raycaster.prototype, 'intersectObjects')
      .mockImplementation(function (this: THREE.Raycaster, objects, recursive, target) {
        for (const object of objects) {
          for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent)
            if (!parent.visible) queriedHidden++;
        }
        return original.call(this, objects, recursive, target);
      });
    const model = createKart({ car: 2, body: 4, decal: 40 });
    raycasts.mockRestore();
    expect(model.getObjectByName('stock-front-wing')?.visible).toBe(false);
    expect(model.getObjectByName('stock-rear-wing')?.visible).toBe(false);
    expect(queriedHidden).toBe(0);
    disposeScene(model);
  });
  it.each(Array.from({ length: 11 }, (_, car) => car))(
    'fits all twenty kits on car %i without changing racing handles',
    (car) => {
      for (let body = 1; body <= 20; body++) {
        const model = createKart({ car, body, color: '#888888' });
        const kit = model.getObjectByName('body-kit');
        expect(kit, `car ${car}, body ${body}`).toBeInstanceOf(THREE.Group);
        expect(model.userData.wheels).toHaveLength(4);
        expect(model.userData.frontWheels).toHaveLength(2);
        expect(model.userData.exhaust).toHaveLength(2);
        expect(model.userData.driver.parent).toBe(model);
        expect(model.userData.shield.visible).toBe(false);
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(kit!);
        const size = bounds.getSize(new THREE.Vector3());
        expect(size.x, `car ${car}, body ${body} width`).toBeLessThanOrEqual(3.31);
        expect(size.z, `car ${car}, body ${body} length`).toBeLessThanOrEqual(5.51);
        kit!.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          expect([...object.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
          expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        });
        disposeScene(model);
      }
    },
  );

  it('preserves the divided Nova nose with every kit', () => {
    for (let body = 1; body <= 20; body++) {
      const model = createKart({ car: 9, body });
      model.updateMatrixWorld(true);
      const kit = model.getObjectByName('body-kit');
      expect(kit).toBeDefined();
      kit!.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.attributes.position;
        const point = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
          if (point.z > 0.65)
            expect(Math.abs(point.x), `body ${body}: Nova center gap`).toBeGreaterThanOrEqual(0.29);
        }
      });
      disposeScene(model);
    }
  });

  it('keeps kit surfaces outside the tires at full left and right steering', () => {
    const collisions: string[] = [];
    for (let car = 0; car <= 10; car++)
      for (let body = 1; body <= 20; body++) {
        const model = createKart({ car, body });
        model.updateMatrixWorld(true);
        let collided = false;
        model.getObjectByName('body-kit')!.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || collided) return;
          const positions = object.geometry.attributes.position;
          const point = new THREE.Vector3();
          for (let i = 0; i < positions.count && !collided; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            for (const wheel of model.userData.wheels) {
              const tire = wheel.children[0] as THREE.Mesh<THREE.CylinderGeometry>;
              const { radiusTop: radius, height: tireWidth } = tire.geometry.parameters;
              for (const yaw of model.userData.frontWheels.includes(wheel)
                ? [-0.35, 0, 0.35]
                : [0]) {
                const dx = point.x - wheel.position.x,
                  dz = point.z - wheel.position.z;
                const x = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
                const z = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
                if (
                  Math.abs(x) < tireWidth / 2 + 0.015 &&
                  Math.hypot(point.y - wheel.position.y, z) < radius + 0.015
                ) {
                  collisions.push(
                    `car ${car}, body ${body}, ${object.geometry.type} at ${point
                      .toArray()
                      .map((n) => n.toFixed(2))
                      .join(',')}`,
                  );
                  collided = true;
                  break;
                }
              }
              if (collided) break;
            }
          }
        });
        disposeScene(model);
      }
    expect(collisions).toEqual([]);
  });
});
