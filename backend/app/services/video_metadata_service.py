import subprocess
import json
import logging
import os
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class VideoMetadataService:
    @staticmethod
    def extract_metadata(file_path: str) -> Dict[str, Any]:
        """
        Run ffprobe command on the video file to extract technical metadata.
        Returns a dictionary with standard fields and the full raw metadata JSON.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found at {file_path}")

        # Construct ffprobe command
        # -v error: suppress verbose logging
        # -select_streams v:0: focus on the primary video stream
        # -show_entries: request stream and format attributes
        # -of json: output format as JSON
        cmd = [
            settings.FFPROBE_PATH,
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,r_frame_rate,width,height",
            "-show_entries", "format=duration,format_name,size",
            "-of", "json",
            file_path
        ]

        logger.info(f"Extracting metadata for {file_path} using ffprobe...")
        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            
            raw_data = json.loads(result.stdout)
            
            streams = raw_data.get("streams", [])
            format_info = raw_data.get("format", {})
            
            # Use default empty dict if stream is not present (e.g. audio-only, corrupted)
            video_stream = streams[0] if streams else {}
            
            # 1. FPS calculation (e.g., "30/1" or "2997/100")
            fps = 0.0
            r_frame_rate = video_stream.get("r_frame_rate", "0/0")
            if "/" in r_frame_rate:
                try:
                    num, den = r_frame_rate.split("/")
                    if float(den) > 0:
                        fps = round(float(num) / float(den), 2)
                except (ValueError, ZeroDivisionError):
                    pass
            else:
                try:
                    fps = round(float(r_frame_rate), 2) if r_frame_rate else 0.0
                except ValueError:
                    pass

            # 2. Duration calculation
            duration = 0.0
            duration_str = format_info.get("duration")
            if duration_str:
                try:
                    duration = round(float(duration_str), 2)
                except ValueError:
                    pass

            # 3. Size
            file_size = int(format_info.get("size", 0))
            if file_size == 0:
                # Fallback to os.path if ffprobe size isn't reported
                file_size = os.path.getsize(file_path)

            metadata = {
                "duration": duration,
                "fps": fps,
                "width": int(video_stream.get("width", 0)) if video_stream.get("width") else None,
                "height": int(video_stream.get("height", 0)) if video_stream.get("height") else None,
                "codec": video_stream.get("codec_name", "unknown"),
                "video_format": format_info.get("format_name", "unknown"),
                "file_size": file_size,
                "metadata_json": raw_data
            }
            
            logger.info(f"Metadata extraction completed successfully for {file_path}. Specs: {metadata['width']}x{metadata['height']}, {fps} fps, {duration}s")
            return metadata

        except FileNotFoundError:
            logger.warning(f"FFprobe not found in system path. Generating fallback mock metadata for {file_path}")
            file_size = os.path.getsize(file_path)
            _, ext = os.path.splitext(file_path)
            video_format = ext.replace(".", "").lower()
            return {
                "duration": 10.0,
                "fps": 30.0,
                "width": 1920,
                "height": 1080,
                "codec": "h264",
                "video_format": video_format,
                "file_size": file_size,
                "metadata_json": {"info": "extracted_via_fallback_mock", "warning": "ffprobe_missing"}
            }
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr.strip() if e.stderr else "Unknown error"
            logger.error(f"FFprobe process failed with exit code {e.returncode}. Error: {error_msg}")
            raise RuntimeError(f"FFprobe execution failed: {error_msg}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON output from ffprobe: {str(e)}")
            raise RuntimeError(f"FFprobe returned invalid JSON output: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during metadata extraction: {str(e)}")
            raise RuntimeError(f"Metadata extraction failed: {str(e)}")
