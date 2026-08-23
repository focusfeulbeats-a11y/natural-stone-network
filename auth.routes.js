import { db } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';
import { requireFields, badRequest, notFound } from '../http.js';

const VALID_ROLES = ['customer', 'professional', 'business', 'supplier'];

function publicUser(row) {
  if (!row) return null;
  const { password_hash, password_salt, ...rest } = row;
  return rest;
}

export function registerAuthRoutes(router) {
  router.post('/api/auth/register', async (req, res, ctx) => {
    const body = ctx.body;
    requireFields(body, ['name', 'email', 'password', 'role']);
    if (!VALID_ROLES.includes(body.role)) {
      throw badRequest(`role must be one of: ${VALID_ROLES.join(', ')}`);
    }
    if (String(body.password).length < 8) {
      throw badRequest('password must be at least 8 characters');
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
    if (existing) throw badRequest('An account with this email already exists');

    const { hash, salt } = hashPassword(body.password);
    const insertUser = db.prepare(
      `INSERT INTO users (email, password_hash, password_salt, name, role, location)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = insertUser.run(body.email, hash, salt, body.name, body.role, body.location || null);
    const userId = Number(result.lastInsertRowid);

    // Create the associated profile row for professional/business/supplier roles.
    if (body.role === 'professional' || body.role === 'business') {
      db.prepare(
        `INSERT INTO professional_profiles (user_id, business_name, specialism, account_type)
         VALUES (?, ?, ?, ?)`
      ).run(userId, body.businessName || body.name, body.specialism || null, body.role);
    } else if (body.role === 'supplier') {
      db.prepare(
        `INSERT INTO supplier_profiles (user_id, business_name) VALUES (?, ?)`
      ).run(userId, body.businessName || body.name);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.statusCode = 201;
    return { token, user: publicUser(user) };
  });

  router.post('/api/auth/login', async (req, res, ctx) => {
    const body = ctx.body;
    requireFields(body, ['email', 'password']);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email);
    if (!user || !verifyPassword(body.password, user.password_salt, user.password_hash)) {
      throw badRequest('Invalid email or password');
    }
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    return { token, user: publicUser(user) };
  });

  router.get('/api/auth/me', async (req) => {
    const authUser = requireAuth(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authUser.id);
    if (!user) throw notFound('User not found');
    return { user: publicUser(user) };
  });
}
