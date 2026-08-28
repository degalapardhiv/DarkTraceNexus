#!/usr/bin/env python3
"""
Load synthetic data into PostgreSQL database.
Run after generating synthetic data.
"""
import asyncio
import json
import sys
import os
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.core.config import settings
from app.core.database import engine, async_session, Base
from app.models.user import User, UserRole
from app.models.entities import Actor, Alias, PGPKey, Wallet, Domain, IP, Post, Source, Infrastructure
from app.models.relationships import (
    Relationship, Evidence, Investigation, TimelineEvent,
    Attribution, BehaviorProfile, StylometricProfile
)
from app.core.security import get_password_hash


async def load_data():
    print("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check if data already exists
        from sqlalchemy import select, func
        count = (await db.execute(select(func.count(Actor.id)))).scalar()
        if count and count > 0:
            print(f"Database already has {count} actors. Skipping load.")
            return

        data_dir = Path(__file__).parent.parent / "data" / "synthetic"

        # Create demo user
        print("Creating demo user...")
        demo_user = User(
            username="demo",
            email="demo@darktrace.local",
            hashed_password=get_password_hash("demo123456"),
            role=UserRole.ADMIN,
        )
        db.add(demo_user)
        await db.flush()

        # Create source
        source = Source(name="Synthetic Dataset v2", source_type="synthetic", reliability="A", record_count=100)
        db.add(source)
        await db.flush()

        # Load actors
        print("Loading actors...")
        with open(data_dir / "actors.json") as f:
            actors_data = json.load(f)

        actor_id_map = {}
        for ad in actors_data:
            actor = Actor(
                name=ad["name"],
                risk_level=ad["risk_level"],
                description=ad.get("description"),
                first_seen=datetime.fromisoformat(ad["first_seen"]) if ad.get("first_seen") else None,
                last_seen=datetime.fromisoformat(ad["last_seen"]) if ad.get("last_seen") else None,
                confidence_score=0.0,
            )
            db.add(actor)
            await db.flush()
            actor_id_map[ad["id"]] = actor.id

            # Aliases
            for alias_data in ad.get("aliases", []):
                alias = Alias(
                    actor_id=actor.id,
                    handle=alias_data["handle"],
                    platform=alias_data.get("platform"),
                    first_seen=datetime.fromisoformat(alias_data["first_seen"]) if alias_data.get("first_seen") else None,
                    last_seen=datetime.fromisoformat(alias_data["last_seen"]) if alias_data.get("last_seen") else None,
                    is_primary=alias_data.get("is_primary", False),
                )
                db.add(alias)

            # PGP Keys
            for pgp_data in ad.get("pgp_fingerprints", []):
                pgp = PGPKey(
                    actor_id=actor.id,
                    fingerprint=pgp_data["fingerprint"],
                    algorithm=pgp_data.get("algorithm"),
                    key_size=pgp_data.get("key_size"),
                    source="synthetic",
                )
                db.add(pgp)

            # Wallets
            for wallet_data in ad.get("wallets", []):
                wallet = Wallet(
                    actor_id=actor.id,
                    address=wallet_data["address"],
                    currency=wallet_data.get("currency", "BTC"),
                    balance=wallet_data.get("balance", 0),
                    source="synthetic",
                )
                db.add(wallet)

            # Domains
            for domain_data in ad.get("domains", []):
                domain = Domain(
                    actor_id=actor.id,
                    domain=domain_data["domain"],
                    is_tor=domain_data.get("is_tor", False),
                    source="synthetic",
                )
                db.add(domain)

            # IPs
            for ip_data in ad.get("ips", []):
                ip = IP(
                    actor_id=actor.id,
                    ip_address=ip_data["ip_address"],
                    asn=ip_data.get("asn"),
                    country=ip_data.get("country"),
                    is_tor=ip_data.get("is_tor", False),
                    source="synthetic",
                )
                db.add(ip)

            # Posts
            for post_data in ad.get("posts", []):
                post = Post(
                    actor_id=actor.id,
                    title=post_data.get("title"),
                    content=post_data.get("content"),
                    platform=post_data.get("platform"),
                    marketplace=post_data.get("marketplace"),
                    forum=post_data.get("forum"),
                    posted_at=datetime.fromisoformat(post_data["posted_at"]) if post_data.get("posted_at") else None,
                    word_count=post_data.get("word_count"),
                )
                db.add(post)

            # Behavioral Profile
            behavior = ad.get("behavior", {})
            if behavior:
                bp = BehaviorProfile(
                    actor_id=actor.id,
                    night_activity_pct=behavior.get("night_activity_pct", 0),
                    weekend_activity_pct=behavior.get("weekend_activity_pct", 0),
                    avg_posting_interval_hours=behavior.get("avg_posting_interval_hours", 0),
                    posting_frequency=behavior.get("posting_frequency", 0),
                    timezone_estimate=behavior.get("timezone_estimate", "UNKNOWN"),
                    alias_migration_freq="LOW",
                    marketplace_activity="MEDIUM",
                    forum_activity="MEDIUM",
                )
                db.add(bp)

            # Stylometric Profile
            stylometric = ad.get("stylometric", {})
            if stylometric:
                sp = StylometricProfile(
                    actor_id=actor.id,
                    avg_sentence_length=stylometric.get("avg_sentence_length", 0),
                    vocabulary_richness=stylometric.get("vocabulary_richness", 0),
                    punctuation_ratio=stylometric.get("punctuation_ratio", 0),
                    avg_word_length=stylometric.get("avg_word_length", 0),
                    sample_count=stylometric.get("sample_count", 0),
                )
                db.add(sp)

        await db.flush()
        print(f"  Loaded {len(actor_id_map)} actors")

        # Load evidence
        print("Loading evidence...")
        with open(data_dir / "evidence.json") as f:
            evidence_data = json.load(f)

        evidence_id_map = {}
        for ev in evidence_data:
            evidence = Evidence(
                actor_id=actor_id_map.get(ev["actor_id"]),
                evidence_type=ev["evidence_type"],
                description=ev["description"],
                confidence=ev.get("confidence", 0),
                source=ev.get("source"),
                evidence_hash=ev.get("evidence_hash"),
            )
            db.add(evidence)
            await db.flush()
            evidence_id_map[ev["id"]] = evidence.id
        print(f"  Loaded {len(evidence_data)} evidence records")

        # Load attributions
        print("Loading attributions...")
        with open(data_dir / "attributions.json") as f:
            attr_data = json.load(f)

        for ad in attr_data:
            attr = Attribution(
                source_actor_id=actor_id_map.get(ad["source_actor_id"]),
                target_actor_id=actor_id_map.get(ad["target_actor_id"]),
                overall_confidence=ad["overall_confidence"],
                confidence_level=ad["confidence_level"],
                alias_similarity=ad.get("alias_similarity", 0),
                pgp_match=ad.get("pgp_match", 0),
                wallet_relationship=ad.get("wallet_relationship", 0),
                behavior_similarity=ad.get("behavior_similarity", 0),
                stylometry_similarity=ad.get("stylometry_similarity", 0),
                infrastructure_match=ad.get("infrastructure_match", 0),
                temporal_correlation=ad.get("temporal_correlation", 0),
                source_reliability=ad.get("source_reliability", 0),
                supporting_evidence=ad.get("supporting_evidence", "[]"),
                contradicting_evidence=ad.get("contradicting_evidence", "[]"),
            )
            db.add(attr)
        print(f"  Loaded {len(attr_data)} attributions")

        # Load timeline events
        print("Loading timeline events...")
        with open(data_dir / "timeline.json") as f:
            tl_data = json.load(f)

        for tl in tl_data:
            event = TimelineEvent(
                actor_id=actor_id_map.get(tl["actor_id"]),
                event_type=tl["event_type"],
                title=tl["title"],
                description=tl.get("description"),
                event_date=datetime.fromisoformat(tl["event_date"]) if tl.get("event_date") else datetime.utcnow(),
                confidence=tl.get("confidence", 0),
                source=tl.get("source"),
                evidence_id=evidence_id_map.get(tl.get("evidence_id")),
            )
            db.add(event)
        print(f"  Loaded {len(tl_data)} timeline events")

        # Load relationships
        print("Loading relationships...")
        with open(data_dir / "relationships.json") as f:
            rel_data = json.load(f)

        for rel in rel_data:
            relationship = Relationship(
                source_entity_type=rel["source_type"],
                source_entity_id=actor_id_map.get(rel["source_id"], rel["source_id"]),
                target_entity_type=rel["target_type"],
                target_entity_id=rel["target_id"],
                relationship_type=rel["relationship_type"],
                confidence=rel.get("confidence", 0),
                evidence_id=evidence_id_map.get(rel.get("evidence_id")),
            )
            db.add(relationship)
        print(f"  Loaded {len(rel_data)} relationships")

        # Update actor confidence scores from attributions
        print("Updating actor confidence scores...")
        for old_id, new_id in actor_id_map.items():
            max_conf = (await db.execute(
                select(func.max(Attribution.overall_confidence)).where(
                    (Attribution.source_actor_id == new_id) | (Attribution.target_actor_id == new_id)
                )
            )).scalar() or 0.0
            actor = await db.get(Actor, new_id)
            if actor:
                actor.confidence_score = max_conf

        await db.commit()
        print("\n=== DATA LOAD COMPLETE ===")
        print(f"Actors: {len(actor_id_map)}")
        print(f"Evidence: {len(evidence_data)}")
        print(f"Attributions: {len(attr_data)}")
        print(f"Timeline Events: {len(tl_data)}")
        print(f"Relationships: {len(rel_data)}")


if __name__ == "__main__":
    asyncio.run(load_data())
