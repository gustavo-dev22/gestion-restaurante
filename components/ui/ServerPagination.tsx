import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServerPaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  className?: string;
}

export function ServerPagination({
  page,
  totalPages,
  basePath,
  className,
}: ServerPaginationProps) {
  const current = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
  const prevHref = `${basePath}?page=${Math.max(current - 1, 1)}`;
  const nextHref = `${basePath}?page=${Math.min(current + 1, totalPages)}`;

  const buttonClass =
    "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <nav
      aria-label="Paginación"
      className={cn(
        "flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <span className="text-xs font-semibold text-slate-600">
        Página {current} de {Math.max(totalPages, 1)}
      </span>
      <div className="flex items-center gap-2">
        {current > 1 ? (
          <Link href={prevHref} aria-label="Página anterior" className={buttonClass}>
            <ChevronLeft size={18} />
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(buttonClass, "pointer-events-none opacity-40")}>
            <ChevronLeft size={18} />
          </span>
        )}
        {current < totalPages ? (
          <Link href={nextHref} aria-label="Página siguiente" className={buttonClass}>
            <ChevronRight size={18} />
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(buttonClass, "pointer-events-none opacity-40")}>
            <ChevronRight size={18} />
          </span>
        )}
      </div>
    </nav>
  );
}
