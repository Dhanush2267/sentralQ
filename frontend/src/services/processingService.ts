import apiClient from "./api";

export interface ProcessingJobDetails {
  id: string;
  video_id: string;
  status: string;
  
  queued: string | null;
  processing: string | null;
  completed: string | null;
  failed: string | null;
  
  progress_percentage: number;
  current_stage: string;
  total_frames: number;
  processed_frames: number;
  
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  
  created_at: string;
  updated_at: string;
}

export const processingService = {
  /**
   * Trigger Vision AI Processing for a specific video asset.
   */
  startProcessing: (videoId: string): Promise<ProcessingJobDetails> => {
    return apiClient.post<ProcessingJobDetails>(`/api/v1/processing/start/${videoId}`).then(r => r.data);
  },

  /**
   * Fetch processing job metrics, progress, and stage details.
   */
  getStatus: (videoId: string): Promise<ProcessingJobDetails> => {
    return apiClient.get<ProcessingJobDetails>(`/api/v1/processing/status/${videoId}`).then(r => r.data);
  },

  /**
   * Restart processing for a failed vision job.
   */
  retryProcessing: (videoId: string): Promise<ProcessingJobDetails> => {
    return apiClient.post<ProcessingJobDetails>(`/api/v1/processing/retry/${videoId}`).then(r => r.data);
  },

  /**
   * Cancel active (queued/processing) vision pipeline task.
   */
  cancelProcessing: (videoId: string): Promise<ProcessingJobDetails> => {
    return apiClient.delete<ProcessingJobDetails>(`/api/v1/processing/cancel/${videoId}`).then(r => r.data);
  },
};

export default processingService;
