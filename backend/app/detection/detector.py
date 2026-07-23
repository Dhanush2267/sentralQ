import logging
from typing import List, Dict, Any, Union, Optional
from app.detection.inference import YOLOInference

logger = logging.getLogger(__name__)

class YOLODetector:
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.25):
        self.inference = YOLOInference(model_path=model_path, conf_threshold=conf_threshold)
        self.model_name = "YOLO"
        self.model_version = model_path.replace(".pt", "")

    def detect(self, frame_paths: Union[str, List[str]], conf: Optional[float] = None) -> List[List[Dict[str, Any]]]:
        """
        Perform detection on a frame or batch of frames.
        Returns a list of lists: for each input frame, a list of detection dictionaries.
        """
        results = self.inference.run_inference(frame_paths, conf=conf)
        
        all_detections = []
        for result in results:
            frame_detections = []
            
            # Check if there are boxes detected
            if hasattr(result, "boxes") and result.boxes is not None:
                names = result.names
                for box in result.boxes:
                    cls_id = int(box.cls[0].item())
                    class_name = names.get(cls_id, f"class_{cls_id}")
                    confidence = float(box.conf[0].item())
                    
                    # Convert xyxy [xmin, ymin, xmax, ymax] to xywh [xmin, ymin, width, height]
                    xyxy = box.xyxy[0].tolist()
                    xmin, ymin, xmax, ymax = xyxy[0], xyxy[1], xyxy[2], xyxy[3]
                    
                    bbox_x = xmin
                    bbox_y = ymin
                    bbox_width = xmax - xmin
                    bbox_height = ymax - ymin
                    
                    detection = {
                        "class_name": class_name,
                        "confidence": confidence,
                        "bbox_x": bbox_x,
                        "bbox_y": bbox_y,
                        "bbox_width": bbox_width,
                        "bbox_height": bbox_height,
                        "model_name": self.model_name,
                        "model_version": self.model_version
                    }
                    frame_detections.append(detection)
                    
            all_detections.append(frame_detections)
            
        return all_detections

    def run_inference(self, frame_path: str) -> Dict[str, Any]:
        """
        Run inference on a single frame and return in format compatible with ModelManager.
        """
        detections = self.detect(frame_path)[0]
        return {
            "model": self.model_name,
            "detected_objects": [d["class_name"] for d in detections],
            "detections": detections,
            "status": "success"
        }
