'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type ToastVariant = 'success' | 'level-up';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting: boolean;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}


const DURATION: Record<ToastVariant, number> = {
  success: 4000,
  'level-up': 6000,
};

const EXIT_MS = 320;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => clearTimeout(id));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, EXIT_MS);
    timers.current.set(`exit-${id}`, timer);
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const duration = DURATION[variant];

      setToasts((prev) => [...prev, { id, message, variant, exiting: false }]);

      
      const timer = setTimeout(() => removeToast(id), duration);
      timers.current.set(id, timer);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      
      <div
        aria-live="polite"
        aria-label="Notifications"
        role="region"
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  const isLevelUp = toast.variant === 'level-up';
  const visible = entered && !toast.exiting;

  const enterEasing = 'cubic-bezier(0.34, 1.26, 0.64, 1)'; 
  const exitEasing = 'cubic-bezier(0.4, 0, 1, 1)';          

  return (
    <div
      role="alert"
      aria-live={isLevelUp ? 'assertive' : 'polite'}
      aria-atomic="true"
      style={{
        transition: `opacity ${EXIT_MS}ms ${toast.exiting ? exitEasing : enterEasing},
                     transform ${EXIT_MS}ms ${toast.exiting ? exitEasing : enterEasing}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 1.5rem))',
      }}
      className={[
       
        'pointer-events-auto flex min-w-[280px] max-w-[380px] items-start',
        'justify-between gap-4 border font-mono',
        
        isLevelUp ? 'px-5 py-4' : 'px-4 py-3',
        isLevelUp
          ? [
              'border-emerald-500/50 bg-[#081410]',
              'shadow-[0_0_24px_rgba(16,185,129,0.15)]',
            ].join(' ')
          : [
              'border-zinc-700/70 bg-[#13161d]',
              'shadow-[0_4px_24px_rgba(0,0,0,0.5)]',
            ].join(' '),
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {isLevelUp ? (
          <span
            aria-hidden="true"
            className="mt-px shrink-0 text-base leading-none text-emerald-400"
          >
            ⬆
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="mt-px shrink-0 text-[10px] leading-none text-emerald-500"
          >
            ●
          </span>
        )}

        <span
          className={[
            'text-[11px] uppercase tracking-widest leading-relaxed',
            isLevelUp
              ? 'font-bold text-emerald-300'
              : 'font-medium text-zinc-200',
          ].join(' ')}
        >
          {toast.message}
        </span>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className={[
          'mt-px shrink-0 text-[10px] leading-none transition-colors',
          isLevelUp
            ? 'text-emerald-700 hover:text-emerald-300'
            : 'text-zinc-600 hover:text-zinc-300',
        ].join(' ')}
      >
        ✕
      </button>
    </div>
  );
}
