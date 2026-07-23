import apiClient from "./api";

export interface AISearchResponse {
  query: string;
  answer: string;
  source: string;
  grok_model: string;
}

const aiSearchService = {
  /**
   * Run natural language search query.
   */
  search: async (query: string, videoId?: string): Promise<AISearchResponse> => {
    const response = await apiClient.post<AISearchResponse>("/api/v1/ai/search", {
      query,
      video_id: videoId || null,
    });
    return response.data;
  },
};

export default aiSearchService;
