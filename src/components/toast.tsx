"use client";
import { useEffect, useState } from "react";

export type ToastVariant = "xp" | "levelup";

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

type Listener = (toast: Toast) => void;
const listeners: Listener[] = [];

export function emitToast(toast: Omit<Toast, "id">) {
  const t = { ...toast, id: crypto.randomUUID() };
  listeners.forEach((fn) => fn(t));
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  const duration = toast.variant === "levelup" ? 6000 : 4000;

  useEffect(() => {
        requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 300); 
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const isLevelUp = toast.variant === "levelup";

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        transition: "opacity 300ms ease, transform 300ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
      }}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border font-mono text-sm
        shadow-lg min-w-[260px] max-w-[340px]
        ${isLevelUp
          ? "bg-yellow-950 border-yellow-500 text-yellow-300"
          : "bg-[#0f1117] border-green-700 text-green-400"
        }
      `}
    >
      <span className="text-base">{isLevelUp ? "⬆" : "✦"}</span>
      <span className="flex-1 tracking-wide">{toast.message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onRemove, 300); }}
        className="text-xs opacity-40 hover:opacity-80 transition-opacity cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => setToasts((prev) => [...prev, t]);
    listeners.push(handler);
    return () => {
      const i = listeners.indexOf(handler);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);

  const remove = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => remove(t.id)} />
      ))}
    </div>
  );
}