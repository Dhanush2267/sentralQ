import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios, { CancelTokenSource } from "axios";
import {
  Upload,
  X,
  FileVideo,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Trash2,
  Play
} from "lucide-react";
import LayoutWrapper from "@/components/LayoutWrapper";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import videoService from "@/services/videoService";

interface UploadFileItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "failed" | "cancelled";
  cancelSource: CancelTokenSource | null;
  error?: string;
  videoId?: string;
}

const ALLOWED_EXTENSIONS = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

const UploadVideo: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadList, setUploadList] = useState<UploadFileItem[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<{
    id: string;
    type: "success" | "error";
    message: string;
  }[]>([]);

  // Show Toast Notifications
  const addNotification = (type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, type, message }]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToList(Array.from(e.dataTransfer.files));
    }
  };

  // File Select Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToList(Array.from(e.target.files));
    }
  };

  // Validation & Listing
  const addFilesToList = (files: File[]) => {
    const newItems: UploadFileItem[] = [];

    files.forEach((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      
      // Extension Validation
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        addNotification("error", `File "${file.name}" rejected: Unsupported format. Extension must be ${ALLOWED_EXTENSIONS.join(", ")}`);
        return;
      }

      // Size Validation
      if (file.size > MAX_FILE_SIZE) {
        addNotification("error", `File "${file.name}" rejected: Exceeds 2GB file limit.`);
        return;
      }

      // Prevent duplicate additions
      if (uploadList.some((item) => item.file.name === file.name && item.file.size === file.size)) {
        return;
      }

      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        progress: 0,
        status: "pending",
        cancelSource: null,
      });
    });

    if (newItems.length > 0) {
      setUploadList((prev) => [...prev, ...newItems]);
    }
  };

  // Start upload for a single item
  const startUploadItem = async (itemId: string) => {
    const item = uploadList.find((i) => i.id === itemId);
    if (!item || item.status === "uploading" || item.status === "completed") return;

    const cancelSource = axios.CancelToken.source();

    setUploadList((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: "uploading", progress: 0, cancelSource, error: undefined }
          : i
      )
    );

    try {
      const response = await videoService.uploadVideo(
        item.file,
        (progress) => {
          setUploadList((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, progress } : i))
          );
        },
        cancelSource
      );

      setUploadList((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, status: "completed", progress: 100, videoId: response.id }
            : i
        )
      );

      addNotification("success", `"${item.file.name}" uploaded successfully!`);
    } catch (err: any) {
      if (axios.isCancel(err)) {
        setUploadList((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, status: "cancelled", progress: 0 } : i))
        );
        addNotification("error", `Upload cancelled for "${item.file.name}"`);
      } else {
        const errorMsg = err.message || "Upload failed.";
        setUploadList((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, status: "failed", error: errorMsg } : i
          )
        );
        addNotification("error", `Failed to upload "${item.file.name}": ${errorMsg}`);
      }
    }
  };

  // Start upload for all pending items
  const startAllUploads = () => {
    uploadList.forEach((item) => {
      if (item.status === "pending" || item.status === "failed" || item.status === "cancelled") {
        startUploadItem(item.id);
      }
    });
  };

  // Cancel upload
  const cancelUploadItem = (itemId: string) => {
    const item = uploadList.find((i) => i.id === itemId);
    if (item && item.cancelSource) {
      item.cancelSource.cancel("User cancelled upload.");
    }
  };

  // Remove from list
  const removeFromList = (itemId: string) => {
    const item = uploadList.find((i) => i.id === itemId);
    if (item) {
      if (item.status === "uploading") {
        cancelUploadItem(itemId);
      }
      setUploadList((prev) => prev.filter((i) => i.id !== itemId));
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <LayoutWrapper>
      {/* Toast Overlay */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-in ${
              n.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300"
                : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-300"
            }`}
          >
            {n.type === "success" ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            )}
            <div className="flex-1 text-sm font-medium">{n.message}</div>
            <button
              onClick={() => removeNotification(n.id)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/videos")}
          className="h-8 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Button>
      </div>

      <PageHeader
        title="Upload Video Assets"
        subtitle="Ingest raw camera footage and files. Supports MP4, AVI, MOV, MKV, and WebM archives up to 2GB."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        {/* Left Column: Drag & Drop Zone */}
        <div className="lg:col-span-2 space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden group ${
              dragActive
                ? "border-primary bg-primary/5 scale-[0.99] shadow-inner"
                : "border-border bg-card/40 hover:border-primary/50 hover:bg-card/70"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".mp4,.avi,.mov,.mkv,.webm"
              className="hidden"
            />
            
            {/* Visual Glass overlay for drop hover */}
            {dragActive && (
              <div className="absolute inset-0 bg-primary/5 backdrop-blur-xs flex items-center justify-center pointer-events-none animate-fade-in">
                <p className="text-primary font-semibold text-lg">Drop your video files here</p>
              </div>
            )}

            <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform duration-300 mb-4">
              <Upload className="h-8 w-8" />
            </div>

            <h3 className="text-lg font-semibold mb-1 text-foreground">
              Drag & Drop files here or click to browse
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Upload multiple archives. Allowed formats are: <span className="font-semibold">{ALLOWED_EXTENSIONS.join(", ")}</span>. Max size per file is 2GB.
            </p>
            <Button type="button" variant="primary">
              Choose Files
            </Button>
          </div>

          {/* Upload Ingestion List */}
          {uploadList.length > 0 && (
            <div className="bg-card/50 border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">Ingestion Queue</h3>
                  <p className="text-xs text-muted-foreground">
                    {uploadList.filter((i) => i.status === "completed").length} of {uploadList.length} files successfully processed
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUploadList([])}
                    disabled={uploadList.some((i) => i.status === "uploading")}
                  >
                    Clear Queue
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={startAllUploads}
                    disabled={!uploadList.some((i) => i.status === "pending" || i.status === "failed")}
                  >
                    Upload All
                  </Button>
                </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {uploadList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-background/50 border border-border/60 rounded-lg flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-secondary rounded-md text-primary">
                        <FileVideo className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-xs font-semibold text-foreground mb-1">
                          <span className="truncate pr-4">{item.file.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatBytes(item.file.size)}
                          </span>
                        </div>
                        
                        {/* Progress Bar / Status label */}
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                item.status === "completed"
                                  ? "bg-emerald-500"
                                  : item.status === "failed"
                                  ? "bg-destructive"
                                  : item.status === "cancelled"
                                  ? "bg-amber-500"
                                  : "bg-primary animate-pulse"
                              }`}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              item.status === "completed"
                                ? "text-emerald-500"
                                : item.status === "failed"
                                ? "text-destructive"
                                : item.status === "cancelled"
                                ? "text-amber-500"
                                : item.status === "uploading"
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            {item.status === "uploading"
                              ? `${item.progress}%`
                              : item.status}
                          </span>
                        </div>
                        {item.error && (
                          <p className="text-[10px] text-destructive font-medium mt-1">
                            {item.error}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {item.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startUploadItem(item.id)}
                          className="h-8 w-8 text-primary hover:text-primary/80"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                      {item.status === "uploading" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelUploadItem(item.id)}
                          className="h-8 w-8 text-amber-500 hover:text-amber-600"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </Button>
                      )}
                      {item.status === "completed" && item.videoId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/videos/${item.videoId}`)}
                          className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromList(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Ingestion Instructions & FAQ */}
        <div className="space-y-6">
          <div className="bg-card/40 border border-border rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Storage Guidelines</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>Uploaded videos are automatically indexed and saved dynamically by year and month.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>FFmpeg pipelines process uploads immediately to draw first frame thumbnails.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>Resolution, codec details, framerates, container formats, and dimensions are queried automatically.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>The assets will reside securely inside PostgreSQL database tables, fully prepared for future AI models.</span>
              </li>
            </ul>
          </div>

          <div className="bg-secondary/30 border border-border/40 rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-2">Notice</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This system does not execute any AI model training or tracking inference in Phase 2.
              It is designed to serve as a pure and robust Video Asset Repository for ingestion, storage, retrieval, and high-performance range-based streaming.
            </p>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
};

export default UploadVideo;
