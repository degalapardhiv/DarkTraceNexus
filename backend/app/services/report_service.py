import json
import csv
import io
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.entities import Actor, Alias, PGPKey, Wallet, Domain, IP, Post
from app.models.relationships import Evidence, Attribution, BehaviorProfile, StylometricProfile


class ReportGenerator:
    """Generate investigation reports."""

    async def generate_actor_report(self, db: AsyncSession, actor_id: int,
                                     investigation_id: int = None) -> Dict:
        actor = await db.get(Actor, actor_id)
        if not actor:
            return {"error": "Actor not found"}

        aliases = (await db.execute(
            select(Alias).where(Alias.actor_id == actor_id)
        )).scalars().all()

        pgps = (await db.execute(
            select(PGPKey).where(PGPKey.actor_id == actor_id)
        )).scalars().all()

        wallets = (await db.execute(
            select(Wallet).where(Wallet.actor_id == actor_id)
        )).scalars().all()

        domains = (await db.execute(
            select(Domain).where(Domain.actor_id == actor_id)
        )).scalars().all()

        ips = (await db.execute(
            select(IP).where(IP.actor_id == actor_id)
        )).scalars().all()

        posts = (await db.execute(
            select(Post).where(Post.actor_id == actor_id)
        )).scalars().all()

        evidence_q = select(Evidence).where(Evidence.actor_id == actor_id)
        if investigation_id:
            evidence_q = evidence_q.where(Evidence.investigation_id == investigation_id)
        evidence = (await db.execute(evidence_q)).scalars().all()

        attributions = (await db.execute(
            select(Attribution).where(
                (Attribution.source_actor_id == actor_id) |
                (Attribution.target_actor_id == actor_id)
            )
        )).scalars().all()

        bp_result = await db.execute(
            select(BehaviorProfile).where(BehaviorProfile.actor_id == actor_id)
        )
        bp = bp_result.scalar_one_or_none()

        sp_result = await db.execute(
            select(StylometricProfile).where(StylometricProfile.actor_id == actor_id)
        )
        sp = sp_result.scalar_one_or_none()

        report = {
            "report_type": "ACTOR_INVESTIGATION",
            "generated_at": datetime.utcnow().isoformat(),
            "executive_summary": {
                "actor_name": actor.name,
                "risk_level": actor.risk_level,
                "confidence_score": actor.confidence_score,
                "first_seen": actor.first_seen.isoformat() if actor.first_seen else None,
                "last_seen": actor.last_seen.isoformat() if actor.last_seen else None,
                "aliases_count": len(aliases),
                "pgp_keys_count": len(pgps),
                "wallets_count": len(wallets),
                "domains_count": len(domains),
                "ips_count": len(ips),
                "posts_count": len(posts),
                "attributions_count": len(attributions),
            },
            "aliases": [{"handle": a.handle, "platform": a.platform, "is_primary": a.is_primary} for a in aliases],
            "pgp_keys": [{"fingerprint": p.fingerprint, "key_id": p.key_id, "algorithm": p.algorithm} for p in pgps],
            "wallets": [{"address": w.address, "currency": w.currency, "balance": w.balance} for w in wallets],
            "infrastructure": {
                "domains": [{"domain": d.domain, "is_tor": d.is_tor} for d in domains],
                "ips": [{"ip": ip.ip_address, "asn": ip.asn, "country": ip.country} for ip in ips],
            },
            "behavioral_analysis": {
                "night_activity_pct": bp.night_activity_pct if bp else 0,
                "weekend_activity_pct": bp.weekend_activity_pct if bp else 0,
                "avg_posting_interval_hours": bp.avg_posting_interval_hours if bp else 0,
                "alias_migration_freq": bp.alias_migration_freq if bp else "UNKNOWN",
                "marketplace_activity": bp.marketplace_activity if bp else "UNKNOWN",
                "forum_activity": bp.forum_activity if bp else "UNKNOWN",
                "timezone_estimate": bp.timezone_estimate if bp else "UNKNOWN",
            } if bp else None,
            "stylometric_analysis": {
                "avg_sentence_length": sp.avg_sentence_length if sp else 0,
                "vocabulary_richness": sp.vocabulary_richness if sp else 0,
                "punctuation_ratio": sp.punctuation_ratio if sp else 0,
                "avg_word_length": sp.avg_word_length if sp else 0,
                "sample_count": sp.sample_count if sp else 0,
            } if sp else None,
            "attributions": [{
                "target_actor_id": a.target_actor_id if a.source_actor_id == actor_id else a.source_actor_id,
                "confidence": a.overall_confidence,
                "level": a.confidence_level,
            } for a in attributions],
            "evidence_chain": [{
                "id": e.id,
                "type": e.evidence_type,
                "description": e.description,
                "confidence": e.confidence,
                "source": e.source,
                "hash": e.evidence_hash,
            } for e in evidence],
            "sources": list(set(e.source for e in evidence if e.source)),
            "limitations": [
                "Confidence scores are based on synthetic data analysis",
                "Stylometric analysis requires sufficient text samples",
                "Infrastructure correlation depends on available metadata",
                "Attribution confidence does not imply forensic certainty",
            ],
        }
        return report

    def to_csv(self, report: Dict) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Section", "Field", "Value"])
        for key, val in report.get("executive_summary", {}).items():
            writer.writerow(["Executive Summary", key, val])
        for alias in report.get("aliases", []):
            writer.writerow(["Alias", alias["handle"], alias["platform"]])
        for pgp in report.get("pgp_keys", []):
            writer.writerow(["PGP Key", pgp["fingerprint"], pgp["algorithm"]])
        for wallet in report.get("wallets", []):
            writer.writerow(["Wallet", wallet["address"], wallet["currency"]])
        for ev in report.get("evidence_chain", []):
            writer.writerow(["Evidence", ev["type"], ev["description"], ev["confidence"]])

        return output.getvalue()

    def to_json(self, report: Dict) -> str:
        return json.dumps(report, indent=2, default=str)
