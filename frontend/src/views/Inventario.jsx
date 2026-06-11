import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Pencil, X, Trash2 } from 'lucide-react';

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formData, setFormData] = useState({ codigo_barras: '', nombre: '', precio_costo: '', precio_venta: '', stock: '' });
  const [mensaje, setMensaje] = useState('');

  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setProductos(data || []);
    } catch (err) {
      console.error('Error al traer inventario:', err.message);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const datosParaEnviar = {
      codigo_barras: formData.codigo_barras.trim(),
      nombre: formData.nombre.trim(),
      precio_costo: parseFloat(String(formData.precio_costo).replace(',', '.')) || 0,
      precio_venta: parseFloat(String(formData.precio_venta).replace(',', '.')) || 0,
      stock: parseInt(formData.stock, 10) || 0
    };

    try {
      if (editandoId) {
        const { error } = await supabase
          .from('productos')
          .update(datosParaEnviar)
          .eq('id', editandoId);
        if (error) throw error;
        setMensaje('¡Producto actualizado correctamente!');
      } else {
        const { error } = await supabase
          .from('productos')
          .insert([datosParaEnviar]);
        if (error) throw error;
        setMensaje('¡Producto guardado correctamente!');
      }
      
      setFormData({ codigo_barras: '', nombre: '', precio_costo: '', precio_venta: '', stock: '' });
      setMostrarForm(false);
      setEditandoId(null);
      cargarProductos();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setMensaje('Error al guardar: ' + err.message);
    }
  };

  const eliminarProducto = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      setMensaje('Producto eliminado.');
      cargarProductos();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setMensaje('Error al eliminar.');
    }
  };

  const activarEdicion = (prod) => {
    setEditandoId(prod.id);
    setFormData({
      codigo_barras: prod.codigo_barras,
      nombre: prod.nombre,
      precio_costo: prod.precio_costo,
      precio_venta: prod.precio_venta,
      stock: prod.stock
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarAccion = () => {
    setFormData({ codigo_barras: '', nombre: '', precio_costo: '', precio_venta: '', stock: '' });
    setMostrarForm(false);
    setEditandoId(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-[#121212] min-h-screen text-zinc-100">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black">Control de <span className="text-yellow-400">Inventario</span></h2>
        </div>
        {!mostrarForm && (
          <button onClick={() => { setEditandoId(null); setMostrarForm(true); }} className="bg-yellow-400 text-black font-bold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2">
            <Plus size={16} /> Nuevo Artículo
          </button>
        )}
      </div>

      {mensaje && <div className="p-3 bg-zinc-900 border border-zinc-700 text-yellow-400 rounded-lg text-center text-sm">{mensaje}</div>}

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-[#1e1e1e] border border-zinc-800 p-5 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <input type="text" required value={formData.codigo_barras} onChange={(e) => setFormData({...formData, codigo_barras: e.target.value})} placeholder="Cód. Barras" className="bg-[#151515] border border-zinc-700 rounded-lg p-2.5 text-sm"/>
          <input type="text" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} placeholder="Nombre" className="sm:col-span-1 md:col-span-2 bg-[#151515] border border-zinc-700 rounded-lg p-2.5 text-sm"/>
          <input type="number" step="0.01" required value={formData.precio_costo} onChange={(e) => setFormData({...formData, precio_costo: e.target.value})} placeholder="Costo" className="bg-[#151515] border border-zinc-700 rounded-lg p-2.5 text-sm"/>
          <input type="number" step="0.01" required value={formData.precio_venta} onChange={(e) => setFormData({...formData, precio_venta: e.target.value})} placeholder="Venta" className="bg-[#151515] border border-zinc-700 rounded-lg p-2.5 text-sm"/>
          {/* Campo de Stock agregado abajo */}
          <input type="number" required value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} placeholder="Stock" className="bg-[#151515] border border-zinc-700 rounded-lg p-2.5 text-sm"/>
          
          <div className="md:col-span-5 flex justify-end gap-3">
            <button type="button" onClick={cancelarAccion} className="bg-zinc-800 px-4 py-2 rounded-lg text-sm">Cancelar</button>
            <button type="submit" className="bg-emerald-500 text-black font-black px-6 py-2 rounded-lg text-sm">{editandoId ? 'Aplicar Cambios' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/40 text-xs uppercase text-zinc-400">
            <tr>
              <th className="py-3 px-4">Producto</th>
              <th className="py-3 px-4 text-right">P. Costo</th>
              <th className="py-3 px-4 text-right">P. Venta</th>
              <th className="py-3 px-4 text-center">Stock</th>
              <th className="py-3 px-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {productos.map((prod) => (
              <tr key={prod.id}>
                <td className="py-3 px-4 text-white font-bold">{prod.nombre}</td>
                <td className="py-3 px-4 text-right text-zinc-400">${parseFloat(prod.precio_costo).toFixed(2)}</td>
                <td className="py-3 px-4 text-right text-yellow-400 font-bold">${parseFloat(prod.precio_venta).toFixed(2)}</td>
                <td className="py-3 px-4 text-center">{prod.stock}</td>
                <td className="py-3 px-4 text-center flex justify-center gap-2">
                  <button onClick={() => activarEdicion(prod)} className="text-zinc-400 hover:text-yellow-400"><Pencil size={16}/></button>
                  <button onClick={() => eliminarProducto(prod.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}