// Loads the baked real-geography assets (see scripts/fetch-data.mjs) and
// exposes terrain/park/road sampling for the whole app. loadWorld() must
// resolve before any scene component renders.

export interface RouteData {
  id: string;
  system: SystemId;
  name: string;
  speed: number;
  vehicles: number;
  cars?: number;
  pts: [number, number][];
  stops: { t: number; name: string }[];
}

export interface RoadsData {
  major: [number, number][][];
  mid: [number, number][][];
  minor: [number, number][][];
}

export type SystemId = 'bus' | 'metro' | 'streetcar' | 'bart' | 'cable' | 'ferry';

interface Meta {
  bbox: { s: number; w: number; n: number; e: number };
  lat0: number;
  lon0: number;
  mLat: number;
  mLon: number;
  scale: number;
  exagg: number;
  gw: number;
  gh: number;
  gw2: number;
  gh2: number;
  xmin: number;
  xmax: number;
  zmin: number;
  zmax: number;
}

const WATER_M = 0.5; // elevation (meters) below which we call it water

export class World {
  meta: Meta;
  private hm: Int16Array; // quarter-meters
  private green: Uint8Array;
  roads: RoadsData;
  routes: RouteData[];
  /** sparse hash of road points for "near a street" queries; cell -> dir */
  private roadCells = new Map<number, { x: number; z: number; dx: number; dz: number }>();
  private cell = 1.2;

  constructor(meta: Meta, hm: Int16Array, green: Uint8Array, roads: RoadsData, routes: RouteData[]) {
    this.meta = meta;
    this.hm = hm;
    this.green = green;
    this.roads = roads;
    this.routes = routes;
    for (const cls of ['mid', 'minor', 'major'] as const) {
      for (const line of roads[cls]) {
        for (let i = 0; i < line.length; i++) {
          const [x, z] = line[i];
          const [nx, nz] = line[Math.min(i + 1, line.length - 1)];
          const key = this.cellKey(x, z);
          if (!this.roadCells.has(key)) {
            const len = Math.hypot(nx - x, nz - z) || 1;
            this.roadCells.set(key, { x, z, dx: (nx - x) / len, dz: (nz - z) / len });
          }
        }
      }
    }
  }

  toXZ(lat: number, lon: number): [number, number] {
    const m = this.meta;
    return [((lon - m.lon0) * m.mLon) / m.scale, ((m.lat0 - lat) * m.mLat) / m.scale];
  }

  private cellKey(x: number, z: number): number {
    const cx = Math.floor((x - this.meta.xmin) / this.cell);
    const cz = Math.floor((z - this.meta.zmin) / this.cell);
    return cz * 8192 + cx;
  }

  /** real elevation in meters, bilinear */
  heightMeters(x: number, z: number): number {
    const m = this.meta;
    const fx = ((x - m.xmin) / (m.xmax - m.xmin)) * m.gw - 0.5;
    const fz = ((z - m.zmin) / (m.zmax - m.zmin)) * m.gh - 0.5;
    const x0 = Math.max(0, Math.min(m.gw - 2, Math.floor(fx)));
    const z0 = Math.max(0, Math.min(m.gh - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - x0));
    const tz = Math.max(0, Math.min(1, fz - z0));
    const a = this.hm[z0 * m.gw + x0];
    const b = this.hm[z0 * m.gw + x0 + 1];
    const c = this.hm[(z0 + 1) * m.gw + x0];
    const d = this.hm[(z0 + 1) * m.gw + x0 + 1];
    return (a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz) / 4;
  }

  /** scene-space terrain height with vertical exaggeration & shore blend */
  sceneH(x: number, z: number): number {
    const hm = this.heightMeters(x, z);
    const land = 0.35 + Math.max(hm, 0) * (this.meta.exagg / this.meta.scale);
    const t = Math.max(0, Math.min(1, hm / 1.4));
    const s = t * t * (3 - 2 * t);
    return -1.8 * (1 - s) + land * s;
  }

  isWater(x: number, z: number): boolean {
    return this.heightMeters(x, z) < WATER_M;
  }

  isGreen(x: number, z: number): boolean {
    const m = this.meta;
    const gx = Math.round(((x - m.xmin) / (m.xmax - m.xmin)) * m.gw2);
    const gz = Math.round(((z - m.zmin) / (m.zmax - m.zmin)) * m.gh2);
    if (gx < 0 || gz < 0 || gx >= m.gw2 || gz >= m.gh2) return false;
    return this.green[gz * m.gw2 + gx] === 1;
  }

  /** random point inside a park (for tree scatter), or null */
  randomGreenPoint(): [number, number] | null {
    const m = this.meta;
    for (let i = 0; i < 30; i++) {
      const gx = Math.floor(Math.random() * m.gw2);
      const gz = Math.floor(Math.random() * m.gh2);
      if (this.green[gz * m.gw2 + gx] === 1) {
        return [
          m.xmin + ((gx + Math.random()) / m.gw2) * (m.xmax - m.xmin),
          m.zmin + ((gz + Math.random()) / m.gh2) * (m.zmax - m.zmin),
        ];
      }
    }
    return null;
  }

  /** distance + direction of the nearest road point within ~2 cells */
  nearestRoad(x: number, z: number): { dist: number; dx: number; dz: number } | null {
    const cx = Math.floor((x - this.meta.xmin) / this.cell);
    const cz = Math.floor((z - this.meta.zmin) / this.cell);
    let best: { dist: number; dx: number; dz: number } | null = null;
    for (let oz = -2; oz <= 2; oz++) {
      for (let ox = -2; ox <= 2; ox++) {
        const e = this.roadCells.get((cz + oz) * 8192 + (cx + ox));
        if (!e) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (!best || d < best.dist) best = { dist: d, dx: e.dx, dz: e.dz };
      }
    }
    return best;
  }
}

export let world: World;

export async function loadWorld(): Promise<World> {
  const base = import.meta.env.BASE_URL + 'data/';
  const [meta, terrainBuf, greenBuf, roads, routes] = await Promise.all([
    fetch(base + 'meta.json').then((r) => r.json()),
    fetch(base + 'terrain.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'green.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'roads.json').then((r) => r.json()),
    fetch(base + 'routes.json').then((r) => r.json()),
  ]);
  world = new World(meta, new Int16Array(terrainBuf), new Uint8Array(greenBuf), roads, routes);
  return world;
}
