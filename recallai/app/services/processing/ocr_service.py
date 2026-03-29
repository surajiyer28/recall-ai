import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_tesseract_available: bool | None = None


def _check_tesseract() -> bool:
    global _tesseract_available
    if _tesseract_available is not None:
        return _tesseract_available
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        _tesseract_available = True
    except Exception:
        logger.warning(
            "Tesseract not available. OCR will be skipped. "
            "Install tesseract-ocr to enable OCR."
        )
        _tesseract_available = False
    return _tesseract_available


def extract_text_from_image(image_path: str) -> str:
    """Extract text from an image using Tesseract OCR. Returns empty string on failure."""
    if not _check_tesseract():
        return ""

    path = Path(image_path)
    if not path.exists():
        logger.warning("Image file not found for OCR: %s", image_path)
        return ""

    try:
        import pytesseract
        from PIL import Image

        image = Image.open(image_path)
        text = pytesseract.image_to_string(image).strip()
        return text
    except Exception as e:
        logger.error("OCR failed for %s: %s", image_path, e)
        return ""


def extract_text_from_images(image_paths: list[str]) -> dict[str, str]:
    """Run OCR on multiple images. Returns {path: extracted_text}."""
    results = {}
    for path in image_paths:
        text = extract_text_from_image(path)
        if text:
            results[path] = text
    return results
