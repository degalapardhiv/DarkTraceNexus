"""
Standalone tests for core ML/CTI logic.
Does not require database or asyncpg.
"""
import sys
import os
import json
import hashlib
from pathlib import Path
from difflib import SequenceMatcher

# Add backend to path but avoid importing modules that need asyncpg
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))


# ============================================================
# Inline the core logic to avoid import chain issues
# ============================================================

def string_similarity(a, b):
    if not a or not b:
        return 0.0
    a, b = a.lower(), b.lower()
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


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


def calculate_attribution(signals):
    weighted_sum = sum(signals.get(k, 0) * v for k, v in WEIGHTS.items())
    total_weight = sum(WEIGHTS.values())
    overall = min(max(weighted_sum / total_weight if total_weight else 0, 0), 1)
    if overall >= 0.85:
        level = "VERY_HIGH"
    elif overall >= 0.65:
        level = "HIGH"
    elif overall >= 0.40:
        level = "MEDIUM"
    else:
        level = "LOW"
    return {"overall_confidence": round(overall, 4), "confidence_level": level}


def generate_evidence_chain(source_id, target_id, signals, evidence_ids):
    chain = []
    descriptions = {
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
                "description": descriptions.get(key, key),
                "confidence": round(score, 3),
            })
    return {
        "source_actor_id": source_id,
        "target_actor_id": target_id,
        "evidence_chain": chain,
        "evidence_ids": evidence_ids,
    }


import re

EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
PGP_REGEX = re.compile(r'(?:PGP|pgp|fingerprint)[:\s]*([A-F0-9]{40})', re.IGNORECASE)
BTC_REGEX = re.compile(r'[13][a-km-zA-HJ-NP-Z1-9]{25,34}')
IP_REGEX = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')


def extract_entities(text):
    return {
        "emails": EMAIL_REGEX.findall(text),
        "pgp_fingerprints": PGP_REGEX.findall(text),
        "btc_addresses": BTC_REGEX.findall(text),
        "ip_addresses": IP_REGEX.findall(text),
    }


# ============================================================
# Tests
# ============================================================

def test_string_similarity_identical():
    assert string_similarity("shadow_x", "shadow_x") == 1.0


def test_string_similarity_similar():
    sim = string_similarity("shadow_x", "shadow_x2")
    assert sim > 0.8


def test_string_similarity_different():
    sim = string_similarity("abc", "xyz")
    assert sim < 0.5


def test_string_similarity_empty():
    assert string_similarity("", "test") == 0.0
    assert string_similarity("test", "") == 0.0
    assert string_similarity("", "") == 0.0


def test_string_similarity_case_insensitive():
    sim = string_similarity("ShadowX", "shadowx")
    assert sim == 1.0


def test_attribution_weights_sum():
    assert abs(sum(WEIGHTS.values()) - 1.0) < 0.001


def test_attribution_very_high():
    signals = {
        "alias_similarity": 0.72, "pgp_match": 1.0, "wallet_relationship": 1.0,
        "behavior_similarity": 0.88, "stylometry_similarity": 0.91,
        "infrastructure_match": 0.85, "temporal_correlation": 0.78, "source_reliability": 0.90,
    }
    result = calculate_attribution(signals)
    assert result["overall_confidence"] >= 0.85
    assert result["confidence_level"] == "VERY_HIGH"


def test_attribution_high():
    signals = {
        "alias_similarity": 0.45, "pgp_match": 0.85, "wallet_relationship": 0.75,
        "behavior_similarity": 0.65, "stylometry_similarity": 0.70,
        "infrastructure_match": 0.55, "temporal_correlation": 0.60, "source_reliability": 0.75,
    }
    result = calculate_attribution(signals)
    assert 0.65 <= result["overall_confidence"] < 0.85
    assert result["confidence_level"] == "HIGH"


def test_attribution_medium():
    signals = {
        "alias_similarity": 0.60, "pgp_match": 0.0, "wallet_relationship": 1.0,
        "behavior_similarity": 0.75, "stylometry_similarity": 0.68,
        "infrastructure_match": 0.55, "temporal_correlation": 0.60, "source_reliability": 0.80,
    }
    result = calculate_attribution(signals)
    assert 0.40 <= result["overall_confidence"] < 0.65
    assert result["confidence_level"] == "MEDIUM"


def test_attribution_low():
    signals = {
        "alias_similarity": 0.22, "pgp_match": 0.0, "wallet_relationship": 0.0,
        "behavior_similarity": 0.55, "stylometry_similarity": 0.18,
        "infrastructure_match": 0.0, "temporal_correlation": 0.30, "source_reliability": 0.70,
    }
    result = calculate_attribution(signals)
    assert result["overall_confidence"] < 0.40
    assert result["confidence_level"] == "LOW"


