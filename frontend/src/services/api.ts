/// <reference types="vite/client" />
import axios from "axios";

// Environment Variable Configuration — VITE_ prefix required for Vite env vars
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased to 30s to handle YOLO/ByteTrack long operations
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request Interceptor — JWT token injection
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sentralq_access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor — Centralized error handling + 401 auth cleanup
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // On 401 Unauthorized, clear stored tokens and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem("sentralq_access_token");
      localStorage.removeItem("sentralq_user");
      // Only redirect if not already on login page to avoid redirect loops
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    // Normalize error response structure for consistent frontend consumption
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : error.response?.data?.message ||
          error.message ||
          "A network error occurred. Please check your connection.";

    const formattedError = {
      message,
      status: error.response?.status || 0,
      code: error.response?.data?.error?.code || "NETWORK_ERROR",
      details: error.response?.data?.error?.details || null,
    };

    console.error("[API Error]", formattedError);
    return Promise.reject(formattedError);
  }
);

export default apiClient;
