import React, { useEffect, useState, useCallback, useMemo } from "react";
import { 
  BarChart3, 
  Activity, 
  Layers, 
  ShieldAlert, 
  TrendingUp, 
  RefreshCw, 
  Clock, 
  Compass,
  AlertTriangle
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import LayoutWrapper from "@/components/LayoutWrapper";
import StatCard from "@/components/StatCard";
import Spinner from "@/components/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import videoService, { VideoDetails } from "@/services/videoService";
import analyticsService, { AnalyticsOverview } from "@/services/analyticsService";
import { useToast } from "@/contexts/ToastContext";

const Analytics: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<VideoDetails[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("all");
  const [data, setData] = useState<AnalyticsOverview | null>(null);

  const fetchAnalytics = useCallback(async (videoId?: string) => {
    setLoading(true);
    try {
      const overview = await analyticsService.getOverview(videoId);
      setData(overview);
    } catch (err: any) {
      toast.error("Failed to load analytics", err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInitialData = useCallback(async () => {
    try {
      const videoList = await videoService.listVideos({ page: 1, size: 100 });
      setVideos(videoList.items);
      fetchAnalytics();
    } catch (err: any) {
      toast.error("Failed to load initial data", err.message);
    }
  }, [fetchAnalytics, toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleVideoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedVideoId(val);
    if (val === "all") {
      fetchAnalytics();
    } else {
      fetchAnalytics(val);
    }
  };

  // Helper to format ISO Date to readable short date
  const formatShortDate = (isoString: string): string => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ─── SVG Chart 1: Area Timeline ──────────────────────────────────────────
  const timelineSvg = useMemo(() => {
    if (!data || data.daily_activity.length === 0) return null;

    const items = data.daily_activity;
    const width = 600;
    const height = 180;
    const padding = 30;

    // Find max value for scale
    const maxVal = Math.max(
      ...items.map(i => Math.max(i.detections, i.tracks * 10, i.events * 10)),
      10
    );

    const getX = (index: number) => padding + (index * (width - 2 * padding)) / (items.length - 1);
    const getY = (val: number) => height - padding - (val * (height - 2 * padding)) / maxVal;

    // Generate paths
    const detectionPoints = items.map((item, idx) => `${getX(idx)},${getY(item.detections)}`).join(" ");
    const trackPoints = items.map((item, idx) => `${getX(idx)},${getY(item.tracks * 10)}`).join(" "); // scaled up for visibility
    
    // Filled area path for detections
    const detectionArea = `${getX(0)},${height - padding} ${detectionPoints} ${getX(items.length - 1)},${height - padding}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
          <line
            key={i}
            x1={padding}
            y1={padding + r * (height - 2 * padding)}
            x2={width - padding}
            y2={padding + r * (height - 2 * padding)}
            stroke="currentColor"
            className="text-border/60"
            strokeDasharray="4 4"
          />
        ))}

        {/* Filled Area */}
        <polygon points={detectionArea} fill="url(#area-grad)" />

        {/* Trend Lines */}
        <polyline points={detectionPoints} fill="none" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinecap="round" />
        <polyline points={trackPoints} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="3 3" />

        {/* Axis Labels */}
        {items.map((item, idx) => (
          <text
            key={idx}
            x={getX(idx)}
            y={height - 10}
            fontSize={9}
            className="fill-muted-foreground font-semibold"
            textAnchor="middle"
          >
            {formatShortDate(item.date)}
          </text>
        ))}

        {/* Left axis values */}
        <text x={padding - 5} y={padding + 4} fontSize={8} className="fill-muted-foreground font-bold" textAnchor="end">
          {maxVal.toFixed(0)}
        </text>
        <text x={padding - 5} y={height - padding + 4} fontSize={8} className="fill-muted-foreground font-bold" textAnchor="end">
          0
        </text>
      </svg>
    );
  }, [data]);

  // ─── SVG Chart 2: Bar Zone Dwells ─────────────────────────────────────────
  const zoneDwellsSvg = useMemo(() => {
    if (!data || data.zone_dwell_times.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs p-4">
          <Clock className="h-8 w-8 opacity-25 mb-1.5" />
          No zone dwell data compiled.
        </div>
      );
    }

    const items = data.zone_dwell_times;
    const width = 360;
    const height = 180;
    const paddingLeft = 90;
    const paddingRight = 40;
    const paddingTop = 20;


    const maxVal = Math.max(...items.map(i => i.avg_dwell_seconds), 5);
    const barHeight = 14;
    const gap = 16;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {items.map((item, idx) => {
          const y = paddingTop + idx * (barHeight + gap);
          const barWidth = ((width - paddingLeft - paddingRight) * item.avg_dwell_seconds) / maxVal;

          return (
            <g key={item.zone_name}>
              {/* Zone Name Label */}
              <text
                x={paddingLeft - 10}
                y={y + 10}
                fontSize={10}
                fontWeight="semibold"
                className="fill-foreground"
                textAnchor="end"
              >
                {item.zone_name}
              </text>
              {/* Rounded Bar background */}
              <rect
                x={paddingLeft}
                y={y}
                width={width - paddingLeft - paddingRight}
                height={barHeight}
                rx={3}
                className="fill-secondary/60"
              />
              {/* Highlight bar */}
              <rect
                x={paddingLeft}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill="url(#bar-grad)"
              />
              {/* Value Label */}
              <text
                x={paddingLeft + barWidth + 8}
                y={y + 11}
                fontSize={9}
                fontWeight="bold"
                className="fill-primary"
              >
                {item.avg_dwell_seconds.toFixed(1)}s
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
    );
  }, [data]);

  // ─── SVG Chart 3: Pie Behavior Events ─────────────────────────────────────
  const behaviorPieSvg = useMemo(() => {
    if (!data || data.event_distribution.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs p-4">
          <Layers className="h-8 w-8 opacity-25 mb-1.5" />
          No behavior logs recorded.
        </div>
      );
    }

    const items = data.event_distribution;
    const total = items.reduce((sum, i) => sum + i.count, 0);
    const size = 180;
    const radius = 60;
    const center = size / 2;
    const strokeWidth = 16;

    let accumulatedAngle = 0;

    const colorsList = ["hsl(var(--primary))", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

    return (
      <div className="flex items-center justify-between gap-4 h-full">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-1/2 max-w-[120px] aspect-square overflow-visible">
          {items.map((item, idx) => {
            const angle = (item.count / total) * 360;
            const startAngle = accumulatedAngle;
            accumulatedAngle += angle;

            // Compute SVG arc points
            const rad1 = ((startAngle - 90) * Math.PI) / 180;
            const rad2 = (((startAngle + angle) - 90) * Math.PI) / 180;

            const x1 = center + radius * Math.cos(rad1);
            const y1 = center + radius * Math.sin(rad1);
            const x2 = center + radius * Math.cos(rad2);
            const y2 = center + radius * Math.sin(rad2);

            const largeArc = angle > 180 ? 1 : 0;
            const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

            return (
              <path
                key={item.event_type}
                d={pathData}
                fill="none"
                stroke={colorsList[idx % colorsList.length]}
                strokeWidth={strokeWidth}
                className="transition-all duration-300 hover:opacity-85"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Legend list */}
        <div className="flex-1 space-y-1 text-xs">
          {items.map((item, idx) => (
            <div key={item.event_type} className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colorsList[idx % colorsList.length] }}
                />
                <span className="font-semibold text-foreground truncate max-w-[120px]">
                  {item.event_type}
                </span>
              </div>
              <span className="font-bold text-muted-foreground text-[10px]">
                {item.count} ({((item.count / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [data]);

  return (
    <LayoutWrapper>
      {/* Upper header action area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <PageHeader
          title="Surveillance Analytics Dashboard"
          subtitle="Visualize surveillance operations, zone utilization, and threat distribution logs"
        />

        {/* Video selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Scope:</span>
          <select
            value={selectedVideoId}
            onChange={handleVideoChange}
            className="px-3 py-1.5 text-xs font-semibold bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            disabled={loading && videos.length === 0}
          >
            <option value="all">Global System Analytics</option>
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.original_filename}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (selectedVideoId === "all") {
                fetchAnalytics();
              } else {
                fetchAnalytics(selectedVideoId);
              }
            }}
            className="flex items-center justify-center p-1.5 border border-border rounded-xl text-muted-foreground hover:text-foreground bg-card hover:bg-secondary/40 transition-colors"
            title="Reload analytics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-32 flex flex-col items-center justify-center gap-2">
          <Spinner className="h-10 w-10 text-primary" />
          <p className="text-xs text-muted-foreground font-semibold">Compiling database logs...</p>
        </div>
      ) : !data ? (
        <div className="py-24 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Failed to load analytics</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Metric Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Global Detections"
              value={data.total_detections}
              icon={Activity}
              description="YOLO frame detections"
            />
            <StatCard
              title="Trajectory Tracks"
              value={data.total_tracks}
              icon={Compass}
              description="ByteTrack active tracks"
            />
            <StatCard
              title="Logged Events"
              value={data.total_events}
              icon={Layers}
              description="Zone crossing events"
            />
            <StatCard
              title="Security Alerts"
              value={data.security_alerts}
              icon={ShieldAlert}
              description="Restricted entries violation"
              trend={{ value: data.security_alerts ? "Review required" : "No violations", positive: data.security_alerts === 0 }}
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Chart 1: Operations activity */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Operational Activity Timeline
                      </CardTitle>
                      <CardDescription>Trend distribution of tracking and events over last 10 days.</CardDescription>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Detections</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Tracks (x10)</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-56">
                  {timelineSvg}
                </CardContent>
              </Card>
            </div>

            {/* Chart 2: Behavior pie */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Logged Behavior Types</CardTitle>
                  <CardDescription>Event types division registered in monitoring zones.</CardDescription>
                </CardHeader>
                <CardContent className="h-56">
                  {behaviorPieSvg}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Chart 3: Dwell times bar */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Zone Average Dwell Times</CardTitle>
                  <CardDescription>Average dwell seconds compared across configured zones.</CardDescription>
                </CardHeader>
                <CardContent className="h-56">
                  {zoneDwellsSvg}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity Table */}
            <div className="lg:col-span-2">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Intelligence Logs</CardTitle>
                  <CardDescription>List of last 10 events registered across surveillance zones.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 border-t border-border flex-1">
                  {data.recent_activity.length === 0 ? (
                    <div className="py-16 text-center text-xs text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No recent activity logs recorded in the DB.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-secondary/30 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                            <th className="px-4 py-2.5">Event Type</th>
                            <th className="px-4 py-2.5">Zone</th>
                            <th className="px-4 py-2.5">Track ID</th>
                            <th className="px-4 py-2.5">Dwell Duration</th>
                            <th className="px-4 py-2.5">Source Video</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-xs">
                          {data.recent_activity.map((item) => {
                            const isAlert = item.event_type === "Restricted Area Entry";
                            return (
                              <tr key={item.id} className="hover:bg-secondary/15 transition-colors">
                                <td className={`px-4 py-2.5 font-semibold ${isAlert ? "text-rose-500" : "text-foreground"}`}>
                                  {item.event_type}
                                </td>
                                <td className="px-4 py-2.5 font-medium">{item.zone_name}</td>
                                <td className="px-4 py-2.5 text-muted-foreground">#{item.track_id}</td>
                                <td className="px-4 py-2.5 font-medium">{item.duration}s</td>
                                <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[140px]" title={item.video_name}>
                                  {item.video_name}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
};

export default Analytics;
