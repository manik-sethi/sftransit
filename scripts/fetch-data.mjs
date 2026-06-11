// Build-time data pipeline: fetches real SF geography from public, key-less
// sources and bakes it into static assets under public/data/.
//   - Elevation: AWS Open Data terrarium tiles (Mapzen/Tilezen)
//   - Roads, parks, transit routes: OpenStreetMap via Overpass API
// Run: node scripts/fetch-data.mjs

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const OUT = path.join(import.meta.dirname, '..', 'public', 'data');
fs.mkdirSync(OUT, { recursive: true });

// ——— geography ———
const BBOX = { s: 37.7, w: -122.53, n: 37.87, e: -122.28 };
const LAT0 = (BBOX.s + BBOX.n) / 2;
const LON0 = (BBOX.w + BBOX.e) / 2;
const M_LAT = 111320;
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const SCALE = 50; // meters per scene unit

const toXZ = (lat, lon) => [((lon - LON0) * M_LON) / SCALE, ((LAT0 - lat) * M_LAT) / SCALE];
const [XMIN, ZMAX] = toXZ(BBOX.s, BBOX.w);
const [XMAX, ZMIN] = toXZ(BBOX.n, BBOX.e);

const UA = 'sf-transit-3d-hobby-viz/0.1 (one-time build-time fetch)';

async function get(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function overpass(query) {
  let lastErr;
  for (const ep of OVERPASS) {
    try {
      const res = await get(ep, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return await res.json();
    } catch (e) {
      lastErr = e;
      console.warn(`  overpass ${ep} failed: ${e.message}; trying next`);
    }
  }
  throw lastErr;
}

const bb = `(${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e})`;

// ——— helpers ———

/** Decimate a polyline of [x,z] to a minimum spacing (keeps endpoints). */
function decimate(pts, minDist = 0.5) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(pts[i][0] - last[0], pts[i][1] - last[1]) >= minDist) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const r2 = (v) => Math.round(v * 100) / 100;
const inMap = (x, z, m = 4) => x > XMIN - m && x < XMAX + m && z > ZMIN - m && z < ZMAX + m;

function lineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// ═══════════════ 1. Elevation ═══════════════

const Z = 12;
const N_TILES = 2 ** Z;
const lon2tx = (lon) => ((lon + 180) / 360) * N_TILES;
const lat2ty = (lat) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * N_TILES;
};

async function buildElevation() {
  console.log('1/4 elevation tiles…');
  const tx0 = Math.floor(lon2tx(BBOX.w));
  const tx1 = Math.floor(lon2tx(BBOX.e));
  const ty0 = Math.floor(lat2ty(BBOX.n));
  const ty1 = Math.floor(lat2ty(BBOX.s));
  const cols = tx1 - tx0 + 1;
  const rows = ty1 - ty0 + 1;
  const stitched = new Float32Array(cols * 256 * rows * 256);
  const W = cols * 256;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`;
      const buf = Buffer.from(await (await get(url)).arrayBuffer());
      const png = PNG.sync.read(buf);
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const i = (y * 256 + x) * 4;
          const h = png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
          stitched[(ty - ty0) * 256 * W + y * W + (tx - tx0) * 256 + x] = h;
        }
      }
      process.stdout.write('.');
    }
  }
  console.log(' stitched');

  const sample = (lat, lon) => {
    const px = lon2tx(lon) * 256 - tx0 * 256;
    const py = lat2ty(lat) * 256 - ty0 * 256;
    const x0 = Math.max(0, Math.min(W - 2, Math.floor(px)));
    const y0 = Math.max(0, Math.min(rows * 256 - 2, Math.floor(py)));
    const fx = px - x0;
    const fy = py - y0;
    const a = stitched[y0 * W + x0];
    const b = stitched[y0 * W + x0 + 1];
    const c = stitched[(y0 + 1) * W + x0];
    const d = stitched[(y0 + 1) * W + x0 + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  };

  const GW = 640;
  const GH = 560;
  const grid = new Int16Array(GW * GH);
  for (let j = 0; j < GH; j++) {
    const lat = BBOX.n - ((j + 0.5) / GH) * (BBOX.n - BBOX.s);
    for (let i = 0; i < GW; i++) {
      const lon = BBOX.w + ((i + 0.5) / GW) * (BBOX.e - BBOX.w);
      grid[j * GW + i] = Math.round(sample(lat, lon) * 4); // quarter-meter units
    }
  }
  fs.writeFileSync(path.join(OUT, 'terrain.bin'), Buffer.from(grid.buffer));
  console.log(`  terrain.bin ${GW}x${GH}`);
  return { GW, GH };
}

// ═══════════════ 2. Roads ═══════════════

const CLASS_OF = (hw) => {
  if (/^(motorway|trunk|primary)/.test(hw)) return 'major';
  if (/^(secondary|tertiary)/.test(hw)) return 'mid';
  return 'minor';
};

async function buildRoads() {
  console.log('2/4 roads (overpass, this one is big)…');
  const q = `[out:json][timeout:300];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|pedestrian)$"]${bb};
