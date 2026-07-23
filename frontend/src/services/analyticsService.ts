import apiClient from "./api";

export interface ZoneDwellTime {
  zone_name: string;
  avg_dwell_seconds: number;
}

export interface EventDistribution {
  event_type: string;
  count: number;
}

export interface DailyActivity {
  date: string;
  detections: number;
  tracks: number;
  events: number;
}

export interface AnalyticsOverview {
  total_videos: number;
  total_detections: number;
  total_tracks: number;
  total_events: number;
  security_alerts: number;
  most_visited_zone: string;
  avg_dwell_time: number;
  zone_dwell_times: ZoneDwellTime[];
  event_distribution: EventDistribution[];
  daily_activity: DailyActivity[];
  recent_activity: Array<{
    id: string;
    video_id: string;
    video_name: string;
    track_id: number;
    zone_name: string;
    event_type: string;
    duration: number;
    created_at: string;
  }>;
}

const analyticsService = {
  /**
   * Fetch aggregated analytics metrics (supports video filtering).
   */
  getOverview: async (videoId?: string): Promise<AnalyticsOverview> => {
    const response = await apiClient.get<AnalyticsOverview>("/api/v1/analytics/overview", {
      params: videoId ? { video_id: videoId } : {},
    });
    return response.data;
  },
};

export default analyticsService;
