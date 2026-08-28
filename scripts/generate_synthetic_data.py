#!/usr/bin/env python3
"""
DarkTrace Nexus - Synthetic Intelligence Data Generator v2
Generates correlated synthetic threat actor data with deliberate cross-actor links.
"""
import json
import random
import hashlib
import os
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

PLATFORMS = ["ShadowMarket", "DarkForum", "CyberBoard", "TorMarket", "NexusExchange", "GhostBazaar"]
MARKETPLACES = ["ShadowMarket", "TorMarket", "NexusExchange", "GhostBazaar"]
FORUMS = ["DarkForum", "CyberBoard", "UndergroundTalk"]

WRITING_STYLES = {
    "formal": {"avg_sent_len": 22, "vocab_rich": 0.65, "punct_ratio": 0.08, "word_len": 5.2},
    "casual": {"avg_sent_len": 12, "vocab_rich": 0.45, "punct_ratio": 0.05, "word_len": 4.3},
    "technical": {"avg_sent_len": 28, "vocab_rich": 0.72, "punct_ratio": 0.10, "word_len": 5.8},
    "aggressive": {"avg_sent_len": 10, "vocab_rich": 0.38, "punct_ratio": 0.04, "word_len": 4.0},
    "cryptic": {"avg_sent_len": 15, "vocab_rich": 0.55, "punct_ratio": 0.07, "word_len": 4.8},
}

THEMES = [
    "ransomware", "credential_theft", "data_broker", "malware_dev",
    "phishing", "exploit_trader", "botnet_operator", "ddos_service",
    "carding", "money_laundering", "crypto_mixer", "access_broker",
]

def gen_pgp():
    return ''.join(random.choices('0123456789ABCDEF', k=40))

def gen_btc():
    return random.choice(['1', '3']) + ''.join(random.choices('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', k=33))

def gen_onion():
    return ''.join(random.choices('abcdefghijklmnopqrstuvwxyz234567', k=16)) + ".onion"

def gen_ip():
    return f"{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"

def gen_domain():
    prefixes = ["secure", "dark", "shadow", "cyber", "ghost", "phantom", "vault", "nexus", "alpha", "omega"]
    suffixes = ["net", "shop", "market", "service", "hub", "gate", "proxy", "relay", "node", "link"]
    tlds = [".onion", ".com", ".net", ".xyz", ".bit"]
    return random.choice(prefixes) + random.choice(suffixes) + random.choice(tlds)

def gen_post(style_key, theme, platform):
    templates = {
        "formal": [
            "Updated {theme} package available. Verified on {platform}. Professional-grade reliability guaranteed.",
            "New {theme} module released. Comprehensive documentation included. Contact for access.",
            "Service-level {theme} solution deployed. Uptime statistics available upon request.",
            "Version 4.{ver} of {theme} framework now operational. All edge cases addressed.",
        ],
        "casual": [
            "hey guys new {theme} stuff fresh from the lab. works great hit me up",
            "just updated my {theme} tools. way faster now. pm if interested",
            "selling {theme} access cheap. btc only. dont waste my time",
            " anyone else having issues with {platform}? my {theme} stuff keeps disconnecting",
        ],
        "technical": [
            "Deployed {theme} infrastructure with failover cluster. Latency optimized to <50ms. Monitoring dashboard available.",
            "Kernel-level {theme} implementation complete. Bypasses standard detection signatures. Technical specs in private channel.",
            "Automated {theme} pipeline now handles 10k requests/sec. Load-balanced across 3 regions. API documentation forthcoming.",
            "Reverse-engineered latest {platform} security patches. {theme} vectors remain viable. Updated exploit module attached.",
        ],
        "aggressive": [
            "your {platform} is trash. my {theme} tools are 10x better. try me",
            "another {theme} victim today. too easy. they never learn",
            "if you cant handle {theme} you dont belong here. step up or get out",
            "new {theme} release going to break everything. youre not ready",
        ],
        "cryptic": [
            "the {theme} flows through channels unseen. {platform} echoes with whispers.",
            "fourteen nodes. {theme} protocol active. the network remembers.",
            "phase {ver} complete. {theme} architecture self-healing. observe.",
            "signal detected on {platform}. {theme} pattern matches archive. proceed with caution.",
        ],
    }
    template = random.choice(templates.get(style_key, templates["casual"]))
    return template.format(
        theme=theme,
        platform=platform,
        ver=random.randint(0, 9),
    )


# ============================================================
# CORE SIMILARITY FUNCTIONS - Used by both generator and ML
# ============================================================
def string_similarity(a, b):
    if not a or not b:
        return 0.0
    a, b = a.lower(), b.lower()
    if a == b:
        return 1.0
    from difflib import SequenceMatcher
    return SequenceMatcher(None, a, b).ratio()

