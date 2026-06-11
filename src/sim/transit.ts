import * as THREE from 'three';
import { World, RouteData, SystemId } from '../geo/world';
import { SYSTEMS } from '../geo/systems';

// Dummy vehicle simulator over real route geometry. The public surface
// (VehicleInfo / poses keyed by vehicle id) is shaped like a GTFS-realtime
// VehiclePosition feed so a real 511.org feed can be swapped in later.

const SURFACE_LIFT = 0.3;
const BRIDGE_DECK_Y = 2.6;
const VEHICLE_LIFT: Record<SystemId, number> = {
  bus: 0.34,
  metro: 0.32,
  streetcar: 0.33,
  cable: 0.32,
  bart: 0,
  ferry: 0,
};
const SYS_MPH = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.mph]));

export interface RouteRuntime {
  def: RouteData;
  curve: THREE.CatmullRomCurve3;
  length: number;
  points: THREE.Vector3[];
  stops: { t: number; name: string }[];
}

export interface VehicleSim {
  id: string;
  label: string;
  route: RouteRuntime;
  t: number;
  dir: 1 | -1;
  dwell: number;
  nextStop: number;
}

export interface VehicleInfo {
  id: string;
  label: string;
  system: SystemId;
  routeName: string;
  speedMph: number;
  nextStop: string;
  dwelling: boolean;
}

/** Per-point path height: drape on terrain, but carry bridges over water
 *  spans and sink BART below grade. */
function pathYs(world: World, def: RouteData): number[] {
  const ys: number[] = [];
  if (def.system === 'ferry') return def.pts.map(() => 0.12);
  if (def.system === 'bart') {
    for (const [x, z] of def.pts) ys.push(Math.max(world.sceneH(x, z) - 1.6, -2.4));
  } else {
    // neighborhood max so vehicles never sink below the flat-shaded terrain
    // triangles, which can sit above the bilinear height between samples
    const ground = (x: number, z: number) =>
      Math.max(
        world.sceneH(x, z),
        world.sceneH(x + 0.7, z),
        world.sceneH(x - 0.7, z),
        world.sceneH(x, z + 0.7),
        world.sceneH(x, z - 0.7),
      );
    // raw drape with water spans marked
    const raw = def.pts.map(([x, z]) => (world.isWater(x, z) ? NaN : ground(x, z) + SURFACE_LIFT));
    // bridge spans: interpolate across NaN runs with a minimum deck height
    let i = 0;
    while (i < raw.length) {
      if (!Number.isNaN(raw[i])) {
        ys.push(raw[i]);
        i++;
        continue;
      }
      const start = i;
      while (i < raw.length && Number.isNaN(raw[i])) i++;
      const a = start > 0 ? ys[start - 1] : BRIDGE_DECK_Y;
      const b = i < raw.length ? raw[i] : BRIDGE_DECK_Y;
      const n = i - start;
      for (let k = 0; k < n; k++) {
        const s = (k + 1) / (n + 1);
        ys.push(Math.max(a + (b - a) * s, BRIDGE_DECK_Y));
      }
    }
  }
  // smooth so ramps onto bridges/hills aren't jagged
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 1; j < ys.length - 1; j++) ys[j] = (ys[j - 1] + ys[j] * 2 + ys[j + 1]) / 4;
  }
  return ys;
}

function buildRuntime(world: World, def: RouteData): RouteRuntime {
  const ys = pathYs(world, def);
  const points = def.pts.map(([x, z], i) => new THREE.Vector3(x, ys[i], z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  return { def, curve, length: curve.getLength(), points, stops: def.stops };
}

export const routeRuntimes: RouteRuntime[] = [];
export const vehicles: VehicleSim[] = [];
const byId = new Map<string, VehicleSim>();

function firstStopAhead(rt: RouteRuntime, t: number, dir: 1 | -1): number {
  if (dir === 1) {
    for (let i = 0; i < rt.stops.length; i++) if (rt.stops[i].t > t + 1e-4) return i;
    return rt.stops.length - 1;
  }
  for (let i = rt.stops.length - 1; i >= 0; i--) if (rt.stops[i].t < t - 1e-4) return i;
  return 0;
}

export function initTransit(world: World): void {
  routeRuntimes.length = 0;
  vehicles.length = 0;
  byId.clear();
  let serial = 1042;
  for (const def of world.routes) {
    const rt = buildRuntime(world, def);
    routeRuntimes.push(rt);
    for (let i = 0; i < def.vehicles; i++) {
      const t = (i + 0.5) / def.vehicles;
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      serial += 137 + ((serial * 7) % 90);
      const v: VehicleSim = {
        id: `${def.id}-${i}`,
        label: `#${serial}`,
        route: rt,
        t,
        dir,
        dwell: 0,
        nextStop: firstStopAhead(rt, t, dir),
      };
      vehicles.push(v);
      byId.set(v.id, v);
    }
  }
}

export function advance(dt: number): void {
  for (const v of vehicles) {
    if (v.dwell > 0) {
      v.dwell -= dt;
      continue;
    }
    const rt = v.route;
    v.t += (v.dir * rt.def.speed * dt) / rt.length;
    if (v.t >= 1 || v.t <= 0) {
      v.t = THREE.MathUtils.clamp(v.t, 0, 1);
      v.dir = (v.dir * -1) as 1 | -1;
      v.dwell = 3 + Math.random() * 2;
      v.nextStop = firstStopAhead(rt, v.t, v.dir);
      continue;
    }
    const stop = rt.stops[v.nextStop];
    if (stop && ((v.dir === 1 && v.t >= stop.t) || (v.dir === -1 && v.t <= stop.t))) {
      v.dwell = 1.5 + Math.random() * 1.5;
      v.nextStop = firstStopAhead(rt, v.t, v.dir);
    }
  }
}

const tmpTarget = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3(0, 0, 0);

export function poseCar(
  v: VehicleSim,
  carIdx: number,
  carLength: number,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
): void {
  const lift = VEHICLE_LIFT[v.route.def.system as SystemId];
  const back = (carIdx * carLength) / v.route.length;
  const t = THREE.MathUtils.clamp(v.t - v.dir * back, 0.0001, 0.9999);
  v.route.curve.getPointAt(t, outPos);
  outPos.y += lift;
  const tan = v.route.curve.getTangentAt(t, tmpTarget).multiplyScalar(v.dir);
  // Matrix4.lookAt builds +Z = eye - target, so eye=tangent points the
  // vehicle's nose (+Z in model space) along the direction of travel.
  tmpMat.lookAt(tan, ZERO, UP);
  outQuat.setFromRotationMatrix(tmpMat);
}

const quatCache = new THREE.Quaternion();

export function positionOf(id: string, out: THREE.Vector3): boolean {
  const v = byId.get(id);
  if (!v) return false;
  poseCar(v, 0, 0, out, quatCache);
  return true;
}

export function infoOf(id: string): VehicleInfo | null {
  const v = byId.get(id);
  if (!v) return null;
  const sys = v.route.def.system as SystemId;
  const stop = v.route.stops[v.nextStop];
  return {
    id: v.id,
    label: v.label,
    system: sys,
    routeName: v.route.def.name,
    speedMph: v.dwell > 0 ? 0 : SYS_MPH[sys],
    nextStop: stop ? stop.name : 'End of line',
    dwelling: v.dwell > 0,
  };
}
