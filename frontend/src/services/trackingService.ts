import apiClient from "./api";

export interface TrajectoryPoint {
  frame_number: number;
  center_x: number;
  center_y: number;
  timestamp: number;
}

export interface TrackDetails {
  id: string;
  video_id: string;
  processing_job_id: string;
  track_id: number;
  class_name: string;
  first_frame: number;
  last_frame: number;
  first_seen_timestamp: number;
  last_seen_timestamp: number;
  total_frames: number;
  average_confidence: number;
  current_status: string;
  distance_travelled: number;
  average_speed: number;
  track_duration: number;
  frame_coverage: number;
  trajectory: TrajectoryPoint[];
  created_at: string;
  updated_at: string;
}

export interface TrackingStatistics {
  total_tracked_people: number;
  average_tracking_duration: number;
  longest_track_duration: number;
  shortest_track_duration: number;
  average_movement_distance: number;
  track_loss_count: number;
  total_tracks: number;
  active_tracks: number;
  completed_tracks: number;
  average_track_length_frames: number;
}

export interface RunTrackingResponse {
  success: boolean;
  message: string;
  video_id: string;
  tracks_count: number;
}

export const trackingService = {
  /**
   * Run ByteTrack tracking on detection results of a video
   */
  runTracking: (
    videoId: string,
    params?: {
      track_buffer?: number;
      match_threshold?: number;
      score_threshold?: number;
      minimum_box_area?: number;
    }
  ): Promise<RunTrackingResponse> => {
    return apiClient.post<RunTrackingResponse>(`/api/v1/tracking/run/${videoId}`, null, { params }).then(r => r.data);
  },

  /**
   * Get all tracks for a video
   */
  getTracks: (videoId: string): Promise<TrackDetails[]> => {
    return apiClient.get<TrackDetails[]>(`/api/v1/tracking/results/${videoId}`).then(r => r.data);
  },

  /**
   * Get trajectory timeline points for a track
   */
  getTimeline: (trackId: string): Promise<TrajectoryPoint[]> => {
    return apiClient.get<TrajectoryPoint[]>(`/api/v1/tracking/timeline/${trackId}`).then(r => r.data);
  },

  /**
   * Fetch tracking statistics for a video asset
   */
  getStatistics: (videoId: string): Promise<TrackingStatistics> => {
    return apiClient.get<TrackingStatistics>(`/api/v1/tracking/statistics/${videoId}`).then(r => r.data);
  }
};

export default trackingService;
