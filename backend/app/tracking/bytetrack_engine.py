import logging
from typing import List
from types import SimpleNamespace
from ultralytics.trackers.byte_tracker import BYTETracker

logger = logging.getLogger(__name__)

class ByteTrackEngine:
    def __init__(
        self,
        track_buffer: int = 30,
        match_threshold: float = 0.8,
        score_threshold: float = 0.5,
        minimum_box_area: float = 0.0
    ):
        self.track_buffer = track_buffer
        self.match_threshold = match_threshold
        self.score_threshold = score_threshold
        self.minimum_box_area = minimum_box_area

        # Prepare argument namespace mapping to ultralytics BYTETracker properties
        self.args = SimpleNamespace(
            track_buffer=self.track_buffer,
            track_thresh=self.score_threshold,
            track_high_thresh=self.score_threshold,
            track_low_thresh=0.1,
            new_track_thresh=min(0.9, self.score_threshold + 0.1),
            match_thresh=self.match_threshold,
            fuse_score=True
        )
        self.tracker = BYTETracker(self.args)
        logger.info(f"ByteTrackEngine initialized with track_buffer={track_buffer}, "
                    f"match_threshold={match_threshold}, score_threshold={score_threshold}, "
                    f"minimum_box_area={minimum_box_area}")

    def update(self, results):
        """
        Update the tracker and return tracking outputs.
        """
        return self.tracker.update(results)

    def reset(self):
        """
        Reset the tracker tracking history and IDs.
        """
        self.tracker.reset()
        logger.info("ByteTrackEngine tracking states successfully reset.")

import numpy as np

class ByteTrackFrameDetections:
    def __init__(self, xys: List[List[float]], confs: List[float], clss: List[int]):
        self.xywh = np.array(xys, dtype=np.float32)  # shape (N, 4)
        self.conf = np.array(confs, dtype=np.float32)  # shape (N,)
        self.cls = np.array(clss, dtype=np.float32)  # shape (N,)

    def __len__(self) -> int:
        return len(self.conf)

    def __getitem__(self, index) -> 'ByteTrackFrameDetections':
        return ByteTrackFrameDetections(
            self.xywh[index].tolist() if self.xywh.ndim > 1 else [self.xywh.tolist()],
            self.conf[index].tolist() if isinstance(index, slice) or (isinstance(index, np.ndarray) and index.dtype == bool) else [self.conf[index]],
            self.cls[index].tolist() if isinstance(index, slice) or (isinstance(index, np.ndarray) and index.dtype == bool) else [self.cls[index]]
        )
