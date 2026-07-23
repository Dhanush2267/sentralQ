import logging

logger = logging.getLogger(__name__)

def get_visualization_info():
    """
    Return basic metadata or configurations used for frame visualization.
    """
    return {
        "status": "ready",
        "engine": "OpenCV-based overlay generator",
        "supported_formats": ["JPEG", "PNG"]
    }
