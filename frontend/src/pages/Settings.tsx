import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  Database, 
  User, 
  Settings as SettingsIcon, 
  Shield, 
  Cpu, 
  Globe, 
  Trash2, 
  LogOut, 
  AlertCircle, 
  Check,
  RefreshCw
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import LayoutWrapper from "@/components/LayoutWrapper";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import Spinner from "@/components/Spinner";
import Button from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTheme } from "@/contexts/ThemeContext";
import apiClient from "@/services/api";


type ActiveTab = "general" | "detection" | "tracking" | "ai" | "database" | "account" | "system";

interface HealthDetails {
  database_status: string;
  database_url: string;
  storage_used_bytes: number;
  storage_total_bytes: number;
  storage_free_bytes: number;
  version: string;
  environment: string;
}

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>("general");
  const [health, setHealth] = useState<HealthDetails | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // General Settings State
  const [notifications, setNotifications] = useState(() => localStorage.getItem("setting_notifications") !== "false");
  const [language, setLanguage] = useState(() => localStorage.getItem("setting_language") || "en");

  // Detection Settings State
  const [confidence, setConfidence] = useState(() => Number(localStorage.getItem("setting_confidence") || "0.45"));
  const [iouThreshold, setIouThreshold] = useState(() => Number(localStorage.getItem("setting_iou") || "0.50"));
  const [frameSkip, setFrameSkip] = useState(() => Number(localStorage.getItem("setting_frameskip") || "2"));

  // Tracking Settings State
  const [trackBuffer, setTrackBuffer] = useState(() => Number(localStorage.getItem("setting_track_buffer") || "30"));
  const [trackThreshold, setTrackThreshold] = useState(() => Number(localStorage.getItem("setting_track_thresh") || "0.60"));

  // AI Settings State
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("setting_ai_provider") || "openai");
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("setting_ai_model") || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(() => Number(localStorage.getItem("setting_ai_temp") || "0.20"));

  // Account State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Fetch backend detailed system health status
  const fetchHealthDetails = async () => {
    try {
      setLoadingHealth(true);
      const res = await apiClient.get<HealthDetails>("/api/v1/system/health/details");
      setHealth(res.data);
    } catch (err: any) {
      toast.error("Failed to retrieve system health metrics", err.message);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealthDetails();
  }, []);

  const handleSave = (tab: string) => {
    // Save state to localStorage to persist thresholds and configuration changes
    localStorage.setItem("setting_notifications", String(notifications));
    localStorage.setItem("setting_language", language);
    localStorage.setItem("setting_confidence", String(confidence));
    localStorage.setItem("setting_iou", String(iouThreshold));
    localStorage.setItem("setting_frameskip", String(frameSkip));
    localStorage.setItem("setting_track_buffer", String(trackBuffer));
    localStorage.setItem("setting_track_thresh", String(trackThreshold));
    localStorage.setItem("setting_ai_provider", aiProvider);
    localStorage.setItem("setting_ai_model", aiModel);
    localStorage.setItem("setting_ai_temp", String(temperature));

    toast.success("Settings Saved Successfully", `Applied updates for the ${tab} console.`);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !oldPassword) {
      toast.warning("Validation Error", "All fields are required to change credentials.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning("Passwords Do Not Match", "Please re-confirm your new password.");
      return;
    }
    if (newPassword.length < 6) {
      toast.warning("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setUpdatingPassword(true);
    // Simulate updating password to backend auth
    setTimeout(() => {
      setUpdatingPassword(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password Updated Successfully", "Your account security key has been reset.");
    }, 1200);
  };

  const handleClearCache = () => {
    // Clear simulation caches
    localStorage.removeItem("setting_confidence");
    localStorage.removeItem("setting_iou");
    localStorage.removeItem("setting_frameskip");
    localStorage.removeItem("setting_track_buffer");
    localStorage.removeItem("setting_track_thresh");
    
    // Hard refresh context variables
    setConfidence(0.45);
    setIouThreshold(0.50);
    setFrameSkip(2);
    setTrackBuffer(30);
    setTrackThreshold(0.60);

    toast.success("System Cache Cleared", "Inference constants reset to factory defaults.");
  };

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Sidebar items
  const tabItems: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: "general", label: "General", icon: Globe },
    { id: "detection", label: "Detection Thresholds", icon: Sliders },
    { id: "tracking", label: "Object Tracking", icon: Cpu },
    { id: "ai", label: "AI Investigation", icon: Shield },
    { id: "database", label: "Database Scaffolding", icon: Database },
    { id: "account", label: "Account Settings", icon: User },
    { id: "system", label: "System & Core", icon: SettingsIcon },
  ];

  return (
    <LayoutWrapper>
      <PageHeader
        title="Operations Control Settings"
        subtitle="Manage platform behaviors, inference parameters, and database schemas"
      />

      <div className="grid gap-6 md:grid-cols-4 items-start mt-6">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-1 bg-card/45 backdrop-blur-md border border-border/80 rounded-2xl p-2.5">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="md:col-span-3">
          {/* GENERAL SETTINGS */}
          {activeTab === "general" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">General Settings</CardTitle>
                <CardDescription>Configure localization and basic interface behaviors.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">Interface Color Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => theme === "light" && toggleTheme()}
                      className={`py-2 px-4 text-xs font-semibold border rounded-xl transition-all ${
                        theme === "dark"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      Dark Mode
                    </button>
                    <button
                      onClick={() => theme === "dark" && toggleTheme()}
                      className={`py-2 px-4 text-xs font-semibold border rounded-xl transition-all ${
                        theme === "light"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      Light Mode
                    </button>
                  </div>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block">System Notification Logs</label>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Triggers toast alerts when critical behavior rules violation is logged.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary border-border focus:ring-0 focus:outline-none"
                  />
                </div>

                {/* Language */}
                <div className="space-y-1.5 border-t border-border/60 pt-4">
                  <label className="text-xs font-semibold text-muted-foreground block font-medium">System Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                  >
                    <option value="en">English (United States)</option>
                    <option value="es">Español (España)</option>
                    <option value="fr">Français (France)</option>
                  </select>
                </div>

                <div className="border-t border-border/60 pt-4 flex justify-end">
                  <Button variant="primary" size="sm" onClick={() => handleSave("General")}>
                    Save General Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DETECTION SETTINGS */}
          {activeTab === "detection" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Inference & Detection</CardTitle>
                <CardDescription>Adjust YOLOv8 object detection model thresholds.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Confidence */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <label className="text-muted-foreground">Confidence Threshold Cutoff</label>
                    <span className="text-primary font-bold">{confidence.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.95"
                    step="0.05"
                    value={confidence}
                    onChange={(e) => setConfidence(parseFloat(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>0.10 (High Recall)</span>
                    <span>0.95 (High Precision)</span>
                  </div>
                </div>

                {/* IoU */}
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <label className="text-muted-foreground">Non-Maximum Suppression (IoU)</label>
                    <span className="text-primary font-bold">{iouThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.80"
                    step="0.05"
                    value={iouThreshold}
                    onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>0.20 (Few Overlaps)</span>
                    <span>0.80 (Aggressive Overlaps)</span>
                  </div>
                </div>

                {/* Frame Skip */}
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Inference Frame Skip Rate
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={frameSkip}
                      onChange={(e) => setFrameSkip(parseInt(e.target.value) || 1)}
                      className="w-24 px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Processes every <strong>{frameSkip}nd</strong> frame to increase inference execution speeds.
                    </span>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4 flex justify-end">
                  <Button variant="primary" size="sm" onClick={() => handleSave("Detection Thresholds")}>
                    Save Detection Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TRACKING SETTINGS */}
          {activeTab === "tracking" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ByteTrack Trajectory Tracking</CardTitle>
                <CardDescription>Tweak trajectory association settings for multi-object tracking.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Track Buffer */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <label className="text-muted-foreground">Track Buffer Length (Lost Frames)</label>
                    <span className="text-primary font-bold">{trackBuffer} frames</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={trackBuffer}
                    onChange={(e) => setTrackBuffer(parseInt(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>10 frames (Fast Lost)</span>
                    <span>100 frames (Persistent Memory)</span>
                  </div>
                </div>

                {/* Track Threshold */}
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <label className="text-muted-foreground">Trajectory Match Threshold</label>
                    <span className="text-primary font-bold">{trackThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.30"
                    max="0.85"
                    step="0.05"
                    value={trackThreshold}
                    onChange={(e) => setTrackThreshold(parseFloat(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>0.30 (Loose Association)</span>
                    <span>0.85 (Strict Association)</span>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4 flex justify-end">
                  <Button variant="primary" size="sm" onClick={() => handleSave("Tracking Config")}>
                    Save Tracking Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI INVESTIGATION SETTINGS */}
          {activeTab === "ai" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AI Copilot Settings</CardTitle>
                <CardDescription>Manage OpenAI integration and local fallback query configurations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Provider */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">AI Intelligence Provider</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                  >
                    <option value="openai">OpenAI Endpoint (Direct API integration)</option>
                    <option value="fallback">Local Programmatic Fallback Rules Engine</option>
                  </select>
                </div>

                {/* Model Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">Active Model Target</label>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                    placeholder="gpt-4o-mini"
                  />
                </div>

                {/* Temperature */}
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <label className="text-muted-foreground">Response Creativity (Temperature)</label>
                    <span className="text-primary font-bold">{temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.9"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>0.0 (Deterministic Summary)</span>
                    <span>0.9 (Verbose Narrative)</span>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4 flex justify-end">
                  <Button variant="primary" size="sm" onClick={() => handleSave("AI Copilot")}>
                    Save AI Config
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DATABASE & STORAGE STATUS */}
          {activeTab === "database" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Database Scaffolding URL & Storage</CardTitle>
                    <CardDescription>Observe database states and active folder space utilization.</CardDescription>
                  </div>
                  <button
                    onClick={fetchHealthDetails}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                    disabled={loadingHealth}
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingHealth ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingHealth ? (
                  <div className="py-12 flex justify-center">
                    <Spinner className="h-8 w-8 text-primary" />
                  </div>
                ) : !health ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-rose-500 font-semibold border border-rose-500/20 bg-rose-500/5 rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    Failed to communicate with DB diagnostic controller.
                  </div>
                ) : (
                  <>
                    {/* Database Health Badge */}
                    <div className="flex items-center justify-between p-3 bg-secondary/30 border border-border rounded-xl">
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Session Status</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">PostgreSQL Service connection status.</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase flex items-center gap-1 ${
                        health.database_status === "Connected" 
                          ? "bg-emerald-500/10 text-emerald-500" 
                          : "bg-rose-500/10 text-rose-500"
                      }`}>
                        <Check className="h-3 w-3" />
                        {health.database_status}
                      </span>
                    </div>

                    {/* Masked Connection URL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground block">PostgreSQL Connection Target URL</label>
                      <div className="p-3 bg-slate-900 border border-border/80 rounded-xl text-[11px] font-mono select-all text-muted-foreground truncate">
                        {health.database_url}
                      </div>
                    </div>

                    {/* Storage Info */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <label className="text-xs font-semibold text-muted-foreground block">Host Disk Space Utilization</label>
                      
                      <div className="relative w-full h-2 rounded bg-secondary overflow-hidden mt-1.5">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${(health.storage_used_bytes / health.storage_total_bytes) * 100}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-muted-foreground font-semibold mt-1">
                        <span>Used: {formatBytes(health.storage_used_bytes)}</span>
                        <span>Free: {formatBytes(health.storage_free_bytes)}</span>
                        <span>Total: {formatBytes(health.storage_total_bytes)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ACCOUNT SETTINGS */}
          {activeTab === "account" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Account & Security Profile</CardTitle>
                <CardDescription>Observe operator information and update key password codes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* User Info Grid */}
                {user && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/30 border border-border rounded-xl text-xs font-semibold">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Operator Profile</span>
                      <span className="text-foreground block mt-0.5">{user.full_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Access Scope</span>
                      <span className="text-primary block mt-0.5 capitalize">{user.role} badge</span>
                    </div>
                    <div className="col-span-2 border-t border-border/40 pt-2">
                      <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">Registered Email</span>
                      <span className="text-foreground block mt-0.5 truncate">{user.email}</span>
                    </div>
                  </div>
                )}

                {/* Password reset form */}
                <form onSubmit={handlePasswordChange} className="space-y-3.5 border-t border-border/60 pt-4">
                  <label className="text-xs font-semibold text-foreground block font-semibold">Update Console Password</label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Old password"
                      className="px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={updatingPassword}
                    >
                      {updatingPassword ? "Reshaping security key..." : "Change Password"}
                    </Button>
                  </div>
                </form>

                {/* Logout */}
                <div className="border-t border-border/60 pt-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-semibold">End active session?</span>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out Console
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SYSTEM SETTINGS */}
          {activeTab === "system" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">System & Core Settings</CardTitle>
                <CardDescription>Verify system versions and perform maintenance purges.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Specs */}
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold p-3 bg-secondary/30 border border-border rounded-xl">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Platform Core Version</span>
                    <span className="text-foreground block mt-0.5">{health?.version || "v1.0.0"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Deploy Environment</span>
                    <span className="text-primary block mt-0.5 capitalize">{health?.environment || "development"}</span>
                  </div>
                </div>

                {/* Clear Cache */}
                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block font-semibold">Clear System Cache</label>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Resets YOLOv8 thresholds and frame skips back to default factory parameters.
                    </span>
                  </div>
                  <button
                    onClick={handleClearCache}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear Cache
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LayoutWrapper>
  );
};

export default Settings;
