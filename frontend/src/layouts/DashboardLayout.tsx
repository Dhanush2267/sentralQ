import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  Search,
  BarChart3,
  FileText,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Shield,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/Button";

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sidebarItems: SidebarItem[] = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Video Library", path: "/videos", icon: Video },
  { name: "AI Search", path: "/ai-search", icon: Search },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Reports", path: "/reports", icon: FileText },
  { name: "Settings", path: "/settings", icon: Settings },
];

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-500/15 text-purple-500 border border-purple-500/20",
  analyst: "bg-primary/15 text-primary border border-primary/20",
  viewer: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
  guest: "bg-muted text-muted-foreground border border-border",
};

const DashboardLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* ========================================== */}
      {/* 1. SIDEBAR (DESKTOP)                       */}
      {/* ========================================== */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/60 backdrop-blur-md">
        {/* Logo Area */}
        <div className="flex h-16 items-center px-6 gap-2 border-b border-border/60">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
            SentralQ
          </span>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 space-y-1 px-4 py-6">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card in Sidebar */}
        {user && (
          <div className="border-t border-border/60 p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-tr from-primary to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.full_name}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${ROLE_BADGE[user.role] || ROLE_BADGE.guest}`}>
                  {user.role}
                </span>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ========================================== */}
      {/* 2. MOBILE SIDEBAR OVERLAY                 */}
      {/* ========================================== */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-background/80 backdrop-blur-sm">
          <div className="relative flex flex-col w-64 max-w-xs bg-card p-6 shadow-xl border-r border-border animate-fade-in">
            {/* Close Button */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold tracking-tight text-foreground">
                  SentralQ
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 rounded-md"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Nav Items */}
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Logout */}
            {user && (
              <div className="mt-auto pt-6 border-t border-border/60">
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-sm text-destructive font-medium hover:underline"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out ({user.email})
                </button>
              </div>
            )}
          </div>
          {/* Background Click to Close */}
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* ========================================== */}
      {/* 3. MAIN WORKSPACE CONTAINER                */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP NAVBAR */}
        <header className="flex h-16 items-center justify-between px-4 md:px-8 border-b border-border bg-card/45 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {/* Mobile Menu trigger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo/Title on Mobile */}
            <div className="flex md:hidden items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold tracking-tight">SentralQ</span>
            </div>

            {/* Search Placeholder Input */}
            <div className="hidden sm:flex items-center relative w-64 md:w-80">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search surveillance intel..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/60"
                disabled
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : (
                <Moon className="h-5 w-5 text-slate-700" />
              )}
            </Button>

            {/* User Profile Dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-xl hover:bg-secondary transition-colors"
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="hidden md:flex flex-col text-right">
                    <span className="text-xs font-semibold text-foreground leading-tight">{user.full_name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE[user.role]?.split(" ")[1] || "text-muted-foreground"}`}>
                      {user.role}
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-primary/20">
                    {initials}
                  </div>
                  <ChevronDown className={`hidden md:block h-3.5 w-3.5 text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50 animate-fade-in">
                    <div className="px-3 py-2 border-b border-border/60">
                      <p className="text-xs font-semibold text-foreground truncate">{user.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setUserMenuOpen(false); logout(); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors font-medium"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Dropdown backdrop */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}
    </div>
  );
};

export default DashboardLayout;

