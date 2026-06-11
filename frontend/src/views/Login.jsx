import React, { useState } from 'react';
import { supabase } from "../supabaseClient";
import { Lock, User, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      // 1. Autenticación en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: usuario,
        password: password,
      });

      if (authError) throw authError;

      // 2. Recuperar el perfil desde la tabla 'perfiles'
      // Usamos 'profileData' para evitar el conflicto con 'authData'
      const { data: profileData, error: perfilError } = await supabase
        .from('perfiles')
        .select('nombre, rol')
        .eq('id', authData.user.id)
        .single();

      if (perfilError) throw new Error('No se pudo recuperar el perfil del usuario');

      // 3. Unificamos los datos
      const usuarioFinal = {
        ...authData.user,
        nombre: profileData.nombre,
        rol: profileData.rol
      };

      if (onLoginSuccess) {
        onLoginSuccess(usuarioFinal);
      }
      
    } catch (err) {
      console.error("Error en Login:", err);
      setError(err.message || 'Error de conexión con Supabase');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center font-sans px-4">
      <div className="max-w-md w-full bg-[#1e1e1e] border border-zinc-800 rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            DyM <span className="text-yellow-400">Almacén</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-2">Iniciar Sesión</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 mb-6 text-sm">
            <AlertCircle size={18} className="text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-2">Email de Acceso</label>
            <input
              type="email"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full bg-[#161616] border border-zinc-700 rounded-lg p-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-2">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#161616] border border-zinc-700 rounded-lg p-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-all"
          >
            {cargando ? 'Conectando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}