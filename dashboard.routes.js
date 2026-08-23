import { db } from '../db.js';
import { requireRole } from '../auth.js';

export function registerDashboardRoutes(router) {
  // GET /api/dashboard/professional — stats to power dashboard-professional.html
  router.get('/api/dashboard/professional', async (req) => {
    const user = requireRole(req, 'professional', 'business');

    const newEnquiries = db
      .prepare(`SELECT COUNT(*) as c FROM enquiries WHERE professional_id = ? AND status = 'new'`)
      .get(user.id).c;
    const followerCount = db
      .prepare('SELECT COUNT(*) as c FROM follows WHERE followee_id = ?')
      .get(user.id).c;
    const projectCount = db
      .prepare(`SELECT COUNT(*) as c FROM projects WHERE owner_id = ? AND status = 'published'`)
      .get(user.id).c;

    const recentEnquiries = db
      .prepare(
        `SELECT e.*, c.name AS customer_name FROM enquiries e
         JOIN users c ON c.id = e.customer_id
         WHERE e.professional_id = ? ORDER BY e.created_at DESC LIMIT 10`
      )
      .all(user.id);

    const topProjects = db
      .prepare(
        `SELECT p.*,
           (SELECT COUNT(*) FROM likes WHERE project_id = p.id) AS like_count,
           (SELECT COUNT(*) FROM saves WHERE project_id = p.id) AS save_count
         FROM projects p WHERE p.owner_id = ?
         ORDER BY like_count DESC LIMIT 5`
      )
      .all(user.id);

    return {
      stats: { newEnquiries, followerCount, projectCount },
      recentEnquiries,
      topProjects,
    };
  });

  // GET /api/dashboard/business — stats to power dashboard-business.html
  router.get('/api/dashboard/business', async (req) => {
    const user = requireRole(req, 'business');

    const openLeads = db
      .prepare(
        `SELECT COUNT(*) as c FROM enquiries WHERE professional_id = ? AND status IN ('new','quoted','in_discussion')`
      )
      .get(user.id).c;
    const liveJobs = db
      .prepare(`SELECT COUNT(*) as c FROM opportunities WHERE business_id = ? AND status = 'live'`)
      .get(user.id).c;
    const totalApplicants = db
      .prepare(
        `SELECT COUNT(*) as c FROM applications a
         JOIN opportunities o ON o.id = a.opportunity_id
         WHERE o.business_id = ?`
      )
      .get(user.id).c;

    const leads = db
      .prepare(
        `SELECT e.*, c.name AS customer_name FROM enquiries e
         JOIN users c ON c.id = e.customer_id
         WHERE e.professional_id = ? ORDER BY e.created_at DESC LIMIT 10`
      )
      .all(user.id);

    const jobs = db
      .prepare(
        `SELECT o.*,
           (SELECT COUNT(*) FROM applications WHERE opportunity_id = o.id) AS applicant_count
         FROM opportunities o WHERE o.business_id = ? ORDER BY o.created_at DESC`
      )
      .all(user.id);

    return {
      stats: { openLeads, liveJobs, totalApplicants },
      leads,
      jobs,
    };
  });
}
