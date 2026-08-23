import { Router } from './router.js';
import { readJsonBody, sendJson, HttpError } from './http.js';
import { attachUser } from './auth.js';
import { config } from './config.js';

import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerProfessionalRoutes } from './routes/professionals.routes.js';
import { registerProjectRoutes } from './routes/projects.routes.js';
import { registerEnquiryRoutes } from './routes/enquiries.routes.js';
import { registerOpportunityRoutes } from './routes/opportunities.routes.js';
import { registerDashboardRoutes } from './routes/dashboard.routes.js';

const router = new Router();
registerAuthRoutes(router);
registerProfessionalRoutes(router);
registerProjectRoutes(router);
registerEnquiryRoutes(router);
registerOpportunityRoutes(router);
registerDashboardRoutes(router);

router.get('/api/health', async () => ({ ok: true, service: 'natural-stone-network-api' }));

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowAll = config.corsOrigins.includes('*');
  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export async function handleRequest(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const match = router.match(req.method, url.pathname);

  if (!match) {
    sendJson(res, 404, { error: 'Not found', path: url.pathname });
    return;
  }

  try {
    attachUser(req);
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJsonBody(req) : {};
    const ctx = { params: match.params, query: url.searchParams, body };
    const result = await match.handler(req, res, ctx);
    sendJson(res, res.statusCode && res.statusCode !== 200 ? res.statusCode : 200, result);
  } catch (err) {
    // Covers both the HttpError class and the plain Error+statusCode pattern
    // used by requireAuth/requireRole in auth.js.
    if (err instanceof HttpError || typeof err.statusCode === 'number') {
      sendJson(res, err.statusCode, { error: err.message });
    } else {
      console.error('Unhandled error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
}
