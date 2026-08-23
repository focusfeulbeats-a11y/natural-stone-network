import { db } from '../db.js';
import { notFound, parsePagination } from '../http.js';

export function registerProfessionalRoutes(router) {
  // GET /api/professionals?specialism=&location=&accountType=&limit=&offset=
  router.get('/api/professionals', async (req, res, ctx) => {
    const { limit, offset } = parsePagination(ctx.query);
    const specialism = ctx.query.get('specialism');
    const location = ctx.query.get('location');
    const accountType = ctx.query.get('accountType');

    const clauses = [];
    const params = [];
    if (specialism) { clauses.push('pp.specialism = ?'); params.push(specialism); }
    if (location) { clauses.push('u.location LIKE ?'); params.push(`%${location}%`); }
    if (accountType) { clauses.push('pp.account_type = ?'); params.push(accountType); }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT u.id as user_id, u.name, u.location, pp.*
         FROM professional_profiles pp
         JOIN users u ON u.id = pp.user_id
         ${where}
         ORDER BY pp.founding_member DESC, pp.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return { professionals: rows, limit, offset };
  });

  router.get('/api/professionals/:id', async (req, res, ctx) => {
    const row = db
      .prepare(
        `SELECT u.id as user_id, u.name, u.email, u.location, pp.*
         FROM professional_profiles pp
         JOIN users u ON u.id = pp.user_id
         WHERE pp.id = ? OR pp.user_id = ?`
      )
      .get(ctx.params.id, ctx.params.id);
    if (!row) throw notFound('Professional not found');

    const projects = db
      .prepare(`SELECT * FROM projects WHERE owner_id = ? AND status = 'published' ORDER BY created_at DESC`)
      .all(row.user_id);

    return { professional: row, projects };
  });

  // GET /api/suppliers
  router.get('/api/suppliers', async (req, res, ctx) => {
    const { limit, offset } = parsePagination(ctx.query);
    const rows = db
      .prepare(
        `SELECT u.id as user_id, u.name, u.location, sp.*
         FROM supplier_profiles sp
         JOIN users u ON u.id = sp.user_id
         ORDER BY sp.featured DESC, sp.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);
    return { suppliers: rows, limit, offset };
  });

  router.get('/api/suppliers/:id', async (req, res, ctx) => {
    const row = db
      .prepare(
        `SELECT u.id as user_id, u.name, u.location, sp.*
         FROM supplier_profiles sp
         JOIN users u ON u.id = sp.user_id
         WHERE sp.id = ? OR sp.user_id = ?`
      )
      .get(ctx.params.id, ctx.params.id);
    if (!row) throw notFound('Supplier not found');
    return { supplier: row };
  });
}
