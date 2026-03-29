import json
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.task import Task

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """\
You are an assistant that extracts actionable tasks, commitments, and reminders from a memory transcript or description.

Today's date is {today}.

Analyze the following text and extract any items that:
- Are tasks the user needs to do (e.g., "I need to mail my tax documents")
- Are commitments or promises made (e.g., "Promised to help Rahul with homework")
- Are reminders or deadlines mentioned (e.g., "Meeting with doctor on Friday")
- Are things that require follow-up action

For each item, provide:
- "title": A short, clear description of the task (max 100 chars)
- "description": Additional context if available, or null
- "deadline": An ISO 8601 datetime string if a deadline/date is mentioned or can be inferred, or null. Interpret relative dates like "this Friday", "next week", "tomorrow" relative to today's date ({today}).

Return a JSON array of objects. If there are no actionable items, return an empty array [].

IMPORTANT: Only return the JSON array, no other text.

Text to analyze:
{text}
"""


class TaskExtractor:
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
        """Extract tasks from text using Gemini Flash. Returns list of task dicts."""
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
            tasks = json.loads(raw)
            if not isinstance(tasks, list):
                return []
            return tasks
        except Exception as e:
            logger.error("Task extraction failed: %s", e)
            return []


_task_extractor: TaskExtractor | None = None


def get_task_extractor() -> TaskExtractor:
    global _task_extractor
    if _task_extractor is None:
        _task_extractor = TaskExtractor()
    return _task_extractor


async def extract_and_store_tasks(
    db: AsyncSession, memory_id: str, text: str
) -> list[Task]:
    """Extract tasks from text and store them in the database."""
    extractor = get_task_extractor()
    raw_tasks = extractor.extract(text)

    stored = []
    for item in raw_tasks:
        title = item.get("title", "").strip()
        if not title:
            continue

        deadline = None
        raw_deadline = item.get("deadline")
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
            description=item.get("description"),
            deadline=deadline,
            status="pending",
        )
        db.add(task)
        stored.append(task)

    if stored:
        await db.commit()
        logger.info("Extracted %d tasks from memory %s", len(stored), memory_id)

    return stored
