from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.ANALYST


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class ActorCreate(BaseModel):
    name: str
    risk_level: str = "UNKNOWN"
    description: Optional[str] = None
    tags: Optional[str] = None


class ActorResponse(BaseModel):
    id: int
    name: str
    risk_level: str
    confidence_score: float
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    description: Optional[str] = None
    tags: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    alias_count: int = 0
    pgp_count: int = 0
    wallet_count: int = 0
    domain_count: int = 0
    post_count: int = 0

    class Config:
        from_attributes = True


class AliasResponse(BaseModel):
    id: int
    actor_id: int
    handle: str
    platform: Optional[str] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    is_primary: bool = False

    class Config:
        from_attributes = True


class PGPKeyResponse(BaseModel):
    id: int
    actor_id: int
    fingerprint: str
    key_id: Optional[str] = None
    user_id: Optional[str] = None
    creation_date: Optional[datetime] = None
    algorithm: Optional[str] = None

    class Config:
        from_attributes = True


class WalletResponse(BaseModel):
    id: int
    actor_id: int
    address: str
    currency: str
    label: Optional[str] = None
    balance: float = 0.0
    transaction_count: int = 0
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


class DomainResponse(BaseModel):
    id: int
    actor_id: int
    domain: str
    is_tor: bool = False
    first_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


class IPResponse(BaseModel):
    id: int
    actor_id: int
    ip_address: str
    port: Optional[int] = None
    asn: Optional[str] = None
    country: Optional[str] = None
    is_tor: bool = False

    class Config:
        from_attributes = True


class PostResponse(BaseModel):
    id: int
    actor_id: int
    title: Optional[str] = None
    content: Optional[str] = None
    platform: Optional[str] = None
    forum: Optional[str] = None
    marketplace: Optional[str] = None
    category: Optional[str] = None
    posted_at: Optional[datetime] = None
    word_count: Optional[int] = None

    class Config:
        from_attributes = True


class RelationshipResponse(BaseModel):
    id: int
    source_entity_type: str
    source_entity_id: int
    target_entity_type: str
    target_entity_id: int
    relationship_type: str
    confidence: float
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


class EvidenceResponse(BaseModel):
    id: int
    investigation_id: Optional[int] = None
    actor_id: Optional[int] = None
    evidence_type: str
    description: str
    source: Optional[str] = None
    confidence: float = 0.0
    relationship_type: Optional[str] = None
    evidence_hash: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AttributionResponse(BaseModel):
    id: int
    source_actor_id: int
    target_actor_id: int
    overall_confidence: float
    confidence_level: str
    alias_similarity: float = 0.0
    pgp_match: float = 0.0
    wallet_relationship: float = 0.0
    behavior_similarity: float = 0.0
    stylometry_similarity: float = 0.0
    infrastructure_match: float = 0.0
    temporal_correlation: float = 0.0
    source_reliability: float = 0.0
    supporting_evidence: Optional[str] = None
    contradicting_evidence: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimelineEventResponse(BaseModel):
    id: int
    investigation_id: Optional[int] = None
    actor_id: Optional[int] = None
    event_type: str
    title: str
    description: Optional[str] = None
    event_date: datetime
    confidence: float = 0.0
    source: Optional[str] = None

    class Config:
        from_attributes = True


class BehaviorProfileResponse(BaseModel):
    id: int
    actor_id: int
    night_activity_pct: float = 0.0
    weekend_activity_pct: float = 0.0
    avg_posting_interval_hours: float = 0.0
    alias_migration_freq: str = "LOW"
    marketplace_activity: str = "LOW"
    forum_activity: str = "LOW"
    posting_frequency: float = 0.0
    timezone_estimate: Optional[str] = None

    class Config:
        from_attributes = True


class StylometricProfileResponse(BaseModel):
    id: int
    actor_id: int
    avg_sentence_length: float = 0.0
    vocabulary_richness: float = 0.0
    punctuation_ratio: float = 0.0
    avg_word_length: float = 0.0
    sample_count: int = 0

    class Config:
        from_attributes = True


class IngestionStats(BaseModel):
    records_processed: int = 0
    actors_discovered: int = 0
    aliases_discovered: int = 0
    infrastructure_indicators: int = 0
    wallets: int = 0
    pgp_keys: int = 0
    domains: int = 0
    relationships: int = 0
    duplicates: int = 0
    errors: int = 0


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    properties: Optional[dict] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    properties: Optional[dict] = None


class GraphData(BaseModel):
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []


class InvestigationCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"


class InvestigationResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    owner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReportRequest(BaseModel):
    actor_id: int
    investigation_id: Optional[int] = None
    format: str = "json"  # json, csv, pdf


class DashboardStats(BaseModel):
    total_actors: int = 0
    total_aliases: int = 0
    total_pgps: int = 0
    total_wallets: int = 0
    total_domains: int = 0
    total_ips: int = 0
    total_posts: int = 0
    total_relationships: int = 0
    total_evidence: int = 0
    total_attributions: int = 0
    high_confidence_linkages: int = 0
    recent_intelligence: int = 0
