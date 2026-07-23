import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Grid,
  List,
  Play,
  Download,
  Trash2,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileVideo,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import LayoutWrapper from "@/components/LayoutWrapper";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import videoService, { VideoDetails } from "@/services/videoService";

const Videos: React.FC = () => {
  const navigate = useNavigate();
  
  // State management
  const [videos, setVideos] = useState<VideoDetails[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(9);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("upload_time");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  
  // Layout views: 'grid' or 'list'
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Deletion confirm modal / flag
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch videos
  const fetchVideos = async () => {
    setLoading(true);
    try {
      const data = await videoService.listVideos({
        page,
        size: pageSize,
        search: searchTerm,
        status: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setVideos(data.items);
      setTotalCount(data.total);
      setTotalPages(data.pages);
    } catch (err: any) {
      console.error("Failed to load videos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [page, searchTerm, statusFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchTerm("");
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    try {
      await videoService.deleteVideo(id);
      setDeletingId(null);
      // If we deleted the last item on the page, go back a page
      if (videos.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchVideos();
      }
    } catch (err: any) {
      alert(`Deletion failed: ${err.message || "Unknown error"}`);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <LayoutWrapper>
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <PageHeader
          title="Video Library"
          subtitle="Enterprise repository for CCTV streams, network feeds, and ingested archive assets."
        />
        <Button
          onClick={() => navigate("/videos/upload")}
          className="gap-2 shrink-0 shadow-md shadow-primary/20"
        >
          <Plus className="h-4.5 w-4.5" />
          Ingest Videos
        </Button>
      </div>

      {/* Dashboard Filter Bar */}
      <div className="bg-card/45 border border-border p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mb-6 shadow-xs">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center relative w-full md:w-80">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search original filename..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-10 pl-9 pr-8 rounded-lg border border-input bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/60 text-foreground"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </button>
          )}
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 py-1 bg-background/50 border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Sort Column */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 py-1 bg-background/50 border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="upload_time">Upload Date</option>
            <option value="filename">Filename</option>
            <option value="file_size">File Size</option>
            <option value="duration">Duration</option>
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 py-1 bg-background/50 border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>

          {/* View Toggle */}
          <div className="border border-border/80 rounded-lg p-0.5 flex bg-background/30 gap-0.5 shrink-0 ml-auto md:ml-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
              title="Grid View"
            >
              <Grid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
              title="Table List View"
            >
              <List className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        // Skeletons
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card/50 border border-border/60 rounded-xl overflow-hidden shadow-xs h-[300px] animate-pulse">
                <div className="h-40 bg-muted/60" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted/80 rounded-md w-3/4" />
                  <div className="h-3 bg-muted/60 rounded-md w-1/2" />
                  <div className="h-8 bg-muted/40 rounded-md pt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-card/40 overflow-hidden animate-pulse">
            <div className="h-10 bg-muted/80 border-b border-border" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted/40 border-b border-border/40" />
            ))}
          </div>
        )
      ) : videos.length === 0 ? (
        // Empty State
        <div className="bg-card/30 border border-border border-dashed p-12 rounded-2xl flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-8">
          <div className="p-4 bg-secondary rounded-full text-muted-foreground mb-4">
            <FileVideo className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Video Assets Available</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {searchTerm || statusFilter
              ? "No video matches found for the selected query search and filter tags."
              : "No video ingestion streams are currently mapped. Upload footage archives to build your database library."}
          </p>
          {(searchTerm || statusFilter) && (
            <Button variant="outline" onClick={handleClearSearch} className="mr-2">
              Clear Filters
            </Button>
          )}
          <Button onClick={() => navigate("/videos/upload")}>Upload First Video</Button>
        </div>
      ) : (
        /* Video representations */
        <>
          {viewMode === "grid" ? (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="group bg-card/50 hover:bg-card border border-border/80 hover:border-primary/45 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col h-[320px] relative"
                >
                  {/* Thumbnail area */}
                  <div className="h-40 bg-slate-900 border-b border-border/60 relative overflow-hidden shrink-0 flex items-center justify-center">
                    {video.status === "completed" && video.thumbnail_path ? (
                      <img
                        src={videoService.getThumbnailUrl(video.id)}
                        alt={video.original_filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : video.status === "failed" ? (
                      <div className="text-center p-4">
                        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-1" />
                        <span className="text-xs text-muted-foreground block">Processing failed</span>
                      </div>
                    ) : (
                      <div className="text-center p-4 text-primary">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-1 text-primary/60" />
                        <span className="text-xs text-muted-foreground block animate-pulse">Running pipeline</span>
                      </div>
                    )}
                    
                    {/* Floating Info badge (Dimensions/Duration) */}
                    {video.status === "completed" && (
                      <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(video.duration)}
                      </div>
                    )}

                    {/* Overlay play button on hover */}
                    {video.status === "completed" && (
                      <div
                        onClick={() => navigate(`/videos/${video.id}`)}
                        className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      >
                        <div className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-all duration-300">
                          <Play className="h-5 w-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 flex flex-col justify-between flex-1 min-h-0">
                    <div className="min-h-0 flex-1">
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <h4
                          onClick={() => navigate(`/videos/${video.id}`)}
                          className="font-semibold text-foreground text-sm truncate hover:text-primary cursor-pointer flex-1"
                          title={video.original_filename}
                        >
                          {video.original_filename}
                        </h4>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{video.width && video.height ? `${video.width}x${video.height}` : "No Res"}</span>
                        <span>•</span>
                        <span>{video.fps ? `${video.fps.toFixed(0)} FPS` : "No FPS"}</span>
                        <span>•</span>
                        <span>{formatBytes(video.file_size)}</span>
                      </div>
                    </div>

                    {/* Bottom row actions */}
                    <div className="border-t border-border/40 pt-4 flex items-center justify-between shrink-0">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                        {formatDate(video.upload_time)}
                      </span>

                      <div className="flex gap-1.5 items-center">
                        {/* Status Label */}
                        <span
                          className={`mr-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                            video.status === "completed"
                              ? "bg-emerald-50/80 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50"
                              : video.status === "failed"
                              ? "bg-red-50/80 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/50"
                              : "bg-primary/5 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30"
                          }`}
                        >
                          {video.status}
                        </span>

                        {/* Vision Status Label */}
                        {video.latest_processing_job && (
                          <span
                            className={`mr-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                              video.latest_processing_job.status === "completed"
                                ? "bg-indigo-50/80 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900/50"
                                : video.latest_processing_job.status === "failed"
                                ? "bg-amber-50/80 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50"
                                : "bg-sky-50/80 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-900/50 animate-pulse"
                            }`}
                          >
                            Vision: {video.latest_processing_job.status} ({Math.round(video.latest_processing_job.progress_percentage)}%)
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(videoService.getDownloadUrl(video.id), "_blank")}
                          disabled={video.status !== "completed" && video.status !== "failed"}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                          title="Download Video File"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        {deletingId === video.id ? (
                          <div className="flex items-center gap-1 z-10 shrink-0">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2 text-[10px] font-semibold"
                              onClick={() => handleDelete(video.id)}
                            >
                              Yes
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px] font-semibold"
                              onClick={() => setDeletingId(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(video.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            title="Delete Video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="bg-card/50 border border-border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-foreground">
                  <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-4 w-20">Thumbnail</th>
                      <th className="p-4">Filename</th>
                      <th className="p-4 w-28">Duration</th>
                      <th className="p-4 w-28">Resolution</th>
                      <th className="p-4 w-20">FPS</th>
                      <th className="p-4 w-24">Size</th>
                      <th className="p-4 w-32">Upload Date</th>
                      <th className="p-4 w-24">Status</th>
                      <th className="p-4 w-32 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {videos.map((video) => (
                      <tr key={video.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-4">
                          <div className="h-10 w-16 bg-slate-900 border border-border/60 rounded overflow-hidden flex items-center justify-center shrink-0">
                            {video.status === "completed" && video.thumbnail_path ? (
                              <img
                                src={videoService.getThumbnailUrl(video.id)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : video.status === "failed" ? (
                              <AlertCircle className="h-4.5 w-4.5 text-destructive" />
                            ) : (
                              <RefreshCw className="h-4.5 w-4.5 animate-spin text-primary/60" />
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-foreground max-w-[200px] truncate">
                          <span
                            onClick={() => navigate(`/videos/${video.id}`)}
                            className="cursor-pointer hover:text-primary transition-colors block"
                            title={video.original_filename}
                          >
                            {video.original_filename}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground font-mono">
                          {formatDuration(video.duration)}
                        </td>
                        <td className="p-4 text-muted-foreground font-mono">
                          {video.width && video.height ? `${video.width}x${video.height}` : "N/A"}
                        </td>
                        <td className="p-4 text-muted-foreground font-mono">
                          {video.fps ? `${video.fps.toFixed(0)}` : "N/A"}
                        </td>
                        <td className="p-4 text-muted-foreground font-mono">
                          {formatBytes(video.file_size)}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(video.upload_time)}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`w-fit px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                                video.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50"
                                  : video.status === "failed"
                                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/50"
                                  : "bg-primary/5 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30"
                              }`}
                            >
                              {video.status}
                            </span>
                            {video.latest_processing_job && (
                              <span
                                className={`w-fit px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                                  video.latest_processing_job.status === "completed"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900/50"
                                    : video.latest_processing_job.status === "failed"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50"
                                    : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-900/50 animate-pulse"
                                }`}
                              >
                                Vision: {video.latest_processing_job.status} ({Math.round(video.latest_processing_job.progress_percentage)}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5 items-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/videos/${video.id}`)}
                              className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                              title="View Details"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(videoService.getDownloadUrl(video.id), "_blank")}
                              disabled={video.status !== "completed" && video.status !== "failed"}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                              title="Download File"
                            >
                              <Download className="h-4 w-4" />
                            </Button>

                            {deletingId === video.id ? (
                              <div className="flex items-center gap-1 shrink-0 z-10">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] font-semibold"
                                  onClick={() => handleDelete(video.id)}
                                >
                                  Yes
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] font-semibold"
                                  onClick={() => setDeletingId(null)}
                                >
                                  No
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingId(video.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-6">
              <span className="text-xs text-muted-foreground">
                Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
                <span className="font-semibold text-foreground">{totalPages}</span> (Total: {totalCount} records)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </LayoutWrapper>
  );
};

export default Videos;