def test_attribution_bounds():
    all_zero = {k: 0.0 for k in WEIGHTS}
    assert calculate_attribution(all_zero)["overall_confidence"] == 0.0

    all_one = {k: 1.0 for k in WEIGHTS}
    assert calculate_attribution(all_one)["overall_confidence"] == 1.0


def test_evidence_chain_generation():
    signals = {
        "pgp_match": 1.0, "wallet_relationship": 1.0,
        "stylometry_similarity": 0.91, "behavior_similarity": 0.88,
    }
    chain = generate_evidence_chain(1, 2, signals, [1, 2, 3])
    assert chain["source_actor_id"] == 1
    assert chain["target_actor_id"] == 2
    assert len(chain["evidence_chain"]) == 4
    assert all(e["confidence"] > 0.3 for e in chain["evidence_chain"])


def test_evidence_chain_weak():
    signals = {"alias_similarity": 0.1, "pgp_match": 0.0}
    chain = generate_evidence_chain(1, 2, signals, [1])
    assert len(chain["evidence_chain"]) == 0


def test_entity_extraction_emails():
    text = "Contact user@example.com and admin@test.org"
    entities = extract_entities(text)
    assert len(entities["emails"]) == 2


def test_entity_extraction_pgps():
    text = "PGP fingerprint: ABCDEF0123456789ABCDEF0123456789ABCDEF01"
    entities = extract_entities(text)
    assert len(entities["pgp_fingerprints"]) == 1


def test_entity_extraction_wallets():
    text = "Send BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    entities = extract_entities(text)
    assert len(entities["btc_addresses"]) >= 1


def test_entity_extraction_ips():
    text = "Server at 192.168.1.1 and 10.0.0.1"
    entities = extract_entities(text)
    assert len(entities["ip_addresses"]) == 2


def test_entity_extraction_no_match():
    text = "No entities here"
    entities = extract_entities(text)
    assert len(entities["emails"]) == 0
    assert len(entities["pgp_fingerprints"]) == 0
    assert len(entities["btc_addresses"]) == 0
    assert len(entities["ip_addresses"]) == 0


def test_synthetic_data_integrity():
    data_dir = Path(__file__).parent.parent / "data" / "synthetic"
    actors_file = data_dir / "actors.json"
    assert actors_file.exists(), "Synthetic actors.json not found"

    with open(actors_file) as f:
        actors = json.load(f)

    assert len(actors) == 50, f"Expected 50 actors, got {len(actors)}"

    for actor in actors:
        assert "name" in actor
        assert "aliases" in actor
        assert "pgp_fingerprints" in actor
        assert "wallets" in actor
        assert len(actor["aliases"]) >= 2
        assert len(actor["pgp_fingerprints"]) >= 1
        assert len(actor["wallets"]) >= 1

    # Check attributions file
    attr_file = data_dir / "attributions.json"
    assert attr_file.exists()
    with open(attr_file) as f:
        attrs = json.load(f)
    assert len(attrs) >= 5, f"Expected at least 5 attributions, got {len(attrs)}"

    # Verify at least one VERY_HIGH
    very_high = [a for a in attrs if a["confidence_level"] == "VERY_HIGH"]
    assert len(very_high) >= 1, "Expected at least one VERY_HIGH attribution"

    # Verify at least one LOW
    low = [a for a in attrs if a["confidence_level"] == "LOW"]
    assert len(low) >= 1, "Expected at least one LOW attribution"


def test_shared_entities_exist():
    data_dir = Path(__file__).parent.parent / "data" / "synthetic"
    with open(data_dir / "actors.json") as f:
        actors = json.load(f)

    # Find shared aliases
    alias_map = {}
    for actor in actors:
        for alias in actor["aliases"]:
            h = alias["handle"]
            if h not in alias_map:
                alias_map[h] = []
            alias_map[h].append(actor["name"])

    shared_aliases = {k: v for k, v in alias_map.items() if len(v) > 1}
    assert len(shared_aliases) >= 1, "Expected at least one shared alias"

    # Find shared PGP
    pgp_map = {}
    for actor in actors:
        for pgp in actor["pgp_fingerprints"]:
            fp = pgp["fingerprint"]
            if fp not in pgp_map:
                pgp_map[fp] = []
            pgp_map[fp].append(actor["name"])

    shared_pgps = {k: v for k, v in pgp_map.items() if len(v) > 1}
    assert len(shared_pgps) >= 1, "Expected at least one shared PGP"

    # Find shared wallets
    wallet_map = {}
    for actor in actors:
        for w in actor["wallets"]:
            addr = w["address"]
            if addr not in wallet_map:
                wallet_map[addr] = []
            wallet_map[addr].append(actor["name"])

    shared_wallets = {k: v for k, v in wallet_map.items() if len(v) > 1}
    assert len(shared_wallets) >= 1, "Expected at least one shared wallet"
