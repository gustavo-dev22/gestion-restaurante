import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label className={cn("mb-1.5 block text-sm font-semibold text-slate-700", className)} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-rose-600" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-rose-600">
      {children}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  errorId,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && !error && <p className="mt-1.5 text-sm text-slate-600">{hint}</p>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
