/// <reference types="vite/client" />
import apiClient from "./api";
import type { AxiosProgressEvent, CancelTokenSource } from "axios";

import type { ProcessingJobDetails } from "./processingService";

export interface VideoDetails {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string | null;
  file_size: number;
  duration: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  video_format: string | null;
  status: string;
  upload_time: string;
  created_at: string;
  updated_at: string;
  metadata_json: Record<string, any> | null;
  processing_stage: string;
  deleted: boolean;
  latest_processing_job?: ProcessingJobDetails | null;
}

export interface VideoListResponse {
  items: VideoDetails[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface UploadResponse {
  id: string;
  filename: string;
  status: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const videoService = {
  /**
   * Upload a video with progress monitoring and cancel support.
   */
  uploadVideo: (
    file: File,
    onProgress: (progress: number) => void,
    cancelTokenSource: CancelTokenSource
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient.post<UploadResponse>("/api/v1/videos/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      cancelToken: cancelTokenSource.token,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        } else {
          onProgress(0);
        }
      },
    }).then(response => response.data);
  },

  /**
   * List videos with pagination, filtering, searching, and sorting.
   */
  listVideos: (params: {
    page: number;
    size: number;
    search?: string;
    status?: string;
    sort_by?: string;
    sort_order?: string;
  }): Promise<VideoListResponse> => {
    return apiClient.get<VideoListResponse>("/api/v1/videos", {
      params: {
        page: params.page,
        size: params.size,
        search: params.search || undefined,
        status: params.status || undefined,
        sort_by: params.sort_by || undefined,
        sort_order: params.sort_order || undefined,
      },
    }).then(response => response.data);
  },

  /**
   * Fetch complete technical details of a video.
   */
  getVideoDetails: (id: string): Promise<VideoDetails> => {
    return apiClient.get<VideoDetails>(`/api/v1/videos/${id}`).then(response => response.data);
  },

  /**
   * Soft-delete a video asset.
   */
  deleteVideo: (id: string): Promise<{ success: boolean; message: string; physical_deleted: boolean }> => {
    return apiClient.delete(`/api/v1/videos/${id}`).then(response => response.data);
  },

  /**
   * Get direct download endpoint URL.
   */
  getDownloadUrl: (id: string): string => {
    return `${API_BASE_URL}/api/v1/videos/${id}/download`;
  },

  /**
   * Get direct download endpoint URL for the annotated video.
   */
  getAnnotatedDownloadUrl: (id: string): string => {
    return `${API_BASE_URL}/api/v1/videos/${id}/download/annotated`;
  },


  /**
   * Get Browser range-streaming endpoint URL.
   */
  getStreamUrl: (id: string): string => {
    return `${API_BASE_URL}/api/v1/videos/${id}/stream`;
  },

  /**
   * Get thumbnail download endpoint URL.
   */
  getThumbnailUrl: (id: string): string => {
    return `${API_BASE_URL}/api/v1/videos/${id}/thumbnail`;
  },
};

export default videoService;
