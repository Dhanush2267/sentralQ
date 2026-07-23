import logging
import math
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.track import Track
from app.models.zone import Zone
from app.models.detection_result import DetectionResult
from app.zones.geometry import is_point_in_polygon

logger = logging.getLogger(__name__)

def detect_events_for_track(db: Session, track: Track, zones: List[Zone]) -> List[Dict[str, Any]]:
    """
    Analyze a track's trajectory and zone boundaries frame-by-frame to extract:
    - Entered Zone / Exited Zone
    - Loitering (dwell duration in zone >= 10.0s)
    - Restricted Area Entry (any entry to restricted zone)
    - Shelf Visit (dwell duration in Shelf zone >= 3.0s)
    - Queue Detection (duration in Queue zone >= 5.0s)
    - Wrong Direction (overall direction vector contrary to zone definition)
    - Repeated Visits (multiple entries to same zone)
    - Multi Zone Transition (crossing from Zone A to Zone B)
    - Entering (first frame near entrance or start of track)
    - Exiting (last frame near exit or end of track)
    - Waiting (stationary inside a Checkout or Waiting Area zone for >= 5s)
    - Sitting (stationary with low aspect ratio or overlapping a chair)
    - Standing (stationary with standing aspect ratio)
    - Long Dwell Time (duration inside any zone >= 20s)
    """
    events = []
    
    trajectory = track.trajectory
    if not trajectory or len(trajectory) == 0:
        return events

    # Fetch detections to compute bounding box aspect ratios, velocities, and overlaps
    detections = db.query(DetectionResult).filter(
        DetectionResult.video_id == track.video_id,
        DetectionResult.track_id == track.track_id
    ).order_by(DetectionResult.frame_number.asc()).all()

    if not detections:
        return events

    # Fetch chairs/sofas for sitting detection overlap check
    chair_detections = db.query(DetectionResult).filter(
        DetectionResult.video_id == track.video_id,
        DetectionResult.class_name.in_(["chair", "sofa", "couch"])
    ).all()

    first_det = detections[0]
    last_det = detections[-1]

    # Calculate overall duration
    total_track_duration = max(0.0, last_det.timestamp_seconds - first_det.timestamp_seconds)

    # 1. Entering Event
    is_near_entrance = False
    for zone in zones:
        if zone.zone_type == "Entrance":
            poly = [(float(pt[0]), float(pt[1])) for pt in zone.polygon_points]
            if len(poly) >= 3 and is_point_in_polygon(first_det.bbox_x + first_det.bbox_width/2, first_det.bbox_y + first_det.bbox_height/2, poly):
                is_near_entrance = True
                break

    if first_det.frame_number <= 5 or is_near_entrance:
        events.append({
            "zone_id": None,
            "start_frame": first_det.frame_number,
            "end_frame": first_det.frame_number,
            "start_timestamp": first_det.timestamp_seconds,
            "end_timestamp": first_det.timestamp_seconds,
            "duration": 0.0,
            "confidence": float(track.average_confidence),
            "event_type": "Entering",
            "summary": f"Track #{track.track_id} entered the surveillance space.",
            "search_text": f"track {track.track_id} entered surveillance camera room door entrance checkin",
            "reason": f"Track initiated at frame {first_det.frame_number}." + (" (Inside entrance zone)" if is_near_entrance else ""),
            "threshold": 5.0,
            "metadata_json": {
                "first_frame": first_det.frame_number,
                "description": f"Track #{track.track_id} entered the scene."
            }
        })

    # 2. Exiting Event
    is_near_exit = False
    for zone in zones:
        if zone.zone_type == "Exit":
            poly = [(float(pt[0]), float(pt[1])) for pt in zone.polygon_points]
            if len(poly) >= 3 and is_point_in_polygon(last_det.bbox_x + last_det.bbox_width/2, last_det.bbox_y + last_det.bbox_height/2, poly):
                is_near_exit = True
                break

    # We assume exiting if the track ends, or if it is near the exit zone
    if is_near_exit:
        events.append({
            "zone_id": None,
            "start_frame": last_det.frame_number,
            "end_frame": last_det.frame_number,
            "start_timestamp": last_det.timestamp_seconds,
            "end_timestamp": last_det.timestamp_seconds,
            "duration": 0.0,
            "confidence": float(track.average_confidence),
            "event_type": "Exiting",
            "summary": f"Track #{track.track_id} exited the surveillance space.",
            "search_text": f"track {track.track_id} exited camera checkout exit out out-of-bounds",
            "reason": "Track terminated near designated exit zone.",
            "threshold": 3.0,
            "metadata_json": {
                "last_frame": last_det.frame_number,
                "description": f"Track #{track.track_id} exited the scene."
            }
        })

    # 3. Sitting / Standing (State analysis based on aspect ratio and stationary speed)
    stationary_detections = []
    for idx, d in enumerate(detections):
        is_stationary = False
        if idx > 0:
            prev = detections[idx-1]
            dist = math.sqrt((d.bbox_x - prev.bbox_x)**2 + (d.bbox_y - prev.bbox_y)**2)
            if dist < 4.0:  # less than 4 pixels movement
                is_stationary = True
        else:
            is_stationary = True
        
        if is_stationary:
            stationary_detections.append(d)

    if len(stationary_detections) >= 5:
        # Determine aspect ratio of stationary sequence
        avg_ratio = sum((det.bbox_height / det.bbox_width) if det.bbox_width > 0 else 1.5 for det in stationary_detections) / len(stationary_detections)
        
        # Check chair overlap
        overlaps_chair = False
        for d in stationary_detections:
            for chair in chair_detections:
                if chair.frame_number == d.frame_number:
                    # bounding box intersection check
                    x1 = max(d.bbox_x, chair.bbox_x)
                    y1 = max(d.bbox_y, chair.bbox_y)
                    x2 = min(d.bbox_x + d.bbox_width, chair.bbox_x + chair.bbox_width)
                    y2 = min(d.bbox_y + d.bbox_height, chair.bbox_y + chair.bbox_height)
                    if x2 > x1 and y2 > y1:
                        overlaps_chair = True
                        break
            if overlaps_chair:
                break

        start_det = stationary_detections[0]
        end_det = stationary_detections[-1]
        duration = max(0.0, end_det.timestamp_seconds - start_det.timestamp_seconds)

        if overlaps_chair or avg_ratio < 1.3:
            events.append({
                "zone_id": None,
                "start_frame": start_det.frame_number,
                "end_frame": end_det.frame_number,
                "start_timestamp": start_det.timestamp_seconds,
                "end_timestamp": end_det.timestamp_seconds,
                "duration": duration,
                "confidence": float(track.average_confidence),
                "event_type": "Sitting",
                "summary": f"Track #{track.track_id} was sitting down.",
                "search_text": f"track {track.track_id} sitting chair couch sofa bench sitting down resting",
                "reason": f"Track stationary for {duration:.1f}s. Overlapping chair: {overlaps_chair}. Aspect ratio: {avg_ratio:.2f}.",
                "threshold": 1.30,
                "metadata_json": {
                    "overlaps_chair": overlaps_chair,
                    "avg_aspect_ratio": round(avg_ratio, 2)
                }
            })
        else:
            events.append({
                "zone_id": None,
                "start_frame": start_det.frame_number,
                "end_frame": end_det.frame_number,
                "start_timestamp": start_det.timestamp_seconds,
                "end_timestamp": end_det.timestamp_seconds,
                "duration": duration,
                "confidence": float(track.average_confidence),
                "event_type": "Standing",
                "summary": f"Track #{track.track_id} was standing stationary.",
                "search_text": f"track {track.track_id} standing vertical waiting motionless upright",
                "reason": f"Track stationary for {duration:.1f}s with standing aspect ratio ({avg_ratio:.2f}).",
                "threshold": 1.30,
                "metadata_json": {
                    "avg_aspect_ratio": round(avg_ratio, 2)
                }
            })

    # 4. Zone Specific Analysis
    for zone in zones:
        polygon = [(float(pt[0]), float(pt[1])) for pt in zone.polygon_points]
        if len(polygon) < 3:
            continue
            
        # Compute frame-by-frame inside/outside status
        inside_status = []
        for pt in trajectory:
            is_inside = is_point_in_polygon(pt["center_x"], pt["center_y"], polygon)
            inside_status.append(is_inside)
            
        # Extract contiguous segments inside the zone
        segments = []
        in_segment = False
        start_idx = 0
        
        for idx, status in enumerate(inside_status):
            if status and not in_segment:
                in_segment = True
                start_idx = idx
            elif not status and in_segment:
                in_segment = False
                segments.append({
                    "start_idx": start_idx,
                    "end_idx": idx - 1,
                    "start_pt": trajectory[start_idx],
                    "end_pt": trajectory[idx - 1]
                })
        if in_segment:
            segments.append({
                "start_idx": start_idx,
                "end_idx": len(trajectory) - 1,
                "start_pt": trajectory[start_idx],
                "end_pt": trajectory[-1]
            })
            
        # Process inside segments
        for seg_idx, seg in enumerate(segments):
            start_pt = seg["start_pt"]
            end_pt = seg["end_pt"]
            duration = max(0.0, end_pt["timestamp"] - start_pt["timestamp"])
            
            # Event: Entered Zone
            events.append({
                "zone_id": zone.id,
                "start_frame": start_pt["frame_number"],
                "end_frame": start_pt["frame_number"],
                "start_timestamp": start_pt["timestamp"],
                "end_timestamp": start_pt["timestamp"],
                "duration": 0.0,
                "confidence": float(track.average_confidence),
                "event_type": "Entered Zone",
                "summary": f"Track #{track.track_id} entered zone {zone.name}.",
                "search_text": f"track {track.track_id} entered zone {zone.name} inside boundary",
                "reason": f"Track coordinate crossed inside zone polygon boundary.",
                "threshold": 0.0,
                "metadata_json": {
                    "zone_name": zone.name,
                    "zone_type": zone.zone_type,
                    "description": f"Track #{track.track_id} entered zone {zone.name}"
                }
            })
            
            # Event: Exited Zone
            events.append({
                "zone_id": zone.id,
                "start_frame": end_pt["frame_number"],
                "end_frame": end_pt["frame_number"],
                "start_timestamp": end_pt["timestamp"],
                "end_timestamp": end_pt["timestamp"],
                "duration": 0.0,
                "confidence": float(track.average_confidence),
                "event_type": "Exited Zone",
                "summary": f"Track #{track.track_id} exited zone {zone.name}.",
                "search_text": f"track {track.track_id} exited zone {zone.name} left boundary",
                "reason": f"Track coordinate crossed outside zone polygon boundary.",
                "threshold": 0.0,
                "metadata_json": {
                    "zone_name": zone.name,
                    "zone_type": zone.zone_type,
                    "description": f"Track #{track.track_id} exited zone {zone.name}"
                }
            })
            
            # Event: Loitering (dwell duration >= 10.0s)
            if duration >= 10.0:
                events.append({
                    "zone_id": zone.id,
                    "start_frame": start_pt["frame_number"],
                    "end_frame": end_pt["frame_number"],
                    "start_timestamp": start_pt["timestamp"],
                    "end_timestamp": end_pt["timestamp"],
                    "duration": duration,
                    "confidence": float(track.average_confidence),
                    "event_type": "Loitering",
                    "summary": f"Track #{track.track_id} loitered in zone {zone.name} for {duration:.1f}s.",
                    "search_text": f"track {track.track_id} loitered stayed in zone {zone.name} dwell time {duration:.1f}s",
                    "reason": f"Track remained inside {zone.name} for {duration:.1f} seconds.",
                    "threshold": 10.0,
                    "metadata_json": {
                        "zone_name": zone.name,
                        "zone_type": zone.zone_type,
                        "description": f"Track #{track.track_id} loitered in zone {zone.name} for {duration:.1f}s"
                    }
                })

            # Event: Long Dwell Time (dwell duration >= 20.0s)
            if duration >= 20.0:
                events.append({
                    "zone_id": zone.id,
                    "start_frame": start_pt["frame_number"],
                    "end_frame": end_pt["frame_number"],
                    "start_timestamp": start_pt["timestamp"],
                    "end_timestamp": end_pt["timestamp"],
                    "duration": duration,
                    "confidence": float(track.average_confidence),
                    "event_type": "Long Dwell Time",
                    "summary": f"Track #{track.track_id} stayed in zone {zone.name} for over 20 seconds.",
                    "search_text": f"track {track.track_id} long dwell time stay in zone {zone.name} exceeding 20s",
                    "reason": f"Dwell duration of {duration:.1f}s exceeded the long stay threshold.",
                    "threshold": 20.0,
                    "metadata_json": {
                        "zone_name": zone.name,
                        "zone_type": zone.zone_type,
                    }
                })

            # Event: Waiting (duration inside Checkout/Waiting Area >= 5.0s and speed is low)
            if zone.zone_type in ["Checkout", "Waiting Area"] and duration >= 5.0:
                events.append({
                    "zone_id": zone.id,
                    "start_frame": start_pt["frame_number"],
                    "end_frame": end_pt["frame_number"],
                    "start_timestamp": start_pt["timestamp"],
                    "end_timestamp": end_pt["timestamp"],
                    "duration": duration,
                    "confidence": float(track.average_confidence),
                    "event_type": "Waiting",
                    "summary": f"Track #{track.track_id} was waiting in checkout queue or waiting zone.",
                    "search_text": f"track {track.track_id} waiting queue line stay in checkout checkout line {zone.name}",
                    "reason": f"Track remained stationary inside waiting/checkout zone {zone.name} for {duration:.1f}s.",
                    "threshold": 5.0,
                    "metadata_json": {
                        "zone_name": zone.name,
                        "zone_type": zone.zone_type,
                    }
                })
                
            # Event: Restricted Area Entry
            if zone.zone_type == "Restricted":
                events.append({
                    "zone_id": zone.id,
                    "start_frame": start_pt["frame_number"],
                    "end_frame": end_pt["frame_number"],
                    "start_timestamp": start_pt["timestamp"],
                    "end_timestamp": end_pt["timestamp"],
                    "duration": duration,
                    "confidence": float(track.average_confidence),
                    "event_type": "Restricted Area Entry",
                    "summary": f"SECURITY ALERT: Track #{track.track_id} entered restricted area: {zone.name}.",
                    "search_text": f"security alarm alert restrict restricted area zone {zone.name} break-in trespass",
                    "reason": f"Trespassed into protected area boundary {zone.name}.",
                    "threshold": 0.0,
                    "metadata_json": {
                        "zone_name": zone.name,
                        "zone_type": zone.zone_type,
                        "description": f"SECURITY ALERT: Track #{track.track_id} entered restricted area: {zone.name}"
                    }
                })
                
            # Event: Shelf Visit (duration >= 3.0s)
            if zone.zone_type == "Shelf" and duration >= 3.0:
                events.append({
                    "zone_id": zone.id,
                    "start_frame": start_pt["frame_number"],
                    "end_frame": end_pt["frame_number"],
                    "start_timestamp": start_pt["timestamp"],
                    "end_timestamp": end_pt["timestamp"],
                    "duration": duration,
                    "confidence": float(track.average_confidence),
                    "event_type": "Shelf Visit",
                    "summary": f"Track #{track.track_id} interacted with shelf {zone.name}.",
                    "search_text": f"track {track.track_id} shelf visit shelf interaction product looking {zone.name}",
                    "reason": f"Dwelled near shelf products boundary for {duration:.1f}s.",
                    "threshold": 3.0,
                    "metadata_json": {
                        "zone_name": zone.name,
                        "zone_type": zone.zone_type,
                        "description": f"Track #{track.track_id} visited shelf {zone.name} for {duration:.1f}s"
                    }
                })
                
            # Event: Wrong Direction
            if zone.zone_type in ["Checkout", "Exit"]:
                dx = end_pt["center_x"] - start_pt["center_x"]
                if zone.zone_type == "Checkout" and dx > 150.0:
                    events.append({
                        "zone_id": zone.id,
                        "start_frame": start_pt["frame_number"],
                        "end_frame": end_pt["frame_number"],
                        "start_timestamp": start_pt["timestamp"],
                        "end_timestamp": end_pt["timestamp"],
                        "duration": duration,
                        "confidence": float(track.average_confidence),
                        "event_type": "Wrong Direction",
                        "summary": f"Track #{track.track_id} moved in the wrong direction through checkout.",
                        "search_text": f"track {track.track_id} wrong way direction reversed back checkout",
                        "reason": f"Vector displacement dx of {dx:.1f}px violates flow direction direction rules.",
                        "threshold": 150.0,
                        "metadata_json": {
                            "zone_name": zone.name,
                            "zone_type": zone.zone_type,
                            "dx": dx,
                            "description": f"Track #{track.track_id} moved in the wrong direction through checkout {zone.name}"
                        }
                    })

        # Event: Repeated Visits (multiple distinct entries)
        if len(segments) >= 2:
            first_pt = segments[0]["start_pt"]
            last_pt = segments[-1]["end_pt"]
            events.append({
                "zone_id": zone.id,
                "start_frame": first_pt["frame_number"],
                "end_frame": last_pt["frame_number"],
                "start_timestamp": first_pt["timestamp"],
                "end_timestamp": last_pt["timestamp"],
                "duration": max(0.0, last_pt["timestamp"] - first_pt["timestamp"]),
                "confidence": float(track.average_confidence),
                "event_type": "Repeated Visits",
                "summary": f"Track #{track.track_id} visited zone {zone.name} multiple times ({len(segments)} times).",
                "search_text": f"track {track.track_id} repeated visits revisit shelf zone {zone.name} multiple entries",
                "reason": f"Track completed {len(segments)} separate entries into {zone.name}.",
                "threshold": 2.0,
                "metadata_json": {
                    "zone_name": zone.name,
                    "zone_type": zone.zone_type,
                    "visit_count": len(segments),
                    "description": f"Track #{track.track_id} visited zone {zone.name} multiple times ({len(segments)} times)"
                }
            })
            
    # Event: Multi Zone Transition (crossing from Zone A to Zone B)
    visits = []
    for zone in zones:
        polygon = [(float(pt[0]), float(pt[1])) for pt in zone.polygon_points]
        if len(polygon) < 3:
            continue
        
        in_segment = False
        for idx, pt in enumerate(trajectory):
            is_inside = is_point_in_polygon(pt["center_x"], pt["center_y"], polygon)
            if is_inside and not in_segment:
                in_segment = True
                visits.append({
                    "zone_id": zone.id,
                    "zone_name": zone.name,
                    "zone_type": zone.zone_type,
                    "start_timestamp": pt["timestamp"],
                    "frame": pt["frame_number"]
                })
            elif not is_inside and in_segment:
                in_segment = False
                
    if len(visits) >= 2:
        visits.sort(key=lambda x: x["start_timestamp"])
        for i in range(1, len(visits)):
            v1 = visits[i-1]
            v2 = visits[i]
            if v1["zone_id"] != v2["zone_id"]:
                events.append({
                    "zone_id": v2["zone_id"],
                    "start_frame": v1["frame"],
                    "end_frame": v2["frame"],
                    "start_timestamp": v1["start_timestamp"],
                    "end_timestamp": v2["start_timestamp"],
                    "duration": max(0.0, v2["start_timestamp"] - v1["start_timestamp"]),
                    "confidence": float(track.average_confidence),
                    "event_type": "Multi Zone Transition",
                    "summary": f"Track #{track.track_id} transitioned from zone {v1['zone_name']} to {v2['zone_name']}.",
                    "search_text": f"track {track.track_id} transition multiple zones from {v1['zone_name']} to {v2['zone_name']}",
                    "reason": f"Track moved between different zone boundaries sequentially.",
                    "threshold": 1.0,
                    "metadata_json": {
                        "from_zone_name": v1["zone_name"],
                        "from_zone_type": v1["zone_type"],
                        "to_zone_name": v2["zone_name"],
                        "to_zone_type": v2["zone_type"],
                        "description": f"Track #{track.track_id} transitioned from zone {v1['zone_name']} to {v2['zone_name']}"
                    }
                })
                
    return events


