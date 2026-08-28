# DarkTrace Nexus — Production Deployment Guide

## Overview

This guide walks you through deploying DarkTrace Nexus to production:

- **Frontend:** Vercel (Next.js)
- **Backend:** Render.com (FastAPI + Docker)
- **Database:** Render PostgreSQL (managed)
- **Realtime:** SSE (Server-Sent Events)

---

## Step 1: Push to GitHub

```bash
cd /home/darkbytehunter/Desktop/DarkTrace-Nexus

# Initialize git (if not already)
git init
git add -A
git status  # Review what will be committed

# Commit
git commit -m "DarkTrace Nexus v1.0 - production ready"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/darktrace-nexus.git
git branch -M main
git push -u origin main
```

**Verify:** `.env` is NOT in the committed files (check `git status`).

---

## Step 2: Create PostgreSQL on Render

1. Go to [render.com](https://render.com) → Sign up / Log in
2. **New** → **PostgreSQL**
3. Settings:
   - Name: `darktrace-db`
   - Database: `darktrace_nexus`
   - User: `darktrace`
   - Region: Singapore (or closest to your users)
   - Plan: **Free** (for testing) or **Starter** (for production)
4. Click **Create Database**
5. Once created, copy the **Internal Database URL** (it looks like):
   ```
   postgresql://darktrace:abc123@dpg-xxxxx-a.oregon-postgres.render.com:5432/darktrace_nexus
   ```
6. **Convert it** to the async format by replacing `postgresql://` with `postgresql+asyncpg://`:
   ```
   postgresql+asyncpg://darktrace:abc123@dpg-xxxxx-a.oregon-postgres.render.com:5432/darktrace_nexus
   ```

**Save this URL — you'll need it in Step 3.**

---

## Step 3: Deploy Backend on Render

1. Go to Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repository
3. Settings:
   - **Name:** `darktrace-nexus-api`
   - **Region:** Singapore (or closest)
   - **Branch:** `main`
   - **Runtime:** Docker
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Docker Context:** `.` (project root, not backend/)
   - **Port:** `8000`
4. **Environment Variables** (click "Advanced" → "Add Environment Variable"):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql+asyncpg://darktrace:abc123@dpg-xxxxx-a.oregon-postgres.render.com:5432/darktrace_nexus` |
   | `JWT_SECRET_KEY` | (run `openssl rand -hex 32` and paste the output) |
   | `JWT_ALGORITHM` | `HS256` |
   | `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
   | `CORS_ORIGINS` | `["https://your-app.vercel.app"]` |
   | `ENABLE_DOCS` | `false` |
   | `ENABLE_DEMO_AUTH` | `false` |
   | `ENVIRONMENT` | `production` |
   | `API_HOST` | `0.0.0.0` |
   | `API_PORT` | `8000` |
   | `DB_POOL_SIZE` | `20` |
   | `DB_MAX_OVERFLOW` | `10` |

5. **Create Web Service**
6. Wait for deployment to complete (first build takes ~3-5 minutes)
7. Verify: Visit `https://darktrace-nexus-api.onrender.com/health` — should return `{"status":"healthy"}`

**Save your backend URL — you'll need it in Step 5.**

---

## Step 4: Load Data into Production Database

After the backend is deployed and the database is connected:

**Option A: Using the upload endpoint**
1. Open your backend URL + `/docs` (only if ENABLE_DOCS=true temporarily)
2. Use the `/api/v1/auth/demo-token` endpoint to get a token (only if ENABLE_DEMO_AUTH=true temporarily)
3. Upload the synthetic data files from `data/synthetic/` using the `/api/v1/ingestion/upload` endpoint

**Option B: Using a one-time script**
Add a startup script or use Render's shell to run:
```bash
python -c "import asyncio; from scripts.load_data import load_data; asyncio.run(load_data())"
```

**Note:** The backend automatically creates all database tables on startup.

---

## Step 5: Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up / Log in with GitHub
2. **Add New Project** → Import `darktrace-nexus`
3. Settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `.next` (auto-detected)
4. **Environment Variables:**

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://darktrace-nexus-api.onrender.com` |

5. **Deploy**
6. Wait for deployment (~1-2 minutes)
7. Visit your Vercel URL — should show the DarkTrace Nexus dashboard

---

## Step 6: Update CORS

After getting your Vercel URL, update the backend CORS:

1. Go to Render Dashboard → `darktrace-nexus-api` → Environment
2. Update `CORS_ORIGINS`:
   ```
   ["https://your-actual-vercel-url.vercel.app"]
   ```
3. The service will auto-redeploy

---

## Step 7: Verify Deployment

```bash
# Backend health
curl https://darktrace-nexus-api.onrender.com/health

# Backend readiness (checks DB connection)
curl https://darktrace-nexus-api.onrender.com/ready

# Frontend
curl -I https://your-app.vercel.app/dashboard
```

Open `https://your-app.vercel.app` in a browser:
- Dashboard should show statistics
- All pages should load
- Real-time indicator should show "Live (SSE)" or "Polling"

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL async connection string |
| `JWT_SECRET_KEY` | Yes | Random hex string for JWT signing |
| `JWT_ALGORITHM` | No | Default: HS256 |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default: 30 |
| `CORS_ORIGINS` | Yes | JSON array of allowed origins |
| `ENABLE_DOCS` | No | Set `false` for production |
| `ENABLE_DEMO_AUTH` | No | Set `false` for production |
| `ENVIRONMENT` | No | Set `production` to enable strict checks |
| `API_HOST` | No | Default: 0.0.0.0 |
| `API_PORT` | No | Default: 8000 |
| `DB_POOL_SIZE` | No | Default: 20 |
| `DB_MAX_OVERFLOW` | No | Default: 10 |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL |

---

## Troubleshooting

### Backend won't start
- Check Render logs for `DATABASE_URL` connection errors
- Ensure you used `postgresql+asyncpg://` (not `postgresql://`)
- Check that the database is in the same region as the backend

### Frontend shows "Connection Error"
- Verify `NEXT_PUBLIC_API_URL` is set correctly in Vercel
- Ensure the backend is running (check `/health` endpoint)
- Check CORS_ORIGINS includes your Vercel URL

### SSE not working
- SSE requires a persistent connection — it works with single-worker gunicorn
- If SSE fails, the frontend automatically falls back to 30-second polling
- Check that `Cache-Control: no-cache` header is present in SSE response

### Slow first request
- Render free tier spins down after inactivity
- First request takes ~30-60 seconds to cold start
- Subsequent requests are fast

---

## Security Notes

- `.env` is gitignored — never commit secrets
- JWT secret must be unique per environment
- CORS is restricted to your Vercel domain
- Demo authentication is disabled in production
- API docs are disabled in production
- Database is not exposed to the public internet
- All API endpoints require JWT authentication
