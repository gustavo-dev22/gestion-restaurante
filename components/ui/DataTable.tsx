import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableProps {
  children: ReactNode;
  className?: string;
  minWidthClass?: string;
  /** Nombre accesible de la tabla para lectores de pantalla. */
  label?: string;
}

/**
 * Contenedor de tabla con scroll horizontal seguro y cabecera fija.
 * Mantiene el marcado <thead>/<tbody> de cada página.
 */
export function DataTable({
  children,
  className,
  minWidthClass = "min-w-[720px]",
  label,
}: DataTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table
        aria-label={label}
        className={cn(
          "w-full text-left",
          minWidthClass,
          "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
        )}
      >
        {children}
      </table>
    </div>
  );
}

export interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  info?: ReactNode;
  className?: string;
}

export function DataTablePagination({
  page,
  totalPages,
  onPrev,
  onNext,
  info,
  className,
}: DataTablePaginationProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">{info}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">
          Página {page} de {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
