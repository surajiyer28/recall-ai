import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.person import Person, PersonHighlight
from app.models.task import Task

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """\
You are an assistant that extracts person names and important highlights from a memory transcript or description.

Today's date is {today}.

Analyze the following text and:
1. Identify all person names mentioned (first names, full names, nicknames — treat each exact spelling as a separate person).
2. For each person, extract only important or actionable highlights — skip small talk like "said hi" or "greeted me".
   Include things said BY them ("Rahul said he'll send the report") and ABOUT them ("need to send Rahul the papers for review").
3. For each person, also identify any tasks/action items associated with them.
4. If there are general tasks NOT associated with any specific person, include a special entry with name set to null.

For each task, provide:
- "title": A short, clear description of the task (max 100 chars)
- "description": Additional context if available, or null
- "deadline": An ISO 8601 datetime string if a deadline/date is mentioned or can be inferred, or null. Interpret relative dates like "this Friday", "next week", "tomorrow" relative to today's date ({today}).

Return a JSON array of objects like:
[
  {{
    "name": "Rahul",
    "highlights": [
      "Needs the financial papers for review",
      "Is moving to Bangalore next month"
    ],
    "tasks": [
      {{
        "title": "Send papers to Rahul for review",
        "description": "Financial papers he requested",
        "deadline": "2026-04-03T00:00:00Z"
      }}
    ]
  }},
  {{
    "name": null,
    "highlights": [],
    "tasks": [
      {{
        "title": "Buy groceries",
        "description": null,
        "deadline": null
      }}
    ]
  }}
]

If there are no people mentioned and no tasks, return an empty array [].

IMPORTANT: Only return the JSON array, no other text.

Text to analyze:
{text}
"""


class PersonExtractor:
    def __init__(self):
        self._model = None
        settings = get_settings()
        self._project = settings.google_cloud_project
        self._location = settings.google_cloud_location

    @property
    def model(self):
        if self._model is None:
            if not self._project:
                raise RuntimeError(
                    "GOOGLE_CLOUD_PROJECT not set. Cannot use Gemini."
                )
            from google.cloud import aiplatform
            aiplatform.init(project=self._project, location=self._location)

            from vertexai.generative_models import GenerativeModel
            self._model = GenerativeModel("gemini-2.5-flash")
        return self._model

    def extract(self, text: str) -> list[dict]:
        """Extract people, highlights, and tasks from text using Gemini Flash."""
        if not text or not text.strip():
            return []

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d (%A)")
        prompt = EXTRACTION_PROMPT.format(today=today, text=text)

        try:
            response = self.model.generate_content(prompt)
            raw = response.text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()
            result = json.loads(raw)
            if not isinstance(result, list):
                return []
            return result
        except Exception as e:
            logger.error("Person extraction failed: %s", e)
            return []


_person_extractor: PersonExtractor | None = None


def get_person_extractor() -> PersonExtractor:
    global _person_extractor
    if _person_extractor is None:
        _person_extractor = PersonExtractor()
    return _person_extractor


async def extract_and_store_people(
    db: AsyncSession, memory_id: str, text: str
) -> None:
    """Extract people, highlights, and tasks from text and store them."""
    extractor = get_person_extractor()
    raw_people = extractor.extract(text)

    stored_tasks = 0
    stored_highlights = 0

    for item in raw_people:
        person_name = item.get("name")
        person_id = None

        # If there's a person name, find or create the person
        if person_name and isinstance(person_name, str):
            person_name = person_name.strip()
            if not person_name:
                person_id = None
            else:
                result = await db.execute(
                    select(Person).where(Person.name == person_name).limit(1)
                )
                person = result.scalar_one_or_none()
                if person is None:
                    person = Person(name=person_name[:200])
                    db.add(person)
                    await db.flush()
                person_id = person.id

                # Store highlights
                highlights = item.get("highlights", [])
                for hl in highlights:
                    if isinstance(hl, str) and hl.strip():
                        db.add(PersonHighlight(
                            person_id=person_id,
                            memory_id=memory_id,
                            highlight=hl.strip(),
                        ))
                        stored_highlights += 1

        # Store tasks (with or without person association)
        tasks = item.get("tasks", [])
        for t in tasks:
            title = t.get("title", "").strip() if isinstance(t.get("title"), str) else ""
            if not title:
                continue

            deadline = None
            raw_deadline = t.get("deadline")
            if raw_deadline:
                try:
                    deadline = datetime.fromisoformat(raw_deadline)
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    pass

            task = Task(
                memory_id=memory_id,
                title=title[:500],
                description=t.get("description"),
                deadline=deadline,
                status="pending",
                person_id=person_id,
            )
            db.add(task)
            stored_tasks += 1

    if stored_tasks or stored_highlights:
        await db.commit()
        logger.info(
            "Extracted %d highlights, %d tasks from memory %s",
            stored_highlights, stored_tasks, memory_id,
        )
