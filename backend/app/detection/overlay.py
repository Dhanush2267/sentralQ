import os
import cv2
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Premium, harmonized color palette (B, G, R format for OpenCV)
COLOR_PALETTE = {
    "person": (230, 124, 115),     # Soft Teal/Blue
    "backpack": (121, 134, 203),   # Lavender
    "handbag": (121, 134, 203),    # Lavender
    "suitcase": (121, 134, 203),   # Lavender
    "cell phone": (255, 138, 101), # Bright Coral
    "bottle": (77, 182, 172),      # Mint green
    "chair": (186, 104, 200),      # Soft Purple
    "cup": (240, 98, 146),         # Soft Pink
    "tv": (141, 110, 99),          # Brown
    "laptop": (141, 110, 99),      # Brown
}

def get_class_color(class_name: str) -> tuple:
    """
    Get a consistent premium color for a class, generating one if not predefined.
    """
    if class_name in COLOR_PALETTE:
        return COLOR_PALETTE[class_name]
    
    # Hash class name for a stable randomized color
    hash_val = hash(class_name)
    r = (hash_val & 0xFF0000) >> 16
    g = (hash_val & 0x00FF00) >> 8
    b = hash_val & 0x0000FF
    
    # Keep it bright enough
    r = (r % 150) + 80
    g = (g % 150) + 80
    b = (b % 150) + 80
    return (b, g, r)

def draw_detections(image_path: str, detections: List[Dict[str, Any]], output_path: str) -> None:
    """
    Draw bounding boxes, class labels, and confidence scores onto the frame image and save it.
    """
    if not os.path.exists(image_path):
        logger.error(f"Cannot draw detections: Image source path '{image_path}' does not exist.")
        return

    # Load image
    img = cv2.imread(image_path)
    if img is None:
        logger.error(f"Failed to read image at '{image_path}' using OpenCV.")
        return

    # Draw each detection box and text
    for det in detections:
        x = int(det["bbox_x"])
        y = int(det["bbox_y"])
        w = int(det["bbox_width"])
        h = int(det["bbox_height"])
        class_name = det["class_name"]
        conf = det["confidence"]
        
        color = get_class_color(class_name)
        
        # Draw bounding box rectangle
        cv2.rectangle(img, (x, y), (x + w, y + h), color, 2)
        
        # Label string
        label = f"{class_name} {conf:.2f}"
        
        # Configure font
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        thickness = 1
        
        # Get label text size
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        
        # Determine text background box position (draw above rectangle if space permits)
        txt_bg_y1 = max(0, y - text_h - 6)
        txt_bg_y2 = y
        txt_bg_x1 = x
        txt_bg_x2 = x + text_w + 6
        
        # Draw text background
        cv2.rectangle(img, (txt_bg_x1, txt_bg_y1), (txt_bg_x2, txt_bg_y2), color, -1)
        
        # Draw text on top of background in white or dark depending on background
        # OpenCV standard BGR text. We use white (255, 255, 255) for the label text.
        cv2.putText(img, label, (x + 3, y - 4), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

    # Make sure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save the output image
    success = cv2.imwrite(output_path, img)
    if not success:
        logger.error(f"Failed to write annotated frame to '{output_path}'.")
    else:
        logger.debug(f"Successfully saved annotated frame to '{output_path}'.")
