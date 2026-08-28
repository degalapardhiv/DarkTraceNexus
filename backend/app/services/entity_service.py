import re
import hashlib
import json
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.entities import Actor, Alias, PGPKey, Wallet, Domain, IP, Post, Infrastructure


class EntityExtractor:
    """Extract and normalize entities from raw intelligence data."""

    EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    PGP_REGEX = re.compile(r'(?:PGP|pgp|fingerprint)[:\s]*([A-F0-9]{40})', re.IGNORECASE)
    BTC_REGEX = re.compile(r'[13][a-km-zA-HJ-NP-Z1-9]{25,34}')
    ETH_REGEX = re.compile(r'0x[a-fA-F0-9]{40}')
    IP_REGEX = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
    DOMAIN_REGEX = re.compile(r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b')
    URL_REGEX = re.compile(r'https?://[^\s]+')
    ONION_REGEX = re.compile(r'[a-z2-7]{16,56}\.onion')

    def extract_entities(self, text: str, source: str = "unknown") -> Dict[str, List[str]]:
        entities = {
            "emails": self.EMAIL_REGEX.findall(text),
            "pgp_fingerprints": self.PGP_REGEX.findall(text),
            "btc_addresses": self.BTC_REGEX.findall(text),
            "eth_addresses": self.ETH_REGEX.findall(text),
            "ip_addresses": self.IP_REGEX.findall(text),
            "domains": self.DOMAIN_REGEX.findall(text),
            "urls": self.URL_REGEX.findall(text),
            "onion_services": self.ONION_REGEX.findall(text),
        }
        return entities

    def generate_entity_id(self, entity_type: str, value: str) -> str:
        raw = f"{entity_type}:{value.lower().strip()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]


class EntityResolver:
    """Resolve entity identities across sources."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_similar_aliases(self, handle: str, threshold: float = 0.6) -> List[Dict]:
        result = await self.db.execute(
            select(Alias).where(Alias.handle.ilike(f"%{handle[:4]}%"))
        )
        aliases = result.scalars().all()
        matches = []
        for alias in aliases:
            sim = self._string_similarity(handle, alias.handle)
            if sim >= threshold and alias.handle != handle:
                matches.append({
                    "alias_id": alias.id,
                    "handle": alias.handle,
                    "actor_id": alias.actor_id,
                    "similarity": round(sim, 3),
                })
        return matches

    async def find_shared_pgps(self, actor_id: int) -> List[Dict]:
        actor_pgps = await self.db.execute(
            select(PGPKey.fingerprint).where(PGPKey.actor_id == actor_id)
        )
        fingerprints = [r[0] for r in actor_pgps.all()]
        if not fingerprints:
            return []
        shared = await self.db.execute(
            select(PGPKey).where(PGPKey.fingerprint.in_(fingerprints), PGPKey.actor_id != actor_id)
        )
        return [{"fingerprint": k.fingerprint, "actor_id": k.actor_id} for k in shared.scalars().all()]

    async def find_shared_wallets(self, actor_id: int) -> List[Dict]:
        actor_wallets = await self.db.execute(
            select(Wallet.address).where(Wallet.actor_id == actor_id)
        )
        addresses = [r[0] for r in actor_wallets.all()]
        if not addresses:
            return []
        shared = await self.db.execute(
            select(Wallet).where(Wallet.address.in_(addresses), Wallet.actor_id != actor_id)
        )
        return [{"address": w.address, "actor_id": w.actor_id} for w in shared.scalars().all()]

    def _string_similarity(self, a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        a, b = a.lower(), b.lower()
        if a == b:
            return 1.0
        from difflib import SequenceMatcher
        return SequenceMatcher(None, a, b).ratio()


class AttributionEngine:
    """Calculate attribution confidence between actors."""

    WEIGHTS = {
        "alias_similarity": 0.10,
        "pgp_match": 0.20,
        "wallet_relationship": 0.15,
        "behavior_similarity": 0.15,
        "stylometry_similarity": 0.20,
        "infrastructure_match": 0.10,
        "temporal_correlation": 0.05,
        "source_reliability": 0.05,
    }

    def calculate_attribution(self, signals: Dict[str, float]) -> Dict:
        weighted_sum = 0.0
        total_weight = 0.0
        for key, weight in self.WEIGHTS.items():
            score = signals.get(key, 0.0)
            weighted_sum += score * weight
            total_weight += weight

        overall = weighted_sum / total_weight if total_weight > 0 else 0.0
        overall = min(max(overall, 0.0), 1.0)

        if overall >= 0.85:
            level = "VERY_HIGH"
        elif overall >= 0.65:
            level = "HIGH"
        elif overall >= 0.40:
            level = "MEDIUM"
        else:
            level = "LOW"

        return {
            "overall_confidence": round(overall, 4),
            "confidence_level": level,
            "signals": signals,
            "weights": self.WEIGHTS,
        }

    def generate_evidence_chain(self, source_actor_id: int, target_actor_id: int,
                                 signals: Dict[str, float], evidence_ids: List[int]) -> Dict:
        chain = []
        evidence_map = {
            "alias_similarity": "Alias pattern similarity detected",
            "pgp_match": "Shared PGP fingerprint observed",
            "wallet_relationship": "Cryptocurrency wallet reuse detected",
            "behavior_similarity": "Behavioral pattern correlation",
            "stylometry_similarity": "Writing style similarity detected",
            "infrastructure_match": "Infrastructure fingerprint correlation",
            "temporal_correlation": "Temporal posting pattern overlap",
            "source_reliability": "Source reliability factor",
        }
        for key, score in signals.items():
            if score > 0.3:
                chain.append({
                    "type": key,
                    "description": evidence_map.get(key, key),
                    "confidence": round(score, 3),
                })
        return {
            "source_actor_id": source_actor_id,
            "target_actor_id": target_actor_id,
            "evidence_chain": chain,
            "evidence_ids": evidence_ids,
        }
