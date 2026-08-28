import os
from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://darktrace:darktrace_secret@localhost:5432/darktrace_nexus"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "darktrace_neo4j"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: str = '["http://localhost:3000"]'
    ML_MODEL_PATH: str = "/app/ml/models"
    SENTENCE_TRANSFORMER_MODEL: str = "all-MiniLM-L6-v2"
    ENABLE_DOCS: bool = True
    ENABLE_DEMO_AUTH: bool = True
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_SSL_MODE: str = "prefer"
    SSE_HEARTBEAT_INTERVAL: int = 30

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    def validate_production(self):
        if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == "change-me-in-production-use-openssl-rand-hex-32":
            if os.environ.get("ENVIRONMENT") == "production":
                raise ValueError("JWT_SECRET_KEY must be set to a secure value in production")

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
