from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Actor(Base):
    __tablename__ = "actors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    risk_level = Column(String(50), default="UNKNOWN")
    confidence_score = Column(Float, default=0.0)
    first_seen = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    description = Column(Text)
    tags = Column(Text)  # JSON array
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    aliases = relationship("Alias", back_populates="actor", cascade="all, delete-orphan")
    pgp_keys = relationship("PGPKey", back_populates="actor", cascade="all, delete-orphan")
    wallets = relationship("Wallet", back_populates="actor", cascade="all, delete-orphan")
    domains = relationship("Domain", back_populates="actor", cascade="all, delete-orphan")
    ips = relationship("IP", back_populates="actor", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="actor", cascade="all, delete-orphan")
    behavior_profile = relationship("BehaviorProfile", back_populates="actor", uselist=False)
    stylometric_profile = relationship("StylometricProfile", back_populates="actor", uselist=False)

    __table_args__ = (
        Index("idx_actor_risk", "risk_level"),
        Index("idx_actor_confidence", "confidence_score"),
    )


class Alias(Base):
    __tablename__ = "aliases"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    handle = Column(String(255), nullable=False, index=True)
    platform = Column(String(255))
    first_seen = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("Actor", back_populates="aliases")

    __table_args__ = (
        Index("idx_alias_handle", "handle"),
    )


class PGPKey(Base):
    __tablename__ = "pgp_keys"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    fingerprint = Column(String(255), nullable=False, index=True)
    key_id = Column(String(50))
    user_id = Column(String(255))
    creation_date = Column(DateTime(timezone=True))
    algorithm = Column(String(50))
    key_size = Column(Integer)
    source = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("Actor", back_populates="pgp_keys")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    address = Column(String(255), nullable=False, index=True)
    currency = Column(String(20), default="BTC")
    label = Column(String(255))
    balance = Column(Float, default=0.0)
    transaction_count = Column(Integer, default=0)
    first_seen = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    source = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("Actor", back_populates="wallets")


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    domain = Column(String(500), nullable=False, index=True)
    registrar = Column(String(255))
    name_servers = Column(Text)  # JSON
    ip_addresses = Column(Text)  # JSON
    created_date = Column(DateTime(timezone=True))
    expires_date = Column(DateTime(timezone=True))
    is_tor = Column(Boolean, default=False)
    source = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("Actor", back_populates="domains")


class IP(Base):
    __tablename__ = "ips"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False, index=True)
    port = Column(Integer)
    protocol = Column(String(20))
    asn = Column(String(50))
    country = Column(String(10))
    isp = Column(String(255))
    is_tor = Column(Boolean, default=False)
    first_seen = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    source = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("Actor", back_populates="ips")


class Infrastructure(Base):
    __tablename__ = "infrastructure"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    infra_type = Column(String(100))  # tor_service, vps, hosting
    identifier = Column(String(500), nullable=False, index=True)
    metadata_json = Column(Text)  # JSON blob of infra metadata
    tls_fingerprint = Column(String(255))
    server_banner = Column(String(500))
    asn = Column(String(50))
    hosting_provider = Column(String(255))
    similarity_hash = Column(String(255))
    first_seen = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    source = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    alias_id = Column(Integer, ForeignKey("aliases.id"))
    title = Column(String(500))
    content = Column(Text)
    platform = Column(String(255))
    forum = Column(String(255))
    marketplace = Column(String(255))
    category = Column(String(100))
    url = Column(String(1000))
    posted_at = Column(DateTime(timezone=True))
    language = Column(String(10))
    sentiment = Column(Float)
    word_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("Actor", back_populates="posts")
    alias = relationship("Alias")


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    source_type = Column(String(100))  # feed, manual, synthetic, osint
    reliability = Column(String(10))  # A, B, C, D
    url = Column(String(1000))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    last_fetched = Column(DateTime(timezone=True))
    record_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
