import json
import hashlib
import re
import math
from collections import Counter
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.entities import Post
from app.models.relationships import BehaviorProfile, StylometricProfile


class BehavioralAnalyzer:
    """Analyze behavioral patterns of threat actors."""

    FUNCTION_WORDS = {
        'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
        'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
        'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
        'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
        'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    }

    async def build_profile(self, db: AsyncSession, actor_id: int) -> Dict:
        result = await db.execute(
            select(Post).where(Post.actor_id == actor_id).order_by(Post.posted_at)
        )
        posts = result.scalars().all()
        if not posts:
            return self._empty_profile(actor_id)

        hours = [p.posted_at.hour for p in posts if p.posted_at]
        weekdays = [p.posted_at.weekday() for p in posts if p.posted_at]

        night_hours = sum(1 for h in hours if 0 <= h < 6)
        weekend_days = sum(1 for d in weekdays if d >= 5)
        total = len(posts) or 1

        intervals = []
        for i in range(1, len(posts)):
            if posts[i].posted_at and posts[i-1].posted_at:
                delta = (posts[i].posted_at - posts[i-1].posted_at).total_seconds() / 3600
                intervals.append(delta)

        avg_interval = sum(intervals) / len(intervals) if intervals else 0

        platforms = [p.platform or p.marketplace or p.forum or "unknown" for p in posts]
        platform_counts = Counter(platforms)
        marketplace_count = sum(v for k, v in platform_counts.items() if 'market' in k.lower())
        forum_count = sum(v for k, v in platform_counts.items() if 'forum' in k.lower() or 'board' in k.lower())

        marketplace_level = "HIGH" if marketplace_count > total * 0.3 else "MEDIUM" if marketplace_count > total * 0.1 else "LOW"
        forum_level = "HIGH" if forum_count > total * 0.3 else "MEDIUM" if forum_count > total * 0.1 else "LOW"

        unique_aliases = set()
        for p in posts:
            if hasattr(p, 'alias_id') and p.alias_id:
                unique_aliases.add(p.alias_id)
        alias_migration = "HIGH" if len(unique_aliases) > 5 else "MEDIUM" if len(unique_aliases) > 2 else "LOW"

        tz_estimate = self._estimate_timezone(hours)

        activity_bursts = self._detect_bursts(posts)

        posting_freq = total / max(1, (posts[-1].posted_at - posts[0].posted_at).days or 1) if posts[-1].posted_at and posts[0].posted_at else 0

        profile_data = {
            "night_activity_pct": round(night_hours / total * 100, 1) if total else 0,
            "weekend_activity_pct": round(weekend_days / total * 100, 1) if total else 0,
            "avg_posting_interval_hours": round(avg_interval, 1),
            "alias_migration_freq": alias_migration,
            "marketplace_activity": marketplace_level,
            "forum_activity": forum_level,
            "posting_frequency": round(posting_freq, 2),
            "timezone_estimate": tz_estimate,
            "activity_bursts": json.dumps(activity_bursts),
            "transaction_patterns": json.dumps({}),
            "behavioral_hash": self._compute_hash(profile_data := {
                "night": night_hours / total if total else 0,
                "weekend": weekend_days / total if total else 0,
                "interval": avg_interval,
                "freq": posting_freq,
            }),
        }
        return profile_data

    def _estimate_timezone(self, hours: List[int]) -> str:
        if not hours:
            return "UNKNOWN"
        peak_hour = Counter(hours).most_common(1)[0][0]
        tz_offset = (peak_hour - 14) % 24
        return f"UTC{'+'if tz_offset < 12 else '-'}{abs(12 - tz_offset)}"

    def _detect_bursts(self, posts: List) -> List[Dict]:
        bursts = []
        for i in range(1, len(posts)):
            if posts[i].posted_at and posts[i-1].posted_at:
                delta = (posts[i].posted_at - posts[i-1].posted_at).total_seconds() / 3600
                if delta < 1.0:
                    bursts.append({
                        "time": posts[i].posted_at.isoformat(),
                        "interval_hours": round(delta, 2),
                    })
        return bursts[:20]

    def _compute_hash(self, data: dict) -> str:
        raw = json.dumps(data, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def _empty_profile(self, actor_id: int) -> Dict:
        return {
            "night_activity_pct": 0, "weekend_activity_pct": 0,
            "avg_posting_interval_hours": 0, "alias_migration_freq": "LOW",
            "marketplace_activity": "LOW", "forum_activity": "LOW",
            "posting_frequency": 0, "timezone_estimate": "UNKNOWN",
            "activity_bursts": "[]", "transaction_patterns": "{}",
            "behavioral_hash": "",
        }


class StylometricAnalyzer:
    """Analyze writing style of threat actors."""

    TOP_WORDS_COUNT = 50
    CHAR_NGRAM_SIZE = 3

    async def build_profile(self, db: AsyncSession, actor_id: int) -> Dict:
        result = await db.execute(
            select(Post).where(Post.actor_id == actor_id)
        )
        posts = result.scalars().all()
        if not posts:
            return self._empty_profile(actor_id)

        all_text = " ".join(p.content or "" for p in posts if p.content)
        if not all_text.strip():
            return self._empty_profile(actor_id)

        sentences = re.split(r'[.!?]+', all_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        words = re.findall(r'\b[a-zA-Z]+\b', all_text.lower())

        avg_sent_len = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
        avg_word_len = sum(len(w) for w in words) / max(len(words), 1)

        vocab = set(words)
        vocab_richness = len(vocab) / max(len(words), 1)

        total_chars = len(all_text)
        punct_count = sum(1 for c in all_text if c in '.,;:!?-()[]{}"\'')
        punct_ratio = punct_count / max(total_chars, 1)

        word_freq = Counter(words).most_common(self.TOP_WORDS_COUNT)
        function_freq = {w: words.count(w) / max(len(words), 1) for w in self.FUNCTION_WORDS if w in words}

        char_ngrams = Counter()
        for i in range(len(all_text) - self.CHAR_NGRAM_SIZE + 1):
            ng = all_text[i:i + self.CHAR_NGRAM_SIZE].lower()
            char_ngrams[ng] += 1
        top_ngrams = dict(char_ngrams.most_common(100))

        profile = {
            "avg_sentence_length": round(avg_sent_len, 2),
            "vocabulary_richness": round(vocab_richness, 4),
            "punctuation_ratio": round(punct_ratio, 4),
            "avg_word_length": round(avg_word_len, 2),
            "function_word_freq": json.dumps(function_freq),
            "top_word_freq": json.dumps(dict(word_freq)),
            "char_ngram_profile": json.dumps(top_ngrams),
            "stylistic_hash": self._compute_hash({
                "sent_len": avg_sent_len, "vocab": vocab_richness,
                "punct": punct_ratio, "word_len": avg_word_len,
            }),
            "sample_count": len(posts),
            "linguistic_fingerprint": json.dumps(self._compute_fingerprint(word_freq, function_freq, top_ngrams)),
        }
        return profile

    def _compute_fingerprint(self, word_freq, function_freq, ngrams):
        return {
            "top_words": [w for w, _ in word_freq[:20]],
            "function_words": list(function_freq.keys())[:15],
            "top_ngrams": list(ngrams.keys())[:20],
        }

    def compute_similarity(self, profile_a: Dict, profile_b: Dict) -> float:
        scores = []
        if profile_a.get("avg_sentence_length") and profile_b.get("avg_sentence_length"):
            diff = abs(profile_a["avg_sentence_length"] - profile_b["avg_sentence_length"])
            scores.append(max(0, 1 - diff / 30))
        if profile_a.get("vocabulary_richness") and profile_b.get("vocabulary_richness"):
            diff = abs(profile_a["vocabulary_richness"] - profile_b["vocabulary_richness"])
            scores.append(max(0, 1 - diff / 0.5))
        if profile_a.get("punctuation_ratio") and profile_b.get("punctuation_ratio"):
            diff = abs(profile_a["punctuation_ratio"] - profile_b["punctuation_ratio"])
            scores.append(max(0, 1 - diff / 0.1))
        if profile_a.get("avg_word_length") and profile_b.get("avg_word_length"):
            diff = abs(profile_a["avg_word_length"] - profile_b["avg_word_length"])
            scores.append(max(0, 1 - diff / 3))

        ngrams_a = json.loads(profile_a.get("char_ngram_profile", "{}"))
        ngrams_b = json.loads(profile_b.get("char_ngram_profile", "{}"))
        if ngrams_a and ngrams_b:
            common = set(ngrams_a.keys()) & set(ngrams_b.keys())
            total = set(ngrams_a.keys()) | set(ngrams_b.keys())
            jaccard = len(common) / max(len(total), 1)
            scores.append(jaccard)

        return sum(scores) / max(len(scores), 1)

    def _compute_hash(self, data: dict) -> str:
        raw = json.dumps(data, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def _empty_profile(self, actor_id: int) -> Dict:
        return {
            "avg_sentence_length": 0, "vocabulary_richness": 0,
            "punctuation_ratio": 0, "avg_word_length": 0,
            "function_word_freq": "{}", "top_word_freq": "{}",
            "char_ngram_profile": "{}", "stylistic_hash": "",
            "sample_count": 0, "linguistic_fingerprint": "{}",
        }
