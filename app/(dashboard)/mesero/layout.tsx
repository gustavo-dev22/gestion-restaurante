"use client";

import NotificacionesMesero from "@/components/mesero/notificacionesMesero";
import LlamadosMesero from "@/components/mesero/llamadosMesero";

export default function MeseroLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificacionesMesero />
      <LlamadosMesero />
      {children}
    </>
  );
}