out geom;`;
  const data = await overpass(q);
  const out = { major: [], mid: [], minor: [] };
  const namedPts = []; // [x, z, streetName] — used to auto-name bus stops
  let pts = 0;
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    const line = decimate(
      el.geometry.map((g) => toXZ(g.lat, g.lon)),
      0.5,
    ).map(([x, z]) => [r2(x), r2(z)]);
    if (line.length < 2 || !line.some(([x, z]) => inMap(x, z))) continue;
    out[CLASS_OF(el.tags.highway)].push(line);
    pts += line.length;
    if (el.tags.name) {
      for (let i = 0; i < line.length; i += 3) namedPts.push([line[i][0], line[i][1], el.tags.name]);
    }
  }
  fs.writeFileSync(path.join(OUT, 'roads.json'), JSON.stringify(out));
  console.log(`  roads.json: ${out.major.length} major / ${out.mid.length} mid / ${out.minor.length} minor ways, ${pts} pts`);
  return namedPts;
}

// ═══════════════ 3. Parks / green ═══════════════

function stitchRings(segments, tol = 0.004) {
  // join open way fragments (outer rings of relations) into closed rings
  const segs = segments.filter((s) => s.length >= 2);
  const rings = [];
  const used = new Array(segs.length).fill(false);
  const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let ring = [...segs[i]];
    let guard = 0;
    while (!close(ring[0], ring[ring.length - 1]) && guard++ < segs.length + 2) {
      const tail = ring[ring.length - 1];
      let found = -1;
      let rev = false;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (close(segs[j][0], tail)) {
          found = j;
          break;
        }
        if (close(segs[j][segs[j].length - 1], tail)) {
          found = j;
          rev = true;
          break;
        }
      }
      if (found < 0) break;
      used[found] = true;
      const add = rev ? [...segs[found]].reverse() : segs[found];
      ring = ring.concat(add.slice(1));
    }
    if (ring.length >= 4 && close(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

async function buildGreen(GW2, GH2) {
  console.log('3/4 parks & greenery…');
  const q = `[out:json][timeout:300];
