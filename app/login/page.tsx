'use client';
import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, User } from 'lucide-react';
import Swal from 'sweetalert2'; // Importamos SweetAlert2

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();

  // Función para mostrar alertas rápidas
  const showAlert = (message: string, icon: 'warning' | 'error' | 'success') => {
    Swal.fire({
      title: 'Atención',
      text: message,
      icon: icon,
      confirmButtonColor: '#2563eb', // Azul acorde al diseño
      confirmButtonText: 'Entendido',
      allowEscapeKey: false,
      allowOutsideClick: false
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- VALIDACIONES DE CAMPOS ---
    if (!username.trim()) {
      showAlert('Por favor, ingresa tu nombre de usuario.', 'warning');
      return;
    }

    if (!password.trim()) {
      showAlert('La contraseña es obligatoria para ingresar.', 'warning');
      return;
    }

    setIsLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      // Ahora validamos con data.success que viene de nuestra API
      if (data.success) {
        setAuth(data.usuario, data.token);
        router.push('/dashboard');
      } else {
        // Aquí es donde SweetAlert mostrará el mensaje que enviamos desde el backend
        showAlert(data.message, 'error');
      }
    } catch (err) {
      showAlert('No se pudo conectar con SASI. Verifica tu conexión.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Restaurante Pro</h1>
            <p className="text-slate-500 mt-2">Gestión Centralizada SASI</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="Usuario SASI"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input 
                  type="password" 
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 flex items-center justify-center disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : null}
              {isLoading ? 'Autenticando...' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}