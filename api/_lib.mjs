// Shared 511.org proxy logic, used by both the Vercel serverless function
// (api/vehicles.js) and the Vite dev-server middleware. Runs server-side
// only — the API token must never reach the browser.

/** Allowlisted agencies -> CDN/cache TTL seconds. Anything else is rejected,
 *  so the proxy can't be used to query arbitrary upstream params. */
export const AGENCY_TTL = {
  SF: 120, // Muni (buses, metro, streetcars, cable cars)
  BA: 180, // BART
  GF: 600, // Golden Gate Ferry
  SB: 600, // SF Bay Ferry
  GG: 600, // Golden Gate Transit buses
};

// generous bounds around the rendered map; drops far-away vehicles
const BOUNDS = { latMin: 37.6, latMax: 38.0, lonMin: -122.7, lonMax: -122.1 };

export function readToken(env) {
  return env.TRANSIT_511_TOKEN || env['511_TOKEN'] || '';
}

/** Fetch + condense one agency's SIRI VehicleMonitoring feed.
 *  Returns { status, body } where body is the compact payload or an error. */
export async function fetchVehicles(agency, token) {
  if (!AGENCY_TTL[agency]) return { status: 400, body: { error: 'unknown agency' } };
  if (!token) return { status: 503, body: { error: 'no API token configured' } };

  const url = new URL('https://api.511.org/transit/VehicleMonitoring');
  url.searchParams.set('api_key', token);
  url.searchParams.set('agency', agency);
  url.searchParams.set('format', 'json');

  let upstream;
  try {
    upstream = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch {
    return { status: 502, body: { error: 'upstream unreachable' } };
  }
  if (upstream.status === 401) return { status: 502, body: { error: 'upstream rejected token' } };
  if (upstream.status === 429) return { status: 429, body: { error: 'rate limited' } };
  if (!upstream.ok) return { status: 502, body: { error: `upstream ${upstream.status}` } };

  let text = await upstream.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // 511 sends a BOM

  let acts;
  try {
    const delivery = JSON.parse(text).Siri.ServiceDelivery.VehicleMonitoringDelivery;
    acts = (Array.isArray(delivery) ? delivery[0] : delivery)?.VehicleActivity ?? [];
  } catch {
    return { status: 502, body: { error: 'unexpected upstream payload' } };
  }

  const vehicles = [];
  for (const a of acts) {
    const j = a?.MonitoredVehicleJourney;
    const loc = j?.VehicleLocation;
    const lat = Number(loc?.Latitude);
    const lon = Number(loc?.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < BOUNDS.latMin || lat > BOUNDS.latMax || lon < BOUNDS.lonMin || lon > BOUNDS.lonMax) continue;
    vehicles.push({
      id: String(j.VehicleRef ?? vehicles.length),
      lat,
      lon,
      bearing: Number(j.Bearing) || 0,
      line: j.LineRef ? String(j.LineRef) : null,
      name: j.PublishedLineName ? String(j.PublishedLineName) : null,
      dest: j.DestinationName ? String(j.DestinationName) : null,
      occ: j.Occupancy ? String(j.Occupancy) : null,
      at: a.RecordedAtTime ?? null,
    });
  }
  return { status: 200, body: { agency, ts: Date.now(), vehicles } };
}
