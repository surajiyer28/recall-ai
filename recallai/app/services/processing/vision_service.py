import logging
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)

IMAGE_CAPTION_PROMPT = (
    "Describe this image in detail. Include all visible objects, their positions "
    "relative to each other, any text visible, colors, and the setting/environment. "
    "Be specific about what objects are present and where they are located. "
    "This description will be used for later recall, so include details that would "
    "help answer questions like 'where did I put my keys?' or 'what was on my desk?'."
)

VIDEO_CAPTION_PROMPT = (
    "Describe everything happening in this video in detail. Include all visible "
    "objects, people, actions, speech/dialogue you hear, sounds, any text visible "
    "on screen, and the setting/environment. Be specific about what objects are "
    "present and where they are located. Note any changes that occur over time. "
    "This description will be used for later recall, so include details that would "
    "help answer questions about what happened, what was said, and where things were."
)


class VisionService:
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
                    "GOOGLE_CLOUD_PROJECT not set. Cannot use Gemini vision."
                )
            from google.cloud import aiplatform
            aiplatform.init(project=self._project, location=self._location)

            from vertexai.generative_models import GenerativeModel
            self._model = GenerativeModel("gemini-2.5-flash")
        return self._model

    def caption_image(self, image_path: str) -> str:
        """Generate a detailed caption for an image using Gemini Flash."""
        from vertexai.generative_models import Image as GeminiImage

        path = Path(image_path)
        if not path.exists():
            logger.warning("Image not found for captioning: %s", image_path)
            return ""

        try:
            image = GeminiImage.load_from_file(image_path)
            response = self.model.generate_content([IMAGE_CAPTION_PROMPT, image])
            return response.text.strip()
        except Exception as e:
            logger.error("Image captioning failed for %s: %s", image_path, e)
            return ""

    def caption_video(self, video_path: str) -> str:
        """Generate a detailed caption for a video (with audio) using Gemini Flash."""
        from vertexai.generative_models import Part

        path = Path(video_path)
        if not path.exists():
            logger.warning("Video not found for captioning: %s", video_path)
            return ""

        try:
            # Determine MIME type from extension
            ext = path.suffix.lower()
            mime_map = {
                ".webm": "video/webm",
                ".mp4": "video/mp4",
                ".avi": "video/x-msvideo",
                ".mov": "video/quicktime",
                ".mkv": "video/x-matroska",
            }
            mime_type = mime_map.get(ext, "video/webm")

            video_part = Part.from_data(path.read_bytes(), mime_type=mime_type)
            response = self.model.generate_content([VIDEO_CAPTION_PROMPT, video_part])
            return response.text.strip()
        except Exception as e:
            logger.error("Video captioning failed for %s: %s", video_path, e)
            return ""

    def caption_images_batch(self, image_paths: list[str]) -> list[str]:
        """Caption multiple images. Returns list of captions."""
        return [self.caption_image(p) for p in image_paths]


_vision_service: VisionService | None = None


def get_vision_service() -> VisionService:
    global _vision_service
    if _vision_service is None:
        _vision_service = VisionService()
    return _vision_service
