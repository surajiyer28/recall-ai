from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.person import Person, PersonHighlight
from app.schemas.person import PersonSummaryOut, PersonHighlightOut

router = APIRouter(prefix="/people", tags=["people"])


@router.get("", response_model=list[PersonSummaryOut])
async def list_people(db: AsyncSession = Depends(get_db)):
    query = (
        select(
            Person.id,
            Person.name,
            func.count(PersonHighlight.id).label("highlight_count"),
            Person.created_at,
        )
        .outerjoin(PersonHighlight, PersonHighlight.person_id == Person.id)
        .group_by(Person.id)
        .order_by(Person.created_at.desc())
    )
    result = await db.execute(query)
    return [
        PersonSummaryOut(
            id=row.id,
            name=row.name,
            highlight_count=row.highlight_count,
            created_at=row.created_at,
        )
        for row in result.all()
    ]


@router.get("/{person_id}/highlights", response_model=list[PersonHighlightOut])
async def get_person_highlights(
    person_id: str, db: AsyncSession = Depends(get_db)
):
    person = await db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    result = await db.execute(
        select(PersonHighlight)
        .where(PersonHighlight.person_id == person_id)
        .order_by(PersonHighlight.created_at.desc())
    )
    return [PersonHighlightOut.model_validate(h) for h in result.scalars().all()]


@router.delete("/{person_id}")
async def delete_person(person_id: str, db: AsyncSession = Depends(get_db)):
    person = await db.get(Person, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    await db.delete(person)
    await db.commit()
    return {"status": "deleted", "person_id": person_id}
