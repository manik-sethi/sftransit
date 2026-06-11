import * as THREE from 'three';
import { world, SystemId } from '../geo/world';
import { useApp } from './store';

// Live vehicle layer: polls our /api/vehicles proxy (which holds the 511.org
// token server-side), projects real lat/lon onto the scene, and smoothly
// interpolates between updates. Poll intervals are budgeted to stay inside
// 511's default 60 requests/hour quota.

const POLLS: { agency: string; everyMs: number }[] = [
  { agency: 'SF', everyMs: 150_000 }, // Muni — ~24 req/hr
  { agency: 'BA', everyMs: 240_000 }, // BART — ~15 req/hr
  { agency: 'GF', everyMs: 900_000 }, // ferries — ~4 req/hr each
  { agency: 'SB', everyMs: 900_000 },
];

const CABLE_LINES = new Set(['59', '60', '61', 'PH', 'PM', 'C']);

function classify(agency: string, line: string | null): SystemId {
  if (agency === 'BA') return 'bart';
  if (agency === 'GF' || agency === 'SB') return 'ferry';
  if (agency === 'GG') return 'bus';
  if (!line) return 'bus';
  if (CABLE_LINES.has(line)) return 'cable';
  if (/^(F|E)/.test(line) && line.length <= 4) return 'streetcar';
  if (/^(J|K|L|M|N|T|S)(BUS|OWL)?$/.test(line)) return 'metro';
  return 'bus';
}

export interface LiveVehicle {
  key: string;
  agency: string;
  ref: string;
  system: SystemId;
  line: string | null;
  name: string | null;
  dest: string | null;
  occ: string | null;
  recordedAt: number;
  lastSeen: number;
  // scene-space position (current, smoothed) and target from latest poll
  x: number;
  z: number;
  tx: number;
  tz: number;
  heading: number;
}

export const liveVehicles = new Map<string, LiveVehicle>();
export const liveStatus = {
  ok: false,
  everConnected: false,
  lastUpdate: 0,
  count: 0,
  error: '' as string | null,
};

function vehicleY(v: { system: SystemId; x: number; z: number }): number {
  if (v.system === 'ferry') return 0.12;
  if (v.system === 'bart') return Math.max(world.sceneH(v.x, v.z) - 1.6, -2.4);
  const g = Math.max(
    world.sceneH(v.x, v.z),
    world.sceneH(v.x + 0.7, v.z),
    world.sceneH(v.x - 0.7, v.z),
    world.sceneH(v.x, v.z + 0.7),
    world.sceneH(v.x, v.z - 0.7),
  );
  return g + 0.62;
}

async function poll(agency: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/vehicles?agency=${agency}`);
  } catch {
    liveStatus.error = 'network error';
    if (!liveStatus.everConnected) useApp.getState().setMode('demo');
    return;
  }
  if (!res.ok) {
    liveStatus.error = res.status === 503 ? 'no API token' : `proxy ${res.status}`;
    if (!liveStatus.everConnected && agency === 'SF') useApp.getState().setMode('demo');
    return;
  }
  const data = (await res.json()) as {
    vehicles: { id: string; lat: number; lon: number; bearing: number; line: string | null; name: string | null; dest: string | null; occ: string | null; at: string | null }[];
  };
  const now = Date.now();
  for (const raw of data.vehicles) {
    const [x, z] = world.toXZ(raw.lat, raw.lon);
    const m = world.meta;
    if (x < m.xmin || x > m.xmax || z < m.zmin || z > m.zmax) continue;
    const key = `${agency}:${raw.id}`;
    const existing = liveVehicles.get(key);
    if (existing) {
      existing.tx = x;
      existing.tz = z;
      existing.line = raw.line;
      existing.name = raw.name;
      existing.dest = raw.dest;
      existing.occ = raw.occ;
      existing.system = classify(agency, raw.line);
      existing.recordedAt = raw.at ? Date.parse(raw.at) : now;
      existing.lastSeen = now;
    } else {
      liveVehicles.set(key, {
        key,
        agency,
        ref: raw.id,
        system: classify(agency, raw.line),
        line: raw.line,
        name: raw.name,
        dest: raw.dest,
        occ: raw.occ,
        recordedAt: raw.at ? Date.parse(raw.at) : now,
        lastSeen: now,
        x,
        z,
        tx: x,
        tz: z,
        // compass bearing (cw from north) -> scene yaw (north = -z, east = +x)
        heading: Math.PI - (raw.bearing * Math.PI) / 180,
      });
    }
  }
  // prune vehicles that vanished from their agency's feed
  const ttl = (POLLS.find((p) => p.agency === agency)?.everyMs ?? 300_000) * 2.5;
  for (const [key, v] of liveVehicles) {
    if (v.agency === agency && now - v.lastSeen > ttl) liveVehicles.delete(key);
  }
  liveStatus.ok = true;
  liveStatus.everConnected = true;
  liveStatus.error = null;
  liveStatus.lastUpdate = now;
  liveStatus.count = liveVehicles.size;
}

let timers: ReturnType<typeof setInterval>[] = [];

export function startLive(): void {
  if (timers.length) return;
  POLLS.forEach((p, i) => {
    setTimeout(() => void poll(p.agency), i * 1500); // stagger initial fetches
    timers.push(setInterval(() => void poll(p.agency), p.everyMs));
  });
}

export function stopLive(): void {
  timers.forEach(clearInterval);
  timers = [];
}

/** Per-frame smoothing toward the latest reported position. */
export function tickLive(dt: number): void {
  const k = 1 - Math.exp(-dt * 0.15); // ~halfway in ~5s — gentle glide
  for (const v of liveVehicles.values()) {
    const dx = v.tx - v.x;
    const dz = v.tz - v.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 12) {
      // big jump (vehicle reassigned / first fix) — snap instead of glide
      v.x = v.tx;
      v.z = v.tz;
    } else if (dist > 0.02) {
      v.x += dx * k;
      v.z += dz * k;
      v.heading = Math.atan2(dx, dz);
    }
  }
}

export function livePositionOf(key: string, out: THREE.Vector3): boolean {
  const v = liveVehicles.get(key);
  if (!v) return false;
  out.set(v.x, vehicleY(v), v.z);
  return true;
}

export { vehicleY as liveVehicleY };

export interface LiveInfo {
  system: SystemId;
  line: string;
  dest: string;
  occ: string | null;
  ref: string;
  ageSec: number;
}

const OCC_LABEL: Record<string, string> = {
  seatsAvailable: 'seats available',
  standingAvailable: 'standing room',
  full: 'full',
};

export function liveInfoOf(key: string): LiveInfo | null {
  const v = liveVehicles.get(key);
  if (!v) return null;
  return {
    system: v.system,
    line: v.name || v.line || (v.system === 'bart' ? 'BART' : 'Muni'),
    dest: v.dest || '—',
    occ: v.occ ? (OCC_LABEL[v.occ] ?? v.occ) : null,
    ref: v.ref,
    ageSec: Math.max(0, Math.round((Date.now() - v.recordedAt) / 1000)),
  };
}
