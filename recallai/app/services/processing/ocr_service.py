import logging
import concurrent.futures
from pathlib import Path

logger = logging.getLogger(__name__)

_tesseract_available: bool | None = None
_OCR_TIMEOUT_SEC = 15  # max seconds per image


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


def _run_ocr(image_path: str) -> str:
    """Blocking OCR call — meant to be run in a thread with a timeout."""
    import pytesseract
    from PIL import Image

    image = Image.open(image_path)
    return pytesseract.image_to_string(image).strip()


def extract_text_from_image(image_path: str) -> str:
    """Extract text from an image using Tesseract OCR. Returns empty string on failure."""
    if not _check_tesseract():
        return ""

    path = Path(image_path)
    if not path.exists():
        logger.warning("Image file not found for OCR: %s", image_path)
        return ""

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_run_ocr, image_path)
            text = future.result(timeout=_OCR_TIMEOUT_SEC)
            return text
    except concurrent.futures.TimeoutError:
        logger.warning("OCR timed out after %ds for %s, skipping", _OCR_TIMEOUT_SEC, image_path)
        return ""
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
