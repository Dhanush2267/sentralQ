import os
import uuid
import shutil
import logging
from datetime import datetime
from fastapi import UploadFile
from app.core.config import settings

logger = logging.getLogger(__name__)

class VideoStorageService:
    @staticmethod
    def get_video_relative_path(unique_id: uuid.UUID, original_filename: str) -> str:
        """
        Generate relative storage path for video: YYYY/MM/uuid.ext
        """
        _, ext = os.path.splitext(original_filename)
        ext = ext.lower()
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        return os.path.join(year, month, f"{unique_id}{ext}")

    @staticmethod
    def get_thumbnail_relative_path(unique_id: uuid.UUID) -> str:
        """
        Generate relative storage path for thumbnail: YYYY/MM/uuid.jpg
        """
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        return os.path.join(year, month, f"{unique_id}.jpg")

    @staticmethod
    def store_video(file: UploadFile, relative_path: str) -> str:
        """
        Save uploaded file physically onto the server under storage/videos/.
        Uses file chunking to prevent high memory usage.
        """
        # Form full absolute path
        base_dir = os.path.join(settings.STORAGE_DIR, "videos")
        full_path = os.path.join(base_dir, relative_path)
        
        # Ensure directories exist
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        try:
            logger.info(f"Writing uploaded video to storage path: {full_path}")
            # Reset file pointer to beginning
            file.file.seek(0)
            with open(full_path, "wb") as buffer:
                # Read file in 1MB chunks
                while True:
                    chunk = file.file.read(1024 * 1024)
                    if not chunk:
                        break
                    buffer.write(chunk)
            
            logger.info(f"Video successfully saved at: {full_path}")
            return full_path
        except Exception as e:
            logger.error(f"Error saving video file to storage: {str(e)}")
            if os.path.exists(full_path):
                os.remove(full_path)
            raise RuntimeError(f"Storage failure: could not write file to disk. Detail: {str(e)}")

    @staticmethod
    def delete_file(absolute_path: str) -> bool:
        """
        Safely delete file from disk.
        """
        if not absolute_path:
            return False
            
        try:
            if os.path.exists(absolute_path):
                logger.info(f"Deleting physical file at path: {absolute_path}")
                os.remove(absolute_path)
                return True
            else:
                logger.warning(f"File not found for deletion: {absolute_path}")
        except Exception as e:
            logger.error(f"Failed to delete physical file {absolute_path}: {str(e)}")
            
        return False

    @staticmethod
    def delete_directory(absolute_path: str) -> bool:
        """
        Safely delete a directory and all of its contents from disk.
        """
        if not absolute_path:
            return False
            
        try:
            if os.path.exists(absolute_path) and os.path.isdir(absolute_path):
                logger.info(f"Deleting physical directory at path: {absolute_path}")
                shutil.rmtree(absolute_path)
                return True
            else:
                logger.warning(f"Directory not found for deletion: {absolute_path}")
        except Exception as e:
            logger.error(f"Failed to delete physical directory {absolute_path}: {str(e)}")
            
        return False

