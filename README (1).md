# Natural Stone Network — Backend API

A REST API for the Natural Stone Network platform. Deliberately **zero external dependencies** — it runs on Node's built-in `http` module and Node 22's built-in `node:sqlite`, so `npm install` isn't required to get going. Swap in Express/Postgres/Prisma later without changing the overall shape of the code.

> `node:sqlite` is still an experimental Node API (stable Node 22+). It works well for an MVP; see **Moving to production** below for when to graduate off it.

## Requirements

- Node.js **22.5+** (for `node:sqlite`). Check with `node -v`.

## Setup

```bash
cd backend
cp .env.example .env      # adjust AUTH_SECRET etc. for your environment
npm run seed               # creates data/natural-stone-network.db and populates demo data
npm start                  # starts the API on http://localhost:4000
```

Demo accounts created by the seed script:

| Email | Password | Role |
|---|---|---|
| `s.whitfield@example.com` | `customerpass1` | customer |
| `hello@haldenstoneworks.example` | `foundingmember1` | professional |
| `hello@craneandvale.example` | `foundingmember1` | business |
| `hello@solentslabimports.example` | `foundingmember1` | supplier |

Use `npm run dev` instead of `npm start` for auto-restart on file changes (`node --watch`).

## Project structure

```
backend/
├── server.js                  # entry point
├── package.json
├── .env.example
├── data/                      # SQLite database file lives here (gitignored)
└── src/
    ├── config.js               # env loading
    ├── db.js                   # schema + connection (node:sqlite)
    ├── auth.js                 # password hashing, signed tokens, auth guards
    ├── http.js                 # request/response helpers, HttpError
    ├── router.js                # tiny dependency-free router
    ├── app.js                  # wires routes + CORS + error handling
    ├── seed.js                 # demo data matching the front-end mockups
    └── routes/
        ├── auth.routes.js
        ├── professionals.routes.js
        ├── projects.routes.js
        ├── enquiries.routes.js
        ├── opportunities.routes.js
        └── dashboard.routes.js
```

## Authentication

Register or log in to get a signed token, then send it as `Authorization: Bearer <token>` on subsequent requests.

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"a-strong-password","role":"customer"}'
```

Tokens are a minimal JWT-style structure (HMAC-SHA256 signed, 7-day expiry) — see `src/auth.js`. This is fine for an MVP; swap for a maintained JWT library once you can install dependencies.

Roles: `customer`, `professional`, `business`, `supplier`. `professional` and `business` both get a `professional_profiles` row (distinguished by `account_type`) so the directory can query them together or apart.

## API reference

All responses are JSON. Endpoints marked 🔒 require a valid `Authorization: Bearer` token; roles in brackets restrict who can call them.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, role, location?, businessName?, specialism? }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | 🔒 current user |

### Professionals & suppliers
| Method | Path | Notes |
|---|---|---|
| GET | `/api/professionals` | filter: `?specialism=&location=&accountType=` |
| GET | `/api/professionals/:id` | profile + published projects |
| GET | `/api/suppliers` | filter: `?limit=&offset=` |
| GET | `/api/suppliers/:id` | |

### Projects (portfolio)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/projects` | filter: `?stoneType=&location=&ownerId=` |
| POST | `/api/projects` | 🔒 professional/business |
| GET | `/api/projects/:id` | includes images, comments, like/save counts |
| POST /DELETE | `/api/projects/:id/like` | 🔒 |
| POST /DELETE | `/api/projects/:id/save` | 🔒 |
| GET/POST | `/api/projects/:id/comments` | POST 🔒 |
| POST/DELETE | `/api/users/:id/follow` | 🔒 follow a professional/business/supplier |

### Enquiries, quotes & workspace messages
| Method | Path | Notes |
|---|---|---|
| POST | `/api/enquiries` | 🔒 customer — `{ professionalId, projectId?, message }` |
| GET | `/api/enquiries` | 🔒 mine, as either party |
| GET | `/api/enquiries/:id` | 🔒 includes quotes + messages |
| PATCH | `/api/enquiries/:id` | 🔒 `{ status }` |
| POST | `/api/enquiries/:id/quotes` | 🔒 professional/business — `{ amountCents, notes? }` |
| POST | `/api/quotes/:id/approve` | 🔒 customer |
| GET/POST | `/api/enquiries/:id/messages` | 🔒 workspace chat |

### Work opportunities
| Method | Path | Notes |
|---|---|---|
| GET | `/api/opportunities` | filter: `?type=&location=` |
| POST | `/api/opportunities` | 🔒 business/professional |
| GET | `/api/opportunities/:id` | |
| PATCH | `/api/opportunities/:id` | 🔒 owner only — `{ status }` |
| POST | `/api/opportunities/:id/apply` | 🔒 `{ coverNote? }` |
| GET | `/api/opportunities/:id/applications` | 🔒 owner only |

### Dashboards
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard/professional` | 🔒 professional/business — stats for `dashboard-professional.html` |
| GET | `/api/dashboard/business` | 🔒 business — stats for `dashboard-business.html` |

### Health
| Method | Path |
|---|---|
| GET | `/api/health` |

## Wiring up the front end

The front end in `../` is already wired up (`../js/api.js`) — this section is for reference if you change the API's base URL or extend the wiring further.

1. Serve the front end separately (e.g. `python3 -m http.server 5500` from the repo root) and make sure `CORS_ORIGIN` in `.env` includes that origin (it does by default).
2. The front end reads `window.NSN_API_BASE` (defaulting to `http://localhost:4000/api`) — override it by setting that global before `js/api.js` loads if you deploy the API elsewhere.
3. Auth tokens are kept in `sessionStorage` on the front end (`js/api.js`'s `Auth` object) — cleared when the tab closes.

## Moving to production

This backend is intentionally minimal so it runs anywhere without a build step. Before real users touch it, you'll want to:

- **Database**: move from SQLite to Postgres (e.g. via `pg` or an ORM like Prisma/Drizzle) once you're running more than one server instance or need concurrent writes at scale.
- **Auth**: swap the hand-rolled token signer for a maintained library, add refresh tokens, and consider rate-limiting login attempts.
- **Validation**: the current checks are minimal (`requireFields`); add stricter input validation (e.g. `zod`) especially for anything user-submitted.
- **File uploads**: project images are currently just URLs — add real upload handling (e.g. to S3-compatible storage) for photos/videos.
- **Framework**: Express or Fastify will make growing the route list easier once you're comfortable adding dependencies.
- **Testing**: add integration tests around auth, enquiries and the founding-member sign-up flow before opening this to real customers.
