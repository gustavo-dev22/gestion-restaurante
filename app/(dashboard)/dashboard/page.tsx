'use client';
import { useAuthStore } from '@/lib/store';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Bienvenido, {user?.nombreCompleto}</h1>
      <p className="text-slate-600">Has ingresado correctamente al sistema.</p>
    </div>
  );
}