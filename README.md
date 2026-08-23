# Natural Stone Network

A premium UK-focused digital platform for the natural stone industry — connecting customers, professionals (fabricators, installers, masons, restoration specialists), businesses hiring, and suppliers.

This repo contains the **front-end MVP prototype**: a static, dependency-free multi-page site that demonstrates the homepage, professional directory, professional profile, project detail, and Founding Member sign-up flow described in the product spec. It's built with plain HTML/CSS/JS so it runs immediately — no build step, no npm install — and is ready to publish via GitHub Pages or wired up to a real backend later.

## Pages

| Page | File | Purpose |
|---|---|---|
| Homepage | `index.html` | Hero, four journeys, project gallery, AI Project Planner teaser, featured professionals, work opportunities, industry activity feed, suppliers, knowledge centre, founding-member CTA |
| Professionals directory | `professionals.html` | Filterable directory/search of professionals |
| Professional profile | `professional-profile.html` | Individual professional's portfolio, stats, reviews |
| Project detail | `project.html` | A single published project, with engagement (likes/saves) and a link back to the professional |
| Join / Founding Member | `signup.html` | Role-based sign-up form (customer / professional / business / supplier) |
| Work opportunities | `opportunities.html` | Filterable list of permanent/temporary/subcontract roles across businesses |
| Professional dashboard | `dashboard-professional.html` | Enquiries, active projects, engagement stats, AI tools, profile completeness |
| Customer dashboard | `dashboard-customer.html` | Quote comparison, project timeline, project files and aftercare |
| Business dashboard | `dashboard-business.html` | Leads/enquiries, team, recruitment postings, portfolio performance |
| Supplier profile | `supplier-profile.html` | A supplier's material catalogue and the projects built with their stone |
| Knowledge Centre article | `article.html` | Editorial guide template with related-article links |
| Project workspace | `workspace.html` | Shared customer/professional space: messages, quotes, milestones, files, people |

## Design system

- **Palette**: charcoal stone background, ivory (marble) text, a muted malachite-green "vein" accent, and a bronze accent for calls to action — evoking stone veining and fittings rather than a generic SaaS look.
- **Type**: [Fraunces](https://fonts.google.com/specimen/Fraunces) for display headings, [Inter](https://fonts.google.com/specimen/Inter) for body and UI text.
- **Signature element**: an animated "vein line" SVG in the hero — a literal visual metaphor for stone veining and for the network connecting people.
- All styles live in `css/style.css`; all shared behaviour (filters, mobile nav, animated stats, the sign-up role toggle, demo form handling) lives in `js/main.js`.

## Running locally

No build tools required. Either:

```bash
# open directly
open index.html

# or serve locally (recommended, avoids any file:// quirks)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Backend

A real, dependency-free REST API now lives in [`backend/`](backend/) — Node's built-in `http` server plus Node 22's built-in `node:sqlite`, so it runs with just `node`, no `npm install` required. See [`backend/README.md`](backend/README.md) for setup, the full API reference, and demo login credentials.

```bash
cd backend
cp .env.example .env
npm run seed
npm start   # http://localhost:4000
```

The front end is now wired to this API (see [`js/api.js`](js/api.js)) — real registration/login, live project/professional/supplier/opportunity listings, likes/saves/comments, enquiries, quotes, and the messaging workspace all talk to the live backend rather than hard-coded data. Run both servers together to try it end to end:

```bash
# terminal 1 — backend
cd backend && cp .env.example .env && npm run seed && npm start   # http://localhost:4000

# terminal 2 — front end
python3 -m http.server 5500   # http://localhost:5500
```

Then open `http://localhost:5500/index.html`. Demo logins (see `backend/README.md`): `s.whitfield@example.com` / `customerpass1` (customer), or `hello@haldenstoneworks.example` / `foundingmember1` (professional).

## Publishing to GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, go to **Pages** → set the source to the `main` branch, root folder.
3. The site will be live at `https://<your-username>.github.io/<repo-name>/`.
4. GitHub Pages only serves the static front end — the backend needs to be deployed separately (Railway, Render, Fly.io, a VPS, etc.) and `js/api.js`'s `API_BASE` pointed at it, e.g. `<script>window.NSN_API_BASE = 'https://your-api.example.com/api';</script>` before `api.js` loads.

## What's built vs. what's next

This is now a full-stack prototype: an 11-page front end wired to a real, tested REST API (accounts/auth, projects with likes/saves/follows/comments, enquiries → quotes → workspace messaging, work opportunities/applications, and dashboard stats). Not yet built:

- The AI Project Planner, AI Quote Assistant, and other AI tools (currently shown as a static teaser on the homepage)
- Payments / membership billing
- Supplier sponsorship analytics
- File/image uploads (project photos are just data today, no real storage)
- Publishing new projects, quotes, or opportunities from the front end (creating those currently requires calling the API directly — reading, liking, commenting, enquiring, messaging, and applying are all wired)

## Project structure

```
natural-stone-network/
├── index.html
├── professionals.html
├── professional-profile.html
├── project.html
├── signup.html
├── opportunities.html
├── dashboard-professional.html
├── dashboard-business.html
├── supplier-profile.html
├── article.html
├── workspace.html
├── css/
│   └── style.css
├── js/
│   └── main.js
├── backend/              # REST API — see backend/README.md
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── src/
└── README.md
```


## Product direction

The current prototype now treats the customer/professional dashboard and project timeline as a core part of the product, rather than a later add-on. The customer journey is designed around **discover → compare → hire → manage → complete → maintain**.

The Natural Stone Academy, recruitment marketplace and post-project aftercare are also positioned as first-class ecosystem components. Payment/escrow remains intentionally future-facing and should only be integrated through an appropriate regulated payment provider once the network has sufficient activity and trust.
