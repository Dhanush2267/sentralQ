import os
import subprocess
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class FrameExtractor:
    @staticmethod
    def extract_frames(video_path: str, output_dir: str, interval: float = 1.0) -> int:
        """
        Extract frames from the video file at a given interval (in seconds).
        Saves them as 000001.jpg, 000002.jpg, etc. under output_dir.
        Returns the number of frames extracted.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at {video_path}")

        # Ensure directories exist
        os.makedirs(output_dir, exist_ok=True)

        # Clear any existing frames in output directory to avoid contamination
        for file in os.listdir(output_dir):
            if file.endswith(".jpg"):
                try:
                    os.remove(os.path.join(output_dir, file))
                except Exception as e:
                    logger.warning(f"Failed to clear old frame file {file}: {e}")

        # ffmpeg command:
        # -y: overwrite output files without asking
        # -i video_path: input file path
        # -vf "fps=1/interval": extract 1 frame every <interval> seconds
        # -q:v 2: high quality JPEG (lower is better, 2 is high quality)
        # -loglevel error: suppress info logging from FFmpeg
        cmd = [
            settings.FFMPEG_PATH,
            "-y",
            "-i", video_path,
            "-vf", f"fps=1/{interval}",
            "-q:v", "2",
            "-loglevel", "error",
            os.path.join(output_dir, "%06d.jpg")
        ]

        logger.info(f"Extracting frames from {video_path} to {output_dir} with command: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        if result.returncode != 0:
            err_msg = result.stderr.strip() if result.stderr else "Unknown error"
            logger.error(f"FFmpeg frame extraction process failed with exit code {result.returncode}. Error: {err_msg}")
            raise RuntimeError(f"FFmpeg frame extraction failed: {err_msg}")

        # Count extracted frames
        frame_files = [f for f in os.listdir(output_dir) if f.endswith(".jpg")]
        frame_files.sort()
        
        logger.info(f"Successfully extracted {len(frame_files)} frames to {output_dir}")
        return len(frame_files)
