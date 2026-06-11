import React, { useState, useEffect } from 'react';
import Login from './views/Login';
import Mostrador from './views/Mostrador';
import AdminDashboard from './views/AdminDashboard';
import Inventario from './views/Inventario';
import Sidebar from './components/Sidebar';
import ControlCaja from './views/ControlCaja';
import GestionUsuarios from './views/GestionUsuarios';

export default function App() {
  const [user, setUser] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('mostrador');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const rol = localStorage.getItem('rol');
    const nombre = localStorage.getItem('nombre');

    if (token && rol && nombre) {
      setUser({ nombre, rol });
    }
  }, []);

  const handleLoginSuccess = (perfilUsuario) => {
    setUser(perfilUsuario);
    setVistaActiva(perfilUsuario.rol === 'admin' ? 'dashboard' : 'mostrador');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col lg:flex-row font-sans overflow-x-hidden">
      
      <Sidebar 
        usuario={user} 
        vistaActiva={vistaActiva} 
        setVistaActiva={setVistaActiva} 
        onLogout={handleLogout} 
      />

<main className="flex-1 overflow-y-auto">
  {vistaActiva === 'mostrador' && <Mostrador usuario={user} onLogout={handleLogout} />}
  {vistaActiva === 'dashboard' && <AdminDashboard />}
  {vistaActiva === 'inventario' && <Inventario />}
  {vistaActiva === 'caja' && <ControlCaja />}
  
  {vistaActiva === 'usuarios' && (
    (user?.rol || '').toLowerCase() === 'admin' ? (
      <GestionUsuarios />
    ) : (
      <div className="p-6 text-red-400 font-mono text-sm">⛔ Acceso Denegado. Se requieren permisos de Administrador.</div>
    )
  )}
</main>
    </div>
  );
}