from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import Optional, List
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.entities import Actor, Alias, PGPKey, Wallet, Domain, IP, Post, Source
from app.models.relationships import (
    Relationship, Evidence, Attribution, TimelineEvent,
    BehaviorProfile, StylometricProfile
)
from app.schemas import (
    DashboardStats, GraphData, GraphNode, GraphEdge,
    InvestigationCreate, InvestigationResponse, TimelineEventResponse,
    EvidenceResponse, AttributionResponse, RelationshipResponse,
    ReportRequest,
)
from app.services.pipeline_service import PipelineService, GraphService
from app.services.report_service import ReportGenerator

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])


async def _get_user_or_demo(
    current_user: User = Depends(get_current_user),
):
    """Allow demo access - returns user or None for demo mode."""
    return current_user


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_actors = (await db.execute(select(func.count(Actor.id)))).scalar() or 0
    total_aliases = (await db.execute(select(func.count(Alias.id)))).scalar() or 0
    total_pgps = (await db.execute(select(func.count(PGPKey.id)))).scalar() or 0
    total_wallets = (await db.execute(select(func.count(Wallet.id)))).scalar() or 0
    total_domains = (await db.execute(select(func.count(Domain.id)))).scalar() or 0
    total_ips = (await db.execute(select(func.count(IP.id)))).scalar() or 0
    total_posts = (await db.execute(select(func.count(Post.id)))).scalar() or 0
    total_relationships = (await db.execute(select(func.count(Relationship.id)))).scalar() or 0
    total_evidence = (await db.execute(select(func.count(Evidence.id)))).scalar() or 0
    total_attributions = (await db.execute(select(func.count(Attribution.id)))).scalar() or 0
    high_conf = (await db.execute(
        select(func.count(Attribution.id)).where(Attribution.overall_confidence >= 0.65)
    )).scalar() or 0

    return DashboardStats(
        total_actors=total_actors, total_aliases=total_aliases,
        total_pgps=total_pgps, total_wallets=total_wallets,
        total_domains=total_domains, total_ips=total_ips,
        total_posts=total_posts, total_relationships=total_relationships,
        total_evidence=total_evidence, total_attributions=total_attributions,
        high_confidence_linkages=high_conf, recent_intelligence=total_posts,
    )


