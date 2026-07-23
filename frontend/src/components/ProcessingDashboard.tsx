import React, { useEffect, useState, useRef } from "react";
import { 
  Play, 
  Square, 
  RotateCcw, 
  Cpu, 
  Layers, 
  Film, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Clock,
  Activity
} from "lucide-react";
import processingService, { ProcessingJobDetails } from "@/services/processingService";
import Button from "@/components/Button";

interface ProcessingDashboardProps {
  videoId: string;
  videoStatus: string;
  initialJob: ProcessingJobDetails | null | undefined;
  onJobStatusChange?: () => void;
}

const ProcessingDashboard: React.FC<ProcessingDashboardProps> = ({ 
  videoId, 
  videoStatus,
  initialJob,
  onJobStatusChange
}) => {
  const [job, setJob] = useState<ProcessingJobDetails | null>(initialJob || null);
  const [_loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await processingService.getStatus(videoId);
      setJob(data);
      setError(null);
    } catch (err: any) {
      // 404 is expected if processing hasn't been triggered yet
      if (err.status === 404) {
        setJob(null);
      } else {
        setError(err.message || "Failed to fetch vision job details.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll status when job is active (queued or processing)
  useEffect(() => {
    const isJobActive = job && (job.status === "queued" || job.status === "processing");
    
    if (isJobActive) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => {
          fetchJobStatus(true);
          if (onJobStatusChange) onJobStatusChange();
        }, 2000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [job]);

  useEffect(() => {
    fetchJobStatus();
  }, [videoId]);

  const handleStart = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const data = await processingService.startProcessing(videoId);
      setJob(data);
      if (onJobStatusChange) onJobStatusChange();
    } catch (err: any) {
      setError(err.message || "Failed to start vision processing.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const data = await processingService.cancelProcessing(videoId);
      setJob(data);
      if (onJobStatusChange) onJobStatusChange();
    } catch (err: any) {
      setError(err.message || "Failed to cancel vision processing.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const data = await processingService.retryProcessing(videoId);
      setJob(data);
      if (onJobStatusChange) onJobStatusChange();
    } catch (err: any) {
      setError(err.message || "Failed to retry vision processing.");
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: calculate processing duration
  const getDuration = (): string => {
    if (!job) return "0s";
    const start = job.started_at ? new Date(job.started_at).getTime() : null;
    const end = job.completed_at ? new Date(job.completed_at).getTime() : null;
    
    if (!start) return "0s";
    
    const now = end || Date.now();
    const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
    return `${diffSeconds} seconds`;
  };

  // Helper: check stages
  const stages = [
    { key: "queued", label: "In Queue", icon: Clock },
    { key: "frame_extraction", label: "Frame Extraction", icon: Film },
    { key: "frame_validation", label: "Frame Validation", icon: Layers },
    { key: "ai_ready", label: "Running AI Inference", icon: Cpu },
    { key: "completed", label: "Complete", icon: CheckCircle2 }
  ];

  const getStageStatus = (stageKey: string): "completed" | "active" | "pending" | "failed" => {
    if (!job) return "pending";
    if (job.status === "failed" && job.current_stage === stageKey) return "failed";
    
    const currentIdx = stages.findIndex(s => s.key === job.current_stage);
    const targetIdx = stages.findIndex(s => s.key === stageKey);
    
    if (job.status === "completed") return "completed";
    if (currentIdx > targetIdx) return "completed";
    if (currentIdx === targetIdx) return "active";
    return "pending";
  };

  // If the standard video ingestion isn't completed, show dependency notice
  if (videoStatus !== "completed") {
    return (
      <div className="bg-card/45 border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary/70" />
          Vision Processing Engine
        </h3>
        <div className="p-4 bg-muted/20 border border-border/60 rounded-xl text-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary/60 mx-auto" />
          <p className="text-sm font-semibold text-foreground">Video Asset Ingestion Pending</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            The standard pipeline is extracting metadata and thumbnails. Vision AI Processing will become available once ingestion is complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/50 border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Vision Processing Engine
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase 3: Frame extraction, caching, scheduling & multi-model registration engine.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!job && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleStart} 
              isLoading={actionLoading}
              className="shadow-sm shadow-primary/10 gap-1.5"
            >
              <Play className="h-4 w-4 fill-current" />
              Start Processing
            </Button>
          )}

          {job && (job.status === "queued" || job.status === "processing") && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleCancel} 
              isLoading={actionLoading}
              className="gap-1.5"
            >
              <Square className="h-4 w-4 fill-current" />
              Cancel Job
            </Button>
          )}

          {job && job.status === "failed" && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleRetry} 
              isLoading={actionLoading}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Retry Job
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-500 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          {error}
        </div>
      )}

      {job ? (
        <div className="space-y-6">
          {/* Progress Bar & Details */}
          <div className="bg-background/40 border border-border/60 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] border ${
                  job.status === "completed" 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" 
                    : job.status === "failed"
                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50"
                    : "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30"
                }`}>
                  {job.status}
                </span>
                <span className="text-muted-foreground font-medium">|</span>
                <span className="text-foreground font-semibold flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground/60" />
                  Stage: <span className="capitalize">{job.current_stage.replace("_", " ")}</span>
                </span>
              </div>
              <span className="font-mono font-bold text-foreground text-sm">
                {job.progress_percentage.toFixed(0)}%
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="h-2.5 w-full bg-secondary/80 rounded-full overflow-hidden relative">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  job.status === "failed" 
                    ? "bg-red-500" 
                    : job.status === "completed" 
                    ? "bg-emerald-500" 
                    : "bg-gradient-to-r from-primary to-indigo-500 animate-pulse"
                }`}
                style={{ width: `${job.progress_percentage}%` }}
              />
            </div>

            {/* Error Message */}
            {job.status === "failed" && job.error_message && (
              <div className="p-3 bg-destructive/5 border border-destructive/15 text-destructive rounded-lg text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5">Execution Error:</span>
                {job.error_message}
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground block font-medium">Frames Extracted</span>
                <span className="text-foreground font-bold font-mono text-sm">
                  {job.total_frames} frames
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block font-medium">Processed (Inference)</span>
                <span className="text-foreground font-bold font-mono text-sm">
                  {job.processed_frames} / {job.total_frames}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block font-medium">Processing Time</span>
                <span className="text-foreground font-bold flex items-center gap-1 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {getDuration()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block font-medium">Engine Config</span>
                <span className="text-foreground font-semibold text-sm">
                  1 fps (configurable)
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal Stages Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline Timeline</h4>
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-2">
              {/* Connector line on desktop */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 hidden md:block z-0" />
              
              {stages.map((stage) => {
                const sStatus = getStageStatus(stage.key);
                const IconComp = stage.icon;
                
                return (
                  <div key={stage.key} className="flex md:flex-col items-center gap-3 md:gap-1.5 z-10 bg-card md:px-2">
                    <div className={`h-8 w-8 rounded-full border flex items-center justify-center transition-all ${
                      sStatus === "completed"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/10"
                        : sStatus === "failed"
                        ? "bg-red-500/10 text-red-500 border-red-500 shadow-sm"
                        : sStatus === "active"
                        ? "bg-primary/20 text-primary border-primary animate-pulse"
                        : "bg-background text-muted-foreground/60 border-border"
                    }`}>
                      {sStatus === "active" && stage.key !== "completed" ? (
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      ) : (
                        <IconComp className="h-4 w-4" />
                      )}
                    </div>
                    <div className="text-left md:text-center space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block">
                        {stage.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium block">
                        {sStatus === "completed" && "Complete"}
                        {sStatus === "failed" && "Failed"}
                        {sStatus === "active" && "In Progress"}
                        {sStatus === "pending" && "Pending"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Model Registry Placeholder Listing (Rich UI Design) */}
          <div className="border-t border-border/40 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supported Model Registry</h4>
              <span className="text-[10px] text-primary font-semibold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                GPU acceleration ready
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: "YOLO", desc: "Object Detection", active: job.current_stage === "ai_ready" },
                { name: "Grounding DINO", desc: "Open-Vocab Detection", active: false },
                { name: "SAM", desc: "Segment Anything", active: false },
                { name: "OCR", desc: "Text Extraction", active: false },
                { name: "CLIP", desc: "Similarity Embeddings", active: false },
                { name: "ByteTrack", desc: "Multi-Object Tracking", active: false }
              ].map((m) => (
                <div key={m.name} className={`p-3 border rounded-xl flex items-center gap-2.5 transition-all ${
                  m.active 
                    ? "bg-primary/5 border-primary/45 shadow-xs" 
                    : "bg-background/20 border-border/60 hover:bg-background/40"
                }`}>
                  <div className={`h-6 w-6 rounded-md flex items-center justify-center ${
                    m.active ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                  }`}>
                    {m.active ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate block" title={m.name}>
                      {m.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-medium block truncate">
                      {m.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-8 bg-background/30 border border-border border-dashed rounded-xl text-center space-y-3">
          <div className="p-3 bg-secondary/80 rounded-full w-fit mx-auto text-muted-foreground/80">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Vision Intelligence Offline</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Extract video frames and run simulated model inference pipelines. This establishes the structural queue framework for subsequent phases.
            </p>
          </div>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleStart} 
            isLoading={actionLoading}
            className="shadow-sm shadow-primary/10 gap-1.5"
          >
            <Play className="h-4 w-4 fill-current" />
            Start Processing
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProcessingDashboard;
