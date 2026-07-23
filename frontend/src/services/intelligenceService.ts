import apiClient from "./api";

export interface ZoneDetails {
  id: string;
  video_id: string;
  name: string;
  zone_type: string;
  polygon_points: number[][];
  color: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ZoneCreateInput {
  video_id: string;
  name: string;
  zone_type: string;
  polygon_points: number[][];
  color: string;
  description?: string;
}

export interface BehaviorEvent {
  id: string;
  video_id: string;
  track_id: number;
  zone_id?: string;
  event_type: string;
  start_frame: number;
  end_frame: number;
  start_timestamp: number;
  end_timestamp: number;
  duration: number;
  confidence: number;
  metadata_json: Record<string, any>;
  created_at: string;
  zone?: ZoneDetails;
}

export interface BehaviorStatistics {
  total_events: number;
  loitering_count: number;
  security_alerts_count: number;
  event_type_counts: Record<string, number>;
  top_visited_zones: Array<{ zone_name: string; count: number }>;
  average_dwell_times: Array<{ zone_name: string; avg_dwell_seconds: number }>;
  // Timeline data included by the backend statistics endpoint
  timeline: Array<{
    event_type: string;
    zone_name: string;
    start_timestamp: number;
    duration: number;
    track_id: number;
  }>;
}

export interface RunBehaviorResponse {
  success: boolean;
  message: string;
  video_id: string;
  events_count: number;
}

export interface AISearchResponse {
  query: string;
  answer: string;
  source: string;
  openai_model: string;
}

export const intelligenceService = {
  // === ZONES API ===
  getZones: (videoId: string): Promise<ZoneDetails[]> => {
    return apiClient.get<ZoneDetails[]>(`/api/v1/zones/video/${videoId}`).then(r => r.data);
  },

  createZone: (input: ZoneCreateInput): Promise<ZoneDetails> => {
    return apiClient.post<ZoneDetails>(`/api/v1/zones/`, input).then(r => r.data);
  },

  updateZone: (zoneId: string, input: Partial<ZoneCreateInput>): Promise<ZoneDetails> => {
    return apiClient.put<ZoneDetails>(`/api/v1/zones/${zoneId}`, input).then(r => r.data);
  },

  deleteZone: (zoneId: string): Promise<void> => {
    return apiClient.delete(`/api/v1/zones/${zoneId}`).then(() => {});
  },

  // === BEHAVIOR API ===
  runBehaviorDetection: (videoId: string): Promise<RunBehaviorResponse> => {
    return apiClient.post<RunBehaviorResponse>(`/api/v1/behavior/run/${videoId}`).then(r => r.data);
  },

  getBehaviorEvents: (videoId: string): Promise<BehaviorEvent[]> => {
    return apiClient.get<BehaviorEvent[]>(`/api/v1/behavior/results/${videoId}`).then(r => r.data);
  },

  getBehaviorStatistics: (videoId: string): Promise<BehaviorStatistics> => {
    return apiClient.get<BehaviorStatistics>(`/api/v1/behavior/statistics/${videoId}`).then(r => r.data);
  },

  // === AI SEARCH API ===
  searchAI: (query: string, videoId?: string): Promise<AISearchResponse> => {
    return apiClient.post<AISearchResponse>(`/api/v1/ai/search`, { query, video_id: videoId }).then(r => r.data);
  },

  // === REPORTS API ===
  getReportDownloadUrl: (videoId: string, format: "pdf" | "csv", reportType: "incident" | "daily" | "summary"): string => {
    const baseUrl = apiClient.defaults.baseURL || "http://localhost:8000";
    return `${baseUrl}/api/v1/reports/generate/${videoId}?format=${format}&report_type=${reportType}`;
  }
};

export default intelligenceService;