@router.get("/graph/{actor_id}")
async def get_actor_graph(
    actor_id: int,
    depth: int = Query(2, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get relationship graph for an actor, including cross-actor correlations."""
    actor = await db.get(Actor, actor_id)
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")

    nodes = []
    edges = []
    node_ids = set()

    central_id = f"actor_{actor.id}"
    nodes.append({
        "id": central_id, "label": actor.name, "type": "Actor",
        "properties": {"risk_level": actor.risk_level, "confidence_score": actor.confidence_score, "id": actor.id},
    })
    node_ids.add(central_id)

    aliases = (await db.execute(select(Alias).where(Alias.actor_id == actor_id))).scalars().all()
    for alias in aliases:
        nid = f"alias_{alias.id}"
        if nid not in node_ids:
            nodes.append({"id": nid, "label": alias.handle, "type": "Alias", "properties": {"platform": alias.platform, "id": alias.id}})
            node_ids.add(nid)
        edges.append({"id": f"e_{alias.id}", "source": central_id, "target": nid, "label": "USES_ALIAS", "properties": {"confidence": 1.0}})

    pgps = (await db.execute(select(PGPKey).where(PGPKey.actor_id == actor_id))).scalars().all()
    for pgp in pgps:
        nid = f"pgp_{pgp.id}"
        if nid not in node_ids:
            nodes.append({"id": nid, "label": f"PGP:{pgp.fingerprint[:12]}...", "type": "PGP", "properties": {"fingerprint": pgp.fingerprint, "algorithm": pgp.algorithm, "id": pgp.id}})
            node_ids.add(nid)
        edges.append({"id": f"e_pgp_{pgp.id}", "source": central_id, "target": nid, "label": "USES_PGP", "properties": {"confidence": 0.98}})

    wallets = (await db.execute(select(Wallet).where(Wallet.actor_id == actor_id))).scalars().all()
    for wallet in wallets:
        nid = f"wallet_{wallet.id}"
        if nid not in node_ids:
            nodes.append({"id": nid, "label": f"{wallet.currency}:{wallet.address[:12]}...", "type": "Wallet", "properties": {"address": wallet.address, "currency": wallet.currency, "balance": wallet.balance, "id": wallet.id}})
            node_ids.add(nid)
        edges.append({"id": f"e_wallet_{wallet.id}", "source": central_id, "target": nid, "label": "USES_WALLET", "properties": {"confidence": 0.9}})

    domains = (await db.execute(select(Domain).where(Domain.actor_id == actor_id))).scalars().all()
    for domain in domains:
        nid = f"domain_{domain.id}"
        if nid not in node_ids:
            nodes.append({"id": nid, "label": domain.domain, "type": "Domain", "properties": {"is_tor": domain.is_tor, "id": domain.id}})
            node_ids.add(nid)
        edges.append({"id": f"e_domain_{domain.id}", "source": central_id, "target": nid, "label": "HOSTED_ON", "properties": {"confidence": 0.85}})

    ips = (await db.execute(select(IP).where(IP.actor_id == actor_id))).scalars().all()
    for ip in ips:
        nid = f"ip_{ip.id}"
        if nid not in node_ids:
            nodes.append({"id": nid, "label": ip.ip_address, "type": "IP", "properties": {"asn": ip.asn, "country": ip.country, "is_tor": ip.is_tor, "id": ip.id}})
            node_ids.add(nid)
        edges.append({"id": f"e_ip_{ip.id}", "source": central_id, "target": nid, "label": "RESOLVES_TO", "properties": {"confidence": 0.8}})

    attributions = (await db.execute(
        select(Attribution).where(
            or_(Attribution.source_actor_id == actor_id, Attribution.target_actor_id == actor_id)
        )
    )).scalars().all()

    for attr in attributions:
        other_id = attr.target_actor_id if attr.source_actor_id == actor_id else attr.source_actor_id
        other_actor = await db.get(Actor, other_id)
        if not other_actor:
            continue

        other_nid = f"actor_{other_id}"
        if other_nid not in node_ids:
            nodes.append({
                "id": other_nid, "label": other_actor.name, "type": "Actor",
                "properties": {"risk_level": other_actor.risk_level, "confidence_score": other_actor.confidence_score, "id": other_actor.id},
            })
            node_ids.add(other_nid)

        edges.append({
            "id": f"e_attr_{attr.id}",
            "source": central_id, "target": other_nid,
            "label": "CORRELATED_WITH",
            "properties": {"confidence": attr.overall_confidence, "level": attr.confidence_level, "attribution_id": attr.id},
        })

        other_aliases = (await db.execute(select(Alias).where(Alias.actor_id == other_id))).scalars().all()
        for oa in other_aliases[:3]:
            oa_nid = f"alias_{oa.id}"
            if oa_nid not in node_ids:
                nodes.append({"id": oa_nid, "label": oa.handle, "type": "Alias", "properties": {"platform": oa.platform, "id": oa.id}})
                node_ids.add(oa_nid)
            edges.append({"id": f"e_oa_{oa.id}", "source": other_nid, "target": oa_nid, "label": "USES_ALIAS", "properties": {"confidence": 1.0}})

        other_pgps = (await db.execute(select(PGPKey).where(PGPKey.actor_id == other_id))).scalars().all()
        for op in other_pgps[:2]:
            op_nid = f"pgp_{op.id}"
            if op_nid not in node_ids:
                nodes.append({"id": op_nid, "label": f"PGP:{op.fingerprint[:12]}...", "type": "PGP", "properties": {"fingerprint": op.fingerprint, "id": op.id}})
                node_ids.add(op_nid)
            edges.append({"id": f"e_op_{op.id}", "source": other_nid, "target": op_nid, "label": "USES_PGP", "properties": {"confidence": 0.98}})

    return {"nodes": nodes, "edges": edges}


@router.get("/attributions", response_model=List[AttributionResponse])
async def list_attributions(
    min_confidence: float = Query(0.0, ge=0, le=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Attribution).where(Attribution.overall_confidence >= min_confidence)
    query = query.order_by(desc(Attribution.overall_confidence)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/evidence", response_model=List[EvidenceResponse])
async def list_evidence(
    actor_id: Optional[int] = None,
    investigation_id: Optional[int] = None,
    evidence_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Evidence)
    if actor_id:
        query = query.where(Evidence.actor_id == actor_id)
    if investigation_id:
        query = query.where(Evidence.investigation_id == investigation_id)
    if evidence_type:
        query = query.where(Evidence.evidence_type == evidence_type)
    query = query.order_by(desc(Evidence.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/evidence/types")
async def list_evidence_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Evidence.evidence_type, func.count(Evidence.id)).group_by(Evidence.evidence_type))
    return [{"type": row[0], "count": row[1]} for row in result.all()]


@router.get("/timeline", response_model=List[TimelineEventResponse])
async def get_timeline(
    actor_id: Optional[int] = None,
    investigation_id: Optional[int] = None,
    event_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(TimelineEvent)
    if actor_id:
        query = query.where(TimelineEvent.actor_id == actor_id)
    if investigation_id:
        query = query.where(TimelineEvent.investigation_id == investigation_id)
    if event_type:
        query = query.where(TimelineEvent.event_type == event_type)
    if start_date:
        query = query.where(TimelineEvent.event_date >= start_date)
    if end_date:
        query = query.where(TimelineEvent.event_date <= end_date)
    query = query.order_by(TimelineEvent.event_date).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/timeline/event-types")
async def list_timeline_event_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(TimelineEvent.event_type, func.count(TimelineEvent.id)).group_by(TimelineEvent.event_type))
    return [{"type": row[0], "count": row[1]} for row in result.all()]


@router.post("/analyze/{actor_id}")
async def analyze_actor(
    actor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = PipelineService(db)
    result = await pipeline.process_actor_intelligence(actor_id)
    return {"status": "completed", "results": result}


@router.post("/attributions/compute")
async def compute_attribution(
    source_actor_id: int,
    target_actor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = PipelineService(db)
    result = await pipeline.compute_attribution(source_actor_id, target_actor_id)
    return result


@router.post("/report")
async def generate_report(
    request: ReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    generator = ReportGenerator()
    report = await generator.generate_actor_report(db, request.actor_id, request.investigation_id)
    if "error" in report:
        raise HTTPException(status_code=404, detail=report["error"])

    if request.format == "csv":
        csv_content = generator.to_csv(report)
        return {"format": "csv", "content": csv_content, "report": report}
    return {"format": "json", "report": report}


@router.get("/search")
async def search_entities(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []

    actors = (await db.execute(select(Actor).where(Actor.name.ilike(f"%{q}%")))).scalars().all()
    for a in actors:
        results.append({"type": "Actor", "id": a.id, "name": a.name, "confidence": a.confidence_score, "risk_level": a.risk_level, "actor_id": a.id})

    aliases = (await db.execute(select(Alias).where(Alias.handle.ilike(f"%{q}%")))).scalars().all()
    for a in aliases:
        actor = await db.get(Actor, a.actor_id)
        results.append({"type": "Alias", "id": a.id, "name": a.handle, "actor_id": a.actor_id, "platform": a.platform,
                        "confidence": actor.confidence_score if actor else 0, "risk_level": actor.risk_level if actor else "UNKNOWN"})

    pgps = (await db.execute(select(PGPKey).where(PGPKey.fingerprint.ilike(f"%{q}%")))).scalars().all()
    for p in pgps:
        actor = await db.get(Actor, p.actor_id)
        results.append({"type": "PGP", "id": p.id, "name": p.fingerprint[:20], "actor_id": p.actor_id,
                        "confidence": actor.confidence_score if actor else 0, "risk_level": actor.risk_level if actor else "UNKNOWN"})

    wallets = (await db.execute(select(Wallet).where(Wallet.address.ilike(f"%{q}%")))).scalars().all()
    for w in wallets:
        actor = await db.get(Actor, w.actor_id)
        results.append({"type": "Wallet", "id": w.id, "name": w.address[:20], "actor_id": w.actor_id,
                        "confidence": actor.confidence_score if actor else 0, "risk_level": actor.risk_level if actor else "UNKNOWN"})

    domains = (await db.execute(select(Domain).where(Domain.domain.ilike(f"%{q}%")))).scalars().all()
    for d in domains:
        actor = await db.get(Actor, d.actor_id)
        results.append({"type": "Domain", "id": d.id, "name": d.domain, "actor_id": d.actor_id,
                        "confidence": actor.confidence_score if actor else 0, "risk_level": actor.risk_level if actor else "UNKNOWN"})

    return results
