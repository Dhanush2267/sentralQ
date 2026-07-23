import apiClient from "./api";

export interface DetectionResult {
  id: string;
  video_id: string;
  processing_job_id: string;
  frame_number: number;
  timestamp_seconds: number;
  class_name: string;
  confidence: number;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  track_id: number | null;  // Track ID assigned by ByteTrack (null if not tracked)
  model_name: string;
  model_version: string;
  created_at: string;
}

export interface DetectionStatistics {
  people: number;
  bags: number;
  phones: number;
  bottles: number;
  chairs: number;
  cups: number;
  others: Record<string, number>;
  total_detections: number;
}

export interface RunDetectionResponse {
  success: boolean;
  message: string;
  video_id: string;
  detections_count: number;
}

export const detectionService = {
  /**
   * Run YOLO detection manually on already extracted frames
   */
  runDetection: (videoId: string): Promise<RunDetectionResponse> => {
    return apiClient.post<RunDetectionResponse>(`/api/v1/detection/run/${videoId}`).then(r => r.data);
  },

  /**
   * Retrieve all detections for a video
   */
  getDetections: (videoId: string): Promise<DetectionResult[]> => {
    return apiClient.get<DetectionResult[]>(`/api/v1/detection/results/${videoId}`).then(r => r.data);
  },

  /**
   * Fetch object detection statistics (e.g. people, bags, phones, etc.)
   */
  getStatistics: (videoId: string): Promise<DetectionStatistics> => {
    return apiClient.get<DetectionStatistics>(`/api/v1/detection/statistics/${videoId}`).then(r => r.data);
  },

  /**
   * Generate absolute URL path for streaming an annotated overlay frame image.
   */
  getFrameUrl: (videoId: string, frameNumber: number): string => {
    const baseURL = apiClient.defaults.baseURL || "http://localhost:8000";
    // Do NOT append timestamp here — browser caching is desirable for frame images
    // and re-fetching on every render causes excessive network traffic.
    return `${baseURL}/api/v1/detection/frame/${videoId}/${frameNumber}`;
  }
};

export default detectionService;
