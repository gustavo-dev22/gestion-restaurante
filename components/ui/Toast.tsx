"use client";

import { useSyncExternalStore } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toasts;
}

function getServerSnapshot() {
  return EMPTY;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function showToast(variant: ToastVariant, title: string, description?: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { id, title, description, variant }];
  emit();
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), 4500);
  }
  return id;
}

export const toastSuccess = (title: string, description?: string) => showToast("success", title, description);
export const toastError = (title: string, description?: string) => showToast("error", title, description);
export const toastInfo = (title: string, description?: string) => showToast("info", title, description);
export const toastWarning = (title: string, description?: string) => showToast("warning", title, description);

const styles: Record<ToastVariant, { icon: React.ReactNode; accent: string; label: string }> = {
  success: {
    icon: <CheckCircle2 size={20} className="text-emerald-600" />,
    accent: "border-emerald-200",
    label: "Éxito",
  },
  error: {
    icon: <AlertCircle size={20} className="text-rose-600" />,
    accent: "border-rose-200",
    label: "Error",
  },
  info: {
    icon: <Info size={20} className="text-blue-600" />,
    accent: "border-blue-200",
    label: "Información",
  },
  warning: {
    icon: <AlertTriangle size={20} className="text-amber-600" />,
    accent: "border-amber-200",
    label: "Atención",
  },
};

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 top-20 z-[120] flex w-[min(92vw,380px)] flex-col gap-2"
    >
      {items.map((item) => {
        const style = styles[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3 shadow-lg",
              style.accent
            )}
          >
            <span className="mt-0.5 shrink-0">{style.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">
                <span className="sr-only">{style.label}: </span>
                {item.title}
              </p>
              {item.description && <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>}
            </div>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => dismissToast(item.id)}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