(
  way["leisure"~"^(park|garden|golf_course|common|nature_reserve|pitch|playground|dog_park)$"]${bb};
  way["landuse"~"^(grass|recreation_ground|forest|meadow|cemetery|village_green)$"]${bb};
  way["natural"~"^(wood|scrub|grassland|heath)$"]${bb};
  relation["leisure"~"^(park|golf_course|nature_reserve|common|garden)$"]${bb};
);
out geom;`;
  const data = await overpass(q);
  const polys = [];
  for (const el of data.elements) {
    if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
      polys.push(el.geometry.map((g) => toXZ(g.lat, g.lon)));
    } else if (el.type === 'relation' && el.members) {
      const outers = el.members
        .filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === '') && m.geometry)
        .map((m) => m.geometry.map((g) => toXZ(g.lat, g.lon)));
      polys.push(...stitchRings(outers));
    }
  }
  // rasterize (even-odd scanline) into a bit mask over the map extent
  const mask = new Uint8Array(GW2 * GH2);
  const sx = (x) => ((x - XMIN) / (XMAX - XMIN)) * GW2;
  const sz = (z) => ((z - ZMIN) / (ZMAX - ZMIN)) * GH2;
  for (const poly of polys) {
    const p = poly.map(([x, z]) => [sx(x), sz(z)]);
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [, y] of p) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    y0 = Math.max(0, Math.floor(y0));
    y1 = Math.min(GH2 - 1, Math.ceil(y1));
    for (let row = y0; row <= y1; row++) {
      const yc = row + 0.5;
      const xs = [];
      for (let i = 0; i < p.length - 1; i++) {
        const [xa, ya] = p[i];
        const [xb, yb] = p[i + 1];
        if (ya <= yc === yb <= yc) continue;
        xs.push(xa + ((yc - ya) / (yb - ya)) * (xb - xa));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.round(xs[k]));
        const b = Math.min(GW2 - 1, Math.round(xs[k + 1]));
        for (let x = a; x <= b; x++) mask[row * GW2 + x] = 1;
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'green.bin'), Buffer.from(mask.buffer));
  console.log(`  green.bin: ${polys.length} polygons rasterized`);
}

// ═══════════════ 4. Transit routes ═══════════════

// Hand-traced fallbacks (lat, lon along the real streets) used when an OSM
// relation is missing or fails validation.
// Hand traces kept as fallbacks for the three flagship bus lines in case the
// bulk Muni fetch fails entirely.
const BUS_FALLBACKS = [
  {
    id: 'bus38', system: 'bus', name: '38 Geary', speed: 2, vehicles: 6,
    match: () => false,
    hand: [[37.7899, -122.3927], [37.7884, -122.4],[37.7873, -122.4029], [37.7861, -122.4137], [37.7855, -122.4216], [37.7847, -122.433], [37.7813, -122.4467], [37.7808, -122.4596], [37.7805, -122.472], [37.78, -122.4849], [37.7797, -122.511]],
    stops: [[37.7899, -122.3927, 'Transit Center'], [37.7861, -122.4137, 'Union Square'], [37.7847, -122.433, 'Japantown'], [37.7805, -122.472, 'Park Presidio'], [37.7797, -122.511, 'Lands End']],
  },
  {
    id: 'bus14', system: 'bus', name: '14 Mission', speed: 2, vehicles: 6,
    match: () => false,
    hand: [[37.7919, -122.3929], [37.7888, -122.3965], [37.7827, -122.407], [37.777, -122.414], [37.765, -122.4196], [37.7522, -122.4184], [37.7424, -122.4214], [37.729, -122.4308], [37.7202, -122.4395], [37.708, -122.4555]],
    stops: [[37.7888, -122.3965, 'Downtown'], [37.765, -122.4196, '16th & Mission'], [37.7522, -122.4184, '24th & Mission'], [37.729, -122.4308, 'Excelsior'], [37.708, -122.4555, 'Daly City']],
  },
  {
    id: 'bus29', system: 'bus', name: '29 Sunset', speed: 2, vehicles: 4,
    match: () => false,
    hand: [[37.7878, -122.4844], [37.7805, -122.4847], [37.7727, -122.4836], [37.7682, -122.4894], [37.7647, -122.4946], [37.7547, -122.4959], [37.743, -122.4965], [37.7345, -122.4938], [37.7235, -122.492]],
    stops: [[37.7878, -122.4844, 'Presidio'], [37.7727, -122.4836, 'Golden Gate Park'], [37.743, -122.4965, 'Taraval'], [37.7235, -122.492, 'Lake Merced']],
  },
  // These Muni lines have no usable OSM route relation in the bbox at all,
  // so they are always hand-traced along their real streets.
  {
    id: 'bus1', system: 'bus', name: '1 California', speed: 2, vehicles: 5,
    match: () => false,
    hand: [[37.795, -122.3968], [37.7932, -122.3985], [37.7925, -122.4045], [37.7918, -122.4095], [37.7905, -122.4225], [37.7898, -122.4345], [37.7888, -122.447], [37.7857, -122.459], [37.785, -122.472], [37.7845, -122.485], [37.78, -122.493]],
    stops: [[37.795, -122.3968, 'Clay & Drumm'], [37.7918, -122.4095, 'Nob Hill'], [37.7898, -122.4345, 'Fillmore'], [37.785, -122.472, 'Park Presidio'], [37.78, -122.493, '33rd & Geary']],
  },
  {
    id: 'bus5', system: 'bus', name: '5 Fulton', speed: 2, vehicles: 5,
    match: () => false,
    hand: [[37.789, -122.396], [37.7835, -122.407], [37.781, -122.4125], [37.778, -122.432], [37.7765, -122.444], [37.7755, -122.4543], [37.7733, -122.466], [37.772, -122.4845], [37.771, -122.5095]],
    stops: [[37.789, -122.396, 'Transit Center'], [37.781, -122.4125, 'Civic Center'], [37.7755, -122.4543, 'Stanyan'], [37.772, -122.4845, '25th Ave'], [37.771, -122.5095, 'Ocean Beach']],
  },
  {
    id: 'bus22', system: 'bus', name: '22 Fillmore', speed: 2, vehicles: 5,
    match: () => false,
    hand: [[37.8035, -122.436], [37.7995, -122.436], [37.794, -122.435], [37.7898, -122.434], [37.7847, -122.433], [37.778, -122.4318], [37.772, -122.43], [37.7665, -122.4292], [37.7645, -122.429], [37.765, -122.4196], [37.7655, -122.4105], [37.7668, -122.39], [37.77, -122.3905]],
    stops: [[37.8035, -122.436, 'Marina'], [37.7898, -122.434, 'Pacific Heights'], [37.7847, -122.433, 'Japantown'], [37.765, -122.4196, '16th & Mission'], [37.77, -122.3905, 'Mission Bay']],
  },
  {
    id: 'bus45', system: 'bus', name: '45 Union/Stockton', speed: 2, vehicles: 3,
    match: () => false,
    hand: [[37.799, -122.446], [37.7975, -122.4358], [37.7985, -122.424], [37.7997, -122.409], [37.7972, -122.4085], [37.7895, -122.407], [37.7855, -122.4055], [37.7805, -122.4005], [37.7765, -122.3945]],
    stops: [[37.799, -122.446, 'Cow Hollow'], [37.7997, -122.409, 'North Beach'], [37.7895, -122.407, 'Stockton Tunnel'], [37.7765, -122.3945, 'Caltrain']],
  },
  {
    id: 'bus49', system: 'bus', name: '49 Van Ness–Mission', speed: 2, vehicles: 5,
    match: () => false,
    hand: [[37.805, -122.4245], [37.7985, -122.4235], [37.7905, -122.4225], [37.7835, -122.421], [37.7752, -122.4192], [37.7693, -122.4196], [37.765, -122.4196], [37.7522, -122.4184], [37.7424, -122.4214], [37.7335, -122.4282], [37.7232, -122.4366]],
    stops: [[37.805, -122.4245, 'Aquatic Park'], [37.7905, -122.4225, 'Cathedral Hill'], [37.7752, -122.4192, 'Market & Van Ness'], [37.7522, -122.4184, '24th & Mission'], [37.7232, -122.4366, 'City College']],
  },
];

// Curated stop lists for marquee bus refs (used over auto-named stops).
const BUS_STOP_OVERRIDES = Object.fromEntries(BUS_FALLBACKS.map((b) => [b.id.replace('bus', ''), b.stops]));

const LINES = [
  {
    id: 'ggt', system: 'bus', name: 'GGT · Golden Gate', speed: 2.4, vehicles: 2,
    match: (t) => t.route === 'bus' && /Golden Gate/i.test(t.operator || '') && /Sausalito|Marin/i.test(t.name || ''),
    hand: [[37.7997, -122.436], [37.7999, -122.4464], [37.8035, -122.4577], [37.807, -122.472], [37.8077, -122.475], [37.8105, -122.4773], [37.832, -122.479], [37.8385, -122.4805], [37.8455, -122.4818], [37.852, -122.4794], [37.8557, -122.478]],
    stops: [[37.7997, -122.436, 'Marina'], [37.8077, -122.475, 'Toll Plaza'], [37.8214, -122.4785, 'Golden Gate Bridge'], [37.8557, -122.478, 'Sausalito']],
  },
  {
    id: 'metroN', system: 'metro', name: 'N Judah', speed: 2.5, vehicles: 4, cars: 2,
    match: (t) => t.route === 'light_rail' && (t.ref === 'N' || /N Judah/i.test(t.name || '')),
    hand: [[37.7765, -122.3947], [37.7895, -122.389], [37.7929, -122.3968], [37.7894, -122.4011], [37.7844, -122.4078], [37.7796, -122.4139], [37.7693, -122.429], [37.7659, -122.45], [37.7625, -122.4665], [37.7607, -122.4767], [37.76, -122.495], [37.7604, -122.5085]],
    stops: [[37.7929, -122.3968, 'Embarcadero'], [37.7844, -122.4078, 'Powell'], [37.7693, -122.429, 'Duboce & Church'], [37.7659, -122.45, 'Cole Valley'], [37.7625, -122.4665, '9th & Irving'], [37.7604, -122.5085, 'Ocean Beach']],
  },
  {
    id: 'metroT', system: 'metro', name: 'T Third Street', speed: 2.5, vehicles: 4, cars: 2,
    match: (t) => t.route === 'light_rail' && (t.ref === 'T' || /T Third/i.test(t.name || '')),
    hand: [[37.7949, -122.4053], [37.7879, -122.4056], [37.7841, -122.4076], [37.779, -122.3973], [37.7766, -122.3934], [37.77, -122.3905], [37.76, -122.3885], [37.7505, -122.387], [37.7405, -122.3895], [37.7235, -122.3935], [37.7185, -122.4005], [37.7085, -122.4045]],
    stops: [[37.7949, -122.4053, 'Chinatown'], [37.7879, -122.4056, 'Union Square'], [37.7766, -122.3934, 'Oracle Park'], [37.76, -122.3885, 'Dogpatch'], [37.7405, -122.3895, 'Bayview'], [37.7085, -122.4045, 'Sunnydale']],
  },
  {
    id: 'fline', system: 'streetcar', name: 'F Market & Wharves', speed: 2, vehicles: 5,
    match: (t) => t.route === 'tram' && (t.ref === 'F' || /F.?Market/i.test(t.name || '')),
    hand: [[37.8075, -122.4175], [37.8085, -122.41], [37.807, -122.4055], [37.8035, -122.4005], [37.7985, -122.3945], [37.795, -122.3935], [37.792, -122.397], [37.7888, -122.4012], [37.7848, -122.4076], [37.7795, -122.414], [37.7752, -122.4192], [37.7693, -122.4283], [37.7625, -122.435]],
    stops: [[37.8075, -122.4175, "Fisherman's Wharf"], [37.8085, -122.41, 'Pier 39'], [37.795, -122.3935, 'Ferry Building'], [37.7848, -122.4076, 'Powell'], [37.7625, -122.435, 'Castro']],
  },
  {
    id: 'bart', system: 'bart', name: 'BART · Transbay', speed: 4.5, vehicles: 4, cars: 4,
    match: (t) => (t.route === 'subway' || t.route === 'train') && /BART|Antioch|SFO|Millbrae|Richmond|Berryessa/i.test((t.name || '') + (t.operator || '')),
    hand: [[37.7061, -122.469], [37.7216, -122.4474], [37.7333, -122.4337], [37.7523, -122.4182], [37.7651, -122.4196], [37.7796, -122.4139], [37.7844, -122.4078], [37.7894, -122.4011], [37.7929, -122.3968], [37.799, -122.385], [37.8035, -122.345], [37.8049, -122.2946]],
    stops: [[37.7061, -122.469, 'Daly City'], [37.7216, -122.4474, 'Balboa Park'], [37.7333, -122.4337, 'Glen Park'], [37.7523, -122.4182, '24th St Mission'], [37.7651, -122.4196, '16th St Mission'], [37.7796, -122.4139, 'Civic Center'], [37.7844, -122.4078, 'Powell'], [37.7894, -122.4011, 'Montgomery'], [37.7929, -122.3968, 'Embarcadero'], [37.8049, -122.2946, 'West Oakland']],
  },
  {
    id: 'cablePH', system: 'cable', name: 'Powell–Hyde', speed: 1, vehicles: 3,
    match: (t) => /tram|funicular/.test(t.route || '') && /Powell.*(Hyde)|Hyde/i.test(t.name || ''),
    hand: [[37.7847, -122.4079], [37.7888, -122.4087], [37.792, -122.4093], [37.7948, -122.4099], [37.7945, -122.4187], [37.7993, -122.4191], [37.802, -122.4193], [37.8065, -122.4207]],
    stops: [[37.7847, -122.4079, 'Powell & Market'], [37.792, -122.4093, 'Nob Hill'], [37.802, -122.4193, 'Lombard St'], [37.8065, -122.4207, 'Hyde & Beach']],
  },
  {
    id: 'cableCal', system: 'cable', name: 'California St', speed: 1, vehicles: 2,
    match: (t) => /tram|funicular/.test(t.route || '') && /California/i.test(t.name || '') && /cable/i.test((t.name || '') + (t.operator || '')),
    hand: [[37.7935, -122.3963], [37.7929, -122.4022], [37.7922, -122.4075], [37.7918, -122.4094], [37.7912, -122.4145], [37.7905, -122.4225]],
    stops: [[37.7935, -122.3963, 'California & Drumm'], [37.7918, -122.4094, 'Grace Cathedral'], [37.7905, -122.4225, 'Van Ness']],
  },
  {
    id: 'ferrySaus', system: 'ferry', name: 'Sausalito Ferry', speed: 1.6, vehicles: 2,
    match: (t) => t.route === 'ferry' && /Sausalito/i.test(t.name || ''),
    hand: [[37.7955, -122.3937], [37.81, -122.41], [37.823, -122.435], [37.84, -122.46], [37.8531, -122.4737], [37.8557, -122.478]],
    stops: [[37.7955, -122.3937, 'Ferry Building'], [37.823, -122.435, 'Alcatraz (passing)'], [37.8557, -122.478, 'Sausalito']],
  },
  {
    id: 'ferryOak', system: 'ferry', name: 'Oakland Ferry', speed: 1.6, vehicles: 2,
    match: (t) => t.route === 'ferry' && /Oakland|Alameda/i.test(t.name || ''),
    hand: [[37.7955, -122.3937], [37.798, -122.37], [37.8, -122.35], [37.7985, -122.32], [37.798, -122.285]],
    stops: [[37.7955, -122.3937, 'Ferry Building'], [37.798, -122.285, 'Oakland']],
  },
];

function densifyLatLon(latlon, step = 0.5) {
  const pts = latlon.map(([lat, lon]) => toXZ(lat, lon));
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Greedy-stitch relation member ways into the longest continuous polyline. */
function stitchLine(ways, tol = 0.6) {
  const segs = ways.filter((w) => w.length >= 2);
  if (!segs.length) return null;
  const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
  let best = null;
  const starts = Math.min(segs.length, 80);
  for (let s = 0; s < starts; s++) {
    const used = new Array(segs.length).fill(false);
    used[s] = true;
    let line = [...segs[s]];
    let extended = true;
    while (extended) {
      extended = false;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        const seg = segs[j];
        if (close(line[line.length - 1], seg[0])) line = line.concat(seg.slice(1));
        else if (close(line[line.length - 1], seg[seg.length - 1])) line = line.concat([...seg].reverse().slice(1));
        else if (close(line[0], seg[seg.length - 1])) line = seg.slice(0, -1).concat(line);
        else if (close(line[0], seg[0])) line = [...seg].reverse().slice(0, -1).concat(line);
        else continue;
        used[j] = true;
        extended = true;
        break;
      }
    }
    if (!best || lineLength(line) > lineLength(best)) best = line;
  }
  return best;
}

function clipToMap(pts) {
  // keep the longest contiguous run inside the map
  let best = [];
  let cur = [];
  for (const p of pts) {
    if (inMap(p[0], p[1], 2)) cur.push(p);
    else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  if (cur.length > best.length) best = cur;
  return best;
}

function snapStops(pts, stops) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const total = cum[cum.length - 1];
  const out = [];
  for (const [lat, lon, name] of stops) {
    const [sx, sz] = toXZ(lat, lon);
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - sx, pts[i][1] - sz);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    if (bd < 8) out.push({ t: cum[bi] / total, name, snapDist: Math.round(bd * 10) / 10 });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function stitchRelation(cand) {
  const ways = (cand.members || [])
    .filter((m) => m.type === 'way' && m.geometry && !/platform|stop/.test(m.role || ''))
    .map((m) => m.geometry.map((g) => toXZ(g.lat, g.lon)));
  const stitched = stitchLine(ways);
  return stitched ? clipToMap(stitched) : null;
}

function maxGap(pts) {
  let g = 0;
  for (let i = 1; i < pts.length; i++) g = Math.max(g, Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return g;
}

/** Auto-name stops along a line from the nearest named street. */
function autoStops(pts, namedPts, spacing = 14) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const total = cum[cum.length - 1];
  const n = Math.min(12, Math.max(2, Math.round(total / spacing)));
  const stops = [];
  let lastName = '';
  for (let k = 0; k <= n; k++) {
    const want = (k / n) * total;
    let i = 0;
    while (i < cum.length - 1 && cum[i] < want) i++;
    const [x, z] = pts[i];
    let name = '';
    let bd = 2.5;
    for (const [nx, nz, nn] of namedPts) {
      const d = Math.hypot(nx - x, nz - z);
      if (d < bd) {
        bd = d;
        name = nn;
      }
    }
    if (!name || name === lastName) continue;
    lastName = name;
    stops.push({ t: Math.round((cum[i] / total) * 1e4) / 1e4, name });
  }
  return stops;
}

async function buildMuniBuses(rels, namedPts, routes) {
  const muni = rels.filter((r) => {
    const t = r.tags || {};
    return t.route === 'bus' && t.ref && /Muni|SFMTA|San Francisco Municipal/i.test(`${t.network || ''} ${t.operator || ''}`);
  });
  const byRef = new Map();
  for (const r of muni) {
    const ref = r.tags.ref;
    if (/R$|X$/i.test(ref)) continue; // skip rapid/express variants of the same corridor
    if (/-Bus$/i.test(ref) || /^7\d\d$/.test(ref)) continue; // rail-replacement shuttles & specials
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push(r);
  }
  const refs = [...byRef.keys()].sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999));
  let ok = 0;
  for (const ref of refs) {
    const cands = byRef
      .get(ref)
      .filter((c) => !/owl|[\s-]bus\b/i.test(c.tags.name || '')) // owls & rail-replacement shuttles
      .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
    for (const cand of cands) {
      const clipped = stitchRelation(cand);
      if (!clipped) continue;
      const len = lineLength(clipped);
      if (len < 12 || maxGap(clipped) > 18) continue;
      const pts = decimate(clipped, 0.4).map(([x, z]) => [r2(x), r2(z)]);
      const stops = BUS_STOP_OVERRIDES[ref]
        ? snapStops(pts, BUS_STOP_OVERRIDES[ref]).map(({ t, name }) => ({ t: Math.round(t * 1e4) / 1e4, name }))
        : autoStops(pts, namedPts);
      const rawName = (cand.tags.name || '')
        .split(':')[0]
        .replace(/^Muni\s*/i, '')
        .replace(/\s*(in|out|north|south|east|west)bound\s*$/i, '')
        .trim();
      routes.push({
        id: `bus${ref}`,
        system: 'bus',
        name: rawName || `${ref} Muni`,
        speed: 2,
        vehicles: Math.max(2, Math.min(4, Math.round(len / 30))),
        pts,
        stops,
      });
      ok++;
      break;
    }
  }
  console.log(`  muni buses: ${ok}/${refs.length} refs stitched into routes`);
  return ok;
}

async function buildTransit(namedPts) {
  console.log('4/4 transit routes…');
  const q = `[out:json][timeout:300];
