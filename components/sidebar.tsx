'use client';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import * as Icons from 'lucide-react';
import Swal from 'sweetalert2';
import { LogOut } from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  
  // 1. Identificar el sistema y el rol activo
  const sistemaRestaurante = user?.sistemas.find((s: any) => s.id === 13);
  const rolActivo = sistemaRestaurante?.roles.find((r: any) => r.esPrincipal) 
                    || sistemaRestaurante?.roles?.[0];

  const objetos = rolActivo?.objetos || [];
  const menusPadre = objetos.filter((obj: any) => obj.tipo === 'Menu').sort((a: any, b: any) => a.orden - b.orden);

  const handleLogout = () => {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: "Tendrás que ingresar tus credenciales nuevamente.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
        router.replace('/login');
      }
    });
  };

  return (
    <aside className="w-72 bg-slate-900 text-white min-h-screen p-4 flex flex-col shadow-xl">
      <div className="mb-8 px-2 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-blue-400">Gestión Restaurante</h2>
        <div className="mt-2">
          <p className="text-sm font-medium text-slate-200 break-words leading-tight">
            {user?.nombreCompleto}
          </p>
          {/* Mostramos el Rol debajo del nombre */}
          <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mt-1">
            {rolActivo?.nombreRol || 'Usuario'}
          </p>
        </div>
      </div>

      <nav className="space-y-2 flex-1 overflow-y-auto">
        {menusPadre.map((menu: any) => {
          const submenus = objetos.filter((sub: any) => sub.idPadre === menu.idObjeto);
          const IconComponent = (Icons as any)[menu.icono] || Icons.HelpCircle;

          return (
            <div key={menu.idObjeto}>
              <div 
                onClick={() => menu.url !== '#' && router.push(menu.url)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer group"
              >
                <IconComponent size={20} className="text-blue-400 group-hover:text-blue-300" />
                <span className="font-medium group-hover:text-white">{menu.nombre}</span>
              </div>

              {submenus.length > 0 && (
                <div className="ml-9 mt-1 space-y-1 border-l border-slate-700">
                  {submenus.map((sub: any) => (
                    <div 
                      key={sub.idObjeto}
                      onClick={() => router.push(sub.url)}
                      className="block p-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer"
                    >
                      {sub.nombre}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-800">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 w-full p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
        >
          <LogOut size={20} />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}