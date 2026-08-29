from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.entities import Actor, Alias, PGPKey, Wallet, Domain, IP, Post, Source
from app.models.relationships import Relationship, Evidence, Attribution, BehaviorProfile, StylometricProfile
from app.schemas import ActorCreate, ActorResponse, IngestionStats, DashboardStats

router = APIRouter(prefix="/actors", tags=["Actors"])


@router.get("/", response_model=List[ActorResponse])
async def list_actors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    risk_level: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Actor)
    if risk_level:
        query = query.where(Actor.risk_level == risk_level)
    if search:
        query = query.where(Actor.name.ilike(f"%{search}%"))
    query = query.order_by(desc(Actor.confidence_score)).offset(skip).limit(limit)
    result = await db.execute(query)
    actors = result.scalars().all()

    response = []
    for actor in actors:
        alias_count = (await db.execute(select(func.count(Alias.id)).where(Alias.actor_id == actor.id))).scalar()
        pgp_count = (await db.execute(select(func.count(PGPKey.id)).where(PGPKey.actor_id == actor.id))).scalar()
        wallet_count = (await db.execute(select(func.count(Wallet.id)).where(Wallet.actor_id == actor.id))).scalar()
        domain_count = (await db.execute(select(func.count(Domain.id)).where(Domain.actor_id == actor.id))).scalar()
        post_count = (await db.execute(select(func.count(Post.id)).where(Post.actor_id == actor.id))).scalar()

        response.append(ActorResponse(
            id=actor.id, name=actor.name, risk_level=actor.risk_level,
            confidence_score=actor.confidence_score, first_seen=actor.first_seen,
            last_seen=actor.last_seen, description=actor.description,
            tags=actor.tags, is_active=actor.is_active, created_at=actor.created_at,
            alias_count=alias_count or 0, pgp_count=pgp_count or 0,
            wallet_count=wallet_count or 0, domain_count=domain_count or 0,
            post_count=post_count or 0,
        ))
    return response


@router.get("/{actor_id}")
async def get_actor_detail(actor_id: int, db: AsyncSession = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    actor = await db.get(Actor, actor_id)
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")

    aliases = (await db.execute(select(Alias).where(Alias.actor_id == actor_id))).scalars().all()
    pgps = (await db.execute(select(PGPKey).where(PGPKey.actor_id == actor_id))).scalars().all()
    wallets = (await db.execute(select(Wallet).where(Wallet.actor_id == actor_id))).scalars().all()
    domains = (await db.execute(select(Domain).where(Domain.actor_id == actor_id))).scalars().all()
    ips = (await db.execute(select(IP).where(IP.actor_id == actor_id))).scalars().all()
    posts = (await db.execute(select(Post).where(Post.actor_id == actor_id))).scalars().all()

    bp = (await db.execute(select(BehaviorProfile).where(BehaviorProfile.actor_id == actor_id))).scalar_one_or_none()
    sp = (await db.execute(select(StylometricProfile).where(StylometricProfile.actor_id == actor_id))).scalar_one_or_none()

    attributions = (await db.execute(
        select(Attribution).where(
            (Attribution.source_actor_id == actor_id) | (Attribution.target_actor_id == actor_id)
        )
    )).scalars().all()

    evidence = (await db.execute(
        select(Evidence).where(Evidence.actor_id == actor_id)
    )).scalars().all()

    return {
        "actor": {
            "id": actor.id, "name": actor.name, "risk_level": actor.risk_level,
            "confidence_score": actor.confidence_score, "first_seen": actor.first_seen,
            "last_seen": actor.last_seen, "description": actor.description,
            "tags": actor.tags, "is_active": actor.is_active,
        },
        "aliases": [{"id": a.id, "handle": a.handle, "platform": a.platform,
                     "first_seen": a.first_seen, "last_seen": a.last_seen, "is_primary": a.is_primary} for a in aliases],
        "pgp_keys": [{"id": p.id, "fingerprint": p.fingerprint, "key_id": p.key_id,
                      "algorithm": p.algorithm, "creation_date": p.creation_date} for p in pgps],
        "wallets": [{"id": w.id, "address": w.address, "currency": w.currency,
                     "label": w.label, "balance": w.balance, "transaction_count": w.transaction_count,
                     "first_seen": w.first_seen.isoformat() if w.first_seen else None,
                     "last_seen": w.last_seen.isoformat() if w.last_seen else None} for w in wallets],
        "domains": [{"id": d.id, "domain": d.domain, "is_tor": d.is_tor,
                     "first_seen": d.created_date.isoformat() if d.created_date else None} for d in domains],
        "ips": [{"id": i.id, "ip_address": i.ip_address, "asn": i.asn,
                 "port": i.port, "country": i.country, "is_tor": i.is_tor,
                 "first_seen": i.first_seen.isoformat() if i.first_seen else None,
                 "last_seen": i.last_seen.isoformat() if i.last_seen else None} for i in ips],
        "posts": [{"id": p.id, "title": p.title, "content": p.content[:200] if p.content else None,
                   "platform": p.platform, "posted_at": p.posted_at, "word_count": p.word_count} for p in posts],
        "behavior_profile": {
            "night_activity_pct": bp.night_activity_pct if bp else 0,
            "weekend_activity_pct": bp.weekend_activity_pct if bp else 0,
            "avg_posting_interval_hours": bp.avg_posting_interval_hours if bp else 0,
            "posting_frequency": bp.posting_frequency if bp else 0,
            "alias_migration_freq": bp.alias_migration_freq if bp else "UNKNOWN",
            "marketplace_activity": bp.marketplace_activity if bp else "UNKNOWN",
            "forum_activity": bp.forum_activity if bp else "UNKNOWN",
            "timezone_estimate": bp.timezone_estimate if bp else "UNKNOWN",
        } if bp else None,
        "stylometric_profile": {
            "avg_sentence_length": sp.avg_sentence_length if sp else 0,
            "vocabulary_richness": sp.vocabulary_richness if sp else 0,
            "punctuation_ratio": sp.punctuation_ratio if sp else 0,
            "avg_word_length": sp.avg_word_length if sp else 0,
            "sample_count": sp.sample_count if sp else 0,
        } if sp else None,
        "attributions": [{
            "id": a.id, "target_actor_id": a.target_actor_id if a.source_actor_id == actor_id else a.source_actor_id,
            "overall_confidence": a.overall_confidence, "confidence_level": a.confidence_level,
            "alias_similarity": a.alias_similarity, "pgp_match": a.pgp_match,
            "wallet_relationship": a.wallet_relationship, "behavior_similarity": a.behavior_similarity,
            "stylometry_similarity": a.stylometry_similarity, "infrastructure_match": a.infrastructure_match,
        } for a in attributions],
        "evidence": [{
            "id": e.id, "evidence_type": e.evidence_type, "description": e.description,
            "confidence": e.confidence, "source": e.source, "evidence_hash": e.evidence_hash,
        } for e in evidence],
    }


@router.post("/", status_code=201)
async def create_actor(actor_data: ActorCreate, db: AsyncSession = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    actor = Actor(
        name=actor_data.name,
        risk_level=actor_data.risk_level,
        description=actor_data.description,
        tags=actor_data.tags,
    )
    db.add(actor)
    await db.commit()
    await db.refresh(actor)
    return {"id": actor.id, "name": actor.name}
