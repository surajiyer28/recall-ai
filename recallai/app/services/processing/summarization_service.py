import logging

from anthropic import Anthropic

from app.config import get_settings

logger = logging.getLogger(__name__)

SUMMARIZATION_SYSTEM_PROMPT = """You are a memory summarization engine for RecallAI, an AI memory prosthetic for ADHD.

Given a transcript and contextual metadata, generate a concise 3-4 sentence summary that prioritizes:
1. Actionable information (deadlines, commitments, tasks)
2. Key decisions made
3. Important names, places, and dates mentioned
4. The core topic or purpose of the conversation/capture

Be factual and specific. Include exact dates, names, and numbers when available. Do not add information not present in the transcript."""


class SummarizationService:
    def __init__(self):
        settings = get_settings()
        self._client = None
        self._api_key = settings.anthropic_api_key

    @property
    def client(self) -> Anthropic:
        if self._client is None:
            if not self._api_key:
                raise RuntimeError(
                    "ANTHROPIC_API_KEY not set. Cannot use Claude for summarization."
                )
            self._client = Anthropic(api_key=self._api_key)
        return self._client

    def summarize(
        self,
        transcript: str,
        entities: list[dict] | None = None,
        place_name: str | None = None,
        duration_sec: int | None = None,
    ) -> str:
        """Generate a 3-4 sentence summary of a memory using Claude."""
        if not transcript or not transcript.strip():
            return ""

        context_parts = []
        if place_name:
            context_parts.append(f"Location: {place_name}")
        if duration_sec:
            mins = duration_sec // 60
            context_parts.append(f"Duration: {mins} minutes")
        if entities:
            entity_strs = [f"{e['type']}: {e['value']}" for e in entities[:10]]
            context_parts.append(f"Entities: {', '.join(entity_strs)}")

        context_block = "\n".join(context_parts) if context_parts else "No additional context."

        user_message = f"""Transcript:
{transcript[:4000]}

Context:
{context_block}

Generate a 3-4 sentence summary."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                system=SUMMARIZATION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error("Claude summarization failed: %s", e)
            return ""


_summarization_service: SummarizationService | None = None


def get_summarization_service() -> SummarizationService:
    global _summarization_service
    if _summarization_service is None:
        _summarization_service = SummarizationService()
    return _summarization_service
