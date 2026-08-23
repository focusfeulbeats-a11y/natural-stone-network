// Populates the database with the same demo businesses/projects used in the
// static front end, so the two can be wired together meaningfully.
// Run with: npm run seed

import { db } from './db.js';
import { hashPassword } from './auth.js';

function upsertUser({ email, password, name, role, location, businessName, specialism, accountType, foundingMember, verified, materials, featured }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;

  const { hash, salt } = hashPassword(password);
  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, password_salt, name, role, location) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(email, hash, salt, name, role, location);
  const userId = Number(result.lastInsertRowid);

  if (role === 'professional' || role === 'business') {
    db.prepare(
      `INSERT INTO professional_profiles (user_id, business_name, specialism, account_type, founding_member, verified, years_trading)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, businessName, specialism, accountType || role, foundingMember ? 1 : 0, verified ? 1 : 0, 10);
  } else if (role === 'supplier') {
    db.prepare(
      `INSERT INTO supplier_profiles (user_id, business_name, materials, featured, verified)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId, businessName, materials, featured ? 1 : 0, verified ? 1 : 0);
  }

  return userId;
}

console.log('Seeding demo data...');

const halden = upsertUser({
  email: 'hello@haldenstoneworks.example',
  password: 'foundingmember1',
  name: 'Halden Stoneworks',
  role: 'professional',
  location: 'Guildford, Surrey',
  businessName: 'Halden Stoneworks',
  specialism: 'Fabricator',
  foundingMember: true,
  verified: true,
});

const marrow = upsertUser({
  email: 'hello@marrowfinch.example',
  password: 'foundingmember1',
  name: 'Marrow & Finch',
  role: 'professional',
  location: 'London',
  businessName: 'Marrow & Finch',
  specialism: 'Installer',
  verified: true,
});

const craneVale = upsertUser({
  email: 'hello@craneandvale.example',
  password: 'foundingmember1',
  name: 'Crane & Vale',
  role: 'business',
  location: 'Leeds',
  businessName: 'Crane & Vale',
  specialism: 'Fabricator',
  verified: true,
});

const solent = upsertUser({
  email: 'hello@solentslabimports.example',
  password: 'foundingmember1',
  name: 'Solent Slab Imports',
  role: 'supplier',
  location: 'Southampton',
  businessName: 'Solent Slab Imports',
  materials: 'Marble, Granite, Quartzite, Onyx',
  featured: true,
  verified: true,
});

const customer = upsertUser({
  email: 's.whitfield@example.com',
  password: 'customerpass1',
  name: 'S. Whitfield',
  role: 'customer',
  location: 'Guildford, Surrey',
});

function seedProject(ownerId, data) {
  const existing = db.prepare('SELECT id FROM projects WHERE owner_id = ? AND title = ?').get(ownerId, data.title);
  if (existing) return existing.id;
  const result = db
    .prepare(
      `INSERT INTO projects (owner_id, title, description, stone_type, service, finish, location, recognition)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(ownerId, data.title, data.description, data.stoneType, data.service, data.finish, data.location, data.recognition || null);
  return Number(result.lastInsertRowid);
}

const calacattaIsland = seedProject(halden, {
  title: 'Calacatta Island & Splashback',
  description: 'A 3.4m Calacatta marble island with a matching waterfall edge and full-height splashback.',
  stoneType: 'marble',
  service: 'Kitchen',
  finish: 'Honed',
  location: 'Surrey',
  recognition: 'Project of the Week',
});

seedProject(marrow, {
  title: 'Filled & Honed Travertine Wet-Room',
  description: 'A full travertine wet-room installation with underfloor heating.',
  stoneType: 'travertine',
  service: 'Bathroom',
  finish: 'Honed',
  location: 'London',
  recognition: 'Most Admired',
});

seedProject(craneVale, {
  title: 'Nero Assoluto Galley Worktops',
  description: 'Templated and fitted granite galley worktops for a commercial kitchen refit.',
  stoneType: 'granite',
  service: 'Worktops',
  finish: 'Polished',
  location: 'Leeds',
});

// A couple of engagement signals on the flagship project.
db.prepare('INSERT OR IGNORE INTO likes (user_id, project_id) VALUES (?, ?)').run(customer, calacattaIsland);
db.prepare('INSERT OR IGNORE INTO saves (user_id, project_id) VALUES (?, ?)').run(customer, calacattaIsland);
db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)').run(customer, halden);

// An opportunity posted by Crane & Vale.
const existingOpp = db.prepare('SELECT id FROM opportunities WHERE business_id = ? AND title = ?').get(craneVale, 'Senior Fabricator');
if (!existingOpp) {
  db.prepare(
    `INSERT INTO opportunities (business_id, title, type, location, description) VALUES (?, ?, ?, ?, ?)`
  ).run(craneVale, 'Senior Fabricator', 'permanent', 'Leeds', 'Experienced fabricator needed for marble & granite work.');
}

// A sample enquiry + quote thread, so /workspace-style views have real data.
const existingEnquiry = db.prepare('SELECT id FROM enquiries WHERE customer_id = ? AND professional_id = ?').get(customer, halden);
let enquiryId = existingEnquiry?.id;
if (!enquiryId) {
  const result = db
    .prepare(
      `INSERT INTO enquiries (customer_id, professional_id, project_id, message, status)
       VALUES (?, ?, ?, ?, 'quoted')`
    )
    .run(customer, halden, calacattaIsland, 'Loving this project — could you quote for something similar in our kitchen?');
  enquiryId = Number(result.lastInsertRowid);

  db.prepare(
    `INSERT INTO quotes (enquiry_id, version, amount_cents, notes, status) VALUES (?, 1, ?, ?, 'sent')`
  ).run(enquiryId, 845000, 'Calacatta island, waterfall edge, templating included.');

  db.prepare('INSERT INTO messages (enquiry_id, sender_id, body) VALUES (?, ?, ?)').run(
    enquiryId, customer, 'Slab selection photos attached. Loving option 2, the veining runs perfectly with the waterfall edge.'
  );
  db.prepare('INSERT INTO messages (enquiry_id, sender_id, body) VALUES (?, ?, ?)').run(
    enquiryId, halden, "Great choice — that slab's booked for you. Templating is booked for the 21st."
  );
}

console.log('Seed complete.');
console.log('Demo login: s.whitfield@example.com / customerpass1');
console.log('Demo login: hello@haldenstoneworks.example / foundingmember1');
