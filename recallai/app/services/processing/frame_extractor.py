import logging
import subprocess
import json
from pathlib import Path

logger = logging.getLogger(__name__)

FRAME_INTERVAL_SEC = 30
VIDEO_CHUNK_SEC = 60


def get_video_duration(video_path: str) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                video_path,
            ],
            capture_output=True, text=True, check=True, timeout=120,
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
            capture_output=True, text=True, check=False, timeout=120,
        )
        if Path(out_path).exists() and Path(out_path).stat().st_size > 100:
            return out_path
        logger.warning("Audio extraction produced no output for %s", video_path)
        return None
    except Exception as e:
        logger.error("Failed to extract audio track: %s", e)
        return None


def extract_frames(video_path: str, output_dir: str) -> list[str]:
    """Extract frames from video. For short clips (<=60s), extracts one frame
    at the middle. For longer videos, extracts at FRAME_INTERVAL_SEC intervals."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    duration = get_video_duration(video_path)

    frame_pattern = str(Path(output_dir) / "frame_%04d.jpg")

    if duration <= 0:
        # Duration unknown (common with WebM) — try extracting a single frame
        logger.info("Duration unknown for %s, extracting single frame", video_path)
        single_frame = str(Path(output_dir) / "frame_0001.jpg")
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", video_path,
                    "-frames:v", "1", "-q:v", "2",
                    single_frame,
                ],
                capture_output=True, text=True, check=False, timeout=120,
            )
        except Exception as e:
            logger.error("Single frame extraction failed: %s", e)
    elif duration <= 60:
        # Short clip — extract one frame from the middle
        midpoint = duration / 2
        single_frame = str(Path(output_dir) / "frame_0001.jpg")
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y", "-ss", str(midpoint),
                    "-i", video_path,
                    "-frames:v", "1", "-q:v", "2",
                    single_frame,
                ],
                capture_output=True, text=True, check=False, timeout=120,
            )
        except Exception as e:
            logger.error("Frame extraction failed for short clip: %s", e)
    else:
        # Longer video — extract at intervals
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", video_path,
                    "-vf", f"fps=1/{FRAME_INTERVAL_SEC}",
                    "-q:v", "2",
                    frame_pattern,
                ],
                capture_output=True, text=True, check=False, timeout=120,
            )
        except Exception as e:
            logger.error("Frame extraction failed: %s", e)

    frames = sorted(Path(output_dir).glob("frame_*.jpg"))
    return [str(f) for f in frames]


def split_video_chunks(video_path: str, output_dir: str) -> list[str]:
    """Split video into chunks of VIDEO_CHUNK_SEC for direct video embedding.
    If the video is <= VIDEO_CHUNK_SEC, returns the original path as-is."""
    duration = get_video_duration(video_path)

    if duration <= 0 or duration <= VIDEO_CHUNK_SEC:
        # Short or unknown duration — use the whole file directly
        return [video_path]

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    chunk_paths = []
    chunk_index = 0
    offset = 0.0

    while offset < duration:
        chunk_path = str(Path(output_dir) / f"chunk_{chunk_index:04d}.webm")
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-ss", str(offset),
                    "-i", video_path,
                    "-t", str(VIDEO_CHUNK_SEC),
                    "-c", "copy",
                    chunk_path,
                ],
                capture_output=True, text=True, check=False, timeout=120,
            )
            if Path(chunk_path).exists() and Path(chunk_path).stat().st_size > 100:
                chunk_paths.append(chunk_path)
        except Exception as e:
            logger.error("Failed to split chunk %d: %s", chunk_index, e)
        offset += VIDEO_CHUNK_SEC
        chunk_index += 1

    return chunk_paths if chunk_paths else [video_path]


def cleanup_extracted_files(file_paths: list[str]) -> None:
    for path in file_paths:
        try:
            Path(path).unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Failed to cleanup %s: %s", path, e)
