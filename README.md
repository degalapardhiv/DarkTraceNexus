# DarkTrace Nexus

**AI-Powered Dark-Web Threat Intelligence, Actor Correlation & Attribution Platform**

> **SIH26151 — Smart India Hackathon 2026** | NTRO | Blockchain & Cybersecurity Theme
>
> This is a **defensive cybersecurity research platform**. All data is synthetic/sanitized. No real dark-web access, no exploitation, no deanonymization of real individuals.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, React Flow |
| Backend | FastAPI, Python 3.11, SQLAlchemy (async), Pydantic v2 |
| Database | PostgreSQL 16 (asyncpg), Neo4j 5 (optional) |
| Auth | JWT + Argon2 password hashing, RBAC |
| Realtime | Server-Sent Events (SSE) with polling fallback |
| ML | scikit-learn, pandas, custom behavioral/stylometric analysis |
| Deploy | Docker multi-stage builds, Vercel (frontend), Render (backend) |

## Architecture

```
GitHub → Vercel (Next.js) → HTTPS → Render (FastAPI) → PostgreSQL
                                    ↕ SSE (real-time dashboard)
```

## Quick Start (Local Development)

```bash
# 1. Clone
git clone https://github.com/your-org/darktrace-nexus.git
cd darktrace-nexus

# 2. Environment
cp .env.example .env
# Edit .env if needed (defaults work for local Docker)

# 3. Start infrastructure
docker-compose up -d postgres

# 4. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# 5. Load data (new terminal)
cd scripts
python -c "import asyncio; from load_data import load_data; asyncio.run(load_data())"

# 6. Frontend (new terminal)
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npx next dev -p 3000
```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step production deployment instructions.

### Quick Summary

1. **Backend (Render):** Create PostgreSQL database → Create Web Service with Docker → Set env vars
2. **Frontend (Vercel):** Import repo → Set `NEXT_PUBLIC_API_URL` → Deploy

## Project Structure

```
darktrace-nexus/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── main.py       # FastAPI app entry point
│   │   ├── core/         # Config, database, security
│   │   ├── api/v1/       # Route handlers (auth, actors, intelligence, ingestion)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic, SSE, analysis
│   │   └── middleware/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             # Next.js application
│   ├── src/
│   │   ├── app/          # Pages (dashboard, actors, graph, attributions, etc.)
│   │   ├── components/   # AppShell layout
│   │   ├── lib/          # API client, SSE client
│   │   └── types/
│   ├── next.config.js
│   └── Dockerfile
├── ml/                   # ML models (empty scaffold)
├── data/synthetic/       # Generated synthetic dataset
├── scripts/              # Data generation and loading
├── tests/                # Backend tests
├── docker-compose.yml
└── .env.example
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login (JWT) |
| POST | `/api/v1/auth/demo-token` | Get demo token (dev only) |
| GET | `/api/v1/intelligence/dashboard` | Dashboard stats |
| GET | `/api/v1/actors/` | List threat actors |
| GET | `/api/v1/actors/{id}` | Actor detail |
| GET | `/api/v1/intelligence/graph/{id}` | Relationship graph |
| GET | `/api/v1/intelligence/attributions` | Attribution list |
| GET | `/api/v1/intelligence/evidence` | Evidence list |
| GET | `/api/v1/intelligence/timeline` | Timeline events |
| GET | `/api/v1/intelligence/search` | Global search |
| POST | `/api/v1/intelligence/report` | Generate report |
| GET | `/api/v1/events` | SSE real-time stream |
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |

## Safety Notice

- All data in this platform is **synthetic and generated for demonstration**
- No real dark-web content is accessed or stored
- No unauthorized access, exploitation, or credential attacks are performed
- No real individuals are de-anonymized
- The platform demonstrates intelligence-correlation methodology only
- Attribution outputs represent **analytical correlation**, not definitive identity determination

## Team

| Role | Responsibility |
|------|----------------|
| D. PARDHIV | Dark Web / OSINT Intelligence |
| B. SREE KRISHNA GOWTHAM | Team Lead & System Architect |
| P. YUGANDHAR | AI/ML & Behavioral Analysis |
| C. SEETHA RAMADEVI | Frontend, Backend & Visualization |
| C. Satyadev | Graph Analytics & Data Engineering |
| A. SIRICHANDANA | Cyber Threat Intelligence & Attribution |

---

**License:** Research/Educational Use Only | **Organization:** NTRO | **Event:** SIH26151
