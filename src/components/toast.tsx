'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Trophy, X, ShieldAlert, CheckCircle, Info } from 'lucide-react';

export type ToastVariant = 'xp' | 'level-up' | 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  isExiting?: boolean;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
  initialXp?: number;
  initialLevel?: number;
}

export function ToastProvider({ children, initialXp = 0, initialLevel = 0 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Track previous XP and level to detect increases
  const prevXp = useRef<number>(initialXp);
  const prevLevel = useRef<number>(initialLevel);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration?: number) => {
      const id = Math.random().toString(36).substring(2, 9);
      // Default durations based on GSSoC issue requirements:
      // XP toasts = 4000ms, Level Up toasts = 6000ms, default = 4000ms.
      const toastDuration = duration ?? (variant === 'level-up' ? 6000 : 4000);

      setToasts((prev) => [...prev, { id, message, variant, duration: toastDuration }]);

      // Dynamically import canvas-confetti to fire celebration on level-up
      if (variant === 'level-up') {
        import('canvas-confetti')
          .then((module) => {
            const confetti = module.default || module;
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#7C3AED', '#06B6D4', '#EC4899', '#F59E0B', '#10B981'],
              zIndex: 9999,
            });
          })
          .catch((err) => {
            console.warn('Failed to load canvas-confetti:', err);
          });
      }
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t)));
    // Remove from DOM after the fade-out animation completes (200ms)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  // Monitor initialXp for increases
  useEffect(() => {
    if (initialXp > prevXp.current) {
      const diff = initialXp - prevXp.current;
      showToast(`+${diff} XP GAINED`, 'xp');
    }
    prevXp.current = initialXp;
  }, [initialXp, showToast]);

  // Monitor initialLevel for increases and launch celebration
  useEffect(() => {
    if (initialLevel > prevLevel.current) {
      showToast(`LEVELED UP! LEVEL ${initialLevel} REACHED`, 'level-up');
    }
    prevLevel.current = initialLevel;
  }, [initialLevel, showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        role="none"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { id, message, variant, duration, isExiting } = toast;

  // Setup auto-dismiss timer
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const handleClose = () => {
    onDismiss(id);
  };

  // Configure visual styling based on toast variant
  let Icon = Info;
  let borderColor = 'border-zinc-800';
  let glowColor = 'shadow-[0_4px_12px_rgba(0,0,0,0.5)]';
  let iconColor = 'text-zinc-400';
  let progressBg = 'bg-zinc-600';

  switch (variant) {
    case 'xp':
      Icon = Sparkles;
      borderColor = 'border-[#06B6D4]/30';
      glowColor = 'shadow-[0_0_15px_rgba(6,182,212,0.15)]';
      iconColor = 'text-[#06B6D4]';
      progressBg = 'bg-[#06B6D4]';
      break;
    case 'level-up':
      Icon = Trophy;
      borderColor = 'border-[#F59E0B]/40';
      glowColor = 'shadow-[0_0_20px_rgba(245,158,11,0.25)]';
      iconColor = 'text-[#F59E0B]';
      progressBg = 'bg-[#F59E0B]';
      break;
    case 'success':
      Icon = CheckCircle;
      borderColor = 'border-[#10B981]/30';
      glowColor = 'shadow-[0_0_15px_rgba(16,185,129,0.15)]';
      iconColor = 'text-[#10B981]';
      progressBg = 'bg-[#10B981]';
      break;
    case 'error':
      Icon = ShieldAlert;
      borderColor = 'border-[#EF4444]/30';
      glowColor = 'shadow-[0_0_15px_rgba(239,68,68,0.15)]';
      iconColor = 'text-[#EF4444]';
      progressBg = 'bg-[#EF4444]';
      break;
    default:
      Icon = Info;
      borderColor = 'border-zinc-700';
      glowColor = 'shadow-[0_4px_12px_rgba(0,0,0,0.5)]';
      iconColor = 'text-zinc-400';
      progressBg = 'bg-zinc-600';
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`pointer-events-auto relative flex w-80 items-center justify-between gap-3 overflow-hidden rounded border bg-[#0d0d1a]/95 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-white backdrop-blur-md transition-all duration-200 ${borderColor} ${glowColor} ${
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className="font-semibold text-zinc-100">{message}</span>
      </div>
      <button
        onClick={handleClose}
        className="p-1 text-zinc-500 transition-colors hover:text-white"
        aria-label="Close notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {duration && (
        <div
          className={`absolute bottom-0 left-0 h-[2px] w-full ${progressBg} origin-left`}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}
