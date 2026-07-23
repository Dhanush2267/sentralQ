import uuid
from typing import List
from sqlalchemy.orm import Session, joinedload
from app.models.report import Report

class ReportRepository:
    @staticmethod
    def create(db: Session, video_id: uuid.UUID, report_type: str, format: str, filename: str, status: str = "completed") -> Report:
        db_report = Report(
            video_id=video_id,
            report_type=report_type,
            format=format,
            filename=filename,
            status=status
        )
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        return db_report

    @staticmethod
    def get_all(db: Session) -> List[Report]:
        return db.query(Report).options(joinedload(Report.video)).order_by(Report.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, report_id: uuid.UUID) -> Report:
        return db.query(Report).filter(Report.id == report_id).first()
