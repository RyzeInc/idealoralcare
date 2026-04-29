'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number; // default 5000; 0 = sticky
}

interface ToastContextValue {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  fromError: (err: unknown, fallbackTitle?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const toast: Toast = { durationMs: 5000, ...t, id };
      setToasts((prev) => [...prev, toast]);
      if (toast.durationMs && toast.durationMs > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), toast.durationMs);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(() => {
    const friendlyError = (err: unknown): string => {
      const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
      // Strip Convex error prefixes like "[CONVEX M(...)]:"
      return raw.replace(/^\[CONVEX [A-Z]\([^)]+\)\]:?\s*/i, '').replace(/^Uncaught Error:\s*/i, '').trim();
    };
    return {
      toasts,
      push,
      dismiss,
      success: (title, description) => push({ type: 'success', title, description }),
      error: (title, description) => push({ type: 'error', title, description, durationMs: 8000 }),
      warning: (title, description) => push({ type: 'warning', title, description, durationMs: 6500 }),
      info: (title, description) => push({ type: 'info', title, description }),
      fromError: (err, fallbackTitle = 'Something went wrong') =>
        push({ type: 'error', title: fallbackTitle, description: friendlyError(err), durationMs: 8000 }),
    };
  }, [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback so legacy components don't crash
    if (typeof window !== 'undefined') {
      console.warn('useToast called outside ToastProvider; falling back to window.alert');
    }
    const fallback = (title: string, description?: string) => {
      if (typeof window !== 'undefined') window.alert(description ? `${title}\n${description}` : title);
      return '';
    };
    return {
      toasts: [],
      push: (t) => fallback(t.title, t.description),
      dismiss: () => {},
      success: fallback,
      error: fallback,
      warning: fallback,
      info: fallback,
      fromError: (err, fallbackTitle = 'Something went wrong') =>
        fallback(fallbackTitle, err instanceof Error ? err.message : String(err)),
    };
  }
  return ctx;
}

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const STYLES: Record<ToastType, { bg: string; border: string; icon: React.ReactNode; iconColor: string }> = {
  success: {
    bg: 'bg-white',
    border: 'border-green-200',
    icon: <CheckCircle2 size={20} />,
    iconColor: 'text-green-600',
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-200',
    icon: <XCircle size={20} />,
    iconColor: 'text-red-600',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-yellow-200',
    icon: <AlertTriangle size={20} />,
    iconColor: 'text-yellow-600',
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-200',
    icon: <Info size={20} />,
    iconColor: 'text-blue-600',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = STYLES[toast.type];
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 10);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto rounded-lg border shadow-lg p-3 ${style.bg} ${style.border} transition-all duration-200 ${
        entering ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 ${style.iconColor}`}>{style.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs text-slate-600 break-words">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
