import logging
from pathlib import Path

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


class WhisperService:
    def __init__(self):
        settings = get_settings()
        self._client = None
        self._api_key = settings.openai_api_key

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            if not self._api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY not set. Cannot use Whisper STT."
                )
            self._client = OpenAI(api_key=self._api_key)
        return self._client

    async def transcribe(self, audio_path: str) -> dict:
        """
        Transcribe audio file via OpenAI Whisper API.
        Returns {transcript, segments, duration_sec, language}.
        """
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        file_size = path.stat().st_size
        if file_size < 100:
            logger.warning("Audio file too small (%d bytes), likely empty", file_size)
            return {
                "transcript": "",
                "segments": [],
                "duration_sec": 0,
                "language": "en",
            }

        try:
            with open(audio_path, "rb") as f:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                )

            segments = []
            if hasattr(response, "segments") and response.segments:
                segments = [
                    {
                        "start": s.start if hasattr(s, "start") else s.get("start", 0),
                        "end": s.end if hasattr(s, "end") else s.get("end", 0),
                        "text": s.text if hasattr(s, "text") else s.get("text", ""),
                    }
                    for s in response.segments
                ]

            return {
                "transcript": response.text,
                "segments": segments,
                "duration_sec": int(response.duration) if hasattr(response, "duration") and response.duration else 0,
                "language": response.language if hasattr(response, "language") else "en",
            }

        except Exception as e:
            logger.error("Whisper API failed: %s", e)
            raise


_whisper_service: WhisperService | None = None


def get_whisper_service() -> WhisperService:
    global _whisper_service
    if _whisper_service is None:
        _whisper_service = WhisperService()
    return _whisper_service
