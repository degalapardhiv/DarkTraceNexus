from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import json
import csv
import io
from typing import List
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.entities import Actor, Alias, PGPKey, Wallet, Domain, IP, Post, Infrastructure, Source
from app.models.relationships import Relationship, Evidence, TimelineEvent
from app.services.entity_service import EntityExtractor
from app.schemas import IngestionStats

router = APIRouter(prefix="/ingestion", tags=["Data Ingestion"])


@router.post("/upload", response_model=IngestionStats)
async def upload_intelligence_data(
    file: UploadFile = File(...),
    source_name: str = "manual_upload",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    content_str = content.decode("utf-8")

    stats = IngestionStats()
    extractor = EntityExtractor()

    source = Source(name=source_name, source_type="manual", reliability="B")
    db.add(source)
    await db.flush()

    try:
        if file.filename.endswith(".json"):
            data = json.loads(content_str)
            records = data if isinstance(data, list) else [data]
        elif file.filename.endswith(".csv"):
            reader = csv.DictReader(io.StringIO(content_str))
            records = list(reader)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use JSON or CSV.")

        now = datetime.now(timezone.utc)

        for record in records:
            stats.records_processed += 1

            actor_name = record.get("actor_name") or record.get("name") or record.get("actor")
            if actor_name:
                existing = await db.execute(
                    select(Actor).where(Actor.name == actor_name)
                )
                actor = existing.scalar_one_or_none()
                if not actor:
                    actor = Actor(
                        name=actor_name,
                        risk_level=record.get("risk_level", "UNKNOWN"),
                        description=record.get("description"),
                        first_seen=now,
                        last_seen=now,
                    )
                    db.add(actor)
                    await db.flush()
                    stats.actors_discovered += 1
                else:
                    actor.last_seen = now

                if record.get("aliases"):
                    for alias_name in record["aliases"]:
                        alias_exists = await db.execute(
                            select(Alias).where(Alias.handle == alias_name, Alias.actor_id == actor.id)
                        )
                        if not alias_exists.scalar_one_or_none():
                            alias = Alias(
                                actor_id=actor.id,
                                handle=alias_name,
                                platform=record.get("platform", "unknown"),
                                first_seen=now,
                            )
                            db.add(alias)
                            stats.aliases_discovered += 1

                if record.get("pgp_fingerprints"):
                    for fp in record["pgp_fingerprints"]:
                        pgp = PGPKey(
                            actor_id=actor.id, fingerprint=fp,
                            source=source_name,
                        )
                        db.add(pgp)
                        stats.pgp_keys += 1

                if record.get("wallets"):
                    for wallet_addr in record["wallets"]:
                        wallet = Wallet(
                            actor_id=actor.id, address=wallet_addr,
                            source=source_name,
                        )
                        db.add(wallet)
                        stats.wallets += 1

                if record.get("domains"):
                    for domain_name in record["domains"]:
                        domain = Domain(
                            actor_id=actor.id, domain=domain_name,
                            source=source_name,
                        )
                        db.add(domain)
                        stats.domains += 1

                if record.get("content") or record.get("text"):
                    post = Post(
                        actor_id=actor.id,
                        title=record.get("title"),
                        content=record.get("content") or record.get("text"),
                        platform=record.get("platform"),
                        marketplace=record.get("marketplace"),
                        forum=record.get("forum"),
                        posted_at=now,
                    )
                    db.add(post)

        source.record_count = stats.records_processed
        await db.commit()

    except json.JSONDecodeError:
        stats.errors += 1
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except Exception as e:
        stats.errors += 1
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingestion error: {str(e)}")

    return stats


@router.get("/sources")
async def list_sources(db: AsyncSession = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Source).order_by(Source.created_at.desc()))
    sources = result.scalars().all()
    return [{"id": s.id, "name": s.name, "type": s.source_type,
             "reliability": s.reliability, "record_count": s.record_count,
             "is_active": s.is_active} for s in sources]
