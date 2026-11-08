'use client';
import Sidebar from '@/components/sidebar';
import Topbar from '@/components/topbar';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Solo actuamos si ya se cargaron los datos del localStorage
    if (hasHydrated && isClient) {
      if (!token) {
        router.replace('/login');
      }
    }
  }, [token, hasHydrated, isClient, router]);

  // Mientras no se hidrate o no estemos en el cliente, mostramos un spinner
  if (!hasHydrated || !isClient) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  // Si después de hidratar no hay token, no renderizamos nada (el useEffect hará el redirect)
  if (!token) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}