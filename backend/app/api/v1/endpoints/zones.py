import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.repositories.zone_repository import ZoneRepository
from app.schemas.zones import ZoneCreate, ZoneUpdate, ZoneResponse

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
def create_zone(zone_in: ZoneCreate, db: Session = Depends(get_db)) -> ZoneResponse:
    """
    Configure a new monitoring zone (Rectangle or Polygon) for a video asset.
    """
    logger.info(f"Creating zone '{zone_in.name}' of type '{zone_in.zone_type}' for video {zone_in.video_id}")
    try:
        zone = ZoneRepository.create(db, obj_in=zone_in.model_dump())
        return zone
    except Exception as e:
        logger.error(f"Failed to create zone: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Zone creation failed: {str(e)}"
        )

@router.get("/video/{video_id}", response_model=List[ZoneResponse])
def get_video_zones(video_id: uuid.UUID, db: Session = Depends(get_db)) -> List[ZoneResponse]:
    """
    Get all monitoring zones configured for a specific video.
    """
    return ZoneRepository.get_by_video_id(db, video_id)

@router.put("/{zone_id}", response_model=ZoneResponse)
def update_zone(zone_id: uuid.UUID, zone_in: ZoneUpdate, db: Session = Depends(get_db)) -> ZoneResponse:
    """
    Update coordinates, colors, or names for an existing zone.
    """
    logger.info(f"Updating zone {zone_id}...")
    zone = ZoneRepository.get(db, zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone with ID {zone_id} not found."
        )
    
    update_data = zone_in.model_dump(exclude_unset=True)
    updated_zone = ZoneRepository.update(db, db_obj=zone, obj_in=update_data)
    return updated_zone

@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(zone_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Delete a monitoring zone configuration.
    """
    logger.info(f"Deleting zone {zone_id}...")
    success = ZoneRepository.delete(db, zone_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone with ID {zone_id} not found."
        )
    return None
