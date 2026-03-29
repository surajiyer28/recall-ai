from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.memory import Memory
from app.models.entity import Entity
from app.models.capture_session import CaptureSession
from app.schemas.memory import MemoryOut, MemoryDetail, EntityBrief
from app.services.storage.vector_store import delete_memory_vectors

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=list[MemoryOut])
async def list_memories(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Memory).order_by(Memory.created_at.desc())

    if search:
        query = query.where(
            Memory.transcript.ilike(f"%{search}%")
            | Memory.summary.ilike(f"%{search}%")
        )

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return [MemoryOut.model_validate(m) for m in result.scalars().all()]


@router.get("/{memory_id}", response_model=MemoryDetail)
async def get_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    memory = await db.get(Memory, memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    entities_result = await db.execute(
        select(Entity).where(Entity.memory_id == memory_id)
    )
    entities = [
        EntityBrief(id=e.id, type=e.type, value=e.value)
        for e in entities_result.scalars().all()
    ]

    detail = MemoryDetail.model_validate(memory)
    detail.entities = entities
    return detail


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    memory = await db.get(Memory, memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    delete_memory_vectors(memory_id)

    await db.delete(memory)
    await db.commit()

    return {"status": "deleted", "memory_id": memory_id}


@router.patch("/{memory_id}", response_model=MemoryOut)
async def update_memory(
    memory_id: str,
    summary: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    memory = await db.get(Memory, memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    if summary is not None:
        memory.summary = summary

    await db.commit()
    await db.refresh(memory)
    return MemoryOut.model_validate(memory)
