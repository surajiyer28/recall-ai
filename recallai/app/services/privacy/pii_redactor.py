import re
import logging

logger = logging.getLogger(__name__)

PII_PATTERNS = {
    "credit_card": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "phone_us": re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
}

REDACTION_PLACEHOLDER = "[REDACTED]"


def redact_pii(text: str, patterns: list[str] | None = None) -> str:
    """
    Redact PII from text using regex patterns.
    If patterns is None, all patterns are applied.
    Returns the redacted text.
    """
    if not text:
        return text

    active_patterns = PII_PATTERNS
    if patterns:
        active_patterns = {k: v for k, v in PII_PATTERNS.items() if k in patterns}

    redacted = text
    for name, pattern in active_patterns.items():
        matches = pattern.findall(redacted)
        if matches:
            logger.info("Redacted %d %s pattern(s)", len(matches), name)
        redacted = pattern.sub(REDACTION_PLACEHOLDER, redacted)

    return redacted


def has_pii(text: str) -> dict[str, int]:
    """Check if text contains PII. Returns dict of {pattern_name: count}."""
    if not text:
        return {}

    found = {}
    for name, pattern in PII_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            found[name] = len(matches)
    return found
