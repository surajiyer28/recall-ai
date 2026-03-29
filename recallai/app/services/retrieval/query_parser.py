import json
import logging
from datetime import datetime, timedelta, timezone

from anthropic import Anthropic

from app.config import get_settings

logger = logging.getLogger(__name__)

QUERY_PARSER_SYSTEM = """You are a query parser for RecallAI, an AI memory system. Given a user's natural language query, extract structured information.

Return ONLY valid JSON with this schema:
{
  "intent": "recall" | "search" | "summarize" | "locate",
  "entities": ["list", "of", "key", "entities"],
  "time_ref": "original time reference or null",
  "time_range_hours": number or null (how many hours back to search, e.g. 24 for "today", 168 for "last week"),
  "modality_hint": "conversation" | "visual" | "any"
}

Guidelines:
- intent "recall": user wants to remember something specific
- intent "search": user wants to find information
- intent "summarize": user wants a summary of events/meetings
- intent "locate": user wants to find where something is
- entities: extract key nouns, names, topics (not common words)
- time_ref: preserve the original time phrase ("yesterday", "last Tuesday")
- time_range_hours: convert to approximate hours back from now
- modality_hint: "visual" if query implies images/locations ("where did I put"), "conversation" if about spoken words, "any" otherwise"""


class QueryParser:
    def __init__(self):
        settings = get_settings()
        self._client = None
        self._api_key = settings.anthropic_api_key

    @property
    def client(self) -> Anthropic:
        if self._client is None:
            if not self._api_key:
                raise RuntimeError("ANTHROPIC_API_KEY not set.")
            self._client = Anthropic(api_key=self._api_key)
        return self._client

    def parse(self, query: str) -> dict:
        """Parse a natural language query into structured search parameters."""
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=200,
                system=QUERY_PARSER_SYSTEM,
                messages=[{"role": "user", "content": query}],
            )
            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text)
        except Exception as e:
            logger.error("Query parsing failed: %s", e)
            return {
                "intent": "recall",
                "entities": [],
                "time_ref": None,
                "time_range_hours": None,
                "modality_hint": "any",
            }

    def resolve_time_range(self, parsed: dict) -> tuple[datetime | None, datetime | None]:
        """Convert parsed time_range_hours to absolute datetime range."""
        hours = parsed.get("time_range_hours")
        if hours is None:
            return None, None
        now = datetime.now(timezone.utc)
        start = now - timedelta(hours=hours)
        return start, now


_query_parser: QueryParser | None = None


def get_query_parser() -> QueryParser:
    global _query_parser
    if _query_parser is None:
        _query_parser = QueryParser()
    return _query_parser
