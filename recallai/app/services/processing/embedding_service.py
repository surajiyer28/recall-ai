import logging
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1408
MAX_BATCH_SIZE = 10


class EmbeddingService:
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
                    "GOOGLE_CLOUD_PROJECT not set. Cannot use MME2 embeddings."
                )
            from google.cloud import aiplatform
            aiplatform.init(project=self._project, location=self._location)

            from vertexai.vision_models import MultiModalEmbeddingModel
            self._model = MultiModalEmbeddingModel.from_pretrained(
                "multimodalembedding@001"
            )
        return self._model

    def embed_text(self, text: str) -> list[float]:
        """Embed text into 1408-d vector using Google MME2."""
        if not text or not text.strip():
            return [0.0] * EMBEDDING_DIM

        response = self.model.get_embeddings(
            contextual_text=text, dimension=EMBEDDING_DIM
        )
        return list(response.text_embedding)

    def embed_image(self, image_path: str) -> list[float]:
        """Embed image into 1408-d vector using Google MME2."""
        from vertexai.vision_models import Image as VertexImage

        path = Path(image_path)
        if not path.exists():
            logger.warning("Image not found for embedding: %s", image_path)
            return [0.0] * EMBEDDING_DIM

        image = VertexImage.load_from_file(image_path)
        response = self.model.get_embeddings(image=image, dimension=EMBEDDING_DIM)
        return list(response.image_embedding)

    def embed_texts_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts. Batches into groups of MAX_BATCH_SIZE."""
        all_embeddings = []
        for i in range(0, len(texts), MAX_BATCH_SIZE):
            batch = texts[i : i + MAX_BATCH_SIZE]
            for text in batch:
                emb = self.embed_text(text)
                all_embeddings.append(emb)
        return all_embeddings

    def embed_images_batch(self, image_paths: list[str]) -> list[list[float]]:
        """Embed multiple images. Batches into groups of MAX_BATCH_SIZE."""
        all_embeddings = []
        for i in range(0, len(image_paths), MAX_BATCH_SIZE):
            batch = image_paths[i : i + MAX_BATCH_SIZE]
            for path in batch:
                emb = self.embed_image(path)
                all_embeddings.append(emb)
        return all_embeddings


_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