def compute_weighted_attribution(signals):
    weights = {
        "alias_similarity": 0.10,
        "pgp_match": 0.20,
        "wallet_relationship": 0.15,
        "behavior_similarity": 0.15,
        "stylometry_similarity": 0.20,
        "infrastructure_match": 0.10,
        "temporal_correlation": 0.05,
        "source_reliability": 0.05,
    }
    weighted_sum = sum(signals.get(k, 0) * v for k, v in weights.items())
    total_weight = sum(weights.values())
    overall = min(max(weighted_sum / total_weight if total_weight else 0, 0), 1)
    if overall >= 0.85:
        level = "VERY_HIGH"
    elif overall >= 0.65:
        level = "HIGH"
    elif overall >= 0.40:
        level = "MEDIUM"
    else:
        level = "LOW"
    return round(overall, 4), level


def generate_actors():
    actors = []
    actor_defs = [
        ("ShadowAlpha", "formal", "ransomware", "CRITICAL"),
        ("DarkWolf", "casual", "credential_theft", "HIGH"),
        ("RedCipher", "technical", "malware_dev", "CRITICAL"),
        ("NightFox", "technical", "exploit_trader", "HIGH"),
        ("GhostProtocol", "cryptic", "data_broker", "HIGH"),
        ("CyberPhantom", "casual", "phishing", "MEDIUM"),
        ("ZeroDay", "aggressive", "exploit_trader", "CRITICAL"),
        ("IronClad", "formal", "access_broker", "MEDIUM"),
        ("BlackMesa", "aggressive", "ransomware", "HIGH"),
        ("CrimsonByte", "casual", "carding", "MEDIUM"),
        ("VenomStrike", "technical", "botnet_operator", "HIGH"),
        ("SilverBullet", "cryptic", "ddos_service", "MEDIUM"),
        ("CarbonFiber", "formal", "money_laundering", "HIGH"),
        ("TitanForge", "aggressive", "credential_theft", "CRITICAL"),
        ("ObsidianEdge", "casual", "crypto_mixer", "MEDIUM"),
        ("NebulaCore", "technical", "malware_dev", "HIGH"),
        ("QuantumLeap", "cryptic", "access_broker", "MEDIUM"),
        ("DragonScale", "formal", "data_broker", "HIGH"),
        ("VortexRider", "aggressive", "phishing", "MEDIUM"),
        ("ApexPredator", "casual", "ransomware", "CRITICAL"),
        ("Nighthawk", "technical", "exploit_trader", "HIGH"),
        ("SteelSerpent", "formal", "botnet_operator", "HIGH"),
        ("ChromeViper", "aggressive", "credential_theft", "MEDIUM"),
        ("PlasmaWave", "cryptic", "ddos_service", "LOW"),
        ("EclipseRun", "casual", "carding", "MEDIUM"),
        ("FrostBite", "technical", "money_laundering", "HIGH"),
        ("NovaSpark", "formal", "crypto_mixer", "MEDIUM"),
        ("RogueAgent", "aggressive", "access_broker", "HIGH"),
        ("PhantomByte", "cryptic", "data_broker", "MEDIUM"),
        ("DarkMatter", "casual", "ransomware", "HIGH"),
        ("BlazeFury", "technical", "malware_dev", "HIGH"),
        ("SilentStorm", "formal", "phishing", "MEDIUM"),
        ("TurboHack", "aggressive", "exploit_trader", "CRITICAL"),
        ("CobraStrike", "cryptic", "botnet_operator", "HIGH"),
        ("MysticCode", "casual", "ddos_service", "LOW"),
        ("SpartanOps", "formal", "credential_theft", "HIGH"),
        ("VikingShield", "technical", "access_broker", "MEDIUM"),
        ("ZeusBolt", "aggressive", "ransomware", "CRITICAL"),
        ("MarsRover", "cryptic", "data_broker", "MEDIUM"),
        ("AtlasNode", "formal", "money_laundering", "HIGH"),
        ("OrionKey", "casual", "crypto_mixer", "MEDIUM"),
        ("NexusCore", "technical", "malware_dev", "HIGH"),
        ("CipherWolf", "aggressive", "credential_theft", "HIGH"),
        ("ShadowNet", "cryptic", "phishing", "MEDIUM"),
        ("GhostLink", "formal", "botnet_operator", "HIGH"),
        ("PhantomRust", "casual", "exploit_trader", "MEDIUM"),
        ("DarkHorizon", "technical", "ransomware", "CRITICAL"),
        ("NightShade", "aggressive", "carding", "MEDIUM"),
        ("RedPhoenix", "cryptic", "access_broker", "HIGH"),
        ("BlueOrion", "formal", "data_broker", "MEDIUM"),
    ]

    for i, (name, style, theme, risk) in enumerate(actor_defs):
        first_seen = datetime(2025, 1, 1) + timedelta(days=random.randint(0, 300))
        last_seen = first_seen + timedelta(days=random.randint(30, 200))
        actors.append({
            "id": i + 1, "name": name, "risk_level": risk,
            "description": f"Synthetic threat actor focused on {theme}. Operates across multiple platforms.",
            "theme": theme, "style_key": style,
            "first_seen": first_seen.isoformat(), "last_seen": last_seen.isoformat(),
            "aliases": [], "pgp_fingerprints": [], "wallets": [],
            "domains": [], "ips": [], "posts": [],
            "behavior": {}, "stylometric": {},
        })
    return actors


