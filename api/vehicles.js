import { AGENCY_TTL, fetchVehicles, readToken } from './_lib.mjs';

// Vercel serverless proxy for 511.org VehicleMonitoring.
// Cache-Control s-maxage lets Vercel's CDN collapse all visitors into
// ~one upstream request per TTL per agency, protecting the 60 req/hr quota.
export default async function handler(req, res) {
  const agency = String(req.query.agency || '');
  const { status, body } = await fetchVehicles(agency, readToken(process.env));
  if (status === 200) {
    const ttl = AGENCY_TTL[agency];
    res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
  }
  res.status(status).json(body);
}
