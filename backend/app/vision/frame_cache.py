import os
import shutil
import logging
from datetime import datetime
from typing import Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)

class FrameCache:
    # In-memory store for cache tracking
    # Key: {video_uuid}_{interval}
    # Value: { "video_uuid": str, "interval": float, "frame_paths": List[str], "last_accessed": datetime }
    _cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_frames(cls, video_uuid: str, interval: float) -> List[str]:
        """
        Check if frames for video_uuid at the given interval are already cached and exist on disk.
        Returns the list of frame file paths if valid, empty list otherwise.
        """
        cache_key = f"{video_uuid}_{interval}"
        if cache_key in cls._cache:
            entry = cls._cache[cache_key]
            entry["last_accessed"] = datetime.utcnow()
            
            # Verify if directory and files actually exist on disk
            output_dir = os.path.join(settings.FRAME_STORAGE_PATH, video_uuid)
            if os.path.exists(output_dir):
                files = [os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.endswith(".jpg")]
                if len(files) == len(entry["frame_paths"]):
                    logger.info(f"Frame cache hit for {video_uuid} at interval {interval}s ({len(files)} frames)")
                    return sorted(files)
            
            # Invalidate if files are missing on disk
            logger.warning(f"Cache entry for {cache_key} was invalid on disk (files missing). Evicting.")
            cls.invalidate(video_uuid, interval)
            
        return []

    @classmethod
    def add_frames(cls, video_uuid: str, interval: float, frame_paths: List[str]) -> None:
        """
        Add extracted frames metadata to the cache. Evicts LRU entries if cache size exceeds limit.
        """
        cache_key = f"{video_uuid}_{interval}"
        
        # Calculate total frames in cache currently
        total_cached_frames = sum(len(entry["frame_paths"]) for entry in cls._cache.values())
        
        # Evict LRU entries if we exceed the limit
        while total_cached_frames + len(frame_paths) > settings.FRAME_CACHE_LIMIT and cls._cache:
            # Find the least recently accessed entry
            lru_key = min(cls._cache.keys(), key=lambda k: cls._cache[k]["last_accessed"])
            lru_entry = cls._cache[lru_key]
            logger.info(f"Frame cache limit reached. Evicting LRU cache entry: {lru_key}")
            
            # Delete files from disk for the evicted entry
            evicted_video_uuid = lru_entry["video_uuid"]
            output_dir = os.path.join(settings.FRAME_STORAGE_PATH, evicted_video_uuid)
            if os.path.exists(output_dir):
                try:
                    shutil.rmtree(output_dir)
                    logger.info(f"Deleted physical frames from disk for evicted cache: {output_dir}")
                except Exception as e:
                    logger.error(f"Failed to delete evicted frames folder {output_dir}: {e}")
            
            total_cached_frames -= len(lru_entry["frame_paths"])
            del cls._cache[lru_key]
            
        cls._cache[cache_key] = {
            "video_uuid": video_uuid,
            "interval": interval,
            "frame_paths": frame_paths,
            "last_accessed": datetime.utcnow()
        }
        logger.info(f"Added {len(frame_paths)} frames for video {video_uuid} (interval {interval}s) to cache")

    @classmethod
    def invalidate(cls, video_uuid: str, interval: float) -> None:
        cache_key = f"{video_uuid}_{interval}"
        if cache_key in cls._cache:
            del cls._cache[cache_key]

    @classmethod
    def clear(cls) -> None:
        cls._cache.clear()
