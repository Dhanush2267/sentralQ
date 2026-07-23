import uuid
import io
import csv
import logging
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.repositories.video_repository import VideoRepository
from app.repositories.zone_repository import ZoneRepository
from app.repositories.track_repository import TrackRepository
from app.repositories.behavior_repository import BehaviorRepository
from app.repositories.report_repository import ReportRepository
from app.schemas.report import ReportResponse


# Import ReportLab modules
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get(
    "/generate/{video_id}",
    summary="Generate Incident, Daily, or Behavior Summary Reports in PDF/CSV format"
)
def generate_report(
    video_id: uuid.UUID,
    format: str = Query("csv", description="File format: 'csv' or 'pdf'"),
    report_type: str = Query("incident", description="Report content type: 'incident', 'daily', or 'summary'"),
    db: Session = Depends(get_db)
):
    """
    Downloads structural surveillance data for auditing.
    Supports CSV streams and ReportLab PDF document templates.
    """
    logger.info(f"Generating {report_type} report in {format} format for video {video_id}...")
    
    # Fetch database assets
    video = VideoRepository.get(db, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video asset {video_id} not found."
        )

    zones = ZoneRepository.get_by_video_id(db, video_id)
    tracks = TrackRepository.get_by_video_id(db, video_id)
    events = BehaviorRepository.get_by_video_id(db, video_id)

    # 1. GENERATE CSV REPORT
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header Metadata
        writer.writerow(["=== SENTRALQ SURVEILLANCE REPORT ==="])
        writer.writerow(["Video File", video.original_filename])
        writer.writerow(["Asset UUID", str(video.id)])
        writer.writerow(["Report Type", report_type.upper()])
        writer.writerow([])
        
        # Zone details
        writer.writerow(["=== MONITORING ZONES ==="])
        writer.writerow(["Zone Name", "Zone Type", "Points Count", "Description"])
        for z in zones:
            writer.writerow([z.name, z.zone_type, len(z.polygon_points), z.description or ""])
        writer.writerow([])

        # Behavior events log
        writer.writerow(["=== BEHAVIOR EVENTS LOG ==="])
        writer.writerow(["Event Type", "Track ID", "Zone Name", "Start Frame", "End Frame", "Start (s)", "End (s)", "Duration (s)", "Confidence (%)", "Description"])
        
        # Filter logic based on report_type
        for e in events:
            if report_type == "incident" and e.event_type not in ["Restricted Area Entry", "Wrong Direction", "Loitering"]:
                continue
            
            zone_name = e.zone.name if e.zone else "Global"
            writer.writerow([
                e.event_type,
                e.track_id,
                zone_name,
                e.start_frame,
                e.end_frame,
                round(e.start_timestamp, 2),
                round(e.end_timestamp, 2),
                round(e.duration, 2),
                round(e.confidence * 100, 1),
                e.metadata_json.get("description", "")
            ])

        output.seek(0)
        filename = f"SentralQ_{report_type}_Report_{video_id}.csv"
        
        # Log to Database
        try:
            ReportRepository.create(
                db=db,
                video_id=video_id,
                report_type=report_type,
                format="csv",
                filename=filename,
                status="completed"
            )
        except Exception as db_err:
            logger.error(f"Failed to log CSV report to database: {db_err}")

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


    # 2. GENERATE PDF REPORT
    elif format.lower() == "pdf":
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []

        styles = getSampleStyleSheet()
        
        # Custom styles for premium look
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Title"],
            fontSize=22,
            textColor=colors.HexColor("#1e1b4b"),  # Dark Indigo
            spaceAfter=12
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#4b5563"),  # Gray
            spaceAfter=20
        )
        heading_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=colors.HexColor("#1e1b4b"),
            spaceBefore=15,
            spaceAfter=10
        )
        body_style = ParagraphStyle(
            "ReportBody",
            parent=styles["BodyText"],
            fontSize=9,
            textColor=colors.HexColor("#1f2937")
        )

        # Title
        story.append(Paragraph("SentralQ Surveillance Intelligence Report", title_style))
        story.append(Paragraph(f"Report Type: {report_type.upper()} | Target Asset: {video.original_filename} (ID: {video.id})", subtitle_style))
        story.append(Spacer(1, 10))

        # Metadata Table
        metadata_data = [
            [Paragraph("<b>Video Duration:</b>", body_style), Paragraph(f"{video.duration:.1f} seconds", body_style),
             Paragraph("<b>Total Tracks:</b>", body_style), Paragraph(f"{len(tracks)}", body_style)],
            [Paragraph("<b>Total Events Logged:</b>", body_style), Paragraph(f"{len(events)}", body_style),
             Paragraph("<b>Resolution / FPS:</b>", body_style), Paragraph(f"{video.width}x{video.height} / {video.fps:.1f} fps", body_style)]
        ]
        meta_table = Table(metadata_data, colWidths=[120, 140, 100, 140])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f3f4f6")),
            ('PADDING', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#d1d5db")),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))

        # Zones Section
        story.append(Paragraph("Configured Monitoring Zones", heading_style))
        if zones:
            zone_headers = [Paragraph("<b>Zone Name</b>", body_style), Paragraph("<b>Type</b>", body_style), Paragraph("<b>Color</b>", body_style), Paragraph("<b>Description</b>", body_style)]
            zone_rows = [zone_headers]
            for z in zones:
                zone_rows.append([
                    Paragraph(z.name, body_style),
                    Paragraph(z.zone_type, body_style),
                    Paragraph(f"<font color='{z.color}'>■</font> {z.color}", body_style),
                    Paragraph(z.description or "No description", body_style)
                ])
            zone_table = Table(zone_rows, colWidths=[120, 100, 80, 200])
            zone_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e5e7eb")),
                ('PADDING', (0,0), (-1,-1), 6),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
            ]))
            story.append(zone_table)
        else:
            story.append(Paragraph("No monitoring zones configured for this video.", body_style))
        story.append(Spacer(1, 15))

        # Events Section
        story.append(Paragraph(f"Behavior Events Log ({report_type.capitalize()})", heading_style))
        
        # Filter events
        filtered_events = []
        for e in events:
            if report_type == "incident" and e.event_type not in ["Restricted Area Entry", "Wrong Direction", "Loitering"]:
                continue
            filtered_events.append(e)

        if filtered_events:
            event_headers = [
                Paragraph("<b>Event Type</b>", body_style),
                Paragraph("<b>Track ID</b>", body_style),
                Paragraph("<b>Zone Name</b>", body_style),
                Paragraph("<b>Time (s)</b>", body_style),
                Paragraph("<b>Duration</b>", body_style),
                Paragraph("<b>Description</b>", body_style)
            ]
            event_rows = [event_headers]
            for e in filtered_events:
                zone_name = e.zone.name if e.zone else "Global"
                desc_text = e.metadata_json.get("description", "")
                
                # Check for critical alerts
                is_alert = e.event_type == "Restricted Area Entry"
                row_style = ParagraphStyle("AlertBody", parent=body_style, textColor=colors.HexColor("#ef4444") if is_alert else colors.HexColor("#1f2937"))
                
                event_rows.append([
                    Paragraph(f"<b>{e.event_type}</b>" if is_alert else e.event_type, row_style),
                    Paragraph(f"#{e.track_id}", row_style),
                    Paragraph(zone_name, row_style),
                    Paragraph(f"{e.start_timestamp:.1f}s", row_style),
                    Paragraph(f"{e.duration:.1f}s" if e.duration > 0.0 else "-", row_style),
                    Paragraph(desc_text, row_style)
                ])
            
            event_table = Table(event_rows, colWidths=[110, 50, 80, 50, 50, 160])
            event_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e5e7eb")),
                ('PADDING', (0,0), (-1,-1), 5),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
            ]))
            story.append(event_table)
        else:
            story.append(Paragraph("No events matching report filter conditions.", body_style))

        # Build PDF Document
        doc.build(story)
        buffer.seek(0)
        filename = f"SentralQ_{report_type}_Report_{video_id}.pdf"
        
        # Log to Database
        try:
            ReportRepository.create(
                db=db,
                video_id=video_id,
                report_type=report_type,
                format="pdf",
                filename=filename,
                status="completed"
            )
        except Exception as db_err:
            logger.error(f"Failed to log PDF report to database: {db_err}")

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report format '{format}' is not supported. Use 'csv' or 'pdf'."
        )


@router.get(
    "/history",
    response_model=List[ReportResponse],
    summary="Get report generation history log"
)
def get_report_history(
    db: Session = Depends(get_db)
) -> List[ReportResponse]:
    """
    Retrieves the complete list of previously generated reports from the database.
    """
    reports_list = ReportRepository.get_all(db)
    response = []
    for r in reports_list:
        response.append(ReportResponse(
            id=r.id,
            video_id=r.video_id,
            report_type=r.report_type,
            format=r.format,
            filename=r.filename,
            status=r.status,
            created_at=r.created_at,
            video_name=r.video.original_filename if r.video else "Unknown Video"
        ))
    return response


@router.get(
    "/{report_id}/download",
    summary="Re-download a previously logged report from history"
)
def download_logged_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    Finds a report metadata entry in the database history, and dynamically re-generates
    it for download.
    """
    report_item = ReportRepository.get_by_id(db, report_id)
    if not report_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report configuration {report_id} not found."
        )
    
    # Delegate to the main generation function to construct the file on the fly
    return generate_report(
        video_id=report_item.video_id,
        format=report_item.format,
        report_type=report_item.report_type,
        db=db
    )

