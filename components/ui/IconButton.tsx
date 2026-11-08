import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "ghost" | "danger" | "primary" | "outline";

const variants: Record<Variant, string> = {
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
  danger: "text-slate-500 hover:bg-rose-50 hover:text-rose-600",
  primary: "text-blue-600 hover:bg-blue-50 hover:text-blue-700",
  outline: "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Etiqueta accesible obligatoria; se usa como aria-label y title. */
  label: string;
  variant?: Variant;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = "ghost", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-40",
          size === "sm" ? "h-8 w-8" : "h-9 w-9",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
