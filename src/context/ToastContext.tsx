'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

/* ── Types ─────────────────────────────────────── */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // ms
}

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success: (msg: string, duration?: number) => void;
    error:   (msg: string, duration?: number) => void;
    info:    (msg: string, duration?: number) => void;
    warning: (msg: string, duration?: number) => void;
  };
  dismiss: (id: string) => void;
}

/* ── Context ────────────────────────────────────── */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/* ── Provider ───────────────────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, duration = type === 'error' ? 6000 : 4000) => {
      const id = crypto.randomUUID();
      setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const toast = {
    success: (msg: string, d?: number) => add('success', msg, d),
    error:   (msg: string, d?: number) => add('error',   msg, d),
    info:    (msg: string, d?: number) => add('info',    msg, d),
    warning: (msg: string, d?: number) => add('warning', msg, d),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/* ── Toast item ─────────────────────────────────── */
const CONFIG: Record<ToastType, { icon: React.ReactNode; border: string; iconColor: string; bg: string }> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    border: '#22c55e',
    iconColor: '#22c55e',
    bg: 'var(--surface)',
  },
  error: {
    icon: <XCircle size={18} />,
    border: '#ef4444',
    iconColor: '#ef4444',
    bg: 'var(--surface)',
  },
  info: {
    icon: <Info size={18} />,
    border: 'var(--accent)',
    iconColor: 'var(--accent)',
    bg: 'var(--surface)',
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    border: '#f59e0b',
    iconColor: '#f59e0b',
    bg: 'var(--surface)',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const cfg = CONFIG[toast.type];
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Slide in
    const t = setTimeout(() => setVisible(true), 10);

    // Progress bar
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [toast.duration]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      onClick={handleDismiss}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1rem 0.875rem 0.875rem',
        borderRadius: '0.75rem',
        backgroundColor: cfg.bg,
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${cfg.border}`,
        boxShadow: '0 4px 16px rgb(0 0 0 / 0.10), 0 1px 4px rgb(0 0 0 / 0.06)',
        cursor: 'pointer',
        maxWidth: '360px',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
        userSelect: 'none',
      }}
    >
      {/* Icon */}
      <span style={{ color: cfg.iconColor, flexShrink: 0, marginTop: '1px' }}>
        {cfg.icon}
      </span>

      {/* Message */}
      <p style={{
        flex: 1,
        fontSize: '0.9rem',
        lineHeight: '1.4',
        color: 'var(--fg)',
        fontWeight: 500,
        marginRight: '0.5rem',
      }}>
        {toast.message}
      </p>

      {/* Close */}
      <button
        onClick={e => { e.stopPropagation(); handleDismiss(); }}
        style={{
          flexShrink: 0,
          color: 'var(--fg-subtle)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          display: 'flex',
          marginTop: '1px',
        }}
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2.5px',
          width: `${progress}%`,
          backgroundColor: cfg.border,
          opacity: 0.5,
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
}

/* ── Container ──────────────────────────────────── */
function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
