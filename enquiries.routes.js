import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { requireFields, notFound, badRequest } from '../http.js';

function assertParticipant(enquiry, userId) {
  if (enquiry.customer_id !== userId && enquiry.professional_id !== userId) {
    throw badRequest('You are not part of this project');
  }
}

export function registerEnquiryRoutes(router) {
  // POST /api/enquiries — a customer starts an enquiry with a professional/business
  router.post('/api/enquiries', async (req, res, ctx) => {
    const user = requireRole(req, 'customer');
    const body = ctx.body;
    requireFields(body, ['professionalId', 'message']);

    const professional = db.prepare('SELECT id FROM users WHERE id = ?').get(body.professionalId);
    if (!professional) throw notFound('Professional not found');

    const result = db
      .prepare(
        `INSERT INTO enquiries (customer_id, professional_id, project_id, message)
         VALUES (?, ?, ?, ?)`
      )
      .run(user.id, body.professionalId, body.projectId || null, body.message);

    const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(Number(result.lastInsertRowid));
    res.statusCode = 201;
    return { enquiry };
  });

  // GET /api/enquiries — mine, as either customer or professional
  router.get('/api/enquiries', async (req) => {
    const user = requireAuth(req);
    const rows = db
      .prepare(
        `SELECT e.*, c.name AS customer_name, p.name AS professional_name
         FROM enquiries e
         JOIN users c ON c.id = e.customer_id
         JOIN users p ON p.id = e.professional_id
         WHERE e.customer_id = ? OR e.professional_id = ?
         ORDER BY e.created_at DESC`
      )
      .all(user.id, user.id);
    return { enquiries: rows };
  });

  router.get('/api/enquiries/:id', async (req, res, ctx) => {
    const user = requireAuth(req);
    const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(ctx.params.id);
    if (!enquiry) throw notFound('Enquiry not found');
    assertParticipant(enquiry, user.id);

    const quotes = db
      .prepare('SELECT * FROM quotes WHERE enquiry_id = ? ORDER BY version DESC')
      .all(enquiry.id);
    const messages = db
      .prepare(
        `SELECT m.*, u.name AS sender_name FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.enquiry_id = ? ORDER BY m.created_at ASC`
      )
      .all(enquiry.id);

    return { enquiry, quotes, messages };
  });

  router.patch('/api/enquiries/:id', async (req, res, ctx) => {
    const user = requireAuth(req);
    const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(ctx.params.id);
    if (!enquiry) throw notFound('Enquiry not found');
    assertParticipant(enquiry, user.id);

    const validStatuses = ['new', 'quoted', 'in_discussion', 'won', 'lost'];
    const status = ctx.body.status;
    if (!validStatuses.includes(status)) throw badRequest(`status must be one of: ${validStatuses.join(', ')}`);

    db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, enquiry.id);
    return { enquiry: db.prepare('SELECT * FROM enquiries WHERE id = ?').get(enquiry.id) };
  });

  // ---- Quotes (professional/business side) ----
  router.post('/api/enquiries/:id/quotes', async (req, res, ctx) => {
    const user = requireRole(req, 'professional', 'business');
    const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(ctx.params.id);
    if (!enquiry) throw notFound('Enquiry not found');
    if (enquiry.professional_id !== user.id) throw badRequest('Not your enquiry to quote');

    const body = ctx.body;
    requireFields(body, ['amountCents']);

    const lastVersion = db
      .prepare('SELECT MAX(version) as v FROM quotes WHERE enquiry_id = ?')
      .get(enquiry.id).v || 0;

    db.prepare(`UPDATE quotes SET status = 'superseded' WHERE enquiry_id = ? AND status != 'superseded'`).run(enquiry.id);

    const result = db
      .prepare(
        `INSERT INTO quotes (enquiry_id, version, amount_cents, notes, status)
         VALUES (?, ?, ?, ?, 'sent')`
      )
      .run(enquiry.id, lastVersion + 1, body.amountCents, body.notes || null);

    db.prepare(`UPDATE enquiries SET status = 'quoted' WHERE id = ?`).run(enquiry.id);

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(result.lastInsertRowid));
    res.statusCode = 201;
    return { quote };
  });

  router.post('/api/quotes/:id/approve', async (req, res, ctx) => {
    const user = requireRole(req, 'customer');
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(ctx.params.id);
    if (!quote) throw notFound('Quote not found');
    const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(quote.enquiry_id);
    if (enquiry.customer_id !== user.id) throw badRequest('Not your quote to approve');

    db.prepare(`UPDATE quotes SET status = 'approved' WHERE id = ?`).run(quote.id);
    db.prepare(`UPDATE enquiries SET status = 'won' WHERE id = ?`).run(enquiry.id);
    return { quote: db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote.id) };
  });

  // ---- Workspace messages ----
  router.get('/api/enquiries/:id/messages', async (req, res, ctx) => {
    const user = requireAuth(req);
    const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(ctx.params.id);
    if (!enquiry) throw notFound('Enquiry not found');
    assertParticipant(enquiry, user.id);
    const messages = db
      .prepare(
        `SELECT m.*, u.name AS sender_name FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.enquiry_id = ? ORDER BY m.created_at ASC`
      )
      .all(enquiry.id);
    return { messages };
  });

  router.post('/api/enquiries/:id/messages', async (req, res, ctx) => {
    const user = requireAuth(req);
    const enquiry = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(ctx.params.id);
    if (!enquiry) throw notFound('Enquiry not found');
    assertParticipant(enquiry, user.id);

    const body = ctx.body;
    requireFields(body, ['body']);

    const result = db
      .prepare('INSERT INTO messages (enquiry_id, sender_id, body) VALUES (?, ?, ?)')
      .run(enquiry.id, user.id, body.body);
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(result.lastInsertRowid));
    res.statusCode = 201;
    return { message };
  });
}
