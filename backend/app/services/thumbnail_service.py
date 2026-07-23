import os
import subprocess
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class ThumbnailService:
    @staticmethod
    def generate_thumbnail(video_path: str, relative_path: str) -> str:
        """
        Generate a single JPEG thumbnail from the first frame of the video using ffmpeg.
        Saves the thumbnail to storage/thumbnails/relative_path and returns the absolute path.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found for thumbnail generation: {video_path}")

        # Form full absolute path for thumbnail
        base_dir = os.path.join(settings.STORAGE_DIR, "thumbnails")
        full_path = os.path.join(base_dir, relative_path)
        
        # Ensure directories exist
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Construct ffmpeg command to extract first frame
        # -y: overwrite output files without asking
        # -ss 0.0: seek to the beginning
        # -i video_path: input file
        # -vframes 1: output 1 frame
        # -q:v 2: quality factor (lower is better, 2 is high quality)
        cmd = [
            settings.FFMAK_PATH if hasattr(settings, "FFMAK_PATH") else settings.FFMPEG_PATH,  # fall back to standard FFMPEG_PATH
            "-y",
            "-ss", "0.0",
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            full_path
        ]

        logger.info(f"Extracting thumbnail from {video_path} to {full_path} using ffmpeg...")
        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            logger.info(f"Thumbnail successfully generated at {full_path}")
            return full_path
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.strip() if e.stderr else "Unknown error"
            logger.error(f"FFmpeg process failed with exit code {e.returncode}. Error: {error_msg}")
            raise RuntimeError(f"FFmpeg execution failed: {error_msg}")
        except Exception as e:
            logger.error(f"Unexpected error during thumbnail generation: {str(e)}")
            raise RuntimeError(f"Thumbnail generation failed: {str(e)}")
