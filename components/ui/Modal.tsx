"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizes;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  showCloseButton = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusFirst = () => {
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      (focusables[0] ?? panel).focus();
    };
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === panel
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-hidden="true"
        onMouseDown={() => {
          if (closeOnBackdrop) onClose();
        }}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            "relative z-10 flex w-full flex-col rounded-2xl bg-white shadow-2xl focus:outline-none",
            sizes[size]
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-4 border-b border-slate-100 p-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-bold text-slate-800">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-slate-600">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar ventana"
                className="-mr-1 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {children && <div className="flex-1 p-5">{children}</div>}

          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