(
  relation["route"="bus"]["network"~"Muni|SFMTA",i]${bb};
  relation["route"="bus"]["operator"~"Golden Gate|San Francisco Municipal",i]${bb};
  relation["route"~"^(light_rail|tram|funicular|subway|train)$"]${bb};
  relation["route"="ferry"]${bb};
);
out geom;`;
  let rels = [];
  try {
    rels = (await overpass(q)).elements.filter((e) => e.type === 'relation');
    console.log(`  ${rels.length} candidate relations from OSM`);
  } catch (e) {
    console.warn(`  transit overpass failed entirely (${e.message}); all routes use hand-traced paths`);
  }

  const routes = [];
  await buildMuniBuses(rels, namedPts, routes);
  // hand-traced fallbacks for any flagship bus line the bulk fetch missed
  const have = new Set(routes.map((r) => r.id));
  const lines = [...BUS_FALLBACKS.filter((b) => !have.has(b.id)), ...LINES];
  for (const line of lines) {
    let pts = null;
    let source = 'hand';
    const cands = rels.filter((r) => line.match(r.tags || {}));
    // prefer relations with more way members (full route variants)
    cands.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
    for (const cand of cands) {
      const ways = (cand.members || [])
        .filter((m) => m.type === 'way' && m.geometry && !/platform|stop/.test(m.role || ''))
        .map((m) => m.geometry.map((g) => toXZ(g.lat, g.lon)));
      const stitched = stitchLine(ways);
      if (!stitched) continue;
      const clipped = clipToMap(stitched);
      const handLen = lineLength(densifyLatLon(line.hand));
      const len = lineLength(clipped);
      const snapped = snapStops(clipped, line.stops);
      // validate: sane length vs hand trace, and most stops found near the line
      if (len > handLen * 0.55 && len < handLen * 2.5 && snapped.length >= Math.min(3, line.stops.length)) {
        pts = clipped;
        source = `osm:${cand.id} (${(cand.tags && cand.tags.name) || ''})`;
        break;
      }
    }
    if (!pts) pts = densifyLatLon(line.hand);
    pts = decimate(pts, 0.4).map(([x, z]) => [r2(x), r2(z)]);
    const stops = snapStops(pts, line.stops).map(({ t, name }) => ({ t: Math.round(t * 1e4) / 1e4, name }));
    routes.push({
      id: line.id,
      system: line.system,
      name: line.name,
      speed: line.speed,
      vehicles: line.vehicles,
      cars: line.cars,
      pts,
      stops,
    });
    console.log(`  ${line.id}: ${source} · ${pts.length} pts · ${stops.length} stops`);
  }
  fs.writeFileSync(path.join(OUT, 'routes.json'), JSON.stringify(routes));
}

// ═══════════════ run ═══════════════

const GW2 = 1024;
const GH2 = 880;
const { GW, GH } = await buildElevation();
const namedPts = await buildRoads();
await buildGreen(GW2, GH2);
await buildTransit(namedPts);
fs.writeFileSync(
  path.join(OUT, 'meta.json'),
  JSON.stringify({ bbox: BBOX, lat0: LAT0, lon0: LON0, mLat: M_LAT, mLon: M_LON, scale: SCALE, exagg: 2.0, gw: GW, gh: GH, gw2: GW2, gh2: GH2, xmin: r2(XMIN), xmax: r2(XMAX), zmin: r2(ZMIN), zmax: r2(ZMAX) }),
);
console.log('done. assets in public/data/');
