import json
import hashlib
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.entities import Actor, Alias, PGPKey, Wallet, Domain, IP, Post, Infrastructure
from app.models.relationships import Relationship, Evidence, BehaviorProfile, StylometricProfile, Attribution
from app.services.entity_service import EntityResolver, AttributionEngine
from app.services.analysis_service import BehavioralAnalyzer, StylometricAnalyzer


class GraphService:
    """Manage the Neo4j graph database."""

    def __init__(self):
        self.driver = None

    def connect(self, uri: str, user: str, password: str):
        try:
            from neo4j import GraphDatabase
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
        except Exception:
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    async def create_actor_node(self, actor_id: int, name: str, risk_level: str):
        if not self.driver:
            return
        with self.driver.session() as session:
            session.run(
                "MERGE (a:Actor {id: $id}) SET a.name = $name, a.risk_level = $risk",
                id=actor_id, name=name, risk=risk_level
            )

    async def create_alias_node(self, alias_id: int, handle: str, platform: str):
        if not self.driver:
            return
        with self.driver.session() as session:
            session.run(
                "MERGE (al:Alias {id: $id}) SET al.handle = $handle, al.platform = $platform",
                id=alias_id, handle=handle, platform=platform
            )

    async def create_pgp_node(self, pgp_id: int, fingerprint: str):
        if not self.driver:
            return
        with self.driver.session() as session:
            session.run(
                "MERGE (p:PGP {id: $id}) SET p.fingerprint = $fp",
                id=pgp_id, fp=fingerprint
            )

    async def create_wallet_node(self, wallet_id: int, address: str, currency: str):
        if not self.driver:
            return
        with self.driver.session() as session:
            session.run(
                "MERGE (w:Wallet {id: $id}) SET w.address = $addr, w.currency = $cur",
                id=wallet_id, addr=address, cur=currency
            )

    async def create_relationship(self, source_type: str, source_id: int,
                                   target_type: str, target_id: int,
                                   rel_type: str, confidence: float, evidence_id: int = None):
        if not self.driver:
            return
        query = f"""
            MATCH (a:{source_type} {{id: $source_id}})
            MATCH (b:{target_type} {{id: $target_id}})
            MERGE (a)-[r:{rel_type}]->(b)
            SET r.confidence = $confidence, r.evidence_id = $evidence_id, r.created_at = datetime()
        """
        with self.driver.session() as session:
            session.run(query, source_id=source_id, target_id=target_id,
                       confidence=confidence, evidence_id=evidence_id)

    async def get_subgraph(self, actor_id: int, depth: int = 2) -> Dict:
        if not self.driver:
            return {"nodes": [], "edges": []}
        query = """
            MATCH path = (a:Actor {id: $actor_id})-[*1..%d]-(connected)
            UNWIND nodes(path) AS n
            UNWIND relationships(path) AS r
            RETURN collect(DISTINCT n) AS nodes, collect(DISTINCT r) AS rels
        """ % depth
        with self.driver.session() as session:
            result = session.run(query, actor_id=actor_id)
            record = result.single()
            if not record:
                return {"nodes": [], "edges": []}

            nodes = []
            for node in record["nodes"]:
                labels = list(node.labels)
                nodes.append({
                    "id": str(node.element_id) if hasattr(node, 'element_id') else str(node.id),
                    "label": node.get("name") or node.get("handle") or node.get("fingerprint", "")[:12] or str(node.id),
                    "type": labels[0] if labels else "Unknown",
                    "properties": dict(node),
                })

            edges = []
            for rel in record["rels"]:
                edges.append({
                    "id": str(rel.element_id) if hasattr(rel, 'element_id') else "",
                    "source": str(rel.start_node.element_id) if hasattr(rel.start_node, 'element_id') else str(rel.start_node.id),
                    "target": str(rel.end_node.element_id) if hasattr(rel.end_node, 'element_id') else str(rel.end_node.id),
                    "label": rel.type,
                    "properties": dict(rel),
                })

            return {"nodes": nodes, "edges": edges}

    async def find_shortest_path(self, source_id: int, target_id: int) -> List[Dict]:
        if not self.driver:
            return []
        query = """
            MATCH (a:Actor {id: $source_id}), (b:Actor {id: $target_id})
            MATCH path = shortestPath((a)-[*..10]-(b))
            RETURN [n IN nodes(path) | {id: n.id, label: n.name, type: labels(n)[0]}] AS nodes,
                   [r IN relationships(path) | {type: type(r), confidence: r.confidence}] AS rels
        """
        with self.driver.session() as session:
            result = session.run(query, source_id=source_id, target_id=target_id)
            record = result.single()
            if not record:
                return []
            return [{"nodes": record["nodes"], "relationships": record["rels"]}]


