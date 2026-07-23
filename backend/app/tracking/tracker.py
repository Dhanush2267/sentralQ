import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.tracking.bytetrack_engine import ByteTrackEngine, ByteTrackFrameDetections
from app.tracking.trajectory import calculate_center
from app.models.detection_result import DetectionResult

logger = logging.getLogger(__name__)

class ByteTrackTracker:
    def __init__(self, engine: ByteTrackEngine):
        self.engine = engine

    def track_detections(
        self,
        detections_by_frame: Dict[int, List[DetectionResult]],
        total_frames: int
    ) -> Dict[int, List[Dict[str, Any]]]:
        """
        Run tracking on a dictionary of frame_number -> List[DetectionResult].
        Returns a dict mapping track_id -> list of detection details representing the track history.
        """
        self.engine.reset()  # Reset tracking state before running
        
        # We will collect track results: track_id -> list of trajectory details
        tracks_data: Dict[int, List[Dict[str, Any]]] = {}
        
        # Sort the frame numbers
        frame_numbers = sorted(detections_by_frame.keys())
        
        for frame_num in frame_numbers:
            frame_dets = detections_by_frame[frame_num]
            if not frame_dets:
                continue
                
            # Filter detections by area if configured
            valid_dets = []
            for d in frame_dets:
                area = d.bbox_width * d.bbox_height
                if area >= self.engine.minimum_box_area:
                    valid_dets.append(d)
                    
            if not valid_dets:
                continue
                
            # Convert to [center_x, center_y, width, height] format for ByteTrack
            xys = []
            confs = []
            clss = []
            
            for d in valid_dets:
                cx, cy = calculate_center(d.bbox_x, d.bbox_y, d.bbox_width, d.bbox_height)
                xys.append([cx, cy, d.bbox_width, d.bbox_height])
                confs.append(d.confidence)
                clss.append(0)  # Agnostic class index
                
            # Create the frame detections results helper
            frame_results = ByteTrackFrameDetections(xys, confs, clss)
            
            # Run tracker update
            # outputs: array of shape (K, 8) -> [xmin, ymin, xmax, ymax, track_id, score, cls, idx]
            try:
                tracked_outputs = self.engine.update(frame_results)
            except Exception as e:
                logger.error(f"ByteTrack update failed on frame {frame_num}: {str(e)}", exc_info=True)
                continue
            
            for obj in tracked_outputs:
                if len(obj) < 8:
                    continue
                track_id = int(obj[4])
                score = float(obj[5])
                idx = int(obj[7])
                
                if idx < 0 or idx >= len(valid_dets):
                    continue
                
                # Match back to the original database record using idx
                matched_det = valid_dets[idx]
                cx, cy = calculate_center(matched_det.bbox_x, matched_det.bbox_y, matched_det.bbox_width, matched_det.bbox_height)
                
                if track_id not in tracks_data:
                    tracks_data[track_id] = []
                    
                tracks_data[track_id].append({
                    "detection_id": matched_det.id,
                    "frame_number": frame_num,
                    "timestamp": matched_det.timestamp_seconds,
                    "class_name": matched_det.class_name,
                    "confidence": score,
                    "bbox_x": matched_det.bbox_x,
                    "bbox_y": matched_det.bbox_y,
                    "bbox_width": matched_det.bbox_width,
                    "bbox_height": matched_det.bbox_height,
                    "center_x": cx,
                    "center_y": cy
                })
                
        return tracks_data