def generate_aliases(actors):
    alias_assignments = {
        # Actor 1 (ShadowAlpha) and Actor 2 (DarkWolf) - SHARED ALIASES
        1: ["shadow_x", "nightmarket", "zero_fox", "phantom_buyer", "alpha_trader"],
        2: ["darkwolf", "phantom_store", "phantom_buyer", "night_trader", "wolf_alpha"],
        # Actor 3 (RedCipher) and Actor 4 (NightFox) - SIMILAR ALIASES
        3: ["redcipher", "crimsonbyte_dev", "cipher_master", "red_node"],
        4: ["nightfox", "night_cipher", "fox_master", "red_node_v2"],
        # Actor 5 (GhostProtocol) and Actor 6 (CyberPhantom) - SIMILAR NAMES
        5: ["ghost_protocol", "phantom_data", "ghost_buyer", "data_phantom"],
        6: ["cyber_phantom", "phantom_net", "cyber_ghost", "phantom_data_v2"],
        # Actor 7 (ZeroDay) and Actor 8 (IronClad) - WEAK LINK
        7: ["zer0day", "zero_exploit", "day_zero"],
        8: ["ironclad", "iron_gate", "clad_ops"],
        # Actor 9 and 10 - WEAK LINK
        9: ["black_mesa", "mesa_ops", "black_ops"],
        10: ["crimson_byte", "crimson_ops", "byte_crimson"],
        # Standalone actors
        11: ["venom_strike", "venom_ops", "strike_venom"],
        12: ["silver_bullet", "silver_ops", "bullet_silver"],
        13: ["carbon_fiber", "carbon_ops"],
        14: ["titan_forge", "titan_ops"],
        15: ["obsidian_edge", "obsidian_ops"],
        16: ["nebula_core", "nebula_ops"],
        17: ["quantum_leap", "quantum_ops"],
        18: ["dragon_scale", "dragon_ops"],
        19: ["vortex_rider", "vortex_ops"],
        20: ["apex_predator", "apex_ops"],
        21: ["nighthawk_ops", "hawk_ops"],
        22: ["steel_serpent", "steel_ops"],
        23: ["chrome_viper", "chrome_ops"],
        24: ["plasma_wave", "plasma_ops"],
        25: ["eclipse_run", "eclipse_ops"],
        26: ["frost_bite", "frost_ops"],
        27: ["nova_spark", "nova_ops"],
        28: ["rogue_agent", "rogue_ops"],
        29: ["phantom_byte", "phantom_ops"],
        30: ["dark_matter", "dark_ops"],
        31: ["blaze_fury", "blaze_ops"],
        32: ["silent_storm", "silent_ops"],
        33: ["turbo_hack", "turbo_ops"],
        34: ["cobra_strike", "cobra_ops"],
        35: ["mystic_code", "mystic_ops"],
        36: ["spartan_ops", "spartan_net"],
        37: ["viking_shield", "viking_ops"],
        38: ["zeus_bolt", "zeus_ops"],
        39: ["mars_rover", "mars_ops"],
        40: ["atlas_node", "atlas_ops"],
        41: ["orion_key", "orion_ops"],
        42: ["nexus_core", "nexus_ops"],
        43: ["cipher_wolf", "cipher_ops"],
        44: ["shadow_net", "shadow_ops"],
        45: ["ghost_link", "ghost_ops"],
        46: ["phantom_rust", "rust_ops"],
        47: ["dark_horizon", "horizon_ops"],
        48: ["night_shade", "shade_ops"],
        49: ["red_phoenix", "phoenix_ops"],
        50: ["blue_orion", "blue_ops"],
    }

    for actor in actors:
        aid = actor["id"]
        handles = alias_assignments.get(aid, [f"{actor['name'].lower()}_v1"])
        platform_count = random.randint(2, 4)
        selected_platforms = random.sample(PLATFORMS, min(platform_count, len(PLATFORMS)))

        for j, handle in enumerate(handles):
            actor["aliases"].append({
                "handle": handle,
                "platform": selected_platforms[j % len(selected_platforms)],
                "first_seen": actor["first_seen"],
                "last_seen": actor["last_seen"],
                "is_primary": j == 0,
            })
    return actors


