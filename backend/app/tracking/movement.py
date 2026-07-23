import math
from typing import List, Dict, Any

def calculate_distance_travelled(trajectory: List[Dict[str, Any]]) -> float:
    """
    Calculate the total Euclidean distance travelled in pixels across the trajectory.
    """
    if len(trajectory) < 2:
        return 0.0
    
    total_dist = 0.0
    for i in range(1, len(trajectory)):
        p1 = trajectory[i - 1]
        p2 = trajectory[i]
        dx = p2["center_x"] - p1["center_x"]
        dy = p2["center_y"] - p1["center_y"]
        total_dist += math.sqrt(dx * dx + dy * dy)
        
    return round(total_dist, 2)

def calculate_movement_metrics(
    trajectory: List[Dict[str, Any]],
    total_tracked_frames: int,
    total_video_frames: int
) -> Dict[str, float]:
    """
    Calculate movement analysis metrics: distance, speed, duration, and frame coverage.
    """
    if not trajectory:
        return {
            "distance_travelled": 0.0,
            "average_speed": 0.0,
            "track_duration": 0.0,
            "frame_coverage": 0.0
        }
        
    distance = calculate_distance_travelled(trajectory)
    
    first_pt = trajectory[0]
    last_pt = trajectory[-1]
    duration = max(0.0, last_pt["timestamp"] - first_pt["timestamp"])
    
    speed = round(distance / duration, 2) if duration > 0.0 else 0.0
    coverage = round(total_tracked_frames / total_video_frames, 4) if total_video_frames > 0 else 0.0
    
    return {
        "distance_travelled": distance,
        "average_speed": speed,
        "track_duration": duration,
        "frame_coverage": coverage
    }
