import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Layers,
  Activity,
  BarChart3,
  AlertTriangle,
  Play,
  Pause,
  Plus,
  Trash2,
  Save,
  Send,
  Sparkles,
  FileSpreadsheet,
  FileDown,
  RefreshCw,
  Search,
} from "lucide-react";
import LayoutWrapper from "@/components/LayoutWrapper";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Button from "@/components/Button";
import Spinner from "@/components/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";

import intelligenceService, {
  ZoneDetails,
  BehaviorEvent,
  BehaviorStatistics
} from "@/services/intelligenceService";
import detectionService from "@/services/detectionService";
import processingService, { ProcessingJobDetails } from "@/services/processingService";
import videoService, { VideoDetails } from "@/services/videoService";

const ZoneTypes = ["Entry", "Exit", "Shelf", "Checkout", "Queue", "Restricted", "Custom"];
const ZoneColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const IntelligenceDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Assets State
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [job, setJob] = useState<ProcessingJobDetails | null>(null);
  const [zones, setZones] = useState<ZoneDetails[]>([]);
  const [events, setEvents] = useState<BehaviorEvent[]>([]);
  const [statistics, setStatistics] = useState<BehaviorStatistics | null>(null);

  // UI / Loader state
  const [_loading, setLoading] = useState<boolean>(true);
  const [_error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"editor" | "behavior" | "ai" | "analytics">("editor");

  // Playback state
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Zone Editor state
  const [editorMode, setEditorMode] = useState<"view" | "draw">("view");
  const [newZoneName, setNewZoneName] = useState<string>("");
  const [newZoneType, setNewZoneType] = useState<string>("Shelf");
  const [newZoneColor, setNewZoneColor] = useState<string>("#3b82f6");
  const [newZoneDesc, setNewZoneDesc] = useState<string>("");
  const [newPoints, setNewPoints] = useState<number[][]>([]); // [[x, y], ...]
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // imgLoaded triggers re-render so SVG coords are computed after image paints
  const [imgLoaded, setImgLoaded] = useState(false);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string; source?: string }>>([
    { sender: "ai", text: "Hello! I am your surveillance AI Search Assistant. Ask me anything about behaviors, zone occupancy, or loitering events in this video asset. (e.g. 'Who entered Shelf A?')" }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Search Filter
  const [searchEventQuery, setSearchEventQuery] = useState<string>("");


  // Load Initial Data
  const loadData = async (showSpinner = true) => {
    if (!id) return;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [videoData, jobData, zonesData, eventsData, statsData] = await Promise.all([
        videoService.getVideoDetails(id),
        processingService.getStatus(id),
        intelligenceService.getZones(id),
        intelligenceService.getBehaviorEvents(id).catch(() => []),
        intelligenceService.getBehaviorStatistics(id).catch(() => null)
      ]);

      setVideo(videoData);
      setJob(jobData);
      setZones(zonesData);
      setEvents(eventsData);
      setStatistics(statsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load intelligence intelligence layers.");
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

  // Handle Playback Slide Loop
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

  // Handle image clicks for drawing polygon points
  const handleImageClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (editorMode !== "draw") return;
    const img = imgRef.current;
    if (!img) return;

    // Get click position relative to client image displayed size
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Normalize coordinates back to original natural image dimension scale
    const normX = Math.round((clickX / rect.width) * (img.naturalWidth || 1920));
    const normY = Math.round((clickY / rect.height) * (img.naturalHeight || 1080));

    setNewPoints([...newPoints, [normX, normY]]);
  };

  // Drag handles helper — stub for future drag-to-reposition interaction
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  // Create Zone trigger
  const handleSaveZone = async () => {
    if (!id) return;
    if (!newZoneName) {
      alert("Please provide a name for this zone.");
      return;
    }
    if (newPoints.length < 3) {
      alert("A monitoring zone must contain at least 3 points.");
      return;
    }

    setActionLoading(true);
    try {
      await intelligenceService.createZone({
        video_id: id,
        name: newZoneName,
        zone_type: newZoneType,
        polygon_points: newPoints,
        color: newZoneColor,
        description: newZoneDesc
      });

      // Reset Form & reload
      setNewZoneName("");
      setNewPoints([]);
      setEditorMode("view");
      await loadData(false);
      
      // Auto run behavior engine when zones update
      await handleTriggerBehaviorAnalysis();
    } catch (err: any) {
      alert(`Failed to save zone: ${err.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Zone trigger
  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Are you sure you want to delete this monitoring zone? It will also clear associated events.")) return;
    setActionLoading(true);
    try {
      await intelligenceService.deleteZone(zoneId);
      await loadData(false);
      await handleTriggerBehaviorAnalysis();
    } catch (err: any) {
      alert(`Failed to delete zone: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Run behavior detection manually
  const handleTriggerBehaviorAnalysis = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await intelligenceService.runBehaviorDetection(id);
      await loadData(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to execute behavior engine.");
    } finally {
      setActionLoading(false);
    }
  };

  // AI chat send query
  const handleSendChat = async () => {
    if (!chatInput.trim() || !id) return;
    const userText = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setChatLoading(true);

    try {
      const resp = await intelligenceService.searchAI(userText, id);
      setChatMessages(prev => [...prev, {
        sender: "ai",
        text: resp.answer,
        source: resp.source
      }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        sender: "ai",
        text: `Error processing query: ${err.message || "API Connection failed"}`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Filter event table list
  const filteredEvents = events.filter((e) => {
    const term = searchEventQuery.toLowerCase();
    const zoneName = e.zone?.name || "";
    return e.event_type.toLowerCase().includes(term) ||
           zoneName.toLowerCase().includes(term) ||
           e.track_id.toString().includes(term);
  });

  const totalFrames = job?.total_frames || 1;

  // Render SVG points mapping scale
  const renderPolygonPointsString = useCallback((pts: number[][], imgElement: HTMLImageElement | null): string => {
    if (!imgElement || pts.length === 0) return "";
    const rect = imgElement.getBoundingClientRect();
    // Guard: image not yet painted
    if (rect.width === 0 || rect.height === 0) return "";
    const scaleX = rect.width / (imgElement.naturalWidth || 1920);
    const scaleY = rect.height / (imgElement.naturalHeight || 1080);
    return pts.map(pt => `${pt[0] * scaleX},${pt[1] * scaleY}`).join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  return (
    <LayoutWrapper>
      {/* Back button */}
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
        title="Enterprise Intelligence Center"
        subtitle={`Zone Modeling & Behavior Intelligence Layer: ${video?.original_filename}`}
      />

      {/* Metric aggregate widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatCard
          title="Configured Zones"
          value={zones.length}
          icon={Layers}
          description="Monitored areas"
        />
        <StatCard
          title="Logged Events"
          value={statistics?.total_events || 0}
          icon={Activity}
          description="Surveillance triggers"
        />
        <StatCard
          title="Loitering Alerts"
          value={statistics?.loitering_count || 0}
          icon={RefreshCw}
          description="Stayed > 10 seconds"
        />
        <StatCard
          title="Security Violations"
          value={statistics?.security_alerts_count || 0}
          icon={AlertTriangle}
          description="Restricted area triggers"
          className={statistics?.security_alerts_count && statistics.security_alerts_count > 0 ? "border-red-500/20 bg-red-500/5 text-red-500" : ""}
        />
      </div>

      {/* Tabs list navigation */}
      <div className="flex border-b border-border mt-6 gap-2">
        <Button
          variant={activeTab === "editor" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("editor")}
          className="rounded-t-xl rounded-b-none h-10 px-4 font-semibold"
        >
          <Layers className="h-4 w-4 mr-1.5" />
          Interactive Zone Editor
        </Button>
        <Button
          variant={activeTab === "behavior" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("behavior")}
          className="rounded-t-xl rounded-b-none h-10 px-4 font-semibold"
        >
          <Activity className="h-4 w-4 mr-1.5" />
          Behavior Events Log
        </Button>
        <Button
          variant={activeTab === "ai" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("ai")}
          className="rounded-t-xl rounded-b-none h-10 px-4 font-semibold text-primary"
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          AI Search Assistant
        </Button>
        <Button
          variant={activeTab === "analytics" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("analytics")}
          className="rounded-t-xl rounded-b-none h-10 px-4 font-semibold"
        >
          <BarChart3 className="h-4 w-4 mr-1.5" />
          Analytics & Reports
        </Button>
      </div>

      {/* Tab Contents: ZONE EDITOR */}
      {activeTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          
          {/* Main draw screen panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Zone Editor Canvas</CardTitle>
                  <CardDescription>
                    {editorMode === "draw" ? "Click on the image frame to draw polygon corner handles." : "View existing zones modeled overlay."}
                  </CardDescription>
                </div>
                {editorMode === "view" ? (
                  <Button variant="primary" size="sm" className="h-8" onClick={() => { setEditorMode("draw"); setNewPoints([]); }}>
                    <Plus className="h-4 w-4 mr-1" /> Add New Zone
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setEditorMode("view")}>
                      Cancel
                    </Button>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setNewPoints([])} disabled={newPoints.length === 0}>
                      Reset Points
                    </Button>
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="p-0 bg-slate-950 flex justify-center items-center aspect-video relative border-y border-border" ref={imageContainerRef}>
                <img
                  ref={imgRef}
                  src={detectionService.getFrameUrl(id || "", currentFrame)}
                  alt="Surveillance Frame"
                  className="w-full h-full object-contain select-none pointer-events-none"
                  onLoad={() => setImgLoaded(true)}
                />

                {/* SVG interactive overlays layer */}
                <svg
                  className={`absolute top-0 left-0 w-full h-full ${editorMode === "draw" ? "cursor-crosshair" : ""}`}
                  onClick={handleImageClick}
                >
                  {/* 1. Render Existing Zones */}
                  {zones.map((z) => {
                    const ptsStr = renderPolygonPointsString(z.polygon_points, imgRef.current);
                    const isHovered = hoveredZoneId === z.id;
                    return (
                      <polygon
                        key={z.id}
                        points={ptsStr}
                        fill={z.color}
                        fillOpacity={isHovered ? 0.35 : 0.15}
                        stroke={z.color}
                        strokeWidth={isHovered ? 3 : 1.5}
                        onMouseEnter={() => setHoveredZoneId(z.id)}
                        onMouseLeave={() => setHoveredZoneId(null)}
                        className="transition-all duration-150"
                      />
                    );
                  })}

                  {/* 2. Render Zone Names Text badges overlay */}
                  {zones.map((z) => {
                    if (z.polygon_points.length === 0 || !imgRef.current) return null;
                    const rect = imgRef.current.getBoundingClientRect();
                    const scaleX = rect.width / (imgRef.current.naturalWidth || 1920);
                    const scaleY = rect.height / (imgRef.current.naturalHeight || 1080);
                    // Center point calculation of polygon
                    const xs = z.polygon_points.map(p => p[0] * scaleX);
                    const ys = z.polygon_points.map(p => p[1] * scaleY);
                    const cx = xs.reduce((sum, v) => sum + v, 0) / xs.length;
                    const cy = ys.reduce((sum, v) => sum + v, 0) / ys.length;

                    return (
                      <g key={`lbl-${z.id}`} className="pointer-events-none">
                        <rect
                          x={cx - 35}
                          y={cy - 10}
                          width={70}
                          height={16}
                          rx={3}
                          fill="#1e1b4b"
                          fillOpacity={0.8}
                        />
                        <text
                          x={cx}
                          y={cy + 1}
                          fill="#ffffff"
                          fontSize={8}
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {z.name} ({z.zone_type})
                        </text>
                      </g>
                    );
                  })}

                  {/* 3. Render New Polygon Drawing in progress */}
                  {editorMode === "draw" && newPoints.length > 0 && (
                    <>
                      {/* Polygon shaded path */}
                      {newPoints.length >= 3 && (
                        <polygon
                          points={renderPolygonPointsString(newPoints, imgRef.current)}
                          fill={newZoneColor}
                          fillOpacity={0.25}
                          stroke={newZoneColor}
                          strokeWidth={2}
                        />
                      )}
                      {/* Bounding lines segment trace */}
                      {newPoints.length < 3 && newPoints.map((pt, idx) => {
                        if (idx === 0) return null;
                        const prev = newPoints[idx - 1];
                        const rect = imgRef.current!.getBoundingClientRect();
                        const scaleX = rect.width / (imgRef.current!.naturalWidth || 1920);
                        const scaleY = rect.height / (imgRef.current!.naturalHeight || 1080);
                        return (
                          <line
                            key={`line-${idx}`}
                            x1={prev[0] * scaleX}
                            y1={prev[1] * scaleY}
                            x2={pt[0] * scaleX}
                            y2={pt[1] * scaleY}
                            stroke={newZoneColor}
                            strokeWidth={2}
                          />
                        );
                      })}
                      {/* Points Handles (Circles) */}
                      {newPoints.map((pt, idx) => {
                        const rect = imgRef.current!.getBoundingClientRect();
                        const scaleX = rect.width / (imgRef.current!.naturalWidth || 1920);
                        const scaleY = rect.height / (imgRef.current!.naturalHeight || 1080);
                        return (
                          <circle
                            key={`pt-${idx}`}
                            cx={pt[0] * scaleX}
                            cy={pt[1] * scaleY}
                            r={6}
                            fill="#ffffff"
                            stroke={newZoneColor}
                            strokeWidth={2}
                          />
                        );
                      })}
                    </>
                  )}
                </svg>
              </CardContent>

              {/* Slider / Playback controls */}
              <div className="p-4 bg-card flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={totalFrames}
                    value={currentFrame}
                    onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-secondary accent-primary rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-semibold font-mono text-foreground shrink-0">
                    {currentFrame} / {totalFrames}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right side form editor controls */}
          <div className="space-y-4">
            {editorMode === "draw" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Define Monitoring Area</CardTitle>
                  <CardDescription>
                    Fill in zone parameters. Draw points on the canvas (at least 3).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">Zone Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Shelf A, Restrict Lobby"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      className="w-full text-xs bg-background border border-border rounded-lg p-2 text-foreground focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">Zone Type</label>
                    <select
                      value={newZoneType}
                      onChange={(e) => setNewZoneType(e.target.value)}
                      className="w-full text-xs bg-background border border-border rounded-lg p-2 text-foreground focus:outline-hidden"
                    >
                      {ZoneTypes.map((t) => (
                        <option key={t} value={t}>{t} Area</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">Zone Outline Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {ZoneColors.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewZoneColor(col)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${newZoneColor === col ? "border-foreground scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">Description (Optional)</label>
                    <textarea
                      placeholder="Security monitoring descriptions..."
                      value={newZoneDesc}
                      onChange={(e) => setNewZoneDesc(e.target.value)}
                      className="w-full text-xs bg-background border border-border rounded-lg p-2 h-20 text-foreground focus:outline-hidden"
                    />
                  </div>

                  <div className="bg-secondary/40 rounded-lg p-3 text-[11px] text-muted-foreground font-mono space-y-1">
                    <span className="font-semibold text-foreground">Polygon points buffer ({newPoints.length}):</span>
                    <div className="max-h-[80px] overflow-y-auto space-y-1">
                      {newPoints.map((pt, idx) => (
                        <div key={idx}>P{idx+1}: X: {pt[0]}, Y: {pt[1]}</div>
                      ))}
                      {newPoints.length === 0 && <div>Click inside image frame to insert corner coordinates.</div>}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditorMode("view"); setNewPoints([]); }}>
                      Discard
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveZone} isLoading={actionLoading} disabled={newPoints.length < 3 || !newZoneName}>
                      <Save className="h-3.5 w-3.5 mr-1" /> Save Zone Model
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Configured Surveillance Zones</CardTitle>
                  <CardDescription>
                    List of monitoring barriers currently modeled for behavior rule detections.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 border-t border-border overflow-hidden">
                  {zones.length > 0 ? (
                    <div className="divide-y divide-border">
                      {zones.map((z) => (
                        <div
                          key={z.id}
                          onMouseEnter={() => setHoveredZoneId(z.id)}
                          onMouseLeave={() => setHoveredZoneId(null)}
                          className={`p-3 text-xs transition-colors flex items-center justify-between ${hoveredZoneId === z.id ? "bg-secondary/40" : ""}`}
                        >
                          <div className="space-y-1">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                              {z.name}
                            </h4>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{z.zone_type} Zone | {z.polygon_points.length} nodes</p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteZone(z.id)}
                            isLoading={actionLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No security zones configured. Draw one on the left.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab Contents: BEHAVIOR LOGS */}
      {activeTab === "behavior" && (
        <div className="mt-6">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-5">
              <div>
                <CardTitle className="text-sm">PostgreSQL Behavior Events Log</CardTitle>
                <CardDescription>
                  Surveillance incidents detected frame-by-frame by the point-in-polygon rules engine.
                </CardDescription>
              </div>

              <div className="flex gap-3">
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filter by event, zone..."
                    value={searchEventQuery}
                    onChange={(e) => setSearchEventQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-hidden"
                  />
                </div>
                
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8"
                  onClick={handleTriggerBehaviorAnalysis}
                  isLoading={actionLoading}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Re-Run Engine Rules
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t border-border overflow-hidden">
              {filteredEvents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase font-bold tracking-wider">
                        <th className="py-3 px-4">Event Type</th>
                        <th className="py-3 px-4">Track ID</th>
                        <th className="py-3 px-4">Zone Location</th>
                        <th className="py-3 px-4">Frame Range</th>
                        <th className="py-3 px-4">Time Range</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Confidence</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredEvents.map((e) => {
                        const isAlert = e.event_type === "Restricted Area Entry";
                        return (
                          <tr
                            key={e.id}
                            className={`transition-colors hover:bg-secondary/25 ${isAlert ? "bg-red-500/5 hover:bg-red-500/10" : ""}`}
                          >
                            <td className={`py-3 px-4 font-semibold ${isAlert ? "text-red-500" : "text-foreground"}`}>
                              {e.event_type}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-foreground">
                              Track #{e.track_id}
                            </td>
                            <td className="py-3 px-4">
                              {e.zone ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.zone.color }} />
                                  {e.zone.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">
                              {e.start_frame} - {e.end_frame}
                            </td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">
                              {e.start_timestamp.toFixed(1)}s - {e.end_timestamp.toFixed(1)}s
                            </td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">
                              {e.duration > 0.0 ? `${e.duration.toFixed(1)}s` : "-"}
                            </td>
                            <td className="py-3 px-4 font-mono text-primary">
                              {(e.confidence * 100).toFixed(0)}%
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {e.metadata_json.description || ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground space-y-1">
                  <Activity className="h-8 w-8 text-muted-foreground/45 mx-auto" />
                  <h4 className="font-semibold text-sm">No behavior events registered</h4>
                  <p className="text-xs text-slate-500">Run the behavior detection engine rules on tracks.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Contents: AI CHAT ASSISTANT */}
      {activeTab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          
          {/* Chat bubbles list */}
          <div className="lg:col-span-3">
            <Card className="h-[480px] flex flex-col justify-between overflow-hidden">
              <CardHeader className="py-3.5 border-b border-border">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5 text-primary" />
                  SentralQ Enterprise AI Chat Assistant
                </CardTitle>
                <CardDescription>
                  Ask surveillance questions. LLM searches tracks and behavior database tables directly.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[80%] rounded-2xl p-3 text-xs ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground ml-auto rounded-tr-none"
                        : "bg-secondary border border-border text-foreground rounded-tl-none"
                    }`}
                  >
                    <span className="whitespace-pre-line font-medium leading-relaxed">{msg.text}</span>
                    {msg.source && (
                      <span className="text-[9px] text-muted-foreground/60 uppercase font-mono tracking-wider font-bold mt-1.5 block">
                        Source: {msg.source}
                      </span>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-secondary border border-border text-foreground rounded-2xl rounded-tl-none p-3 max-w-[120px] flex items-center gap-1.5">
                    <Spinner className="h-3 w-3 text-primary animate-spin" />
                    <span className="text-[10px] text-muted-foreground font-semibold">AI Searching...</span>
                  </div>
                )}
              </CardContent>

              {/* Chat Input panel */}
              <div className="p-3 border-t border-border flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Who stayed longer than 20 seconds? Summarize security alerts."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                  className="flex-1 pl-3 pr-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-hidden"
                  disabled={chatLoading}
                />
                <Button
                  variant="primary"
                  size="icon"
                  className="h-8 w-8 rounded-xl shrink-0"
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Quick prompt templates suggestion side panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Search Suggestions</CardTitle>
                <CardDescription>Click template query to execute assistant search.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {[
                  "Show everyone who entered Shelf A.",
                  "Who stayed longer than 20 seconds?",
                  "Find suspicious activities.",
                  "Summarize customer movements.",
                  "Generate surveillance summary."
                ].map((promptText) => (
                  <button
                    key={promptText}
                    type="button"
                    onClick={() => setChatInput(promptText)}
                    className="w-full text-left text-xs bg-background hover:bg-secondary/45 border border-border p-2 rounded-lg text-foreground transition-colors"
                  >
                    {promptText}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab Contents: ANALYTICS & REPORTS */}
      {activeTab === "analytics" && (
        <div className="space-y-6 mt-6 animate-fade-in">
          
          {/* Export Report Widget */}
          <Card className="border border-indigo-500/25 bg-indigo-500/5">
            <CardHeader className="py-4">
              <CardTitle className="text-sm flex items-center gap-1.5 text-indigo-400">
                <FileDown className="h-4.5 w-4.5" />
                Surveillance Audit Report Exporters
              </CardTitle>
              <CardDescription>
                Download CSV spreadsheets or ReportLab generated PDF audits for tracking incidents and customer dwell metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 pt-2">
              <a
                href={intelligenceService.getReportDownloadUrl(id || "", "csv", "incident")}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-border/80 bg-background text-xs font-semibold text-foreground hover:bg-secondary rounded-xl transition-all"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                Download Incident CSV Report
              </a>
              <a
                href={intelligenceService.getReportDownloadUrl(id || "", "pdf", "incident")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-border/80 bg-background text-xs font-semibold text-foreground hover:bg-secondary rounded-xl transition-all"
              >
                <FileDown className="h-4 w-4 text-red-500" />
                Open PDF Incident Report
              </a>
              <a
                href={intelligenceService.getReportDownloadUrl(id || "", "pdf", "summary")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-border/80 bg-background text-xs font-semibold text-foreground hover:bg-secondary rounded-xl transition-all"
              >
                <FileDown className="h-4 w-4 text-indigo-500" />
                Open PDF Behavior Summary
              </a>
            </CardContent>
          </Card>

          {/* Custom CSS/SVG Analytics Charts grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Top Visited Zones chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Zone Traffic (Visit counts)</CardTitle>
                <CardDescription>Total Entered Zone triggers per zone area.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {statistics?.top_visited_zones && statistics.top_visited_zones.length > 0 ? (
                  statistics.top_visited_zones.map((item, idx) => {
                    const maxVal = Math.max(...statistics.top_visited_zones.map(z => z.count)) || 1;
                    const percent = (item.count / maxVal) * 100;
                    return (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className="flex justify-between font-medium">
                          <span>{item.zone_name}</span>
                          <span className="font-mono text-muted-foreground font-semibold">{item.count} entries</span>
                        </div>
                        <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">No zone visit records.</div>
                )}
              </CardContent>
            </Card>

            {/* Average Dwell Times chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Mean Dwell/Loitering Times</CardTitle>
                <CardDescription>Average dwell duration (seconds) per configured zone.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {statistics?.average_dwell_times && statistics.average_dwell_times.length > 0 ? (
                  statistics.average_dwell_times.map((item, idx) => {
                    const maxVal = Math.max(...statistics.average_dwell_times.map(z => z.avg_dwell_seconds)) || 1;
                    const percent = (item.avg_dwell_seconds / maxVal) * 100;
                    return (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className="flex justify-between font-medium">
                          <span>{item.zone_name}</span>
                          <span className="font-mono text-muted-foreground font-semibold">{item.avg_dwell_seconds.toFixed(1)} seconds</span>
                        </div>
                        <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">No dwell time metrics available.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Behavior Timelines distribution card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity timeline timeline triggers</CardTitle>
              <CardDescription>Occurrence range plot for logged behavior events.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {statistics?.timeline && statistics.timeline.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 text-xs font-mono">
                   {statistics.timeline.map((item, idx) => {
                    const isAlert = item.event_type === "Restricted Area Entry";
                    const endTime = item.start_timestamp + item.duration;
                    return (
                      <div
                        key={idx}
                        className={`p-2 border rounded-lg flex items-center justify-between ${
                          isAlert ? "bg-red-500/5 border-red-500/20" : "bg-background border-border/80"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isAlert ? "bg-red-500" : "bg-primary"}`} />
                          <span className="font-bold text-foreground">{item.event_type}</span>
                          <span className="text-muted-foreground">| Track #{item.track_id} in {item.zone_name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          Time: {item.start_timestamp.toFixed(1)}s - {endTime.toFixed(1)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">No timeline distribution.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </LayoutWrapper>
  );
};

export default IntelligenceDashboard;
