import { createBrowserRouter } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

// Auth Pages (public)
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import NotFound from "@/pages/NotFound";

// Application Pages (protected)
import Dashboard from "@/pages/Dashboard";
import Videos from "@/pages/Videos";
import UploadVideo from "@/pages/UploadVideo";
import VideoDetails from "@/pages/VideoDetails";
import DetectionDashboard from "@/pages/DetectionDashboard";
import TrackingDashboard from "@/pages/TrackingDashboard";
import IntelligenceDashboard from "@/pages/IntelligenceDashboard";
import AISearch from "@/pages/AISearch";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

export const router = createBrowserRouter([
  // ── Public Auth Routes ─────────────────────────────────────────────
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },

  // ── Protected Dashboard Routes ─────────────────────────────────────
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "videos", element: <Videos /> },
      { path: "videos/upload", element: <UploadVideo /> },
      { path: "videos/:id", element: <VideoDetails /> },
      { path: "videos/:id/detection", element: <DetectionDashboard /> },
      { path: "videos/:id/tracking", element: <TrackingDashboard /> },
      { path: "videos/:id/intelligence", element: <IntelligenceDashboard /> },
      { path: "ai-search", element: <AISearch /> },
      { path: "analytics", element: <Analytics /> },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
    ],
  },

  // ── 404 Catch-All ──────────────────────────────────────────────────
  {
    path: "*",
    element: <NotFound />,
  },
]);

