"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      <Printer size={18} aria-hidden="true" />
      Imprimir reporte
    </Button>
  );
}