def detect_global_events(tracks: List[Track], zones: List[Zone]) -> List[Dict[str, Any]]:
    """
    Compute frame-by-frame global events across all tracks:
    - Crowd Detection: >= 4 people on a single frame.
    - Group Formation: 2 or 3 tracks located within 150 pixels of each other for >= 15 frames.
    """
    global_events = []
    from collections import defaultdict
    
    # 1. Map all trajectory points to frame numbers
    frame_tracks = defaultdict(list)
    for track in tracks:
        for pt in track.trajectory:
            frame_tracks[pt["frame_number"]].append({
                "track_id": track.track_id,
                "center_x": pt["center_x"],
                "center_y": pt["center_y"],
                "timestamp": pt["timestamp"],
                "confidence": float(track.average_confidence)
            })
            
    # Track consecutive frames for Crowd
    crowd_frames = []
    group_track_frames = defaultdict(list)
    
    all_frames = sorted(frame_tracks.keys())
    for f in all_frames:
        pts = frame_tracks[f]
        
        # 1. Crowd Detection
        people_count = len(pts)
        if people_count >= 4:
            crowd_frames.append((f, people_count))
            
        # 2. Group Formation
        n = len(pts)
        for i in range(n):
            for j in range(i + 1, n):
                p1 = pts[i]
                p2 = pts[j]
                dist = math.sqrt((p1["center_x"] - p2["center_x"])**2 + (p1["center_y"] - p2["center_y"])**2)
                if dist < 150.0:
                    group_key = tuple(sorted([p1["track_id"], p2["track_id"]]))
                    group_track_frames[group_key].append({
                        "frame": f,
                        "timestamp": p1["timestamp"],
                        "confidence": min(p1["confidence"], p2["confidence"])
                    })
                    
    # Compile Crowd Detection events
    if crowd_frames:
        # Group consecutive crowd frames
        segments = []
        curr_seg = [crowd_frames[0]]
        for i in range(1, len(crowd_frames)):
            if crowd_frames[i][0] == crowd_frames[i-1][0] + 1:
                curr_seg.append(crowd_frames[i])
            else:
                segments.append(curr_seg)
                curr_seg = [crowd_frames[i]]
        segments.append(curr_seg)
        
        for seg in segments:
            if len(seg) >= 5:  # Crowd persists for at least 5 frames
                start_f, start_count = seg[0]
                end_f, end_count = seg[-1]
                
                # Fetch timestamps
                start_t = 0.0
                end_t = 0.0
                for pt in frame_tracks[start_f]:
                    start_t = pt["timestamp"]
                    break
                for pt in frame_tracks[end_f]:
                    end_t = pt["timestamp"]
                    break
                    
                duration = end_t - start_t
                max_count = max(x[1] for x in seg)
                
                global_events.append({
                    "zone_id": None,
                    "start_frame": start_f,
                    "end_frame": end_f,
                    "start_timestamp": start_t,
                    "end_timestamp": end_t,
                    "duration": duration,
                    "confidence": 0.90,
                    "event_type": "Crowd Detection",
                    "summary": f"Crowd of {max_count} people detected in surveillance area.",
                    "search_text": f"crowd detection group many people assembly crowd of {max_count} people",
                    "reason": f"Active track count reached {max_count} people simultaneously for {duration:.1f}s.",
                    "threshold": 4.0,
                    "metadata_json": {
                        "people_count": max_count,
                        "description": f"Crowd alert: {max_count} people assembled together."
                    }
                })
                
    # Compile Group Formation events
    for tracks_pair, seg_info in group_track_frames.items():
        if len(seg_info) >= 15:  # Group persists for at least 15 frames
            seg_info.sort(key=lambda x: x["frame"])
            sub_segs = []
            curr_seg = [seg_info[0]]
            for i in range(1, len(seg_info)):
                if seg_info[i]["frame"] == seg_info[i-1]["frame"] + 1:
                    curr_seg.append(seg_info[i])
                else:
                    sub_segs.append(curr_seg)
                    curr_seg = [seg_info[i]]
            sub_segs.append(curr_seg)
            
            for s in sub_segs:
                if len(s) >= 15:
                    start_item = s[0]
                    end_item = s[-1]
                    duration = end_item["timestamp"] - start_item["timestamp"]
                    
                    global_events.append({
                        "zone_id": None,
                        "start_frame": start_item["frame"],
                        "end_frame": end_item["frame"],
                        "start_timestamp": start_item["timestamp"],
                        "end_timestamp": end_item["timestamp"],
                        "duration": duration,
                        "confidence": float(sum(x["confidence"] for x in s) / len(s)),
                        "event_type": "Group Formation",
                        "summary": f"Tracks #{tracks_pair[0]} and #{tracks_pair[1]} formed a close interaction group.",
                        "search_text": f"group formation interaction tracks {tracks_pair[0]} {tracks_pair[1]} meeting together close proximity",
                        "reason": f"Distance between Track #{tracks_pair[0]} and #{tracks_pair[1]} was under 150 pixels for {duration:.1f}s.",
                        "threshold": 150.0,
                        "metadata_json": {
                            "track_ids": list(tracks_pair),
                            "description": f"Group interaction: Tracks #{tracks_pair[0]} and #{tracks_pair[1]} walking together."
                        }
                    })
                    
    return global_events
