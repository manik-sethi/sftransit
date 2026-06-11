import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-server twin of api/vehicles.js: same proxy, token read from .env into
// the Node process only (never exposed to the client bundle), with an
// in-memory TTL cache standing in for Vercel's CDN cache.
function liveTransitDev(): Plugin {
  return {
    name: 'live-transit-dev-proxy',
    configureServer(server) {
      let token = '';
      try {
        const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        token = /^511_TOKEN=(.*)$/m.exec(env)?.[1]?.trim() ?? '';
      } catch {
        // no .env — endpoint will answer 503 and the app falls back to demo mode
      }
      const cache = new Map<string, { exp: number; status: number; body: unknown }>();
      server.middlewares.use('/api/vehicles', (req, res) => {
        (async () => {
          const { AGENCY_TTL, fetchVehicles } = await import('./api/_lib.mjs');
          const agency = String(new URL(req.url ?? '', 'http://x').searchParams.get('agency') || '');
          let hit = cache.get(agency);
          if (!hit || hit.exp < Date.now()) {
            const { status, body } = await fetchVehicles(agency, token);
            hit = { exp: Date.now() + (AGENCY_TTL[agency] ?? 60) * 1000, status, body };
            if (status === 200) cache.set(agency, hit);
          }
          res.statusCode = hit.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(hit.body));
        })().catch(() => {
          res.statusCode = 500;
          res.end('{"error":"proxy failure"}');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), liveTransitDev()],
  server: {
    port: 3000,
    strictPort: true,
  },
});
