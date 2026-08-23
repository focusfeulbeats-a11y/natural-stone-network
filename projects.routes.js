import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { requireFields, notFound, parsePagination } from '../http.js';

export function registerProjectRoutes(router) {
  // GET /api/projects?stoneType=&location=&ownerId=&limit=&offset=
  router.get('/api/projects', async (req, res, ctx) => {
    const { limit, offset } = parsePagination(ctx.query);
    const stoneType = ctx.query.get('stoneType');
    const location = ctx.query.get('location');
    const ownerId = ctx.query.get('ownerId');

    const clauses = [`status = 'published'`];
    const params = [];
    if (stoneType) { clauses.push('stone_type = ?'); params.push(stoneType); }
    if (location) { clauses.push('location LIKE ?'); params.push(`%${location}%`); }
    if (ownerId) { clauses.push('owner_id = ?'); params.push(ownerId); }

    const rows = db
      .prepare(
        `SELECT p.*,
           (SELECT COUNT(*) FROM likes WHERE project_id = p.id) AS like_count,
           (SELECT COUNT(*) FROM saves WHERE project_id = p.id) AS save_count,
           u.name AS owner_name
         FROM projects p
         JOIN users u ON u.id = p.owner_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return { projects: rows, limit, offset };
  });

  router.post('/api/projects', async (req, res, ctx) => {
    const user = requireRole(req, 'professional', 'business');
    const body = ctx.body;
    requireFields(body, ['title']);

    const result = db
      .prepare(
        `INSERT INTO projects (owner_id, title, description, stone_type, service, finish, location, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.id,
        body.title,
        body.description || null,
        body.stoneType || null,
        body.service || null,
        body.finish || null,
        body.location || null,
        body.status === 'draft' ? 'draft' : 'published'
      );

    const projectId = Number(result.lastInsertRowid);
    if (Array.isArray(body.images)) {
      const insertImg = db.prepare('INSERT INTO project_images (project_id, url, position) VALUES (?, ?, ?)');
      body.images.forEach((url, i) => insertImg.run(projectId, url, i));
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.statusCode = 201;
    return { project };
  });

  router.get('/api/projects/:id', async (req, res, ctx) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(ctx.params.id);
    if (!project) throw notFound('Project not found');
    const images = db
      .prepare('SELECT url, position FROM project_images WHERE project_id = ? ORDER BY position')
      .all(project.id);
    const owner = db.prepare('SELECT id, name, location FROM users WHERE id = ?').get(project.owner_id);
    const likeCount = db.prepare('SELECT COUNT(*) as c FROM likes WHERE project_id = ?').get(project.id).c;
    const saveCount = db.prepare('SELECT COUNT(*) as c FROM saves WHERE project_id = ?').get(project.id).c;
    const comments = db
      .prepare(
        `SELECT c.id, c.body, c.created_at, u.name AS author_name
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.project_id = ? ORDER BY c.created_at ASC`
      )
      .all(project.id);

    return { project: { ...project, images, owner, likeCount, saveCount, comments } };
  });

  router.post('/api/projects/:id/like', async (req, res, ctx) => {
    const user = requireAuth(req);
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(ctx.params.id);
    if (!project) throw notFound('Project not found');
    db.prepare('INSERT OR IGNORE INTO likes (user_id, project_id) VALUES (?, ?)').run(user.id, project.id);
    return { liked: true };
  });

  router.delete('/api/projects/:id/like', async (req, res, ctx) => {
    const user = requireAuth(req);
    db.prepare('DELETE FROM likes WHERE user_id = ? AND project_id = ?').run(user.id, ctx.params.id);
    return { liked: false };
  });

  router.post('/api/projects/:id/save', async (req, res, ctx) => {
    const user = requireAuth(req);
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(ctx.params.id);
    if (!project) throw notFound('Project not found');
    db.prepare('INSERT OR IGNORE INTO saves (user_id, project_id) VALUES (?, ?)').run(user.id, project.id);
    return { saved: true };
  });

  router.delete('/api/projects/:id/save', async (req, res, ctx) => {
    const user = requireAuth(req);
    db.prepare('DELETE FROM saves WHERE user_id = ? AND project_id = ?').run(user.id, ctx.params.id);
    return { saved: false };
  });

  router.get('/api/projects/:id/comments', async (req, res, ctx) => {
    const comments = db
      .prepare(
        `SELECT c.id, c.body, c.created_at, u.name AS author_name
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.project_id = ? ORDER BY c.created_at ASC`
      )
      .all(ctx.params.id);
    return { comments };
  });

  router.post('/api/projects/:id/comments', async (req, res, ctx) => {
    const user = requireAuth(req);
    const body = ctx.body;
    requireFields(body, ['body']);
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(ctx.params.id);
    if (!project) throw notFound('Project not found');
    const result = db
      .prepare('INSERT INTO comments (project_id, user_id, body) VALUES (?, ?, ?)')
      .run(project.id, user.id, body.body);
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(result.lastInsertRowid));
    res.statusCode = 201;
    return { comment };
  });

  // ---- Follows (of a professional/business/supplier user) ----
  router.post('/api/users/:id/follow', async (req, res, ctx) => {
    const user = requireAuth(req);
    const followeeId = Number(ctx.params.id);
    if (followeeId === user.id) throw notFound('Cannot follow yourself');
    db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)').run(user.id, followeeId);
    return { following: true };
  });

  router.delete('/api/users/:id/follow', async (req, res, ctx) => {
    const user = requireAuth(req);
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(user.id, ctx.params.id);
    return { following: false };
  });
}
