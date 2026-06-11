# SF Transit · Live(ish) 🌉

A beige, toy-like 3D rendering of San Francisco built on **real geography** —
actual elevation, the full real street network, real park polygons, the true
shoreline — with simulated live transit (Muni buses, Muni Metro, the F
streetcar, BART, cable cars, and ferries) running on real route geometry.

## Run

```sh
npm install
npm run dev   # serves on http://localhost:3000
```

## Live transit data

The app shows **real vehicle positions** from the 511.org SIRI
VehicleMonitoring API (Muni, BART, Golden Gate & SF Bay ferries), proxied
through `api/vehicles.js` so the API token stays server-side:

- Local dev: put `511_TOKEN=<your key>` in `.env` (gitignored). The Vite dev
  server hosts the same proxy endpoint.
- Vercel: set the `TRANSIT_511_TOKEN` env var in project settings. CDN
  caching (`s-maxage`) collapses all visitors into ~one upstream request per
  TTL per agency, keeping usage inside 511's 60 req/hr default quota.
- Poll budget: Muni every 150s, BART every 240s, ferries every 15min, with
  client-side position interpolation between updates.
- No token / API down → the app automatically falls back to the built-in
  demo simulator (toggle in the top-left panel).

## Static geography data

Static geography assets live in `public/data/` and are baked by
`node scripts/fetch-data.mjs` (no API keys needed):

- elevation from AWS Open Data terrarium tiles (Mapzen/Tilezen)
- streets, parks, and transit route relations from OpenStreetMap (Overpass)
- transit lines fall back to hand-traced street-following paths when an OSM
  relation is missing or fails validation

Re-run the script any time to refresh the data. © OpenStreetMap contributors.

## Controls

- **Drag** to orbit, **scroll** to zoom, **right-drag** to pan
- **Click any vehicle** to follow it (info card shows route, speed, next stop)
- Click water / press ✕ to stop following
- Toggle transit systems in the legend panel

## Swapping in real data

All vehicles come from the dummy simulator in `src/sim/transit.ts`. Its
public surface (`VehicleInfo`, per-id poses) is shaped like a GTFS-realtime
VehiclePosition feed, so a real 511.org feed can replace `advance()` behind
the same interface without touching the rendering. API keys belong in env
vars, never in source.
