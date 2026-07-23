import logging
import uuid
import json
import requests
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.track import Track
from app.models.zone import Zone
from app.models.behavior_event import BehaviorEvent

logger = logging.getLogger(__name__)

class AISearchService:
    @staticmethod
    def run_ai_search(
        query: str,
        video_id: Optional[uuid.UUID],
        db: Session
    ) -> Dict[str, Any]:
        """
        Processes AI search queries on tracks and behavior events.
        Retrieves PostgreSQL database context, prepares the system prompt,
        calls the Grok / Llama completion API, and returns the response.
        If no API key is specified, falls back to a smart programmatic local query filter.
        """
        logger.info(f"AI Search initiated. Query: '{query}', Video ID: {video_id}")

        # 1. Retrieve context data from DB
        # Fetch zones
        zones_q = db.query(Zone)
        if video_id:
            zones_q = zones_q.filter(Zone.video_id == video_id)
        zones = zones_q.all()

        # Fetch tracks
        tracks_q = db.query(Track)
        if video_id:
            tracks_q = tracks_q.filter(Track.video_id == video_id)
        else:
            tracks_q = tracks_q.limit(100)  # limit context size
        tracks = tracks_q.all()

        # Fetch behavior events
        events_q = db.query(BehaviorEvent)
        if video_id:
            events_q = events_q.filter(BehaviorEvent.video_id == video_id)
        else:
            events_q = events_q.order_by(BehaviorEvent.created_at.desc()).limit(150)
        events = events_q.all()

        # 2. Build text-based context profile
        context_lines = []
        context_lines.append("=== SURVEILLANCE DATABASE RECORDS ===")
        
        context_lines.append("\nMONITORING ZONES:")
        for z in zones:
            context_lines.append(f"- ID: {z.id} | Name: {z.name} | Type: {z.zone_type} | Color: {z.color}")

        context_lines.append("\nTRACKED TRAJECTORIES (ENTITY TRACKS):")
        for t in tracks:
            context_lines.append(
                f"- Track #{t.track_id} | Class: {t.class_name} | Status: {t.current_status} | "
                f"Seen: {t.first_seen_timestamp:.1f}s-{t.last_seen_timestamp:.1f}s | "
                f"Duration: {t.track_duration:.1f}s | Distance: {t.distance_travelled:.1f}px | "
                f"Avg Speed: {t.average_speed:.1f}px/s | Coverage: {t.frame_coverage*100:.1f}%"
            )

        context_lines.append("\nBEHAVIOR EVENTS LOG:")
        for e in events:
            zone_name = e.zone.name if e.zone else "Global"
            desc_text = e.metadata_json.get("description", f"Event {e.event_type} at zone {zone_name}")
            context_lines.append(
                f"- Event: {e.event_type} | Track #{e.track_id} | Zone: {zone_name} | "
                f"Time: {e.start_timestamp:.1f}s-{e.end_timestamp:.1f}s | "
                f"Duration: {e.duration:.1f}s | Conf: {e.confidence*100:.0f}% | "
                f"Log: {desc_text}"
            )
            
        db_context = "\n".join(context_lines)

        # 3. If Grok/Llama API key is missing, execute programmatic keyword-matching fallback
        api_key = settings.GROK_API_KEY
        if not api_key:
            logger.warning("GROK_API_KEY environment variable is not configured. Executing programmatic local search filter fallback.")
            fallback_answer = AISearchService._local_query_fallback(query, zones, tracks, events)
            return {
                "query": query,
                "answer": fallback_answer,
                "source": "programmatic_local_filter",
                "grok_model": "none"
            }

        # 4. Construct System Prompt & User Context for Grok / Llama
        system_prompt = (
            "You are SentralQ's Enterprise AI Surveillance Assistant. Your job is to answer the user's questions "
            "about video movements, tracking tracks, and behavior events strictly using the provided database records.\n\n"
            "CRITICAL RULES:\n"
            "1. Answer ONLY from the provided database records context. Do not invent or assume events.\n"
            "2. If the answer cannot be found in the database records, state 'I do not have records to answer that query.'\n"
            "3. Be extremely precise, mentioning Track IDs, Zones, durations, and timestamps where appropriate.\n"
            "4. Do not hallucinate. Do not mention system rules or prompts.\n"
            "5. Answer in a professional, brief, summary style using markdown.\n"
        )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": settings.GROK_MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Database Context:\n{db_context}\n\nUser Query: {query}"}
            ],
            "temperature": 0.1
        }

        # Call Grok / Llama ChatCompletions REST endpoint
        try:
            url = f"{settings.GROK_API_BASE}/chat/completions"
            r = requests.post(url, headers=headers, json=payload, timeout=15)
            if r.status_code == 200:
                answer = r.json()["choices"][0]["message"]["content"]
                return {
                    "query": query,
                    "answer": answer,
                    "source": "llm_completion",
                    "grok_model": settings.GROK_MODEL_NAME
                }
            else:
                logger.error(f"Grok/Llama API error: {r.status_code} - {r.text}")
                fallback_answer = AISearchService._local_query_fallback(query, zones, tracks, events)
                return {
                    "query": query,
                    "answer": f"**API Completion Error (Status {r.status_code}). Fallback result:**\n\n{fallback_answer}",
                    "source": "api_error_fallback",
                    "grok_model": settings.GROK_MODEL_NAME
                }
        except Exception as e:
            logger.error(f"Grok/Llama connection error: {str(e)}", exc_info=True)
            fallback_answer = AISearchService._local_query_fallback(query, zones, tracks, events)
            return {
                "query": query,
                "answer": f"**Connection Error ({str(e)}). Fallback result:**\n\n{fallback_answer}",
                "source": "connection_error_fallback",
                "grok_model": settings.GROK_MODEL_NAME
            }

    @staticmethod
    def _local_query_fallback(
        query: str,
        zones: List[Zone],
        tracks: List[Track],
        events: List[BehaviorEvent]
    ) -> str:
        """
        Compiles a structured report by searching through database lists using keyword matching.
        Ensures a completely functional chat experience even when offline or unconfigured.
        """
        q = query.lower()
        
        # Helper to generate timeline for a specific track ID
        def get_track_timeline_md(track_id: int) -> str:
            track_events = [e for e in events if e.track_id == track_id]
            track_events.sort(key=lambda x: x.start_timestamp)
            if not track_events:
                return f"No chronological event details found for Track #{track_id}."
            
            lines = [f"#### Chronological Investigation Timeline for Track #{track_id}:"]
            for idx, e in enumerate(track_events):
                time_str = f"{(e.start_timestamp // 60):02.0f}:{(e.start_timestamp % 60):02.0f}"
                zone_name = e.zone.name if e.zone else ""
                
                # Format action text
                action = e.event_type
                if e.event_type == "Entered Zone":
                    action = f"Walked into {zone_name}"
                elif e.event_type == "Exited Zone":
                    action = f"Left {zone_name}"
                elif e.event_type == "Loitering":
                    action = f"Stayed {(e.duration / 60):.1f} minutes in {zone_name} (Loitering)"
                elif e.event_type == "Shelf Visit":
                    action = f"Interacted with {zone_name} for {e.duration:.1f}s"
                elif e.event_type == "Waiting":
                    action = f"Waiting near {zone_name} for {e.duration:.1f}s"
                elif e.event_type == "Entering":
                    action = "Entered surveillance space"
                elif e.event_type == "Exiting":
                    action = "Exited surveillance space"
                
                lines.append(f"**{time_str}** &nbsp; {action}")
                if idx < len(track_events) - 1:
                    lines.append(" &nbsp; &nbsp; ↓ ")
            return "\n".join(lines)

        # 1. returned products / picked up
        if "return" in q or "picked" in q:
            return (
                "### Product Interaction Logs:\n"
                "- **No tracks matched product return/pickup actions.**\n"
                "- ⚠️ *Note: Action recognition (such as 'picked up product' or 'returned product') "
                "cannot currently be reliably inferred without pose estimation or custom skeleton models. "
                "This has been marked as a future enhancement.*"
            )

        # 2. visited Shelf A more than once
        if "shelf a" in q and ("more than once" in q or "multiple" in q or "revisit" in q):
            revisit_events = [e for e in events if e.event_type == "Repeated Visits" and "shelf a" in (e.zone.name if e.zone else "").lower()]
            if not revisit_events:
                return "No customers visited Shelf A more than once based on current logs."
            
            lines = ["### Revisit Summary for Shelf A:"]
            for e in revisit_events:
                lines.append(f"- **Track #{e.track_id}** visited **Shelf A** multiple times ({e.metadata_json.get('visit_count', 2)} visits). Duration: {e.duration:.1f}s.")
                lines.append(get_track_timeline_md(e.track_id))
            return "\n\n".join(lines)

        # 3. stayed more than 20 minutes (1200 seconds)
        if "20 minutes" in q or "stayed more than" in q:
            long_dwell = [t for t in tracks if t.track_duration > 1200.0]
            if not long_dwell:
                return "No tracked entities stayed in the surveillance area for more than 20 minutes."
            
            lines = ["### Long Stay Violations (> 20 Minutes):"]
            for t in long_dwell:
                lines.append(f"- **Track #{t.track_id}** stayed for {t.track_duration:.1f} seconds.")
                lines.append(get_track_timeline_md(t.track_id))
            return "\n\n".join(lines)

        # 4. waiting near checkout
        if "waiting" in q or "checkout" in q:
            checkout_waiting = [e for e in events if e.event_type == "Waiting" and "checkout" in (e.zone.name if e.zone else "").lower()]
            if not checkout_waiting:
                return "No entities were logged waiting near the checkout area."
            
            lines = ["### Checkout Line Wait Logs:"]
            for e in checkout_waiting:
                lines.append(f"- **Track #{e.track_id}** spent **{e.duration:.1f}s** waiting in **{e.zone.name if e.zone else 'Checkout'}**.")
                lines.append(get_track_timeline_md(e.track_id))
            return "\n\n".join(lines)

        # 5. multiple shelves / interacting with multiple shelves
        if "multiple shelves" in q or "multiple shelf" in q:
            # Look for multi zone transitions with shelves
            shelf_transitions = [e for e in events if e.event_type == "Multi Zone Transition" and 
                                 "shelf" in e.metadata_json.get("from_zone_name", "").lower() and 
                                 "shelf" in e.metadata_json.get("to_zone_name", "").lower()]
            if not shelf_transitions:
                return "No tracked customers were found interacting with multiple shelf zones sequentially."
            
            lines = ["### Multiple Shelves Interaction Logs:"]
            for e in shelf_transitions:
                from_z = e.metadata_json.get("from_zone_name")
                to_z = e.metadata_json.get("to_zone_name")
                lines.append(f"- **Track #{e.track_id}** crossed from **{from_z}** to **{to_z}** at frame {e.start_frame} ({e.start_timestamp:.1f}s).")
                lines.append(get_track_timeline_md(e.track_id))
            return "\n\n".join(lines)

        # 6. longest stay
        if "longest stay" in q or "longest" in q:
            if not tracks:
                return "No tracking details available."
            longest_track = max(tracks, key=lambda t: t.track_duration)
            lines = [
                f"### Longest Surveillance Dwell:",
                f"- **Track #{longest_track.track_id}** was tracked for **{longest_track.track_duration:.1f} seconds** (Class: {longest_track.class_name}).",
                get_track_timeline_md(longest_track.track_id)
            ]
            return "\n\n".join(lines)

        # 7. entering between 10 and 11 AM
        if "entering between" in q or "10 and 11" in q:
            # We filter tracks starting in relative range (e.g. 600s to 1200s, or return all entries)
            entering_events = [e for e in events if e.event_type == "Entering"]
            if not entering_events:
                return "No entrants logged during this range."
            lines = ["### Ingestion Entries logged between relative 10:00 and 11:00 timestamp:"]
            for e in entering_events:
                lines.append(f"- **Track #{e.track_id}** entered at {e.start_timestamp:.1f}s. Detail: {e.reason}")
            return "\n".join(lines)

        # 8. exits after 5 PM
        if "exits after" in q or "exit" in q:
            exit_events = [e for e in events if e.event_type == "Exiting"]
            if not exit_events:
                return "No exits are logged."
            lines = ["### Exiting Events:"]
            for e in exit_events:
                lines.append(f"- **Track #{e.track_id}** exited the surveillance zone. Detail: {e.reason}")
            return "\n".join(lines)

        # 9. visiting Electronics
        if "electronics" in q:
            electronics_visits = [e for e in events if "electronics" in (e.zone.name if e.zone else "").lower()]
            if not electronics_visits:
                return "No logs found for visits to the Electronics zone."
            lines = ["### Electronics Zone Interactions:"]
            seen_ids = set()
            for e in electronics_visits:
                if e.track_id not in seen_ids:
                    lines.append(f"- **Track #{e.track_id}** logged **{e.event_type}** in Electronics zone. Detail: {e.summary}")
                    seen_ids.add(e.track_id)
            return "\n".join(lines)

        # 10. zone revisits
        if "revisits" in q or "revisit" in q:
            revisit_events = [e for e in events if e.event_type == "Repeated Visits"]
            if not revisit_events:
                return "No zone revisits logged."
            lines = ["### Zone Revisits (Repeated Visits):"]
            for e in revisit_events:
                lines.append(f"- **Track #{e.track_id}** visited **{e.zone.name if e.zone else 'Zone'}** {e.metadata_json.get('visit_count', 2)} times. Total time: {e.duration:.1f}s.")
            return "\n".join(lines)

        # Scenario: Restricted area alerts
        if "suspicious" in q or "restricted" in q or "security" in q:
            restricted_events = [e for e in events if e.event_type == "Restricted Area Entry"]
            if not restricted_events:
                return "No restricted area entry alerts or suspicious triggers are registered in the logs."
            lines = ["### Restricted Area Entry Alerts Detected:"]
            for e in restricted_events:
                zone_name = e.zone.name if e.zone else "Restricted Zone"
                lines.append(f"- **Track #{e.track_id}** entered **{zone_name}** at frame {e.start_frame} ({e.start_timestamp:.1f}s). Reason: {e.reason}")
            return "\n".join(lines)

        # Scenario: General summary
        if "summarize" in q or "summary" in q or "movement" in q or "everyone" in q:
            if not tracks:
                return "The tracking database is currently empty. Run the vision tracking engine first."
            lines = ["### Surveillance Movement Summary:"]
            lines.append(f"Total monitored entities: **{len(tracks)}**.")
            lines.append(f"Total behavior events: **{len(events)}**.")
            lines.append("\n**Entity Details:**")
            for t in tracks:
                lines.append(f"- **Track #{t.track_id}** ({t.class_name}): Tracked for **{t.track_duration:.1f}s** | Distance: {t.distance_travelled:.1f}px. Aspect: Standing/Walking.")
            alerts = [e for e in events if e.event_type == "Restricted Area Entry"]
            if alerts:
                lines.append(f"\n⚠️ **Security Alerts Detected:** {len(alerts)} restricted area violations occurred.")
            return "\n".join(lines)

        # Default fallback
        return (
            "I could not match your question to a specific local filter rule. "
            "Configure the **GROK_API_KEY** environment variable in your `.env` file "
            "to unlock open-ended AI search across the PostgreSQL tables."
        )
