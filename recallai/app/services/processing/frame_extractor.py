import logging
import subprocess
import json
from pathlib import Path

logger = logging.getLogger(__name__)

FRAME_INTERVAL_SEC = 30


def get_video_duration(video_path: str) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                video_path,
            ],
            capture_output=True, text=True, check=True,
        )
        info = json.loads(result.stdout)
        return float(info["format"]["duration"])
    except Exception as e:
        logger.error("Failed to get video duration: %s", e)
        return 0.0


def extract_audio_track(video_path: str, output_dir: str) -> str | None:
    """Extract audio track from video as WAV file."""
    out_path = str(Path(output_dir) / "extracted_audio.wav")
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", video_path,
                "-vn", "-acodec", "pcm_s16le",
                "-ar", "16000", "-ac", "1",
                out_path,
            ],
            capture_output=True, text=True, check=True,
        )
        if Path(out_path).exists() and Path(out_path).stat().st_size > 100:
            return out_path
        return None
    except Exception as e:
        logger.error("Failed to extract audio track: %s", e)
        return None


def extract_frames(video_path: str, output_dir: str) -> list[str]:
    """Extract frames at 1 per FRAME_INTERVAL_SEC seconds. Returns list of frame paths."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    duration = get_video_duration(video_path)
    if duration <= 0:
        logger.warning("Video duration is 0, skipping frame extraction")
        return []

    frame_pattern = str(Path(output_dir) / "frame_%04d.jpg")
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", video_path,
                "-vf", f"fps=1/{FRAME_INTERVAL_SEC}",
                "-q:v", "2",
                frame_pattern,
            ],
            capture_output=True, text=True, check=True,
        )
    except Exception as e:
        logger.error("Frame extraction failed: %s", e)
        return []

    frames = sorted(Path(output_dir).glob("frame_*.jpg"))
    return [str(f) for f in frames]


def cleanup_extracted_files(file_paths: list[str]) -> None:
    for path in file_paths:
        try:
            Path(path).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Failed to cleanup %s: %s", path, e)
