import os
import torch
import logging
from typing import List, Dict, Any, Union, Optional
from ultralytics import YOLO

logger = logging.getLogger(__name__)

class YOLOInference:
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.25):
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.device = self._detect_device()
        self.model = None  # Lazily loaded

    def _detect_device(self) -> str:
        """
        Detect hardware acceleration (CUDA/GPU) using PyTorch, with CPU fallback.
        """
        if torch.cuda.is_available():
            logger.info("YOLOInference: GPU acceleration (CUDA) detected.")
            return "cuda"
        logger.info("YOLOInference: GPU not available. Using CPU fallback.")
        return "cpu"

    def load_model(self) -> YOLO:
        """
        Lazily load the YOLO model weights on the correct device.
        """
        if self.model is None:
            logger.info(f"YOLOInference: Lazily loading YOLO model weights from '{self.model_path}' onto '{self.device}'...")
            self.model = YOLO(self.model_path)
            self.model.to(self.device)
            logger.info("YOLOInference: Model loaded successfully.")
        return self.model

    def run_inference(self, frames: Union[str, List[str]], conf: Optional[float] = None) -> List[Any]:
        """
        Run inference on a single frame path or a list of frame paths (batch inference support).
        """
        model = self.load_model()
        conf_val = conf if conf is not None else self.conf_threshold
        
        # Run YOLO model predictions on input frame(s)
        results = model(frames, conf=conf_val, device=self.device, verbose=False)
        return results if isinstance(results, list) else [results]
