import logging
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.ai_search_service import AISearchService
from app.schemas.ai import AISearchRequest, AISearchResponse

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/search",
    response_model=AISearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Query surveillance logs using AI Assistant"
)
def run_ai_search(
    request: AISearchRequest,
    db: Session = Depends(get_db)
) -> AISearchResponse:
    """
    Search and summarize surveillance incidents using Grok / Llama LLM.
    Leverages Postgres logs as context to avoid hallucinations.
    """
    try:
        res = AISearchService.run_ai_search(
            query=request.query,
            video_id=request.video_id,
            db=db
        )
        return AISearchResponse(**res)
    except Exception as e:
        logger.error(f"AI search failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Search execution failed: {str(e)}"
        )
