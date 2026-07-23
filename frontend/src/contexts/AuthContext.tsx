import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "@/services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "analyst" | "viewer" | "guest";
  is_active: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string, role?: string) => Promise<AuthUser>;
  logout: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "sentralq_access_token";
const USER_KEY = "sentralq_user";

// ─── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true while restoring session

  // Restore session from localStorage on first mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Corrupted localStorage entry — clear and continue unauthenticated
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await apiClient.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      user: AuthUser;
    }>("/api/v1/auth/login", { email, password });

    const { access_token, user: userData } = response.data;

    // Persist token and user profile
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const register = useCallback(async (
    email: string,
    fullName: string,
    password: string,
    role = "viewer"
  ): Promise<AuthUser> => {
    const response = await apiClient.post<AuthUser>("/api/v1/auth/register", {
      email,
      full_name: fullName,
      password,
      role,
    });
    return response.data;
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    // Hard redirect to login page
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>. Wrap your app in <AuthProvider>.");
  }
  return ctx;
};

export default AuthContext;