def generate_infrastructure(actors):
    # Shared infrastructure for correlated pairs
    shared_pgp_a = gen_pgp()
    shared_pgp_b = gen_pgp()
    shared_wallet_a = gen_btc()
    shared_wallet_b = gen_btc()
    shared_wallet_c = gen_btc()
    shared_domain_a = gen_domain()
    shared_domain_b = gen_domain()
    shared_ip_a = gen_ip()

    for actor in actors:
        aid = actor["id"]
        for _ in range(random.randint(1, 3)):
            actor["pgp_fingerprints"].append({
                "fingerprint": gen_pgp(),
                "algorithm": random.choice(["RSA", "DSA", "ECC"]),
                "key_size": random.choice([2048, 4096]),
            })
        for _ in range(random.randint(1, 4)):
            actor["wallets"].append({
                "address": gen_btc(),
                "currency": random.choice(["BTC", "BTC", "BTC", "XMR", "ETH"]),
                "balance": round(random.uniform(0, 50), 4),
            })
        for _ in range(random.randint(2, 5)):
            actor["domains"].append({"domain": gen_domain(), "is_tor": random.random() > 0.4})
        for _ in range(random.randint(1, 3)):
            actor["ips"].append({
                "ip_address": gen_ip(),
                "asn": f"AS{random.randint(1000, 99999)}",
                "country": random.choice(["US", "RU", "CN", "DE", "NL", "RO", "UA", "BR"]),
                "is_tor": random.random() > 0.6,
            })

    # === DELIBERATE CORRELATIONS ===
    # Pair 1: ShadowAlpha(1) <-> DarkWolf(2) - STRONG (shared PGP, wallet, alias, style overlap)
    actors[0]["pgp_fingerprints"][0]["fingerprint"] = shared_pgp_a
    actors[1]["pgp_fingerprints"][0]["fingerprint"] = shared_pgp_a
    actors[0]["wallets"][0]["address"] = shared_wallet_a
    actors[1]["wallets"][0]["address"] = shared_wallet_a
    actors[0]["domains"][0]["domain"] = shared_domain_a
    actors[1]["domains"][0]["domain"] = shared_domain_a

    # Pair 2: RedCipher(3) <-> NightFox(4) - MEDIUM (shared domain, similar aliases)
    actors[2]["domains"][0]["domain"] = shared_domain_b
    actors[3]["domains"][0]["domain"] = shared_domain_b
    actors[2]["pgp_fingerprints"][0]["fingerprint"] = shared_pgp_b
    actors[3]["pgp_fingerprints"][0]["fingerprint"] = shared_pgp_b

    # Pair 3: GhostProtocol(5) <-> CyberPhantom(6) - MEDIUM (shared wallet)
    actors[4]["wallets"][0]["address"] = shared_wallet_b
    actors[5]["wallets"][0]["address"] = shared_wallet_b
    actors[4]["ips"][0]["ip_address"] = shared_ip_a
    actors[5]["ips"][0]["ip_address"] = shared_ip_a

    # Pair 4: ZeroDay(7) <-> IronClad(8) - WEAK (only alias similarity)
    # Pair 5: BlackMesa(9) <-> CrimsonByte(10) - WEAK (only behavioral similarity)

    return actors


def generate_posts(actors):
    for actor in actors:
        num_posts = random.randint(15, 35)
        base_date = datetime.fromisoformat(actor["first_seen"])

        for i in range(num_posts):
            post_date = base_date + timedelta(days=random.randint(0, 180), hours=random.randint(0, 23))
            hour = post_date.hour

            if actor["style_key"] == "formal":
                hour = random.choices(range(24), weights=[1]*6 + [3]*12 + [1]*6)[0]
            elif actor["style_key"] == "casual":
                hour = random.choices(range(24), weights=[2]*6 + [1]*12 + [3]*6)[0]
            elif actor["style_key"] == "aggressive":
                hour = random.choices(range(24), weights=[3]*6 + [2]*12 + [1]*6)[0]
            post_date = post_date.replace(hour=hour)

            platform = random.choice(PLATFORMS)
            content = gen_post(actor["style_key"], actor["theme"], platform)

            actor["posts"].append({
                "title": f"{actor['theme'].replace('_', ' ').title()} - Post #{i+1}",
                "content": content,
                "platform": platform,
                "marketplace": platform if any(m in platform.lower() for m in ["market", "exchange", "bazaar"]) else None,
                "forum": platform if any(f in platform.lower() for f in ["forum", "board"]) else None,
                "posted_at": post_date.isoformat(),
                "word_count": len(content.split()),
            })
    return actors


