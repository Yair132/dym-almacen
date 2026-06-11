import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, TrendingUp, Calendar, ShoppingBag, Wallet, Smartphone, CreditCard, BarChart3, Loader } from 'lucide-react';

export default function AdminDashboard() {
  const [metricas, setMetricas] = useState(null);
  const [cajaDiaria, setCajaDiaria] = useState({ desglose: { efectivo: 0, transferencia: 0, tarjeta: 0 }, total_general: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarTodoElPanel = async () => {
      try {
        const { data: ventas, error: ventasError } = await supabase
          .from('ventas')
          .select('total, costo_total, fecha, metodo_pago');

        if (ventasError) throw ventasError;

        const hoy = new Date().toISOString().split('T')[0];
        const ventasHoy = ventas.filter(v => v.fecha && v.fecha.startsWith(hoy));
        
        const desglose = ventasHoy.reduce((acc, v) => {
          const metodo = v.metodo_pago || 'efectivo';
          acc[metodo] = (acc[metodo] || 0) + (v.total || 0);
          return acc;
        }, { efectivo: 0, transferencia: 0, tarjeta: 0 });

        setCajaDiaria({
          desglose,
          total_general: ventasHoy.reduce((sum, v) => sum + (v.total || 0), 0)
        });

        setMetricas({
          diario: {
            ganancia_neta: ventasHoy.reduce((sum, v) => sum + ((v.total || 0) - (v.costo_total || 0)), 0),
            total_ventas: ventasHoy.reduce((sum, v) => sum + (v.total || 0), 0)
          },
          historico: {
            total_ventas: ventas.reduce((sum, v) => sum + (v.total || 0), 0)
          }
        });
      } catch (err) {
        console.error("Error al cargar:", err);
        setError('Error al conectar con la base de datos.');
      }
    };
    
    cargarTodoElPanel();
  }, []);

  if (error) return <div className="p-4 text-red-400">{error}</div>;
  if (!metricas) return <div className="flex justify-center p-20 text-yellow-400"><Loader className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 bg-[#121212] min-h-screen text-zinc-100">
      <h2 className="text-2xl font-black">Panel de <span className="text-yellow-400">Administración</span></h2>
      
      {/* Ventas del día */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#151515] border-l-4 border-emerald-500 p-4 rounded-r-xl">
          <span className="text-[10px] uppercase text-zinc-500">Efectivo</span>
          <p className="text-lg font-bold">${cajaDiaria.desglose.efectivo.toFixed(2)}</p>
        </div>
        <div className="bg-[#151515] border-l-4 border-blue-500 p-4 rounded-r-xl">
          <span className="text-[10px] uppercase text-zinc-500">Transf. / MP</span>
          <p className="text-lg font-bold">${cajaDiaria.desglose.transferencia.toFixed(2)}</p>
        </div>
        <div className="bg-[#151515] border-l-4 border-purple-500 p-4 rounded-r-xl">
          <span className="text-[10px] uppercase text-zinc-500">Tarjeta</span>
          <p className="text-lg font-bold">${cajaDiaria.desglose.tarjeta.toFixed(2)}</p>
        </div>
      </div>

      {/* Métricas macro */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-[#1e1e1e] p-5 rounded-xl border border-zinc-800">
          <span className="text-[10px] uppercase text-zinc-500">Ganancia Diaria</span>
          <p className="text-xl font-black text-emerald-400">${metricas.diario.ganancia_neta.toFixed(2)}</p>
        </div>
        <div className="bg-[#1e1e1e] p-5 rounded-xl border border-zinc-800">
          <span className="text-[10px] uppercase text-zinc-500">Facturado Hoy</span>
          <p className="text-xl font-black text-white">${metricas.diario.total_ventas.toFixed(2)}</p>
        </div>
        <div className="bg-[#1e1e1e] p-5 rounded-xl border border-zinc-800">
          <span className="text-[10px] uppercase text-zinc-500">Caja Histórica</span>
          <p className="text-xl font-black text-zinc-300">${metricas.historico.total_ventas.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}