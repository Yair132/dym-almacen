import React, { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Package, DollarSign, Users, LogOut, Menu, X } from 'lucide-react';

export default function Sidebar({ usuario, vistaActiva, setVistaActiva, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const opcionesMenu = [
    { id: 'mostrador', nombre: 'Registrar Venta', icono: <ShoppingCart size={20} />, roles: ['admin', 'cajero'] },
    { id: 'dashboard', nombre: 'Estadisticas', icono: <LayoutDashboard size={20} />, roles: ['admin'] },
    { id: 'inventario', nombre: 'Productos', icono: <Package size={20} />, roles: ['admin'] },
    { id: 'caja', nombre: 'Control de Caja', icono: <DollarSign size={20} />, roles: ['admin', 'cajero'] },
    { id: 'usuarios', nombre: 'Gestión Empleados', icono: <Users size={20} />, roles: ['admin'] },
  ];

  const filtrarOpciones = opcionesMenu.filter(opcion => opcion.roles.includes(usuario.rol));

  const cambiarVista = (id) => {
    setVistaActiva(id);
    setIsOpen(false); // Cierra el menú en mobile al hacer clic
  };

  return (
    <>
      {/* Botón Hamburguesa para Celulares */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-5 right-5 z-50 bg-yellow-400 text-black p-3.5 rounded-full shadow-2xl cursor-pointer"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Contenedor del Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#1e1e1e] border-r border-zinc-800 p-5 flex flex-col justify-between transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:h-screen
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          {/* Logo */}
          <div className="mb-8 px-2">
            <h2 className="text-xl font-black text-white">
              DyM <span className="text-yellow-400">Almacén</span>
            </h2>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mt-1">NextPulse Soluciones</span>
          </div>

          {/* Opciones de Navegación */}
          <nav className="space-y-1.5">
            {filtrarOpciones.map((opcion) => (
              <button
                key={opcion.id}
                onClick={() => cambiarVista(opcion.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer
                  ${vistaActiva === opcion.id 
                    ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/10' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}
                `}
              >
                {opcion.icono}
                <span>{opcion.nombre}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Perfil Abajo */}
        <div className="border-t border-zinc-800 pt-4 mt-auto">
          <div className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/60 mb-3">
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{usuario.nombre}</p>
              <p className="text-[10px] text-yellow-400 font-mono uppercase font-bold tracking-tight mt-0.5">{usuario.rol}</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}