def generate_behavior_profiles(actors):
    for actor in actors:
        posts = actor["posts"]
        if not posts:
            actor["behavior"] = {
                "night_activity_pct": 0, "weekend_activity_pct": 0,
                "avg_posting_interval_hours": 0, "posting_frequency": 0,
                "timezone_estimate": "UNKNOWN",
            }
            continue

        hours = [datetime.fromisoformat(p["posted_at"]).hour for p in posts]
        weekdays = [datetime.fromisoformat(p["posted_at"]).weekday() for p in posts]
        night = sum(1 for h in hours if 0 <= h < 6)
        weekend = sum(1 for d in weekdays if d >= 5)
        total = len(posts)

        intervals = []
        sorted_posts = sorted(posts, key=lambda p: p["posted_at"])
        for i in range(1, len(sorted_posts)):
            t1 = datetime.fromisoformat(sorted_posts[i-1]["posted_at"])
            t2 = datetime.fromisoformat(sorted_posts[i]["posted_at"])
            intervals.append((t2 - t1).total_seconds() / 3600)

        peak_hour = max(set(hours), key=hours.count) if hours else 12

        actor["behavior"] = {
            "night_activity_pct": round(night / total * 100, 1) if total else 0,
            "weekend_activity_pct": round(weekend / total * 100, 1) if total else 0,
            "avg_posting_interval_hours": round(sum(intervals) / len(intervals), 1) if intervals else 0,
            "posting_frequency": round(total / max(1, (datetime.fromisoformat(sorted_posts[-1]["posted_at"]) - datetime.fromisoformat(sorted_posts[0]["posted_at"])).days or 1), 2),
            "timezone_estimate": f"UTC{'+'if (peak_hour - 14) % 24 < 12 else '-'}{abs(12 - (peak_hour - 14) % 24)}",
        }

    # Make correlated pairs have SIMILAR behavioral profiles
    # Pair 1: Actor 1 & 2 should have similar posting patterns
    actors[1]["behavior"]["night_activity_pct"] = actors[0]["behavior"]["night_activity_pct"] + random.uniform(-3, 3)
    actors[1]["behavior"]["weekend_activity_pct"] = actors[0]["behavior"]["weekend_activity_pct"] + random.uniform(-3, 3)
    actors[1]["behavior"]["avg_posting_interval_hours"] = actors[0]["behavior"]["avg_posting_interval_hours"] + random.uniform(-1, 1)

    # Pair 2: Actor 3 & 4 should have similar posting patterns
    actors[3]["behavior"]["night_activity_pct"] = actors[2]["behavior"]["night_activity_pct"] + random.uniform(-2, 2)
    actors[3]["behavior"]["weekend_activity_pct"] = actors[2]["behavior"]["weekend_activity_pct"] + random.uniform(-2, 2)

    return actors


def generate_stylometric_profiles(actors):
    for actor in actors:
        style = WRITING_STYLES[actor["style_key"]]
        noise = lambda: random.uniform(-0.02, 0.02)
        actor["stylometric"] = {
            "avg_sentence_length": round(style["avg_sent_len"] + random.uniform(-2, 2), 1),
            "vocabulary_richness": round(max(0.1, min(1.0, style["vocab_rich"] + noise())), 3),
            "punctuation_ratio": round(max(0.01, style["punct_ratio"] + noise()), 3),
            "avg_word_length": round(style["word_len"] + random.uniform(-0.2, 0.2), 1),
            "sample_count": len(actor["posts"]),
        }

    # Make correlated pairs have VERY SIMILAR stylometric profiles
    # Pair 1: ShadowAlpha(1) and DarkWolf(2) - same style overlap
    actors[1]["stylometric"]["avg_sentence_length"] = actors[0]["stylometric"]["avg_sentence_length"] + random.uniform(-0.5, 0.5)
    actors[1]["stylometric"]["vocabulary_richness"] = actors[0]["stylometric"]["vocabulary_richness"] + random.uniform(-0.01, 0.01)
    actors[1]["stylometric"]["punctuation_ratio"] = actors[0]["stylometric"]["punctuation_ratio"] + random.uniform(-0.005, 0.005)
    actors[1]["stylometric"]["avg_word_length"] = actors[0]["stylometric"]["avg_word_length"] + random.uniform(-0.1, 0.1)

    # Pair 2: RedCipher(3) and NightFox(4) - technical style, very similar
    actors[3]["stylometric"]["avg_sentence_length"] = actors[2]["stylometric"]["avg_sentence_length"] + random.uniform(-0.3, 0.3)
    actors[3]["stylometric"]["vocabulary_richness"] = actors[2]["stylometric"]["vocabulary_richness"] + random.uniform(-0.005, 0.005)
    actors[3]["stylometric"]["punctuation_ratio"] = actors[2]["stylometric"]["punctuation_ratio"] + random.uniform(-0.003, 0.003)

    return actors


