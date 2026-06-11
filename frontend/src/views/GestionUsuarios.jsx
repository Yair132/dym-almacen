import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Shield, User, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

export default function GestionUsuarios() {
  const [formData, setFormData] = useState({ nombre: '', rol: 'cajero', email: '', password: '' });
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [empleados, setEmpleados] = useState([]);

  useEffect(() => {
    cargarEmpleados();
  }, []);

const cargarEmpleados = async () => {

  const { data, error } = await supabase
    .from('perfiles')
    .select('*');

  if (error) {
    console.error("Error cargando perfiles:", error);
  } else {
    setEmpleados(data || []);
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje({ tipo: '', texto: '' });

    // Creamos el usuario en el Auth de Supabase
    const { error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: { 
          nombre: formData.nombre, 
          rol: formData.rol 
        }
      }
    });

    if (authError) {
      setMensaje({ tipo: 'error', texto: authError.message });
    } else {
      setMensaje({ tipo: 'exito', texto: 'Empleado registrado exitosamente.' });
      setFormData({ nombre: '', rol: 'cajero', email: '', password: '' });
      cargarEmpleados();
    }
  };

  const handleEliminar = async (id, nombre) => {
    if (window.confirm(`¿Seguro que deseas eliminar a "${nombre}"?`)) {
      const { error } = await supabase.from('perfiles').delete().eq('id', id);
      if (error) alert('Error al eliminar: ' + error.message);
      else cargarEmpleados();
    }
  };

  return (
    <div className="p-6 bg-[#121212] min-h-screen text-zinc-100">
      <h2 className="text-2xl font-black mb-6">Gestión de <span className="text-yellow-400">Empleados</span></h2>
      
      {mensaje.texto && (
        <div className={`p-4 mb-4 rounded ${mensaje.tipo === 'exito' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400'}`}>
          {mensaje.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#1e1e1e] p-6 rounded-xl border border-zinc-800 space-y-4 max-w-lg mb-8">
        <input type="text" placeholder="Nombre Completo" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full bg-[#151515] p-3 rounded border border-zinc-700 text-white" />
        <input type="email" placeholder="Email (Login)" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-[#151515] p-3 rounded border border-zinc-700 text-white" />
        <input type="password" placeholder="Contraseña" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-[#151515] p-3 rounded border border-zinc-700 text-white" />
        <select value={formData.rol} onChange={(e) => setFormData({...formData, rol: e.target.value})} className="w-full bg-[#151515] p-3 rounded border border-zinc-700 text-white">
          <option value="cajero">Cajero</option>
          <option value="admin">Administrador</option>
        </select>
        <button type="submit" className="w-full bg-yellow-400 text-black font-black py-3 rounded">Registrar Empleado</button>
      </form>

      <div className="bg-[#1e1e1e] rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#161616] text-zinc-400 text-xs uppercase">
            <tr><th className="p-4">Nombre</th><th className="p-4">Rol</th><th className="p-4">Acción</th></tr>
          </thead>
          <tbody>
            {empleados.map((emp) => (
              <tr key={emp.id} className="border-t border-zinc-800">
                <td className="p-4">{emp.nombre}</td>
                <td className="p-4">{emp.rol}</td>
                <td className="p-4"><button onClick={() => handleEliminar(emp.id, emp.nombre)} className="text-red-500"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}