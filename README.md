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

## Data

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
