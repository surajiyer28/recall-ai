import logging

from anthropic import Anthropic

from app.config import get_settings

logger = logging.getLogger(__name__)

ANSWER_SYSTEM_PROMPT = """You are RecallAI, an AI memory prosthetic for people with ADHD. You help users recall past events, conversations, and information from their captured memories.

When answering:
1. Cite specific timestamps and locations when available
2. Distinguish between what the user said vs what others said (if speaker info available)
3. Include a confidence indicator based on the provided confidence level
4. Offer 2-3 relevant follow-up suggestions (as brief questions the user might ask next)
5. When confidence is low, explicitly say so — never make up information
6. If no relevant memories found, say: "I don't have a memory of that. It may have happened outside a capture window, or before you started using RecallAI."

Be conversational, warm, and concise. You are a helpful memory aid, not a formal assistant."""


class AnswerGenerator:
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

    def generate(
        self,
        query: str,
        memories: list[dict],
        confidence: str,
        conversation_history: list[dict] | None = None,
    ) -> dict:
        """
        Generate an answer from retrieved memories.
        Returns {answer, confidence, follow_ups, source_memory_ids}.
        """
        if not memories:
            return {
                "answer": "I don't have a memory of that. It may have happened outside a capture window, or before you started using RecallAI.",
                "confidence": "none",
                "follow_ups": [],
                "source_memory_ids": [],
            }

        memory_context = self._format_memories(memories)

        messages = []
        if conversation_history:
            messages.extend(conversation_history)

        user_content = f"""User query: {query}

Confidence level: {confidence}

Retrieved memories:
{memory_context}

Generate a helpful answer based on these memories. End with 2-3 follow-up suggestion questions."""

        messages.append({"role": "user", "content": user_content})

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=600,
                system=ANSWER_SYSTEM_PROMPT,
                messages=messages,
            )
            answer_text = response.content[0].text.strip()

            follow_ups = []
            if "?" in answer_text:
                lines = answer_text.split("\n")
                for line in reversed(lines):
                    line = line.strip().lstrip("- •*123.")
                    if "?" in line and len(line) < 100:
                        follow_ups.insert(0, line.strip())
                    if len(follow_ups) >= 3:
                        break

            return {
                "answer": answer_text,
                "confidence": confidence,
                "follow_ups": follow_ups,
                "source_memory_ids": [m.get("id", "") for m in memories],
            }

        except Exception as e:
            logger.error("Answer generation failed: %s", e)
            snippets = []
            for m in memories[:3]:
                snippet = m.get("summary") or (m.get("transcript", "")[:200])
                if snippet:
                    ts = m.get("created_at", "")
                    place = m.get("place_name", "")
                    snippets.append(f"[{ts} at {place}]: {snippet}")

            return {
                "answer": "I found some relevant memories but had trouble generating a response. Here are the raw matches:\n\n" + "\n\n".join(snippets),
                "confidence": confidence,
                "follow_ups": [],
                "source_memory_ids": [m.get("id", "") for m in memories],
            }

    def _format_memories(self, memories: list[dict]) -> str:
        parts = []
        for i, m in enumerate(memories, 1):
            lines = [f"Memory {i}:"]
            if m.get("created_at"):
                lines.append(f"  Time: {m['created_at']}")
            if m.get("place_name"):
                lines.append(f"  Location: {m['place_name']}")
            if m.get("summary"):
                lines.append(f"  Summary: {m['summary']}")
            if m.get("transcript"):
                transcript = m["transcript"][:500]
                lines.append(f"  Transcript: {transcript}")
            if m.get("entities"):
                ent_strs = [f"{e['type']}:{e['value']}" for e in m["entities"][:8]]
                lines.append(f"  Entities: {', '.join(ent_strs)}")
            if m.get("image_refs"):
                lines.append(f"  Has images: yes")
            parts.append("\n".join(lines))
        return "\n\n".join(parts)


_answer_generator: AnswerGenerator | None = None


def get_answer_generator() -> AnswerGenerator:
    global _answer_generator
    if _answer_generator is None:
        _answer_generator = AnswerGenerator()
    return _answer_generator
