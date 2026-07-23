import apiClient from "./api";

export interface ReportHistoryItem {
  id: string;
  video_id: string;
  report_type: "incident" | "daily" | "summary";
  format: "pdf" | "csv";
  filename: string;
  status: string;
  created_at: string;
  video_name: string;
}

const reportService = {
  /**
   * Fetch complete history of logged generated reports.
   */
  getHistory: async (): Promise<ReportHistoryItem[]> => {
    const response = await apiClient.get<ReportHistoryItem[]>("/api/v1/reports/history");
    return response.data;
  },

  /**
   * Trigger report generation for a video, download directly as a blob.
   */
  generateReport: async (
    videoId: string,
    reportType: string,
    format: "pdf" | "csv"
  ): Promise<{ data: Blob; filename: string }> => {
    const response = await apiClient.get<Blob>(
      `/api/v1/reports/generate/${videoId}`,
      {
        params: { format, report_type: reportType },
        responseType: "blob",
      }
    );
    const contentDisposition = response.headers["content-disposition"];
    let filename = `SentralQ_${reportType}_Report_${videoId}.${format}`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=(.+)/);
      if (match && match[1]) filename = match[1].replace(/['"]/g, "");
    }
    return { data: response.data, filename };
  },

  /**
   * Re-download an existing report from database history.
   */
  downloadReport: async (reportId: string, filename: string): Promise<void> => {
    const response = await apiClient.get<Blob>(`/api/v1/reports/${reportId}/download`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default reportService;
