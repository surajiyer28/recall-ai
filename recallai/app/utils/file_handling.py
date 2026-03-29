import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}

ALL_ALLOWED = ALLOWED_AUDIO_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS


def get_upload_dir(media_type: str) -> Path:
    settings = get_settings()
    base = Path(settings.upload_dir) / media_type
    base.mkdir(parents=True, exist_ok=True)
    return base


def validate_extension(filename: str, allowed: set[str]) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in allowed:
        raise ValueError(
            f"Unsupported file format '{ext}'. Accepted: {', '.join(sorted(allowed))}"
        )
    return ext


async def save_upload(file: UploadFile, media_type: str, session_id: str) -> str:
    allowed = {
        "audio": ALLOWED_AUDIO_EXTENSIONS,
        "video": ALLOWED_VIDEO_EXTENSIONS,
        "images": ALLOWED_IMAGE_EXTENSIONS,
    }[media_type]

    ext = validate_extension(file.filename or "unknown.bin", allowed)
    dest_dir = get_upload_dir(media_type)
    filename = f"{session_id}{ext}"
    filepath = dest_dir / filename

    content = await file.read()

    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(
            f"File exceeds maximum size of {settings.max_upload_size_mb}MB"
        )

    with open(filepath, "wb") as f:
        f.write(content)

    return str(filepath)


async def save_image_upload(
    file: UploadFile, session_id: str, index: int
) -> str:
    ext = validate_extension(file.filename or "unknown.bin", ALLOWED_IMAGE_EXTENSIONS)
    dest_dir = get_upload_dir("images")
    filename = f"{session_id}_{index}{ext}"
    filepath = dest_dir / filename

    content = await file.read()
    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(
            f"File exceeds maximum size of {settings.max_upload_size_mb}MB"
        )

    with open(filepath, "wb") as f:
        f.write(content)

    return str(filepath)


def delete_file(filepath: str) -> None:
    try:
        os.remove(filepath)
    except FileNotFoundError:
        pass
