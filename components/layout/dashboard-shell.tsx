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
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} session={session} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          menuOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
          session={session}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