def generate_all(actors):
    relationships = []
    evidence_records = []
    attributions = []
    timeline_events = []
    evidence_id = 1

    # Direct entity relationships
    for actor in actors:
        for alias in actor["aliases"]:
            evidence_records.append({
                "id": evidence_id, "actor_id": actor["id"],
                "evidence_type": "alias_observed",
                "description": f"Alias '{alias['handle']}' observed on {alias['platform']}",
                "confidence": 0.95, "source": alias["platform"],
                "evidence_hash": hashlib.sha256(f"alias:{actor['id']}:{alias['handle']}".encode()).hexdigest(),
            })
            relationships.append({
                "source_type": "Actor", "source_id": actor["id"],
                "target_type": "Alias", "target_id": hash(alias["handle"]) % 10000,
                "relationship_type": "USES_ALIAS", "confidence": 0.95,
                "evidence_id": evidence_id,
            })
            timeline_events.append({
                "actor_id": actor["id"], "event_type": "alias_created",
                "title": f"Alias '{alias['handle']}' created on {alias['platform']}",
                "event_date": alias["first_seen"], "confidence": 0.9,
                "source": alias["platform"], "evidence_id": evidence_id,
            })
            evidence_id += 1

        for pgp in actor["pgp_fingerprints"]:
            evidence_records.append({
                "id": evidence_id, "actor_id": actor["id"],
                "evidence_type": "pgp_key_observed",
                "description": f"PGP key {pgp['fingerprint'][:16]}... ({pgp['algorithm']}/{pgp['key_size']}bit) observed",
                "confidence": 0.98, "source": "synthetic",
                "evidence_hash": hashlib.sha256(f"pgp:{actor['id']}:{pgp['fingerprint']}".encode()).hexdigest(),
            })
            relationships.append({
                "source_type": "Actor", "source_id": actor["id"],
                "target_type": "PGP", "target_id": hash(pgp["fingerprint"]) % 10000,
                "relationship_type": "USES_PGP", "confidence": 0.98,
                "evidence_id": evidence_id,
            })
            evidence_id += 1

        for wallet in actor["wallets"]:
            evidence_records.append({
                "id": evidence_id, "actor_id": actor["id"],
                "evidence_type": "wallet_observed",
                "description": f"Cryptocurrency wallet {wallet['address'][:16]}... ({wallet['currency']}, balance: {wallet['balance']}) observed",
                "confidence": 0.9, "source": "synthetic",
                "evidence_hash": hashlib.sha256(f"wallet:{actor['id']}:{wallet['address']}".encode()).hexdigest(),
            })
            relationships.append({
                "source_type": "Actor", "source_id": actor["id"],
                "target_type": "Wallet", "target_id": hash(wallet["address"]) % 10000,
                "relationship_type": "USES_WALLET", "confidence": 0.9,
                "evidence_id": evidence_id,
            })
            evidence_id += 1

        for domain in actor["domains"]:
            evidence_records.append({
                "id": evidence_id, "actor_id": actor["id"],
                "evidence_type": "domain_observed",
                "description": f"Domain {domain['domain']} observed ({'TOR' if domain['is_tor'] else 'clearnet'})",
                "confidence": 0.85, "source": "synthetic",
                "evidence_hash": hashlib.sha256(f"domain:{actor['id']}:{domain['domain']}".encode()).hexdigest(),
            })
            relationships.append({
                "source_type": "Actor", "source_id": actor["id"],
                "target_type": "Domain", "target_id": hash(domain["domain"]) % 10000,
                "relationship_type": "USES_INFRASTRUCTURE", "confidence": 0.85,
                "evidence_id": evidence_id,
            })
            evidence_id += 1

    # === CROSS-ACTOR CORRELATIONS ===
    # These create the meaningful attributions the demo depends on

    cross_correlations = [
        # (src, tgt, signals_override, description)
        # Pair 1: ShadowAlpha <-> DarkWolf - STRONG
        (1, 2, {
            "alias_similarity": 0.72,
            "pgp_match": 1.0,
            "wallet_relationship": 1.0,
            "behavior_similarity": 0.88,
            "stylometry_similarity": 0.91,
            "infrastructure_match": 0.85,
            "temporal_correlation": 0.78,
            "source_reliability": 0.90,
        }, "ShadowAlpha and DarkWolf share PGP fingerprint, wallet address, and alias 'phantom_buyer'. Writing style and behavioral patterns highly correlated."),

        # Pair 2: RedCipher <-> NightFox - MEDIUM-HIGH
        (3, 4, {
            "alias_similarity": 0.55,
            "pgp_match": 1.0,
            "wallet_relationship": 0.0,
            "behavior_similarity": 0.82,
            "stylometry_similarity": 0.94,
            "infrastructure_match": 0.70,
            "temporal_correlation": 0.65,
            "source_reliability": 0.85,
        }, "RedCipher and NightFox share PGP key and domain infrastructure. Both use technical writing style with very similar vocabulary and sentence structure."),

        # Pair 3: GhostProtocol <-> CyberPhantom - MEDIUM
        (5, 6, {
            "alias_similarity": 0.60,
            "pgp_match": 0.0,
            "wallet_relationship": 1.0,
            "behavior_similarity": 0.75,
            "stylometry_similarity": 0.68,
            "infrastructure_match": 0.55,
            "temporal_correlation": 0.60,
            "source_reliability": 0.80,
        }, "GhostProtocol and CyberPhantom share cryptocurrency wallet and IP address. Similar alias naming patterns observed."),

        # Pair 4: ZeroDay <-> IronClad - WEAK
        (7, 8, {
            "alias_similarity": 0.35,
            "pgp_match": 0.0,
            "wallet_relationship": 0.0,
            "behavior_similarity": 0.42,
            "stylometry_similarity": 0.28,
            "infrastructure_match": 0.0,
            "temporal_correlation": 0.38,
            "source_reliability": 0.75,
        }, "Weak correlation between ZeroDay and IronClad. Only temporal posting patterns show minor overlap. Insufficient evidence for strong attribution."),

        # Pair 5: BlackMesa <-> CrimsonByte - WEAK
        (9, 10, {
            "alias_similarity": 0.22,
            "pgp_match": 0.0,
            "wallet_relationship": 0.0,
            "behavior_similarity": 0.55,
            "stylometry_similarity": 0.18,
            "infrastructure_match": 0.0,
            "temporal_correlation": 0.30,
            "source_reliability": 0.70,
        }, "Minimal correlation. Behavioral patterns show some overlap but stylistic and infrastructure signals are divergent."),

        # Pair 6: VenomStrike <-> SilverBullet - MEDIUM
        (11, 12, {
            "alias_similarity": 0.45,
            "pgp_match": 0.0,
            "wallet_relationship": 0.0,
            "behavior_similarity": 0.65,
            "stylometry_similarity": 0.72,
            "infrastructure_match": 0.30,
            "temporal_correlation": 0.55,
            "source_reliability": 0.80,
        }, "Moderate correlation. Stylometric analysis reveals similar vocabulary patterns. Behavioral profiles partially overlap."),

        # Pair 7: CarbonFiber <-> TitanForge - HIGH
        (13, 14, {
            "alias_similarity": 0.40,
            "pgp_match": 0.0,
            "wallet_relationship": 0.0,
            "behavior_similarity": 0.70,
            "stylometry_similarity": 0.85,
            "infrastructure_match": 0.0,
            "temporal_correlation": 0.60,
            "source_reliability": 0.85,
        }, "Strong stylometric correlation between CarbonFiber and TitanForge despite different thematic focus areas."),

        # Pair 8: NebulaCore <-> DragonScale - MEDIUM
        (16, 18, {
            "alias_similarity": 0.30,
            "pgp_match": 0.0,
            "wallet_relationship": 0.0,
            "behavior_similarity": 0.58,
            "stylometry_similarity": 0.62,
            "infrastructure_match": 0.0,
            "temporal_correlation": 0.48,
            "source_reliability": 0.75,
        }, "Moderate correlation based on behavioral and stylometric signals. No cryptographic or infrastructure overlap detected."),

        # Pair 9: ZeusBolt <-> DarkHorizon - VERY HIGH (intentionally strong for demo)
        (38, 47, {
            "alias_similarity": 0.50,
            "pgp_match": 1.0,
            "wallet_relationship": 1.0,
            "behavior_similarity": 0.85,
            "stylometry_similarity": 0.88,
            "infrastructure_match": 0.90,
            "temporal_correlation": 0.80,
            "source_reliability": 0.90,
        }, "ZeusBolt and DarkHorizon show very strong correlation across multiple independent signals: shared PGP, shared wallet, matching infrastructure, and highly similar behavioral/stylometric profiles."),

        # Pair 10: ApexPredator <-> DarkMatter - HIGH
        (20, 30, {
            "alias_similarity": 0.38,
            "pgp_match": 0.0,
            "wallet_relationship": 1.0,
            "behavior_similarity": 0.78,
            "stylometry_similarity": 0.75,
            "infrastructure_match": 0.60,
            "temporal_correlation": 0.65,
            "source_reliability": 0.85,
        }, "ApexPredator and DarkMatter share wallet address and show correlated behavioral patterns."),
    ]

    for src_id, tgt_id, signals, desc in cross_correlations:
        overall, level = compute_weighted_attribution(signals)

        # Determine primary evidence type
        if signals.get("pgp_match", 0) >= 0.9:
            etype = "pgp_match"
        elif signals.get("wallet_relationship", 0) >= 0.9:
            etype = "wallet_reuse"
        elif signals.get("stylometry_similarity", 0) >= 0.8:
            etype = "stylometric_correlation"
        elif signals.get("behavior_similarity", 0) >= 0.7:
            etype = "behavioral_correlation"
        elif signals.get("infrastructure_match", 0) >= 0.5:
            etype = "infrastructure_correlation"
        else:
            etype = "weak_correlation"

        evidence_records.append({
            "id": evidence_id, "actor_id": src_id,
            "evidence_type": etype,
            "description": desc,
            "confidence": overall, "source": "attribution_engine",
            "evidence_hash": hashlib.sha256(f"attr:{src_id}:{tgt_id}:{overall}".encode()).hexdigest(),
        })

        relationships.append({
            "source_type": "Actor", "source_id": src_id,
            "target_type": "Actor", "target_id": tgt_id,
            "relationship_type": "CORRELATED_WITH", "confidence": overall,
            "evidence_id": evidence_id,
        })

        attributions.append({
            "source_actor_id": src_id, "target_actor_id": tgt_id,
            "overall_confidence": overall, "confidence_level": level,
            **signals,
            "supporting_evidence": json.dumps([evidence_id]),
            "contradicting_evidence": json.dumps([]),
        })

        timeline_events.append({
            "actor_id": src_id, "event_type": "correlation_detected",
            "title": f"Cross-actor correlation detected: {level} confidence ({overall*100:.0f}%)",
            "description": desc,
            "event_date": datetime(2025, random.randint(1, 12), random.randint(1, 28)).isoformat(),
            "confidence": overall, "source": "attribution_engine",
            "evidence_id": evidence_id,
        })
        evidence_id += 1

    return relationships, evidence_records, attributions, timeline_events


