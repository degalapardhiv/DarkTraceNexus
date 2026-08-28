from fastapi import APIRouter
from app.api.v1 import auth, actors, intelligence, ingestion

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(actors.router)
api_router.include_router(intelligence.router)
api_router.include_router(ingestion.router)
