import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Clock,
  Navigation,
  Compass,
  Layers,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Eye,
  Settings as SettingsIcon,
  RefreshCw,
  Zap
} from "lucide-react";
import LayoutWrapper from "@/components/LayoutWrapper";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Button from "@/components/Button";
import Spinner from "@/components/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import trackingService, { TrackDetails, TrackingStatistics } from "@/services/trackingService";
import detectionService, { DetectionResult } from "@/services/detectionService";
import processingService, { ProcessingJobDetails } from "@/services/processingService";
import videoService, { VideoDetails } from "@/services/videoService";

const TrackingDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data State
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [job, setJob] = useState<ProcessingJobDetails | null>(null);
  const [tracks, setTracks] = useState<TrackDetails[]>([]);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [statistics, setStatistics] = useState<TrackingStatistics | null>(null);
  
  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Tracker Config state (modal or simple accordion)
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [trackBuffer, setTrackBuffer] = useState<number>(30);
  const [matchThresh, setMatchThresh] = useState<number>(0.8);
  const [scoreThresh, setScoreThresh] = useState<number>(0.5);
  const [minArea, setMinArea] = useState<number>(0.0);

  // Playback & Interaction state
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  
  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>("");

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Dashboard Data
  const loadData = async (showSpinner = true) => {
    if (!id) return;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [videoData, jobData, tracksData, statsData, detectionsData] = await Promise.all([
        videoService.getVideoDetails(id),
        processingService.getStatus(id),
        trackingService.getTracks(id),
        trackingService.getStatistics(id).catch(() => null),
        detectionService.getDetections(id).catch(() => [])
      ]);

      setVideo(videoData);
      setJob(jobData);
      setTracks(tracksData);
      setStatistics(statsData);
      setDetections(detectionsData);

      if (tracksData.length > 0 && selectedTrackId === null) {
        setSelectedTrackId(tracksData[0].track_id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load tracking analytics data.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [id]);

  // Handle auto playback loop
  useEffect(() => {
    if (isPlaying) {
      const maxFrame = job?.total_frames || 1;
      playbackTimerRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= maxFrame) {
            setIsPlaying(false);
            return 1;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, job]);

  // Run/Re-run tracker manually
  const handleRunTracking = async () => {
    if (!id) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const resp = await trackingService.runTracking(id, {
        track_buffer: trackBuffer,
        match_threshold: matchThresh,
        score_threshold: scoreThresh,
        minimum_box_area: minArea
      });
      setSuccessMsg(resp.message);
      await loadData(false);
    } catch (err: any) {
      setError(err.message || "Failed to execute ByteTrack tracker.");
    } finally {
      setActionLoading(false);
    }
  };

  // Distinct track color mapper
  const getTrackColor = (trackId: number): string => {
    const colors = [
      "#3b82f6", // Blue
      "#10b981", // Emerald
      "#ec4899", // Pink
      "#f59e0b", // Amber
      "#8b5cf6", // Purple
      "#ef4444", // Red
      "#06b6d4", // Cyan
      "#84cc16", // Lime
    ];
    return colors[trackId % colors.length];
  };

  // Render trajectory canvas overlay — wrapped in useCallback for stable reference
  const drawTrajectory = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    // Guard: if image hasn't painted yet, dimensions will be 0 — skip
    if (img.clientWidth === 0 || img.clientHeight === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sync canvas buffer size to displayed image dimensions
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (tracks.length === 0) return;

    // Scale from natural image resolution → displayed size
    const scaleX = canvas.width / (img.naturalWidth || 1920);
    const scaleY = canvas.height / (img.naturalHeight || 1080);

    // 1. Draw trajectory paths (dimmed for non-selected, full for selected)
    tracks.forEach((t) => {
      const isSelected = t.track_id === selectedTrackId;
      if (t.trajectory.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = getTrackColor(t.track_id);
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.globalAlpha = isSelected ? 0.95 : 0.25;

      const firstPt = t.trajectory[0];
      ctx.moveTo(firstPt.center_x * scaleX, firstPt.center_y * scaleY);

      t.trajectory.forEach((pt) => {
        ctx.lineTo(pt.center_x * scaleX, pt.center_y * scaleY);
      });
      ctx.stroke();

      // Direction arrow at trajectory end
      if (t.trajectory.length > 1) {
        const last = t.trajectory[t.trajectory.length - 1];
        const prev = t.trajectory[t.trajectory.length - 2];
        const angle = Math.atan2(
          (last.center_y - prev.center_y) * scaleY,
          (last.center_x - prev.center_x) * scaleX
        );

        ctx.beginPath();
        ctx.fillStyle = getTrackColor(t.track_id);
        ctx.globalAlpha = isSelected ? 0.95 : 0.25;
        ctx.moveTo(last.center_x * scaleX, last.center_y * scaleY);
        ctx.lineTo(
          last.center_x * scaleX - 10 * Math.cos(angle - Math.PI / 6),
          last.center_y * scaleY - 10 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          last.center_x * scaleX - 10 * Math.cos(angle + Math.PI / 6),
          last.center_y * scaleY - 10 * Math.sin(angle + Math.PI / 6)
        );
        ctx.fill();
      }
    });

    // 2. Draw bounding boxes for detections in the current frame
    const activeDetections = detections.filter((d) => d.frame_number === currentFrame);

    ctx.globalAlpha = 1.0;
    activeDetections.forEach((d) => {
      if (d.track_id === null) return;
      const isSelected = d.track_id === selectedTrackId;

      const x = d.bbox_x * scaleX;
      const y = d.bbox_y * scaleY;
      const w = d.bbox_width * scaleX;
      const h = d.bbox_height * scaleY;

      const color = getTrackColor(d.track_id);

      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = color;
      const label = `Track ${d.track_id} (${(d.confidence * 100).toFixed(0)}%)`;
      ctx.font = "bold 10px monospace";
      const textWidth = ctx.measureText(label).width;

      ctx.fillRect(x, Math.max(0, y - 15), textWidth + 6, 15);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x + 3, Math.max(10, y - 4));
    });
  }, [currentFrame, tracks, selectedTrackId, detections]);

  // Re-draw on frame/track/detection change and window resize
  useEffect(() => {
    drawTrajectory();
    window.addEventListener("resize", drawTrajectory);
    return () => window.removeEventListener("resize", drawTrajectory);
  }, [drawTrajectory]);

  // Find active track details
  const activeTrack = tracks.find((t) => t.track_id === selectedTrackId);
  const totalFramesCount = job?.total_frames || 1;

  // Filter track table
  const filteredTracks = tracks.filter((t) => {
    const term = searchQuery.toLowerCase();
    return t.track_id.toString().includes(term) || t.class_name.toLowerCase().includes(term);
  });

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
          <Spinner className="h-8 w-8 text-primary mb-2" />
          <p className="text-sm text-muted-foreground font-semibold">Compiling motion tracking database...</p>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      {/* Back Button */}
      <div className="mb-4 flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/videos/${id}`)}
          className="h-8 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Asset Details
        </Button>

        {/* Config accordion trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConfig(!showConfig)}
          className="h-8 gap-1.5"
        >
          <SettingsIcon className="h-4 w-4" />
          Tracker Settings
        </Button>
      </div>

      <PageHeader
        title="ByteTrack Motion Tracking Intelligence"
        subtitle={`Video Ingestion: ${video?.original_filename} (UUID: ${video?.id})`}
      />

      {/* Accordion config parameters panel */}
      {showConfig && (
        <Card className="mt-4 border border-primary/20 bg-primary/5 animate-fade-in">
          <CardHeader className="py-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4.5 w-4.5 text-primary" />
              Configure ByteTrack Parameters
            </CardTitle>
            <CardDescription>
              Tweak frame association settings to filter tracking noise or retain lost track coordinates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Track Buffer: <span className="text-foreground font-mono">{trackBuffer} frames</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={trackBuffer}
                  onChange={(e) => setTrackBuffer(parseInt(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Match Threshold: <span className="text-foreground font-mono">{matchThresh.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="0.95"
                  step="0.05"
                  value={matchThresh}
                  onChange={(e) => setMatchThresh(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Score Threshold: <span className="text-foreground font-mono">{scoreThresh.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={scoreThresh}
                  onChange={(e) => setScoreThresh(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Min BBox Area: <span className="text-foreground font-mono">{minArea} px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="100"
                  value={minArea}
                  onChange={(e) => setMinArea(parseInt(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                className="h-8"
                onClick={handleRunTracking}
                isLoading={actionLoading}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Re-Run Tracking Engine
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold rounded-xl mt-4 flex items-center gap-2">
          <Eye className="h-4.5 w-4.5" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold rounded-xl mt-4 flex items-center gap-2">
          <Eye className="h-4.5 w-4.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <StatCard
          title="Total Tracks"
          value={statistics?.total_tracks || 0}
          icon={Layers}
          description="Total linked entities"
        />
        <StatCard
          title="Tracked People"
          value={statistics?.total_tracked_people || 0}
          icon={Users}
          description="Person class tracks"
        />
        <StatCard
          title="Active Tracks"
          value={statistics?.active_tracks || 0}
          icon={Play}
          description="Tracks in current window"
        />
        <StatCard
          title="Avg Track Length"
          value={statistics?.average_track_length_frames ? `${statistics.average_track_length_frames.toFixed(0)} frames` : 0}
          icon={Clock}
          description="Average frame duration"
        />
        <StatCard
          title="Avg Travel Distance"
          value={statistics?.average_movement_distance ? `${statistics.average_movement_distance.toFixed(0)} px` : "0 px"}
          icon={Compass}
          description="Mean Euclidean displacement"
        />
      </div>

      {/* Interactive visualizer player grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        
        {/* Visualizer Canvas overlay */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="py-4">
              <CardTitle className="text-md flex items-center gap-2">
                <Navigation className="h-4.5 w-4.5 text-primary" />
                Trajectory Visualizer Bounding Boxes
              </CardTitle>
              <CardDescription>
                Frame {currentFrame} of {totalFramesCount} (Timestamp: {((currentFrame - 1) * 1.0).toFixed(1)}s)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 bg-slate-950 flex justify-center items-center aspect-video relative border-y border-border">
              {totalFramesCount > 0 ? (
                <>
                  <img
                    ref={imgRef}
                    src={detectionService.getFrameUrl(video?.id || "", currentFrame)}
                    alt={`Frame ${currentFrame}`}
                    className="w-full h-full object-contain"
                    onLoad={drawTrajectory}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 pointer-events-none w-full h-full"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">No frames available.</p>
              )}
            </CardContent>

            {/* Playback Controls */}
            <div className="p-4 bg-card flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentFrame(1)}
                  disabled={currentFrame <= 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentFrame((prev) => Math.max(1, prev - 1))}
                  disabled={currentFrame <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 w-16 gap-1"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3 w-3 fill-current" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 fill-current" /> Play
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentFrame((prev) => Math.min(totalFramesCount, prev + 1))}
                  disabled={currentFrame >= totalFramesCount}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentFrame(totalFramesCount)}
                  disabled={currentFrame >= totalFramesCount}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Slider bar */}
              <div className="flex-1 w-full mx-4 flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max={totalFramesCount}
                  value={currentFrame}
                  onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-secondary accent-primary rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs font-semibold font-mono text-foreground shrink-0">
                  {currentFrame} / {totalFramesCount}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Selected Track Details Panel */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-sm">Track Inspector & Metrics</CardTitle>
              <CardDescription>
                Live speed and distance statistics for target track ID.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Person Track Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">Select Target Track ID</label>
                <select
                  value={selectedTrackId || ""}
                  onChange={(e) => {
                    const tid = parseInt(e.target.value);
                    setSelectedTrackId(tid);
                    const trk = tracks.find((t) => t.track_id === tid);
                    if (trk) setCurrentFrame(trk.first_frame); // jump frame to track start
                  }}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2 text-foreground focus:outline-hidden"
                >
                  {tracks.map((t) => (
                    <option key={t.id} value={t.track_id}>
                      Track #{t.track_id} - Class: {t.class_name} ({t.total_frames} frames)
                    </option>
                  ))}
                  {tracks.length === 0 && <option>No tracks generated</option>}
                </select>
              </div>

              {activeTrack ? (
                <div className="divide-y divide-border/60 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted-foreground">Class Name</span>
                    <span className="font-semibold text-foreground capitalize">{activeTrack.class_name}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted-foreground">Timeline Range</span>
                    <span className="font-semibold text-foreground font-mono">
                      Frames {activeTrack.first_frame} - {activeTrack.last_frame}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted-foreground">Tracking Duration</span>
                    <span className="font-semibold text-foreground font-mono">
                      {activeTrack.track_duration.toFixed(2)} seconds
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted-foreground">Average Speed</span>
                    <span className="font-semibold text-foreground font-mono">
                      {activeTrack.average_speed.toFixed(1)} px/s
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted-foreground">Displacement Distance</span>
                    <span className="font-semibold text-foreground font-mono">
                      {activeTrack.distance_travelled.toFixed(1)} px
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted-foreground">Video Frame Coverage</span>
                    <span className="font-semibold text-foreground font-mono">
                      {(activeTrack.frame_coverage * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-muted-foreground">Mean Confidence</span>
                    <span className="font-semibold text-foreground font-mono text-primary">
                      {(activeTrack.average_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  
                  {/* Trajectory Timeline coordinates preview */}
                  <div className="pt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                      Trajectory Centers History
                    </span>
                    <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                      {activeTrack.trajectory.map((pt, idx) => (
                        <div
                          key={idx}
                          className={`p-1.5 border rounded-lg flex items-center justify-between text-[10px] ${
                            pt.frame_number === currentFrame
                              ? "bg-primary/10 border-primary/20"
                              : "bg-background border-border/80"
                          }`}
                        >
                          <span className="font-mono font-bold text-foreground">Frame #{pt.frame_number}</span>
                          <span className="font-mono text-muted-foreground">X: {pt.center_x}, Y: {pt.center_y}</span>
                          <span className="font-mono text-muted-foreground">{pt.timestamp.toFixed(1)}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No track selected or available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tracks Database inventory Table */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-5">
          <div>
            <CardTitle className="text-md">Tracks Inventory Database</CardTitle>
            <CardDescription>
              Complete list of entities tracked by ByteTrack including movement diagnostics. Click on a track row to select it.
            </CardDescription>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by track ID or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-hidden focus:border-primary"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t border-border overflow-hidden">
          {filteredTracks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Track ID</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Frame Range</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Total Frames</th>
                    <th className="py-3 px-4">Travelled Distance</th>
                    <th className="py-3 px-4">Avg Speed</th>
                    <th className="py-3 px-4">Coverage</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTracks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTrackId(t.track_id)}
                      className={`cursor-pointer transition-colors hover:bg-secondary/25 ${
                        t.track_id === selectedTrackId ? "bg-primary/5 hover:bg-primary/10" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        Track #{t.track_id}
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold text-foreground">
                        {t.class_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {t.first_frame} - {t.last_frame}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {t.track_duration.toFixed(2)}s
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {t.total_frames}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {t.distance_travelled.toFixed(0)} px
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {t.average_speed.toFixed(1)} px/s
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {(t.frame_coverage * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 py-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTrackId(t.track_id);
                            setCurrentFrame(t.first_frame);
                            window.scrollTo({ top: 380, behavior: "smooth" });
                          }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Search className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <h4 className="font-semibold text-sm">No tracks found</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No tracking database records match search phrase "{searchQuery}". Try updating your query or trigger a re-run.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </LayoutWrapper>
  );
};

export default TrackingDashboard;
