#!/usr/bin/env python3
"""
DarkTrace Nexus - Quick Start Script
Generates data, loads into database, and starts services.
"""
import asyncio
import subprocess
import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
DATA_DIR = PROJECT_ROOT / "data" / "synthetic"


def run(cmd, cwd=None):
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd or PROJECT_ROOT, capture_output=False)
    if result.returncode != 0:
        print(f"  WARNING: Command failed with exit code {result.returncode}")
    return result.returncode == 0


def main():
    print("=" * 60)
    print("  DarkTrace Nexus - Quick Start")
    print("=" * 60)

    # Step 1: Generate synthetic data
    if not (DATA_DIR / "actors.json").exists():
        print("\n[1/4] Generating synthetic data...")
        run(f"{sys.executable} {SCRIPTS_DIR / 'generate_synthetic_data.py'}")
    else:
        print("\n[1/4] Synthetic data already exists. Regenerating...")
        run(f"{sys.executable} {SCRIPTS_DIR / 'generate_synthetic_data.py'}")

    # Step 2: Install backend dependencies
    print("\n[2/4] Installing backend dependencies...")
    run(f"pip install -q -r {PROJECT_ROOT / 'backend' / 'requirements.txt'}")

    # Step 3: Load data into database
    print("\n[3/4] Loading data into database...")
    run(f"{sys.executable} {SCRIPTS_DIR / 'load_data.py'}")

    # Step 4: Print instructions
    print("\n[4/4] Setup complete!")
    print("\n" + "=" * 60)
    print("  START SERVICES")
    print("=" * 60)
    print("""
  Option A - Docker (recommended):
    docker-compose up -d

  Option B - Manual:
    # Terminal 1 - Backend
    cd backend
    uvicorn app.main:app --reload --port 8000

    # Terminal 2 - Frontend
    cd frontend
    npm install
    npm run dev

  Access:
    Frontend:  http://localhost:3000
    Backend:   http://localhost:8000
    API Docs:  http://localhost:8000/docs
    Neo4j:     http://localhost:7474

  Demo Flow:
    1. Open http://localhost:3000/dashboard
    2. View 50 threat actors and 10 cross-actor correlations
    3. Click 'Threat Actors' to browse profiles
    4. Click 'ShadowAlpha' to view actor profile
    5. Open 'Relationship Graph' to see entity connections
    6. View 'Attributions' tab for cross-actor analysis
    7. Check 'Evidence' for SHA-256 hashed records
    8. Open 'Timeline' for chronological events
    9. Generate investigation report from 'Reports'
""")

    print("=" * 60)
    print("  IMPORTANT SAFETY NOTICE")
    print("=" * 60)
    print("""
  This platform uses ONLY synthetic data for demonstration.
  No real dark-web content is accessed or stored.
  No unauthorized access or exploitation is performed.
  Designed for defensive threat-intelligence research only.
""")


if __name__ == "__main__":
    main()
