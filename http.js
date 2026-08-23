export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function badRequest(message) {
  return new HttpError(400, message);
}
export function notFound(message = 'Not found') {
  return new HttpError(404, message);
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
}

export function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

/** Require the given fields to be present (and non-empty for strings) on an object. */
export function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length) {
    throw badRequest(`Missing required field(s): ${missing.join(', ')}`);
  }
}

export function parsePagination(query) {
  const limit = Math.min(Math.max(parseInt(query.get('limit') || '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(query.get('offset') || '0', 10) || 0, 0);
  return { limit, offset };
}
