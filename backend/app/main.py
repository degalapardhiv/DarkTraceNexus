from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, Base
from app.api import api_router
from app.services.sse_service import sse_broadcaster
import time
import json


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="DarkTrace Nexus",
    description="AI-Powered Dark-Web Threat Intelligence, Actor Correlation & Attribution Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time, 4))
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.include_router(api_router)


@app.get("/health")
@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "DarkTrace Nexus API", "version": "1.0.0"}


@app.get("/ready")
async def readiness_check():
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return Response(
            content=json.dumps({"status": "not ready", "error": str(e)}),
            status_code=503,
            media_type="application/json",
        )


@app.get("/api/v1/events")
async def sse_events(request: Request):
    async def event_generator():
        async for event in sse_broadcaster.subscribe():
            yield f"event: {event['event']}\ndata: {event['data']}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/v1/status")
async def api_status():
    return {
        "api": "operational",
        "version": "1.0.0",
        "mode": "demo",
        "description": "DarkTrace Nexus - Defensive Threat Intelligence Platform",
        "sse_clients": sse_broadcaster.client_count,
    }
