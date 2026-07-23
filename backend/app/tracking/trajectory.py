from typing import Dict, Any, List

def calculate_center(bbox_x: float, bbox_y: float, bbox_width: float, bbox_height: float) -> tuple[float, float]:
    """
    Calculate the center coordinates (x, y) of a bounding box.
    """
    center_x = bbox_x + (bbox_width / 2.0)
    center_y = bbox_y + (bbox_height / 2.0)
    return center_x, center_y

def format_trajectory_point(frame_number: int, center_x: float, center_y: float, timestamp: float) -> Dict[str, Any]:
    """
    Format a single trajectory point to be stored in the trajectory JSON.
    """
    return {
        "frame_number": frame_number,
        "center_x": round(center_x, 2),
        "center_y": round(center_y, 2),
        "timestamp": round(timestamp, 2)
    }
