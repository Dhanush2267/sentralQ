# SentralQ — Enterprise AI Surveillance Intelligence Platform
## Technical Architecture & Systems Reference Manual

SentralQ is a production-ready, high-fidelity AI-powered enterprise surveillance platform that detects and tracks people, maps movement paths, infers complex behavioral interactions, indexes surveillance incidents, and supports natural-language search.

---

## 1. System Pipeline Architecture

```mermaid
graph TD
    A[Uploaded Video] -->|FastAPI Ingestion| B[Vision Processing Job]
    B -->|FFmpeg Frame Extraction| C[Extracted Frames (1 FPS)]
    C -->|YOLOv8 Object Detection| D[DetectionResult Database Rows]
    D -->|ByteTrack Association| E[Tracks & Trajectories Database Rows]
    E -->|Rule-Based Behavior Engine| F[BehaviorEvents with Explainability Logs]
    F -->|NL Semantic Parsing| G[AI Copilot Search Assistant]
    F -->|Dynamic Aggregates| H[Operational Analytics Dashboard]
```

---

## 2. Ingestion & Vision Processing Pipeline
1. **Metadata & Thumbnail Ingestion:** FFprobe extracts container, resolution, frame-rate, and codec metadata. A first-frame thumbnail is captured.
2. **Keyframe Extraction:** FFmpeg decodes the video and writes frames at a configurable interval (default: 1 frame/sec) to `storage/frames/<video_id>/`.
3. **YOLO Detection:** A pretrained Ultralytics YOLOv8 model runs inference on each keyframe. Objects of class `person` and context labels (e.g. `chair`, `laptop`, `backpack`) are saved in the `detection_results` database table.

---

## 3. ByteTrack Multi-Object Tracking (MOT)
1. **State Estimation:** Detections are grouped chronologically. A Kalman Filter predicts the future bounding box coordinates of active tracks in subsequent frames.
2. **IoU Data Association:** Detections in new frames are mapped to tracks using Hungarian algorithm matching based on bounding box Intersection over Union (IoU) overlap.
3. **Trajectory & Movement Metrics:** Tracks are stored in `tracks` table. Distance traveled, average speed, and relative frame coverage are calculated dynamically.

---

## 4. Behavior Rules Engine
Behavior evaluation is executed during a tracking post-processing hook, mapping trajectories to zones.

*   **Zone Entry/Exit:** Inferred when a track's $(x, y)$ coordinate transitions inside or outside a zone polygon boundary.
*   **Loitering:** Triggered when a track remains within any zone boundary for $\ge 10.0$ seconds.
*   **Waiting:** Triggered when a track is stationary inside a Checkout or Waiting Area zone for $\ge 5.0$ seconds.
*   **Sitting:** Inferred when a person's track velocity is stationary for $\ge 5.0$ seconds and the bounding box aspect ratio ($H/W$) is $< 1.3$, or when the bounding box intersects a `chair`, `sofa`, or `couch` detection.
*   **Standing:** Inferred when a person is stationary for $\ge 5.0$ seconds and aspect ratio is $\ge 1.3$.
*   **Wrong Direction:** Triggered when the horizontal displacement ($dx$) of a track through Checkout zones is reversed compared to the standard flow direction.
*   **Crowd Detection (Global):** Logged when 4 or more active tracks overlap on any single frame.
*   **Group Formation (Global):** Triggered when 2 or 3 tracks dwell within 150 pixels of each other for $\ge 15.0$ seconds.

---

## 5. Rich Event Index & Explainability
Every log entry stored in the `behavior_events` table contains first-class parameters detailing exactly **WHY** it was triggered:
*   `summary`: High-level human description of the event.
*   `search_text`: Keyword-rich text (used by local fallback search queries).
*   `reason`: Rationale detailing mathematical violations (e.g. specific speeds or durations).
*   `threshold`: The metric cutoff limit checked by the rules engine (e.g. 10.0s for loitering).

---

## 6. AI Search & Natural Language Interface
The AI Copilot operates in dual mode:
1. **OpenAI Search:** If `OPENAI_API_KEY` is present, queries are translated into SQL or summarized directly from the database context.
2. **Deterministic Rules Engine:** If offline, a keyword parser maps 10 query archetypes to query parameters (duration, shelf names, checkout waits, zone revisits) and formats chronological Markdown timelines.

---

## 7. Interactive Annotated Video Export
The platform generates an audited surveillance copy of the video (`GET /api/v1/videos/{id}/download/annotated`):
*   Reads frame images sequentially.
*   Draws configured zones as semi-transparent overlays.
*   Draws bounding boxes, Track IDs, and historical motion tails.
*   Burns active behaviors/incidents into a top HUD status box.
*   Transcodes raw frames to H264 MP4 using FFmpeg.

---

## 8. Database Schema Mapping

### Video Table (`videos`)
- `id`: UUID (Primary Key)
- `filename`, `original_filename`: String
- `file_path`, `thumbnail_path`: String
- `duration`, `fps`, `width`, `height`: Float/Integer
- `status`, `processing_stage`: String
- `deleted`: Boolean (Enforces cascade removal checks)

### Track Table (`tracks`)
- `id`: UUID (Primary Key)
- `video_id`: ForeignKey (`videos.id` ON DELETE CASCADE)
- `track_id`: Integer
- `class_name`: String
- `distance_travelled`, `average_speed`, `track_duration`: Float
- `trajectory`: JSON (`[{"frame_number": f, "center_x": x, "center_y": y, "timestamp": t}]`)

### Behavior Event Table (`behavior_events`)
- `id`: UUID (Primary Key)
- `video_id`: ForeignKey (`videos.id` ON DELETE CASCADE)
- `track_id`: Integer
- `zone_id`: ForeignKey (`zones.id` ON DELETE CASCADE, Nullable)
- `event_type`: String
- `start_frame`, `end_frame`: Integer
- `start_timestamp`, `end_timestamp`, `duration`, `confidence`: Float
- `summary`, `search_text`, `reason`: String
- `threshold`: Float
- `metadata_json`: JSON
- `created_at`: DateTime
