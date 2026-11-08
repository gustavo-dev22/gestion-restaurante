import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 " +
  "transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(inputBase, error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/30", className)}
      {...props}
    />
  )
);

Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(inputBase, "min-h-24 resize-y", error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/30", className)}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";

export const selectBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 " +
  "transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
