import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { requireFields, notFound, badRequest, parsePagination } from '../http.js';

export function registerOpportunityRoutes(router) {
  // GET /api/opportunities?type=&location=
  router.get('/api/opportunities', async (req, res, ctx) => {
    const { limit, offset } = parsePagination(ctx.query);
    const type = ctx.query.get('type');
    const location = ctx.query.get('location');

    const clauses = [`o.status = 'live'`];
    const params = [];
    if (type) { clauses.push('o.type = ?'); params.push(type); }
    if (location) { clauses.push('o.location LIKE ?'); params.push(`%${location}%`); }

    const rows = db
      .prepare(
        `SELECT o.*, u.name AS business_name,
           (SELECT COUNT(*) FROM applications WHERE opportunity_id = o.id) AS applicant_count
         FROM opportunities o
         JOIN users u ON u.id = o.business_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return { opportunities: rows, limit, offset };
  });

  router.post('/api/opportunities', async (req, res, ctx) => {
    const user = requireRole(req, 'business', 'professional');
    const body = ctx.body;
    requireFields(body, ['title', 'type']);
    if (!['permanent', 'temporary', 'subcontract'].includes(body.type)) {
      throw badRequest('type must be permanent, temporary or subcontract');
    }

    const result = db
      .prepare(
        `INSERT INTO opportunities (business_id, title, type, location, description)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(user.id, body.title, body.type, body.location || null, body.description || null);

    const opportunity = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(Number(result.lastInsertRowid));
    res.statusCode = 201;
    return { opportunity };
  });

  router.get('/api/opportunities/:id', async (req, res, ctx) => {
    const opportunity = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(ctx.params.id);
    if (!opportunity) throw notFound('Opportunity not found');
    return { opportunity };
  });

  router.patch('/api/opportunities/:id', async (req, res, ctx) => {
    const user = requireAuth(req);
    const opportunity = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(ctx.params.id);
    if (!opportunity) throw notFound('Opportunity not found');
    if (opportunity.business_id !== user.id) throw badRequest('Not your listing');

    const validStatuses = ['live', 'filled', 'closed'];
    const status = ctx.body.status;
    if (!validStatuses.includes(status)) throw badRequest(`status must be one of: ${validStatuses.join(', ')}`);

    db.prepare('UPDATE opportunities SET status = ? WHERE id = ?').run(status, opportunity.id);
    return { opportunity: db.prepare('SELECT * FROM opportunities WHERE id = ?').get(opportunity.id) };
  });

  // ---- Applications ----
  router.post('/api/opportunities/:id/apply', async (req, res, ctx) => {
    const user = requireAuth(req);
    const opportunity = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(ctx.params.id);
    if (!opportunity) throw notFound('Opportunity not found');

    const result = db
      .prepare(
        `INSERT OR IGNORE INTO applications (opportunity_id, applicant_id, cover_note)
         VALUES (?, ?, ?)`
      )
      .run(opportunity.id, user.id, ctx.body.coverNote || null);

    if (result.changes === 0) throw badRequest('You have already applied to this opportunity');

    const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(Number(result.lastInsertRowid));
    res.statusCode = 201;
    return { application };
  });

  router.get('/api/opportunities/:id/applications', async (req, res, ctx) => {
    const user = requireAuth(req);
    const opportunity = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(ctx.params.id);
    if (!opportunity) throw notFound('Opportunity not found');
    if (opportunity.business_id !== user.id) throw badRequest('Not your listing');

    const applications = db
      .prepare(
        `SELECT a.*, u.name AS applicant_name, u.email AS applicant_email
         FROM applications a JOIN users u ON u.id = a.applicant_id
         WHERE a.opportunity_id = ? ORDER BY a.created_at DESC`
      )
      .all(opportunity.id);
    return { applications };
  });
}
