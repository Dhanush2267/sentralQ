import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Trash2,
  Calendar,
  HardDrive,
  Film,
  RefreshCw,
  AlertTriangle,
  Activity,
  Navigation,
  Sparkles
} from "lucide-react";
import LayoutWrapper from "@/components/LayoutWrapper";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Spinner from "@/components/Spinner";
import videoService, { VideoDetails as VideoType } from "@/services/videoService";
import ProcessingDashboard from "@/components/ProcessingDashboard";

const VideoDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<boolean>(false);

  // Poll video details if it is still processing
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVideo = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const data = await videoService.getVideoDetails(id);
      setVideo(data);
      setError(null);
      
      // If status is still uploading or processing, setup polling
      if (data.status === "uploaded" || data.status === "processing") {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(() => {
            fetchVideo(true);
          }, 3000);
        }
      } else {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch video details.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideo();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await videoService.deleteVideo(id);
      navigate("/videos");
    } catch (err: any) {
      alert(`Deletion failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
          <Spinner className="h-8 w-8 text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading video details...</p>
        </div>
      </LayoutWrapper>
    );
  }

  if (error || !video) {
    return (
      <LayoutWrapper>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] text-center max-w-md mx-auto">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Video</h3>
          <p className="text-sm text-muted-foreground mb-6">{error || "Asset not found or was deleted."}</p>
          <Button onClick={() => navigate("/videos")}>Back to Library</Button>
        </div>
      </LayoutWrapper>
    );
  }

  // Check if browser native playback is potentially unsupported
  const isCodecUnsupported = () => {
    const format = video.video_format?.toLowerCase() || "";
    const codec = video.codec?.toLowerCase() || "";
    // Standard web compatible: mp4 (h264, vp9), webm (vp8, vp9, av1)
    if (format.includes("matroska") || format.includes("avi") || format.includes("x-msvideo") || format.includes("asf")) {
      return true;
    }
    if (codec.includes("hevc") || codec.includes("h265") || codec.includes("mpeg4")) {
      // Browser support for HEVC is spotty on Windows/Linux without hardware decoders
      return true;
    }
    return false;
  };

  return (
    <LayoutWrapper>
      {/* Back & Actions header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/videos")}
          className="h-8 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Button>

        <div className="flex items-center gap-2">
          {video.status === "completed" && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/videos/${video.id}/detection`)}
                className="h-8 gap-1.5 animate-fade-in"
              >
                <Activity className="h-4 w-4" />
                View Detections
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/videos/${video.id}/tracking`)}
                className="h-8 gap-1.5 animate-fade-in bg-indigo-600 hover:bg-indigo-700"
              >
                <Navigation className="h-4 w-4" />
                View Tracking
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/videos/${video.id}/intelligence`)}
                className="h-8 gap-1.5 animate-fade-in bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="h-4 w-4" />
                View Intelligence
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(videoService.getDownloadUrl(video.id), "_blank")}
            className="h-8 gap-1.5"
            disabled={video.status !== "completed" && video.status !== "failed"}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>

          {video.status === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(videoService.getAnnotatedDownloadUrl(video.id), "_blank")}
              className="h-8 gap-1.5 text-primary border-primary/25 hover:bg-primary/5"
            >
              <Download className="h-4 w-4" />
              Download Annotated Video
            </Button>
          )}


          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                onClick={handleDelete}
                isLoading={isDeleting}
              >
                Confirm Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-8 gap-1.5 text-destructive hover:bg-destructive/5 border-destructive/20 hover:border-destructive/30"
            >
              <Trash2 className="h-4 w-4" />
              Delete Asset
            </Button>
          )}
        </div>
      </div>

      <PageHeader
        title={video.original_filename}
        subtitle={`Asset ID: ${video.id}`}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-6">
        {/* Left Side: Video Preview Player */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-slate-950 rounded-2xl overflow-hidden aspect-video border border-slate-800 flex flex-col justify-center items-center relative group">
            {video.status === "completed" && !playbackError ? (
              <video
                controls
                preload="metadata"
                className="w-full h-full object-contain"
                poster={videoService.getThumbnailUrl(video.id)}
                onError={() => setPlaybackError(true)}
              >
                <source src={videoService.getStreamUrl(video.id)} />
                Your browser does not support the video tag.
              </video>
            ) : video.status === "uploaded" || video.status === "processing" ? (
              <div className="p-8 text-center text-slate-400 space-y-3">
                <RefreshCw className="h-10 w-10 animate-spin text-primary mx-auto" />
                <h4 className="font-semibold text-slate-200 text-lg">Extracting Video Metadata</h4>
                <p className="text-sm text-slate-500 max-w-sm">
                  The processing pipeline is running ffprobe and ffmpeg to generate the first frame thumbnail. This will take just a few seconds.
                </p>
                <span className="inline-block px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-semibold animate-pulse uppercase tracking-wider">
                  Stage: {video.processing_stage}
                </span>
              </div>
            ) : (
              // Failed or Playback error fallback
              <div className="p-8 text-center text-slate-400 space-y-3 max-w-md">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                <h4 className="font-semibold text-slate-200 text-lg">
                  {playbackError ? "Playback Unavailable" : "Processing Pipeline Failed"}
                </h4>
                <p className="text-sm text-slate-500">
                  {playbackError
                    ? "This container or codec configuration cannot be decoded directly by your web browser natively."
                    : "The storage or metadata indexing engine failed to parse this specific file."}
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.open(videoService.getDownloadUrl(video.id), "_blank")}
                  >
                    <Download className="mr-2 h-4 w-4" /> Download Original Video
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(videoService.getAnnotatedDownloadUrl(video.id), "_blank")}
                  >
                    <Download className="mr-2 h-4 w-4" /> Download Annotated Video
                  </Button>
                </div>

              </div>
            )}
          </div>

          {/* Compatibility Warning Banner */}
          {video.status === "completed" && isCodecUnsupported() && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs font-medium space-y-1">
                <p className="font-semibold">Browser Codec Alert</p>
                <p className="text-amber-800/80 dark:text-amber-400/80">
                  This video utilizes <span className="font-bold">{video.video_format}</span> with the <span className="font-bold">{video.codec}</span> codec.
                  HTML5 video decoders in some browsers (e.g. Chrome/Firefox) might fail to decode this combination natively. If you encounter a black screen or playback failure, download the file to play it locally.
                </p>
              </div>
            </div>
          )}

          {/* Vision Processing Dashboard Card */}
          <ProcessingDashboard 
            videoId={video.id} 
            videoStatus={video.status} 
            initialJob={video.latest_processing_job} 
            onJobStatusChange={() => fetchVideo(true)} 
          />
        </div>

        {/* Right Side: Technical Specs & Parameters */}
        <div className="space-y-6">
          {/* Status Panel */}
          <div className="bg-card/50 border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Pipeline Ingestion Status
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Job Status</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    video.status === "completed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50"
                      : video.status === "failed"
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50"
                      : "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30 animate-pulse"
                  }`}
                >
                  {video.status}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Processing Stage</span>
                <span className="text-foreground font-semibold capitalize">
                  {video.processing_stage}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Uploaded Date</span>
                <span className="text-foreground font-semibold flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(video.upload_time)}
                </span>
              </div>
            </div>
          </div>

          {/* Technical Specs Panel */}
          <div className="bg-card/50 border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              Technical Metadata
            </h3>

            <div className="divide-y divide-border/60">
              <div className="py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="text-foreground font-semibold">
                  {video.duration ? `${video.duration.toFixed(2)} seconds` : "N/A"}
                </span>
              </div>

              <div className="py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Resolution</span>
                <span className="text-foreground font-semibold">
                  {video.width && video.height ? `${video.width} x ${video.height}` : "N/A"}
                </span>
              </div>

              <div className="py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Frame Rate</span>
                <span className="text-foreground font-semibold">
                  {video.fps ? `${video.fps.toFixed(2)} fps` : "N/A"}
                </span>
              </div>

              <div className="py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Codec</span>
                <span className="text-foreground font-semibold uppercase">
                  {video.codec || "N/A"}
                </span>
              </div>

              <div className="py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Format (Container)</span>
                <span className="text-foreground font-semibold uppercase">
                  {video.video_format || "N/A"}
                </span>
              </div>

              <div className="py-3 flex justify-between text-sm">
                <span className="text-muted-foreground">File Size</span>
                <span className="text-foreground font-semibold">
                  {formatBytes(video.file_size)}
                </span>
              </div>
            </div>
          </div>

          {/* Paths Panel */}
          <div className="bg-card/50 border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Physical Path Locations
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Original Filename
                </span>
                <span className="text-xs text-foreground font-semibold font-mono break-all bg-background/50 border border-border/40 p-2 rounded-md block">
                  {video.original_filename}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Storage Video Path
                </span>
                <span className="text-xs text-foreground font-semibold font-mono break-all bg-background/50 border border-border/40 p-2 rounded-md block">
                  {video.file_path}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Storage Thumbnail Path
                </span>
                <span className="text-xs text-foreground font-semibold font-mono break-all bg-background/50 border border-border/40 p-2 rounded-md block">
                  {video.thumbnail_path || "N/A (Extraction Pending)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
};

export default VideoDetails;
