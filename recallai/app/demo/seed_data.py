"""
Demo data loader: inserts 6 realistic memory captures directly into the database
(no API keys required). Covers all 5 query types from the RecallAI reference.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.models.database import async_session_factory
from app.models.capture_session import CaptureSession
from app.models.memory import Memory
from app.models.entity import Entity
from app.models.knowledge_graph import EntityRelationship
from app.models.notification import Notification

logger = logging.getLogger(__name__)

DEMO_CAPTURES = [
    {
        "trigger": "vad",
        "place_name": "Luddy Hall 3025",
        "gps_lat": 39.1755,
        "gps_lng": -86.5234,
        "hours_ago": 3,
        "transcript": (
            "Professor Chen said the project proposal is due next Friday. "
            "She wants us to include a literature review section. "
            "I'm working with Sarah and Marcus on the group project. "
            "Sarah suggested we focus on transformer architectures for the NLP section. "
            "Marcus will handle the data pipeline."
        ),
        "summary": (
            "Group project meeting in Luddy Hall with Sarah and Marcus. "
            "Professor Chen assigned a proposal due next Friday requiring a literature review. "
            "Sarah will cover transformer architectures for NLP. "
            "Marcus will handle the data pipeline."
        ),
        "duration_sec": 1800,
        "entities": [
            {"type": "person", "value": "Professor Chen"},
            {"type": "person", "value": "Sarah"},
            {"type": "person", "value": "Marcus"},
            {"type": "place", "value": "Luddy Hall 3025"},
            {"type": "date", "value": "next Friday"},
            {"type": "action_item", "value": "submit project proposal with literature review"},
            {"type": "object", "value": "transformer architectures"},
        ],
    },
    {
        "trigger": "manual_upload",
        "place_name": "Kitchen",
        "gps_lat": 39.1680,
        "gps_lng": -86.5100,
        "hours_ago": 26,
        "transcript": (
            "I just put my car keys on the shelf next to the coffee maker. "
            "Also need to remember I left the blue notebook on the dining table. "
            "The Bluetooth headphones are charging on my desk upstairs."
        ),
        "summary": (
            "Quick self-note about item locations at home: "
            "car keys on kitchen shelf near coffee maker, "
            "blue notebook on dining table, "
            "Bluetooth headphones charging on upstairs desk."
        ),
        "duration_sec": 30,
        "entities": [
            {"type": "object", "value": "car keys"},
            {"type": "place", "value": "shelf next to coffee maker"},
            {"type": "object", "value": "blue notebook"},
            {"type": "place", "value": "dining table"},
            {"type": "object", "value": "Bluetooth headphones"},
            {"type": "place", "value": "desk upstairs"},
        ],
    },
    {
        "trigger": "vad",
        "place_name": "Wells Library Study Room",
        "gps_lat": 39.1690,
        "gps_lng": -86.5190,
        "hours_ago": 48,
        "transcript": (
            "Dr. Ramirez mentioned during office hours that the midterm will cover "
            "chapters 5 through 9. He said to focus on the recurrence relations "
            "and dynamic programming sections. The exam is worth 30 percent of the grade. "
            "I should review the practice problems from last week."
        ),
        "summary": (
            "Office hours with Dr. Ramirez at Wells Library. "
            "Midterm covers chapters 5-9 focusing on recurrence relations and dynamic programming. "
            "Exam is 30% of grade. Need to review practice problems."
        ),
        "duration_sec": 900,
        "entities": [
            {"type": "person", "value": "Dr. Ramirez"},
            {"type": "place", "value": "Wells Library Study Room"},
            {"type": "object", "value": "midterm exam"},
            {"type": "object", "value": "dynamic programming"},
            {"type": "object", "value": "recurrence relations"},
            {"type": "action_item", "value": "review practice problems for midterm"},
        ],
    },
    {
        "trigger": "manual_upload",
        "place_name": "Target on East 3rd Street",
        "gps_lat": 39.1650,
        "gps_lng": -86.5050,
        "hours_ago": 72,
        "transcript": None,
        "summary": "Photo of shopping list on whiteboard: eggs, milk, bread, olive oil, chicken breast, rice, broccoli.",
        "duration_sec": None,
        "image_refs": {"paths": ["demo_shopping_list.jpg"]},
        "entities": [
            {"type": "object", "value": "shopping list"},
            {"type": "place", "value": "Target on East 3rd Street"},
            {"type": "action_item", "value": "buy eggs, milk, bread, olive oil, chicken breast, rice, broccoli"},
        ],
    },
    {
        "trigger": "vad",
        "place_name": "IMU Conference Room B",
        "gps_lat": 39.1680,
        "gps_lng": -86.5230,
        "hours_ago": 5,
        "transcript": (
            "The hackathon starts at 9 AM on Saturday at the Luddy Hall atrium. "
            "Registration is online, I already signed up with Alex. "
            "We decided to build a memory assistant app. "
            "Alex will bring his laptop with the GPU. "
            "I need to prepare the backend architecture diagram before Saturday."
        ),
        "summary": (
            "Planning session with Alex for Saturday hackathon at Luddy Hall atrium (9 AM). "
            "Building a memory assistant app. Alex brings GPU laptop. "
            "Need to prepare backend architecture diagram before Saturday."
        ),
        "duration_sec": 600,
        "entities": [
            {"type": "person", "value": "Alex"},
            {"type": "place", "value": "Luddy Hall atrium"},
            {"type": "date", "value": "Saturday 9 AM"},
            {"type": "object", "value": "hackathon"},
            {"type": "object", "value": "memory assistant app"},
            {"type": "action_item", "value": "prepare backend architecture diagram before Saturday"},
        ],
    },
    {
        "trigger": "vad",
        "place_name": "Von Lee parking lot",
        "gps_lat": 39.1695,
        "gps_lng": -86.5210,
        "hours_ago": 8,
        "transcript": (
            "Just ran into Emily from the ML club. She mentioned the guest speaker "
            "next Wednesday is from Google Research, talking about multimodal models. "
            "Emily said she can give me a ride to the airport next month for spring break. "
            "I told her I'd bring the poster for the research showcase on Thursday."
        ),
        "summary": (
            "Chance encounter with Emily at Von Lee parking lot. "
            "ML Club guest speaker from Google Research next Wednesday on multimodal models. "
            "Emily offered airport ride for spring break. "
            "Promised to bring poster for Thursday research showcase."
        ),
        "duration_sec": 180,
        "entities": [
            {"type": "person", "value": "Emily"},
            {"type": "place", "value": "Von Lee parking lot"},
            {"type": "object", "value": "Google Research speaker"},
            {"type": "date", "value": "next Wednesday"},
            {"type": "date", "value": "Thursday"},
            {"type": "action_item", "value": "bring poster for research showcase Thursday"},
            {"type": "action_item", "value": "confirm airport ride with Emily"},
        ],
    },
]


async def load_demo_data():
    """Load all demo captures into the database."""
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)

        for i, capture in enumerate(DEMO_CAPTURES):
            hours_ago = capture["hours_ago"]
            ts = now - timedelta(hours=hours_ago)

            session = CaptureSession(
                trigger=capture["trigger"],
                status="stored",
                place_name=capture["place_name"],
                gps_lat=capture["gps_lat"],
                gps_lng=capture["gps_lng"],
                started_at=ts,
                ended_at=ts + timedelta(seconds=capture.get("duration_sec") or 0),
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

            memory = Memory(
                session_id=session.id,
                transcript=capture.get("transcript"),
                summary=capture.get("summary"),
                duration_sec=capture.get("duration_sec"),
                capture_trigger=capture["trigger"],
                image_refs=capture.get("image_refs"),
                created_at=ts,
            )
            db.add(memory)
            await db.commit()
            await db.refresh(memory)

            entities_db = []
            for ent in capture.get("entities", []):
                entity = Entity(
                    memory_id=memory.id,
                    type=ent["type"],
                    value=ent["value"],
                )
                db.add(entity)
                entities_db.append(entity)
            await db.commit()
            for e in entities_db:
                await db.refresh(e)

            persons = [e for e in entities_db if e.type == "person"]
            non_persons = [e for e in entities_db if e.type != "person"]
            for person in persons:
                for other in non_persons:
                    rel_type = {
                        "place": "discussed_at",
                        "object": "mentioned_by",
                        "date": "mentioned_by",
                        "action_item": "assigned_to",
                    }.get(other.type, "mentioned_by")
                    rel = EntityRelationship(
                        source_entity_id=person.id,
                        target_entity_id=other.id,
                        relationship_type=rel_type,
                        memory_id=memory.id,
                    )
                    db.add(rel)
            await db.commit()

            logger.info(
                "Demo capture %d: %s at %s (%d entities)",
                i + 1, capture["trigger"], capture["place_name"],
                len(entities_db),
            )

        print(f"Loaded {len(DEMO_CAPTURES)} demo captures successfully.")


async def main():
    logging.basicConfig(level=logging.INFO)
    await load_demo_data()


if __name__ == "__main__":
    asyncio.run(main())
