"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import type { SessionPayload } from "@/lib/auth/session";

interface DashboardShellProps {
  session: SessionPayload;
  children: React.ReactNode;
}

export default function DashboardShell({ session, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Saltar al contenido principal
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} session={session} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          menuOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
          session={session}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
