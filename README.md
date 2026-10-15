# CreatorPulse

CreatorPulse is a creator workspace for profiles, time management with Attend, and task planning. The original dashboard demo is preserved at [`/demo/`](public/demo/index.html) and keeps its sample data separate from account data.

## Run locally

Requires Node.js 22 or later.

```sh
npm install
cp .env.example .env
npm run dev
```

Open the Vite address shown in the terminal (usually `http://localhost:5173`). The Express API runs on port 4000 and Vite forwards `/api` requests to it. The API creates its SQLite database at `data/creatorpulse.sqlite` on first start.

For a production-style local run:

```sh
npm run build
NODE_ENV=production npm start
```

The production server serves the built frontend, API, and original demo from one origin. Set `PORT`, `DATABASE_PATH`, and `SESSION_DAYS` in the environment when needed. Keep the database file on persistent storage when deploying.

## What's implemented

- Email and password accounts with per-account creator profiles and Attend tasks.
- Passwords hashed with Node's scrypt; sessions stored server-side and delivered with an HTTP-only cookie.
- Profile and task CRUD endpoints with basic input validation and ownership checks.
- A free local planning helper that turns lines, semicolon-separated items, and “and then” steps into reviewable Attend task suggestions. It has no API key or paid AI service configured and does not perform actions on creator platforms.
- Responsive React frontend with profile, daily plan, and overview screens.
- CreatorPulse stick-figure camera mascot in SVG form for the app and 1024×1024 PNG form for social profiles.
- The original static analytics and simulated content agent demo is copied into `public/demo/`; its mock dashboard data remains independent of signed-in app records.

## API

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/me`, `PUT /api/profile`
- `GET /api/tasks?date=YYYY-MM-DD`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`
- `POST /api/agent/plan`

## Current scope

This is the first full-stack slice, not a finished production service. It does not yet include email verification, password reset, rate limiting, multi-factor authentication, hosted database configuration, third-party creator platform connections, or external AI calls. The local planner is deterministic so the app has no model usage or API costs at this stage.
