import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, Lock, Unlock, Loader, Wallet, Smartphone, CreditCard, ArrowDownRight, TrendingDown, FileText } from 'lucide-react';

export default function ControlCaja() {
  const [cajaActiva, setCajaActiva] = useState(null);
  const [ultimoResumen, setUltimoResumen] = useState(null);
  const [montoInicial, setMontoInicial] = useState('');
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [totalesTurno, setTotalesTurno] = useState({ 
    desglose: { efectivo: 0, transferencia: 0, tarjeta: 0 }, 
    total_general: 0,
    ganancia_total: 0,
    total_retiros: 0 
  });

  useEffect(() => { chequearEstadoCaja(); }, []);

  const chequearEstadoCaja = async () => {
    setCargando(true);
    const { data } = await supabase.from('cajas').select('*').eq('estado', 'abierta').maybeSingle();
    if (data) {
      setCajaActiva(data);
      setUltimoResumen(null);
      cargarTotalesTurno(data.fecha_apertura);
    } else {
      setCajaActiva(null);
    }
    setCargando(false);
  };

  const cargarTotalesTurno = async (fechaApertura) => {
    const [resVentas, resRetiros] = await Promise.all([
      supabase.from('ventas').select('total, metodo_pago, detalle_ventas(cantidad, precio_costo, precio_unitario)').gte('fecha', fechaApertura),
      supabase.from('retiros').select('monto').gte('fecha', fechaApertura)
    ]);

    const ventas = resVentas.data || [];
    const retiros = resRetiros.data || [];

    const resumen = ventas.reduce((acc, v) => {
      const metodo = v.metodo_pago || 'efectivo';
      acc.desglose[metodo] = (acc.desglose[metodo] || 0) + (Number(v.total) || 0);
      acc.total_general += (Number(v.total) || 0);
      if (v.detalle_ventas) {
        v.detalle_ventas.forEach(d => {
          acc.ganancia_total += (Number(d.precio_unitario) - Number(d.precio_costo)) * d.cantidad;
        });
      }
      return acc;
    }, { 
      desglose: { efectivo: 0, transferencia: 0, tarjeta: 0 }, 
      total_general: 0, 
      ganancia_total: 0 
    });

    resumen.total_retiros = retiros.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
    // El efectivo real es lo que entró menos lo que se retiró
    resumen.efectivo_neto = resumen.desglose.efectivo - resumen.total_retiros;

    setTotalesTurno(resumen);
  };

  const manejarCierre = async () => {
    if (!window.confirm("¿Cerrar caja y finalizar turno?")) return;
    setUltimoResumen(totalesTurno);
    const { error } = await supabase.from('cajas').update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() }).eq('id', cajaActiva.id);
    if (!error) { setCajaActiva(null); setMensaje({ tipo: 'exito', texto: 'Turno cerrado correctamente.' }); }
  };

  const RenderResumen = ({ datos, titulo }) => (
    <div className="bg-[#1e1e1e] p-6 rounded-xl border border-zinc-800 space-y-6 shadow-2xl">
      <h3 className="text-zinc-400 font-bold flex items-center gap-2 border-b border-zinc-800 pb-3"><FileText size={18} /> {titulo}</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151515] p-4 rounded-xl border border-emerald-500/10">
          <span className="text-[10px] text-zinc-500 uppercase block mb-1">Efectivo Neto</span>
          <p className="font-bold text-xl text-emerald-400">${(datos.efectivo_neto || 0).toFixed(2)}</p>
        </div>
        <div className="bg-[#151515] p-4 rounded-xl border border-blue-500/10">
          <span className="text-[10px] text-zinc-500 uppercase block mb-1">Transferencias</span>
          <p className="font-bold text-xl text-blue-400">${datos.desglose.transferencia.toFixed(2)}</p>
        </div>
        <div className="bg-[#151515] p-4 rounded-xl border border-purple-500/10">
          <span className="text-[10px] text-zinc-500 uppercase block mb-1">Tarjetas</span>
          <p className="font-bold text-xl text-purple-400">${datos.desglose.tarjeta.toFixed(2)}</p>
        </div>
        <div className="bg-[#151515] p-4 rounded-xl border border-red-500/10">
          <span className="text-[10px] text-zinc-500 uppercase block mb-1">Retiros Efectivo</span>
          <p className="font-bold text-xl text-red-400">-${datos.total_retiros.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-[#1a1a1a] p-5 rounded-xl border border-yellow-500/20 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">Ganancia Estimada del Turno</span>
          <p className="font-black text-3xl text-yellow-400">${datos.ganancia_total.toFixed(2)}</p>
        </div>
        <ArrowDownRight size={32} className="text-yellow-400 opacity-50" />
      </div>
    </div>
  );

  if (cargando) return <div className="text-center p-20 text-yellow-400"><Loader className="animate-spin inline" /></div>;

  return (
    <div className="p-6 bg-[#121212] min-h-screen text-zinc-100">
      <h2 className="text-2xl font-black mb-8 border-b border-zinc-800 pb-4">Control de <span className="text-yellow-400">Caja</span></h2>
      
      {mensaje.texto && <div className={`p-4 rounded-xl border mb-6 ${mensaje.tipo === 'exito' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' : 'bg-red-950/20 border-red-500/30 text-red-400'}`}>{mensaje.texto}</div>}

      {!cajaActiva ? (
        <div className="space-y-10">
          {/* Formulario CENTRADO y PEQUEÑO */}
          <div className="flex justify-center">
            <form onSubmit={async(e) => { e.preventDefault(); await supabase.from('cajas').insert([{ monto_inicial: parseFloat(montoInicial), estado: 'abierta', fecha_apertura: new Date().toISOString() }]); chequearEstadoCaja(); }} className="bg-[#1e1e1e] p-8 rounded-2xl border border-zinc-800 w-full max-w-md shadow-2xl">
              <h3 className="text-red-400 font-bold mb-6 flex items-center gap-2"><Lock size={20} /> La caja está cerrada</h3>
              <div className="space-y-4">
                <label className="text-xs text-zinc-500 uppercase font-bold">Monto inicial de efectivo</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3.5 text-zinc-600" size={18} />
                  <input type="number" required value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} placeholder="0.00" className="w-full bg-[#151515] border border-zinc-700 rounded-xl p-3.5 pl-10 text-white text-lg focus:border-yellow-400 outline-none transition-all" />
                </div>
                <button className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 rounded-xl flex justify-center items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-yellow-400/10">
                  <Unlock size={18} /> Iniciar Turno Comercial
                </button>
              </div>
            </form>
          </div>

          {ultimoResumen && <RenderResumen datos={ultimoResumen} titulo="Resumen del Turno Cerrado" />}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="font-bold text-emerald-500 uppercase tracking-wider text-sm">Turno en curso</span>
            </div>
            <button onClick={manejarCierre} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-6 py-2.5 rounded-xl font-bold border border-red-500/20 transition-all cursor-pointer">Finalizar Turno y Cerrar Caja</button>
          </div>
          <RenderResumen datos={totalesTurno} titulo="Detalle de Operaciones en Tiempo Real" />
        </div>
      )}
    </div>
  );
}