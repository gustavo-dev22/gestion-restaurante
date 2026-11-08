"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import Modal from "./Modal";
import { Button } from "./Button";

export type ConfirmVariant = "default" | "danger" | "success" | "warning" | "info";

const icons: Record<ConfirmVariant, ReactNode> = {
  default: <Info className="text-blue-600" size={24} />,
  danger: <ShieldAlert className="text-rose-600" size={24} />,
  success: <CheckCircle2 className="text-emerald-600" size={24} />,
  warning: <AlertTriangle className="text-amber-600" size={24} />,
  info: <Info className="text-blue-600" size={24} />,
};

const iconWrap: Record<ConfirmVariant, string> = {
  default: "bg-blue-50",
  danger: "bg-rose-50",
  success: "bg-emerald-50",
  warning: "bg-amber-50",
  info: "bg-blue-50",
};

const confirmButtonVariant: Record<ConfirmVariant, "primary" | "danger" | "success"> = {
  default: "primary",
  danger: "danger",
  success: "success",
  warning: "primary",
  info: "primary",
};

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  hideCancel?: boolean;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  hideCancel = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      showCloseButton={!loading}
      footer={
        <>
          {!hideCancel && (
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
          )}
          {onConfirm && (
            <Button
              type="button"
              variant={confirmButtonVariant[variant]}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconWrap[variant]}`}>
          {icons[variant]}
        </div>
        <div className="min-w-0 flex-1 text-sm text-slate-600">
          {description && <div>{description}</div>}
          {children}
        </div>
      </div>
    </Modal>
  );
}
