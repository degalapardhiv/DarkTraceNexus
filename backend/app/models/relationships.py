from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_entity_type = Column(String(50), nullable=False)
    source_entity_id = Column(Integer, nullable=False)
    target_entity_type = Column(String(50), nullable=False)
    target_entity_id = Column(Integer, nullable=False)
    relationship_type = Column(String(100), nullable=False, index=True)
    confidence = Column(Float, default=0.0)
    source_id = Column(Integer, ForeignKey("sources.id"))
    evidence_id = Column(Integer, ForeignKey("evidence.id"))
    timestamp = Column(DateTime(timezone=True))
    metadata_json = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        {"extend_existing": True},
    )


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    investigation_id = Column(Integer, ForeignKey("investigations.id"), index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), index=True)
    evidence_type = Column(String(100), nullable=False)  # pgp_match, wallet_reuse, stylometric, etc.
    description = Column(Text, nullable=False)
    source = Column(String(255))
    confidence = Column(Float, default=0.0)
    relationship_type = Column(String(100))
    supporting_data = Column(Text)  # JSON
    evidence_hash = Column(String(255))  # SHA-256 hash
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        {"extend_existing": True},
    )


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="OPEN")
    priority = Column(String(50), default="MEDIUM")
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True))

    owner = relationship("User", back_populates="investigations")
    evidence_records = relationship("Evidence", backref="investigation")
    timeline_events = relationship("TimelineEvent", back_populates="investigation")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    investigation_id = Column(Integer, ForeignKey("investigations.id"), index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), index=True)
    event_type = Column(String(100), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    event_date = Column(DateTime(timezone=True), nullable=False, index=True)
    confidence = Column(Float, default=0.0)
    source = Column(String(255))
    evidence_id = Column(Integer, ForeignKey("evidence.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    investigation = relationship("Investigation", back_populates="timeline_events")


class Attribution(Base):
    __tablename__ = "attributions"

    id = Column(Integer, primary_key=True, index=True)
    source_actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    target_actor_id = Column(Integer, ForeignKey("actors.id"), nullable=False, index=True)
    overall_confidence = Column(Float, default=0.0)
    confidence_level = Column(String(50))  # LOW, MEDIUM, HIGH, VERY_HIGH
    alias_similarity = Column(Float, default=0.0)
    pgp_match = Column(Float, default=0.0)
    wallet_relationship = Column(Float, default=0.0)
    behavior_similarity = Column(Float, default=0.0)
    stylometry_similarity = Column(Float, default=0.0)
    infrastructure_match = Column(Float, default=0.0)
    temporal_correlation = Column(Float, default=0.0)
    source_reliability = Column(Float, default=0.0)
    supporting_evidence = Column(Text)  # JSON array of evidence IDs
    contradicting_evidence = Column(Text)  # JSON array of evidence IDs
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class BehaviorProfile(Base):
    __tablename__ = "behavior_profiles"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), unique=True, nullable=False)
    night_activity_pct = Column(Float, default=0.0)
    weekend_activity_pct = Column(Float, default=0.0)
    avg_posting_interval_hours = Column(Float, default=0.0)
    alias_migration_freq = Column(String(50), default="LOW")
    marketplace_activity = Column(String(50), default="LOW")
    forum_activity = Column(String(50), default="LOW")
    transaction_patterns = Column(Text)  # JSON
    activity_bursts = Column(Text)  # JSON
    posting_frequency = Column(Float, default=0.0)
    timezone_estimate = Column(String(50))
    behavioral_hash = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    actor = relationship("Actor", back_populates="behavior_profile")


class StylometricProfile(Base):
    __tablename__ = "stylometric_profiles"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("actors.id"), unique=True, nullable=False)
    avg_sentence_length = Column(Float, default=0.0)
    vocabulary_richness = Column(Float, default=0.0)
    punctuation_ratio = Column(Float, default=0.0)
    avg_word_length = Column(Float, default=0.0)
    function_word_freq = Column(Text)  # JSON
    top_word_freq = Column(Text)  # JSON
    char_ngram_profile = Column(Text)  # JSON
    linguistic_fingerprint = Column(Text)  # JSON vector
    stylistic_hash = Column(String(255))
    sample_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    actor = relationship("Actor", back_populates="stylometric_profile")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    action = Column(String(255), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(Integer)
    details = Column(Text)
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
