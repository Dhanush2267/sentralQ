import os
import cv2
import uuid
import subprocess
import logging
from typing import List
from sqlalchemy.orm import Session
from app.core.config import settings
from app.repositories.video_repository import VideoRepository
from app.models.detection_result import DetectionResult
from app.models.track import Track
from app.models.zone import Zone
from app.models.behavior_event import BehaviorEvent
from app.detection.overlay import get_class_color

logger = logging.getLogger(__name__)

class VideoAnnotationService:
    @staticmethod
    def get_annotated_video_path(video_id: uuid.UUID) -> str:
        """Get path where the final web-playable annotated video is saved."""
        return os.path.join(settings.STORAGE_DIR, "videos", f"{video_id}_annotated.mp4")

    @staticmethod
    def compile_annotated_video(db: Session, video_id: uuid.UUID) -> str:
        """
        Draws bounding boxes, track IDs, zone overlays, trajectory lines,
        and active behavior event alerts directly onto extracted frames,
        compiles them into a video using OpenCV, and transcodes to H264 via FFmpeg.
        """
        video = VideoRepository.get(db, video_id)
        if not video:
            raise RuntimeError(f"Video asset {video_id} not found.")

        final_path = VideoAnnotationService.get_annotated_video_path(video_id)
        
        # Return cached copy if already generated
        if os.path.exists(final_path):
            logger.info(f"Returning cached annotated video for ID: {video_id}")
            return final_path

        frames_dir = os.path.join(settings.STORAGE_DIR, "frames", str(video_id))
        if not os.path.exists(frames_dir) or not os.listdir(frames_dir):
            raise RuntimeError("Extracted frames directory is empty or missing. Process the video first.")

        # Gather frames and sort numerically
        frame_files = []
        for f in os.listdir(frames_dir):
            if f.endswith(".jpg"):
                try:
                    frame_num = int(f.split(".")[0])
                    frame_files.append((frame_num, f))
                except ValueError:
                    continue
        
        frame_files.sort()
        if not frame_files:
            raise RuntimeError("No valid JPEG frame files found for compilation.")

        # Load database entities
        detections = db.query(DetectionResult).filter(DetectionResult.video_id == video_id).all()
        tracks = db.query(Track).filter(Track.video_id == video_id).all()
        zones = db.query(Zone).filter(Zone.video_id == video_id).all()
        events = db.query(BehaviorEvent).filter(BehaviorEvent.video_id == video_id).all()

        # Group detections/tracks for easy lookups
        detections_by_frame = {}
        for d in detections:
            detections_by_frame.setdefault(d.frame_number, []).append(d)

        tracks_by_id = {t.track_id: t for t in tracks}

        # Initialize raw compilation paths
        temp_raw_video = os.path.join(settings.STORAGE_DIR, "videos", f"{video_id}_temp_raw.mp4")
        os.makedirs(os.path.dirname(temp_raw_video), exist_ok=True)

        # Read first frame to establish width, height, and FPS
        sample_img_path = os.path.join(frames_dir, frame_files[0][1])
        sample_img = cv2.imread(sample_img_path)
        if sample_img is None:
            raise RuntimeError(f"Failed to read sample frame at: {sample_img_path}")
        
        height, width, _ = sample_img.shape
        
        # Configure video writer (using mp4v for high compatibility with standard OpenCV compiles)
        fps = video.fps if video.fps and video.fps > 0 else 24.0
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(temp_raw_video, fourcc, fps, (width, height))

        try:
            logger.info(f"Starting frame-by-frame rendering for video {video_id} ({len(frame_files)} frames)...")
            
            for frame_num, filename in frame_files:
                img_path = os.path.join(frames_dir, filename)
                frame_img = cv2.imread(img_path)
                if frame_img is None:
                    continue

                # 1. Draw Zones (semi-transparent filled polygons)
                overlay = frame_img.copy()
                for zone in zones:
                    poly_points = zone.polygon_points
                    if len(poly_points) >= 3:
                        # Convert points to cv2 shape format
                        pts = [[int(pt[0]), int(pt[1])] for pt in poly_points]
                        import numpy as np
                        pts_arr = np.array(pts, dtype=np.int32)
                        
                        # Parse color hex to BGR
                        color_hex = zone.color.lstrip("#")
                        try:
                            r, g, b = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
                        except Exception:
                            r, g, b = 59, 130, 246  # default blue
                        
                        # Draw filled polygon
                        cv2.fillPoly(overlay, [pts_arr], (b, g, r))
                        # Draw outline
                        cv2.polylines(frame_img, [pts_arr], True, (b, g, r), 2)
                        # Add zone name text label
                        text_pos = pts[0]
                        cv2.putText(frame_img, zone.name, (text_pos[0], text_pos[1] - 5),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)

                # Overlay transparent zones with 0.15 weight
                cv2.addWeighted(overlay, 0.15, frame_img, 0.85, 0, frame_img)

                # 2. Draw Active Detections & Bounding Boxes
                frame_dets = detections_by_frame.get(frame_num, [])
                for det in frame_dets:
                    x, y, w, h = int(det.bbox_x), int(det.bbox_y), int(det.bbox_width), int(det.bbox_height)
                    class_name = det.class_name
                    track_id = det.track_id
                    
                    color = get_class_color(class_name)
                    cv2.rectangle(frame_img, (x, y), (x + w, y + h), color, 2)
                    
                    # Track overlay string label
                    label = f"#{track_id} {class_name}" if track_id is not None else class_name
                    cv2.putText(frame_img, label, (x + 3, y - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)

                    # Draw historic trajectory line for this track
                    if track_id is not None and track_id in tracks_by_id:
                        track_obj = tracks_by_id[track_id]
                        pts = []
                        for pt in track_obj.trajectory:
                            if pt["frame_number"] <= frame_num:
                                pts.append((int(pt["center_x"]), int(pt["center_y"])))
                        
                        # Keep only the last 30 points to avoid cluttered overlays
                        pts = pts[-30:]
                        for k in range(1, len(pts)):
                            cv2.line(frame_img, pts[k - 1], pts[k], color, 1)

                # 3. Draw Active Behavior Events in the corner
                # We filter events that overlap with this frame number
                frame_events = [e for e in events if e.start_frame <= frame_num <= e.end_frame]
                y_offset = 30
                
                # Draw title header for events
                if frame_events:
                    cv2.rectangle(frame_img, (width - 260, 10), (width - 10, 15 + (len(frame_events) * 20)), (15, 23, 42), -1) # Dark Slate BG
                    cv2.putText(frame_img, "ACTIVE INCIDENTS:", (width - 250, 25),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (220, 38, 38), 1, cv2.LINE_AA) # Red title
                    
                    for e in frame_events:
                        label = f"{e.event_type} " + (f"(#{e.track_id})" if e.track_id > 0 else "")
                        cv2.putText(frame_img, label, (width - 250, y_offset + 15),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1, cv2.LINE_AA)
                        y_offset += 20

                # 4. Render timeline / HUD bar at the bottom
                cv2.rectangle(frame_img, (0, height - 30), (width, height), (15, 23, 42), -1)
                hud_text = f"Frame: {frame_num} / {len(frame_files)}  |  Time: {((frame_num-1)/fps):.1f}s  |  Active Targets: {len(frame_dets)}  |  SentralQ Security Feed"
                cv2.putText(frame_img, hud_text, (15, height - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (148, 163, 184), 1, cv2.LINE_AA) # Slate Gray HUD text

                writer.write(frame_img)
            
            logger.info("OpenCV raw video compilation finished successfully.")
        finally:
            writer.release()

        # 5. Transcode raw video to web-compatible H264 MP4 using FFmpeg
        logger.info(f"Transcoding raw video {temp_raw_video} to browser-playable H264 format...")
        try:
            # -y overwrites existing file; libx264 enforces H264 compression; -pix_fmt yuv420p increases HTML5 video compatibility
            cmd = [
                settings.FFMPEG_PATH,
                "-y",
                "-i", temp_raw_video,
                "-vcodec", "libx264",
                "-pix_fmt", "yuv420p",
                final_path
            ]
            logger.info(f"Running ffmpeg command: {' '.join(cmd)}")
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            logger.info("FFmpeg H264 transcoding completed successfully.")
        except Exception as ffmpeg_err:
            logger.error(f"FFmpeg transcoding failed: {str(ffmpeg_err)}")
            # Fallback to copy the raw file if ffmpeg is unconfigured or fails
            import shutil
            shutil.copy(temp_raw_video, final_path)
            logger.warning("Fell back to copying raw video compilation directly.")
        finally:
            # Clean up temp raw compilation files
            if os.path.exists(temp_raw_video):
                os.remove(temp_raw_video)

        return final_path
