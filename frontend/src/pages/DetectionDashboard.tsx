import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Briefcase,
  Smartphone,
  GlassWater,
  Armchair,
  CupSoda,
  Search,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  Database,
  Info,
  Layers
} from "lucide-react";
import LayoutWrapper from "@/components/LayoutWrapper";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Button from "@/components/Button";
import Spinner from "@/components/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import detectionService, { DetectionResult, DetectionStatistics } from "@/services/detectionService";
import processingService, { ProcessingJobDetails } from "@/services/processingService";
import videoService, { VideoDetails } from "@/services/videoService";

const DetectionDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [job, setJob] = useState<ProcessingJobDetails | null>(null);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [statistics, setStatistics] = useState<DetectionStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation & playback state
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // Filters
  const [searchClass, setSearchClass] = useState<string>("");
  const [minConfidence, setMinConfidence] = useState<number>(0.25);
  
  // Playback timer ref
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load dashboard data
  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [videoData, jobData, detectionsData, statsData] = await Promise.all([
        videoService.getVideoDetails(id),
        processingService.getStatus(id).catch(() => null),
        detectionService.getDetections(id),
        detectionService.getStatistics(id)
      ]);

      setVideo(videoData);
      setJob(jobData);
      setDetections(detectionsData);
      setStatistics(statsData);
      
      // If we have detections, default to the first frame that contains a detection
      if (detectionsData.length > 0) {
        const sortedFrames = [...detectionsData].sort((a, b) => a.frame_number - b.frame_number);
        setCurrentFrame(sortedFrames[0].frame_number);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load detection dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [id]);

  // Handle Play/Pause
  useEffect(() => {
    if (isPlaying) {
      const maxFrame = job?.total_frames || 1;
      playbackTimerRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= maxFrame) {
            setIsPlaying(false);
            return 1; // loop back to first frame
          }
          return prev + 1;
        });
      }, 1000); // 1 frame per second (configurable)
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, job]);

  // Filter detections across the table
  const filteredDetections = detections.filter((d) => {
    const matchesSearch = d.class_name.toLowerCase().includes(searchClass.toLowerCase());
    const matchesConfidence = d.confidence >= minConfidence;
    return matchesSearch && matchesConfidence;
  });

  // Filter detections on the current active frame in the viewer
  const activeFrameDetections = detections.filter(
    (d) => d.frame_number === currentFrame && d.confidence >= minConfidence
  );

  const totalFramesCount = job?.total_frames || 1;

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
          <Spinner className="h-8 w-8 text-primary mb-2" />
          <p className="text-sm text-muted-foreground font-semibold">Analyzing detection records...</p>
        </div>
      </LayoutWrapper>
    );
  }

  if (error || !video) {
    return (
      <LayoutWrapper>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] text-center max-w-md mx-auto">
          <Info className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
          <p className="text-sm text-muted-foreground mb-6">{error || "Video asset not found."}</p>
          <Button onClick={() => navigate(`/videos/${id}`)}>Back to Details</Button>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      {/* Back Button */}
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/videos/${id}`)}
          className="h-8 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Asset Details
        </Button>
      </div>

      <PageHeader
        title="YOLO AI Detection Intelligence"
        subtitle={`Video Asset: ${video.original_filename} (ID: ${video.id})`}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mt-6">
        <StatCard
          title="Detections"
          value={statistics?.total_detections || 0}
          icon={Layers}
          description="Total detected objects"
        />
        <StatCard
          title="People"
          value={statistics?.people || 0}
          icon={Users}
          description="YOLO person class"
        />
        <StatCard
          title="Bags"
          value={statistics?.bags || 0}
          icon={Briefcase}
          description="Backpack, Suitcase, Handbag"
        />
        <StatCard
          title="Phones"
          value={statistics?.phones || 0}
          icon={Smartphone}
          description="Cell phone class"
        />
        <StatCard
          title="Bottles"
          value={statistics?.bottles || 0}
          icon={GlassWater}
          description="Bottle class"
        />
        <StatCard
          title="Chairs"
          value={statistics?.chairs || 0}
          icon={Armchair}
          description="Chair class"
        />
        <StatCard
          title="Cups"
          value={statistics?.cups || 0}
          icon={CupSoda}
          description="Cup class"
        />
        
        {/* Others Statistics Count Card */}
        <Card className="overflow-hidden group" hoverEffect>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground tracking-wide uppercase">Others</p>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Database className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                {Object.values(statistics?.others || {}).reduce((a, b) => a + b, 0)}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                {Object.keys(statistics?.others || {}).slice(0, 2).join(", ") || "No other classes"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Left Frame Viewer, Right Info panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        
        {/* Frame Viewer Box */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="py-4">
              <CardTitle className="text-md flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-primary" />
                Annotated Overlay Frame
              </CardTitle>
              <CardDescription>
                Frame {currentFrame} of {totalFramesCount} (Timestamp: {((currentFrame - 1) * (job?.total_frames ? 1.0 : 1.0)).toFixed(1)}s)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 bg-slate-950 flex justify-center items-center aspect-video relative border-y border-border">
              {totalFramesCount > 0 ? (
                <img
                  src={detectionService.getFrameUrl(video.id, currentFrame)}
                  alt={`Annotated frame ${currentFrame}`}
                  className="w-full h-full object-contain"
                  onError={(_e) => {
                    console.error(`Failed to load annotated frame: ${currentFrame}`);
                  }}
                />
              ) : (
                <p className="text-sm text-slate-500">No frames extracted for this job.</p>
              )}
            </CardContent>
            
            {/* Viewer Controls */}
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

              {/* Slider timeline */}
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

        {/* Frame Bounding Box Details List */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-sm">Objects on Current Frame</CardTitle>
              <CardDescription>
                Detections matching criteria on Frame {currentFrame}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeFrameDetections.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {activeFrameDetections.map((det) => (
                    <div
                      key={det.id}
                      className="p-2.5 bg-background border border-border/80 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-foreground block capitalize">
                          {det.class_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          BBox: [{Math.round(det.bbox_x)}, {Math.round(det.bbox_y)}, {Math.round(det.bbox_width)}, {Math.round(det.bbox_height)}]
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                        {(det.confidence * 100).toFixed(0)}% Conf
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No objects detected on this frame matching the confidence threshold.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detections Query Table Card */}
      <Card className="mt-6">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-5">
          <div>
            <CardTitle className="text-md">Detection Library database</CardTitle>
            <CardDescription>
              Filter and search all objects detected in the video asset. Click any row to jump to its frame.
            </CardDescription>
          </div>
          
          {/* Query Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by object class..."
                value={searchClass}
                onChange={(e) => setSearchClass(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-hidden focus:border-primary"
              />
            </div>
            
            {/* Confidence Slider filter */}
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1 text-xs">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground font-medium shrink-0">Min Conf:</span>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="w-24 h-1 bg-secondary accent-primary rounded-lg appearance-none cursor-pointer"
              />
              <span className="font-mono font-bold text-foreground w-8">
                {(minConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </CardHeader>
        
        {/* Table Body */}
        <CardContent className="p-0 border-t border-border overflow-hidden">
          {filteredDetections.length > 0 ? (
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Frame Number</th>
                    <th className="py-3 px-4">Timestamp (s)</th>
                    <th className="py-3 px-4">Object Class</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Bounding Box (XYWH)</th>
                    <th className="py-3 px-4">Model Engine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDetections.map((det) => (
                    <tr
                      key={det.id}
                      onClick={() => {
                        setCurrentFrame(det.frame_number);
                        window.scrollTo({ top: 400, behavior: "smooth" }); // scroll up to the frame viewer
                      }}
                      className={`cursor-pointer transition-colors hover:bg-secondary/25 ${
                        det.frame_number === currentFrame ? "bg-primary/5 hover:bg-primary/10" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        #{det.frame_number}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {det.timestamp_seconds.toFixed(2)}s
                      </td>
                      <td className="py-3 px-4 font-semibold capitalize text-foreground">
                        {det.class_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold font-mono text-[10px] border ${
                            det.confidence >= 0.7
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : det.confidence >= 0.4
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400"
                              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400"
                          }`}
                        >
                          {(det.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        [{Math.round(det.bbox_x)}, {Math.round(det.bbox_y)}, {Math.round(det.bbox_width)}, {Math.round(det.bbox_height)}]
                      </td>
                      <td className="py-3 px-4 text-[10px] text-muted-foreground font-semibold">
                        {det.model_name} ({det.model_version})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Search className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <h4 className="font-semibold text-sm">No detections found</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No database records match your search phrase "{searchClass}" or confidence criteria. Try adjusting the query filter selectors.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </LayoutWrapper>
  );
};

export default DetectionDashboard;
