# Comeback HQ — Sync API

A small REST API that powers cross-device sync for [Comeback HQ](https://github.com/Vivek-Borole/comeback-hq): email/password auth and a per-user saved-state blob.

**Stack:** Node.js · TypeScript · Express · PostgreSQL (`pg`, parameterized queries) · JWT auth · bcrypt password hashing · Helmet · rate limiting.

## API

| Method | Route            | Auth | Body / Result |
|--------|------------------|------|----------------|
| GET    | `/health`        | —    | `{ ok: true }` |
| POST   | `/auth/signup`   | —    | `{ email, password }` → `{ token, email }` |
| POST   | `/auth/login`    | —    | `{ email, password }` → `{ token, email }` |
| GET    | `/state`         | JWT  | → `{ data, updatedAt }` |
| PUT    | `/state`         | JWT  | `{ data }` → `{ updatedAt }` |

Auth is a Bearer token: `Authorization: Bearer <token>`. Sync uses last-write-wins on a single JSON blob per user.

## Design notes (the interview talking points)
- **Passwords** are hashed with bcrypt (salted, cost 10) — never stored in plaintext.
- **Sessions** are stateless JWTs (30-day expiry) verified on protected routes by `requireAuth` middleware.
- **SQL injection** is prevented by parameterized queries throughout (`$1, $2`).
- **Login** returns the same generic error for unknown-email vs wrong-password (no account enumeration).
- **CORS** is locked to the known frontend origin(s); **Helmet** sets security headers; **rate limiting** throttles auth brute force.
- **Schema** is created on boot (`CREATE TABLE IF NOT EXISTS`); state is upserted with `ON CONFLICT`.

## Run locally
```bash
cp .env.example .env      # fill in DATABASE_URL + JWT_SECRET
npm install
npm run dev               # http://localhost:3000
```
Generate a JWT secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Deploy (free: Neon + Render)

**1. Database — Neon** (neon.tech)
- Create a free project → copy the connection string (starts `postgres://…?sslmode=require`).

**2. API — Render** (render.com)
- New → **Web Service** → connect this GitHub repo.
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add **Environment Variables**:
  - `DATABASE_URL` = your Neon connection string
  - `JWT_SECRET` = a long random string
  - `CORS_ORIGIN` = `https://vivek-borole.github.io`
- Deploy. Your API base URL will be `https://<name>.onrender.com`.

**3. Point the frontend at it**
- In the Comeback HQ app, set `SYNC_API` to your Render URL (see that repo), and redeploy.

> Render's free tier sleeps after ~15 min idle, so the first request after a nap takes ~30–50s to wake. The app stays usable offline (local storage) and syncs in the background once the API wakes, so this is only a minor first-sync delay.
