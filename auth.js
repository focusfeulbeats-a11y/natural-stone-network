import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { config } from './config.js';

// ---------- Password hashing (scrypt, built into Node — no bcrypt dependency needed) ----------

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, salt, expectedHash) {
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

// ---------- Signed session tokens ----------
// A minimal JWT-like token: base64url(payload) + "." + HMAC-SHA256 signature.
// Good enough for an MVP; swap for a proper JWT library once you can install dependencies.

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signToken(payload, expiresInSeconds = 60 * 60 * 24 * 7) {
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const encoded = base64url(JSON.stringify(body));
  const signature = createHmac('sha256', config.authSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', config.authSecret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

// ---------- Request-level helpers ----------

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

/** Attaches req.user if a valid token is present. Never throws. */
export function attachUser(req) {
  const token = getBearerToken(req);
  if (!token) return;
  const payload = verifyToken(token);
  if (payload) req.user = payload; // { id, role, email }
}

/** Throws an HttpError(401) if no valid user is attached. */
export function requireAuth(req) {
  if (!req.user) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  return req.user;
}

/** Throws an HttpError(403) if the user's role isn't in the allowed list. */
export function requireRole(req, ...roles) {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) {
    const err = new Error(`Requires role: ${roles.join(' or ')}`);
    err.statusCode = 403;
    throw err;
  }
  return user;
}
