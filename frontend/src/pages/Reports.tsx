import React, { useEffect, useState, useCallback } from "react";
import { 
  FileText, 
  Download, 
  Loader2, 
  RefreshCw, 
  Calendar, 
  Video as VideoIcon, 
  CheckCircle2
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import LayoutWrapper from "@/components/LayoutWrapper";
import Spinner from "@/components/Spinner";
import Button from "@/components/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import videoService, { VideoDetails } from "@/services/videoService";
import reportService, { ReportHistoryItem } from "@/services/reportService";
import { useToast } from "@/contexts/ToastContext";

const Reports: React.FC = () => {
  const toast = useToast();
  const [videos, setVideos] = useState<VideoDetails[]>([]);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Form State
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [reportType, setReportType] = useState<string>("incident");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");

  const loadData = useCallback(async () => {
    try {
      setLoadingVideos(true);
      setLoadingHistory(true);
      
      const videoList = await videoService.listVideos({ page: 1, size: 100 });
      setVideos(videoList.items);
      if (videoList.items.length > 0) {
        setSelectedVideoId(videoList.items[0].id);
      }

      const historyData = await reportService.getHistory();
      setHistory(historyData);
    } catch (err: any) {
      toast.error("Failed to load operations data", err.message);
    } finally {
      setLoadingVideos(false);
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideoId) {
      toast.warning("Validation Error", "Please select a video asset to run audit.");
      return;
    }

    setGenerating(true);
    try {
      const { data, filename } = await reportService.generateReport(selectedVideoId, reportType, format);
      
      // Trigger browser download
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Report Generated Successfully", `Downloaded: ${filename}`);
      
      // Refresh report history
      const historyData = await reportService.getHistory();
      setHistory(historyData);
    } catch (err: any) {
      toast.error("Report Generation Failed", err.message || "An error occurred during ReportLab compilation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadExisting = async (item: ReportHistoryItem) => {
    try {
      toast.info("Downloading Report", `Fetching ${item.filename}...`);
      await reportService.downloadReport(item.id, item.filename);
    } catch (err: any) {
      toast.error("Download Failed", err.message);
    }
  };

  function formatTimestamp(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  return (
    <LayoutWrapper>
      <div className="flex items-start justify-between mb-4">
        <PageHeader
          title="Surveillance Audit Reports"
          subtitle="Compile structural zone metrics, target logs, and behavior incidents into CSV/PDF"
        />
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          disabled={loadingHistory || loadingVideos}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${(loadingHistory || loadingVideos) ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Generate Report Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-primary" />
                Compile Audit Report
              </CardTitle>
              <CardDescription>
                Select parameters to export video tracking summaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingVideos ? (
                <div className="py-8 flex justify-center">
                  <Spinner className="h-6 w-6 text-primary" />
                </div>
              ) : videos.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  <VideoIcon className="h-8 w-8 mx-auto opacity-30 mb-2" />
                  <p className="font-semibold">No Video Assets Available</p>
                  <p className="mt-1">Upload a video to make reports exportable.</p>
                </div>
              ) : (
                <form onSubmit={handleGenerate} className="space-y-4">
                  {/* Select Video */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">
                      Target Video File
                    </label>
                    <select
                      value={selectedVideoId}
                      onChange={(e) => setSelectedVideoId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    >
                      {videos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.original_filename} ({v.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Report Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">
                      Report Type Focus
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="incident">Incident Review (Restricted Zones/Violations)</option>
                      <option value="summary">Summary Report (Complete Zones Dwells & Tracks)</option>
                      <option value="daily">Daily Log (Detailed event metrics chronologically)</option>
                    </select>
                  </div>

                  {/* Format Choice */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">
                      Export Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormat("pdf")}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                          format === "pdf"
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        PDF Document
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormat("csv")}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                          format === "csv"
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        CSV Spreadsheet
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={generating}
                    className="w-full h-10 flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Document...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Generate & Download
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Report History */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-primary" />
                Audit Logs & History
              </CardTitle>
              <CardDescription>
                A dynamic audit trail of previously compiled surveillance reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 border-t border-border flex flex-col justify-between">
              {loadingHistory ? (
                <div className="py-24 flex justify-center items-center flex-1">
                  <Spinner className="h-8 w-8 text-primary" />
                </div>
              ) : history.length === 0 ? (
                <div className="py-24 text-center text-muted-foreground flex-1 flex flex-col justify-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No reports generated yet</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    Select a video asset and parameters to compile your first surveillance audit.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="px-5 py-3">Report Details</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Format</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Generated Time</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-foreground truncate max-w-xs">
                              {item.filename}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-xs">
                              Source: {item.video_name}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 capitalize font-medium">
                            {item.report_type}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              item.format === "pdf" 
                                ? "bg-red-500/10 text-red-500" 
                                : "bg-emerald-500/10 text-emerald-500"
                            }`}>
                              {item.format}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground font-medium">
                            {formatTimestamp(item.created_at)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => handleDownloadExisting(item)}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all"
                              title="Download report file"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutWrapper>
  );
};

export default Reports;