class PipelineService:
    """End-to-end intelligence processing pipeline."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.resolver = EntityResolver(db)
        self.attribution_engine = AttributionEngine()
        self.behavior_analyzer = BehavioralAnalyzer()
        self.stylometric_analyzer = StylometricAnalyzer()
        self.graph_service = GraphService()

    async def process_actor_intelligence(self, actor_id: int) -> Dict:
        results = {}

        actor = await self.db.get(Actor, actor_id)
        if not actor:
            return {"error": "Actor not found"}

        profile = await self.behavior_analyzer.build_profile(self.db, actor_id)
        existing_bp = await self.db.execute(
            select(BehaviorProfile).where(BehaviorProfile.actor_id == actor_id)
        )
        bp = existing_bp.scalar_one_or_none()
        if bp:
            for k, v in profile.items():
                if hasattr(bp, k):
                    setattr(bp, k, v)
        else:
            bp = BehaviorProfile(actor_id=actor_id, **profile)
            self.db.add(bp)
        results["behavior_profile"] = profile

        stylometric = await self.stylometric_analyzer.build_profile(self.db, actor_id)
        existing_sp = await self.db.execute(
            select(StylometricProfile).where(StylometricProfile.actor_id == actor_id)
        )
        sp = existing_sp.scalar_one_or_none()
        if sp:
            for k, v in stylometric.items():
                if hasattr(sp, k):
                    setattr(sp, k, v)
        else:
            sp = StylometricProfile(actor_id=actor_id, **stylometric)
            self.db.add(sp)
        results["stylometric_profile"] = stylometric

        await self.db.commit()
        return results

    async def compute_attribution(self, source_actor_id: int, target_actor_id: int) -> Dict:
        signals = {}

        source_aliases = await self.db.execute(
            select(Alias.handle).where(Alias.actor_id == source_actor_id)
        )
        target_aliases = await self.db.execute(
            select(Alias.handle).where(Alias.actor_id == target_actor_id)
        )
        source_handles = [r[0] for r in source_aliases.all()]
        target_handles = [r[0] for r in target_aliases.all()]

        alias_sim = 0.0
        for sh in source_handles:
            for th in target_handles:
                sim = self.resolver._string_similarity(sh, th)
                alias_sim = max(alias_sim, sim)
        signals["alias_similarity"] = alias_sim

        shared_pgps = await self.resolver.find_shared_pgps(source_actor_id)
        pgp_targets = [p for p in shared_pgps if p["actor_id"] == target_actor_id]
        signals["pgp_match"] = 1.0 if pgp_targets else 0.0

        shared_wallets = await self.resolver.find_shared_wallets(source_actor_id)
        wallet_targets = [w for w in shared_wallets if w["actor_id"] == target_actor_id]
        signals["wallet_relationship"] = 1.0 if wallet_targets else 0.0

        source_bp_result = await self.db.execute(
            select(BehaviorProfile).where(BehaviorProfile.actor_id == source_actor_id)
        )
        target_bp_result = await self.db.execute(
            select(BehaviorProfile).where(BehaviorProfile.actor_id == target_actor_id)
        )
        source_bp = source_bp_result.scalar_one_or_none()
        target_bp = target_bp_result.scalar_one_or_none()
        if source_bp and target_bp:
            behavior_sim = 0.0
            diffs = [
                abs(source_bp.night_activity_pct - target_bp.night_activity_pct) / 100,
                abs(source_bp.weekend_activity_pct - target_bp.weekend_activity_pct) / 100,
                min(abs(source_bp.avg_posting_interval_hours - target_bp.avg_posting_interval_hours) / 24, 1),
            ]
            behavior_sim = 1 - sum(diffs) / len(diffs)
            signals["behavior_similarity"] = max(behavior_sim, 0.0)
        else:
            signals["behavior_similarity"] = 0.0

        source_sp_result = await self.db.execute(
            select(StylometricProfile).where(StylometricProfile.actor_id == source_actor_id)
        )
        target_sp_result = await self.db.execute(
            select(StylometricProfile).where(StylometricProfile.actor_id == target_actor_id)
        )
        source_sp = source_sp_result.scalar_one_or_none()
        target_sp = target_sp_result.scalar_one_or_none()
        if source_sp and target_sp:
            signals["stylometry_similarity"] = self.stylometric_analyzer.compute_similarity(
                {c.key: getattr(source_sp, c.key) for c in source_sp.__table__.columns},
                {c.key: getattr(target_sp, c.key) for c in target_sp.__table__.columns},
            )
        else:
            signals["stylometry_similarity"] = 0.0

        source_infra = await self.db.execute(
            select(Infrastructure.similarity_hash).where(
                Infrastructure.actor_id == source_actor_id,
                Infrastructure.similarity_hash.isnot(None)
            )
        )
        target_infra = await self.db.execute(
            select(Infrastructure.similarity_hash).where(
                Infrastructure.actor_id == target_actor_id,
                Infrastructure.similarity_hash.isnot(None)
            )
        )
        source_hashes = set(r[0] for r in source_infra.all())
        target_hashes = set(r[0] for r in target_infra.all())
        if source_hashes and target_hashes:
            signals["infrastructure_match"] = len(source_hashes & target_hashes) / max(len(source_hashes | target_hashes), 1)
        else:
            signals["infrastructure_match"] = 0.0

        signals["temporal_correlation"] = 0.5
        signals["source_reliability"] = 0.8

        attribution = self.attribution_engine.calculate_attribution(signals)

        existing_attr = await self.db.execute(
            select(Attribution).where(
                Attribution.source_actor_id == source_actor_id,
                Attribution.target_actor_id == target_actor_id
            )
        )
        attr = existing_attr.scalar_one_or_none()
        if attr:
            for k, v in attribution.items():
                if hasattr(attr, k):
                    setattr(attr, k, v)
        else:
            attr = Attribution(
                source_actor_id=source_actor_id,
                target_actor_id=target_actor_id,
                **attribution,
            )
            self.db.add(attr)

        await self.db.commit()
        return attribution