def main():
    output_dir = Path(__file__).parent.parent / "data" / "synthetic"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Generating 50 synthetic actors...")
    actors = generate_actors()

    print("Generating aliases with cross-actor overlaps...")
    actors = generate_aliases(actors)

    print("Generating infrastructure with shared indicators...")
    actors = generate_infrastructure(actors)

    print("Generating 1000+ posts...")
    actors = generate_posts(actors)

    print("Generating behavioral profiles...")
    actors = generate_behavior_profiles(actors)

    print("Generating stylometric profiles...")
    actors = generate_stylometric_profiles(actors)

    print("Generating relationships and attributions...")
    relationships, evidence_records, attributions, timeline_events = generate_all(actors)

    # Save
    for name, data in [
        ("actors.json", actors),
        ("relationships.json", relationships),
        ("evidence.json", evidence_records),
        ("attributions.json", attributions),
        ("timeline.json", timeline_events),
    ]:
        with open(output_dir / name, "w") as f:
            json.dump(data, f, indent=2, default=str)
        print(f"  Saved {len(data)} records to {name}")

    # Stats
    total_aliases = sum(len(a["aliases"]) for a in actors)
    total_pgps = sum(len(a["pgp_fingerprints"]) for a in actors)
    total_wallets = sum(len(a["wallets"]) for a in actors)
    total_domains = sum(len(a["domains"]) for a in actors)
    total_posts = sum(len(a["posts"]) for a in actors)

    print(f"\n=== SYNTHETIC DATA v2 SUMMARY ===")
    print(f"Actors:            {len(actors)}")
    print(f"Aliases:           {total_aliases}")
    print(f"PGP Keys:          {total_pgps}")
    print(f"Wallets:           {total_wallets}")
    print(f"Domains:           {total_domains}")
    print(f"Posts:             {total_posts}")
    print(f"Relationships:     {len(relationships)}")
    print(f"Evidence Records:  {len(evidence_records)}")
    print(f"Attributions:      {len(attributions)}")
    print(f"Timeline Events:   {len(timeline_events)}")

    print(f"\n=== ATTRIBUTION CONFIDENCE LEVELS ===")
    for a in attributions:
        src = next((x["name"] for x in actors if x["id"] == a["source_actor_id"]), "?")
        tgt = next((x["name"] for x in actors if x["id"] == a["target_actor_id"]), "?")
        print(f"  {src} <-> {tgt}: {a['confidence_level']} ({a['overall_confidence']*100:.0f}%)")

    print(f"\n=== SHARED ENTITIES ===")
    alias_map = {}
    for actor in actors:
        for alias in actor["aliases"]:
            h = alias["handle"]
            if h not in alias_map:
                alias_map[h] = []
            alias_map[h].append(actor["name"])
    for h, names in alias_map.items():
        if len(names) > 1:
            print(f"  Shared alias '{h}': {', '.join(names)}")

    pgp_map = {}
    for actor in actors:
        for pgp in actor["pgp_fingerprints"]:
            fp = pgp["fingerprint"]
            if fp not in pgp_map:
                pgp_map[fp] = []
            pgp_map[fp].append(actor["name"])
    for fp, names in pgp_map.items():
        if len(names) > 1:
            print(f"  Shared PGP {fp[:16]}...: {', '.join(names)}")

    wallet_map = {}
    for actor in actors:
        for w in actor["wallets"]:
            addr = w["address"]
            if addr not in wallet_map:
                wallet_map[addr] = []
            wallet_map[addr].append(actor["name"])
    for addr, names in wallet_map.items():
        if len(names) > 1:
            print(f"  Shared wallet {addr[:16]}...: {', '.join(names)}")


if __name__ == "__main__":
    main()
