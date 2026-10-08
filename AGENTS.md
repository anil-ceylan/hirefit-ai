# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

HireFit AI is a dual-service app:
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 SPA (port 5173)
- **Backend**: Express 5 server in `server/` (port 3000)

Both are Node.js (ESM) and use `npm` as the package manager (`package-lock.json` in both root and `server/`).

### Running locally

| Service | Command | Working Dir |
|---------|---------|-------------|
| Frontend dev | `npm run dev` | `/workspace` |
| Backend | `node server/server.js` | `/workspace/server` |
| Lint | `npm run lint` | `/workspace` |
| Build | `npm run build` | `/workspace` |

The frontend reads `VITE_API_URL` to locate the backend. Set `VITE_API_URL=http://localhost:3000` in `/workspace/.env` for local dev so requests go to the local Express server instead of the production Railway URL.

The backend loads its `.env` from `server/.env` (via `server/loadEnv.js`). Both `.env` files are gitignored; see `.env.example` for the template.

### Required environment variables (secrets)

- `GROQ_API_KEY` — Groq LLM API (used for job extraction, CV optimization, roadmap)
- `ANTHROPIC_API_KEY` — Anthropic Claude (core analysis engines: ATS, Recruiter, Decision)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase auth + DB

Without these secrets the backend will start (health check passes) but AI-dependent endpoints will fail.

### Gotchas

- The CORS middleware in `server/server.js` hardcodes `https://hirefit-ai.vercel.app` as the allowed origin. When testing locally with `curl` or the Vite dev server, requests to the backend from the browser may be blocked. Use `VITE_API_URL=http://localhost:3000` and the backend still responds to direct requests (curl, scripts) regardless of origin.
- ESLint has ~160 pre-existing errors in the codebase (mostly `no-unused-vars` and `no-empty`). These are not blocking.
- The server sub-package has its own `node_modules`; always run `npm install` in both root and `server/`.
- Supabase is hosted (no local Supabase CLI setup needed). Auth JWT validation happens on every protected endpoint.
