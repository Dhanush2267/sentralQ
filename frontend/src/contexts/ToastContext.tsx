import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (opts: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ type, title, message, duration = 4500 }: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message, duration }]);

      const timer = setTimeout(() => dismiss(id), duration);
      timerRefs.current.set(id, timer);
    },
    [dismiss]
  );

  const success = useCallback((title: string, message?: string) => toast({ type: "success", title, message }), [toast]);
  const error = useCallback((title: string, message?: string) => toast({ type: "error", title, message, duration: 6000 }), [toast]);
  const info = useCallback((title: string, message?: string) => toast({ type: "info", title, message }), [toast]);
  const warning = useCallback((title: string, message?: string) => toast({ type: "warning", title, message }), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, info, warning, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
};

// ─── Individual Toast Item ────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { bar: string; icon: string; iconColor: string; Icon: React.FC<{ className?: string }> }> = {
  success: {
    bar: "bg-emerald-500",
    icon: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-500",
    Icon: CheckCircle,
  },
  error: {
    bar: "bg-destructive",
    icon: "bg-destructive/10 border-destructive/20",
    iconColor: "text-destructive",
    Icon: AlertCircle,
  },
  info: {
    bar: "bg-primary",
    icon: "bg-primary/10 border-primary/20",
    iconColor: "text-primary",
    Icon: Info,
  },
  warning: {
    bar: "bg-amber-500",
    icon: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-500",
    Icon: AlertTriangle,
  },
};

const ToastItem: React.FC<{ toast: Toast; dismiss: (id: string) => void }> = ({ toast, dismiss }) => {
  const style = TOAST_STYLES[toast.type];
  const Icon = style.Icon;

  return (
    <div
      className="relative flex items-start gap-3 w-full max-w-sm bg-card border border-border rounded-xl shadow-lg p-3.5 pr-8 overflow-hidden animate-fade-in"
      role="alert"
      aria-live="polite"
    >
      {/* Colored side bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar} rounded-l-xl`} />

      {/* Icon */}
      <div className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border ${style.icon}`}>
        <Icon className={`h-3.5 w-3.5 ${style.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground leading-snug">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>

      {/* Dismiss Button */}
      <button
        onClick={() => dismiss(toast.id)}
        className="absolute top-2.5 right-2.5 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ─── Container ───────────────────────────────────────────────────────────────

const ToastContainer: React.FC<{ toasts: Toast[]; dismiss: (id: string) => void }> = ({ toasts, dismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} dismiss={dismiss} />
        </div>
      ))}
    </div>
  );
};
