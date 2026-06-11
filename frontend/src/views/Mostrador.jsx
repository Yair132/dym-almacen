import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient'; // 👈 Conexión a Supabase
import { Barcode, Trash2, ShoppingCart, DollarSign, User, LogOut, Wallet } from 'lucide-react';
import { TicketImpresion } from './TicketImpresion';

export default function Mostrador({ usuario, onLogout }) {
  const [codigo, setCodigo] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [pagoCon, setPagoCon] = useState('');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [mostrarModalRetiro, setMostrarModalRetiro] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState('');
  const [motivoRetiro, setMotivoRetiro] = useState('');
  const [datosCierre, setDatosCierre] = useState(null);
  
  // Estado para capturar la venta confirmada y pasarla a la tiquetera
  const [datosUltimaVenta, setDatosUltimaVenta] = useState(null);

  // Control de Flujo de Caja
  const [cajaVerificada, setCajaVerificada] = useState(false);
  const [mostrarModalApertura, setMostrarModalApertura] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');
  
  const buscadorRef = useRef(null);
  const ticketRef = useRef(null);

  // 🛡️ EFECTO 1: Verificación automática de Caja Activa en Supabase
  useEffect(() => {
    const verificarEstadoCaja = async () => {
      try {
        const { data, error } = await supabase
          .from('cajas')
          .select('id')
          .eq('estado', 'abierta')
          .maybeSingle();

        if (error || !data) {
          setMostrarModalApertura(true);
        } else {
          setCajaVerificada(true);
          setTimeout(() => buscadorRef.current?.focus(), 100);
        }
      } catch (err) {
        console.error("Error al verificar estado de caja:", err);
        mostrarMensaje('error', 'Error al verificar el estado de la caja.');
      }
    };

    verificarEstadoCaja();
  }, []);

  // Mantener el lector de barra siempre activo apuntando al input
  useEffect(() => {
    if (cajaVerificada) {
      buscadorRef.current?.focus();
    }
  }, [cajaVerificada]);

  useEffect(() => {
    const manejarTeclado = (e) => {
      if (e.key === 'F10') {
        e.preventDefault();
        procesarVenta();
      }
    };
    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [carrito, pagoCon, metodoPago, cajaVerificada]);

  // Efecto centinela: Al detectar datos de la última venta, dispara la tiquetera de inmediato
  useEffect(() => {
    if (datosUltimaVenta) {
      window.print();
      setCarrito([]);
      setPagoCon('');
      setMetodoPago('efectivo');
      setDatosUltimaVenta(null);
      setTimeout(() => buscadorRef.current?.focus(), 100);
    }
  }, [datosUltimaVenta]);

  // 💰 Función para procesar el formulario de Apertura de Caja en Supabase
  const handleAperturaCaja = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('cajas').insert([
        { monto_inicial: parseFloat(montoInicial) || 0, estado: 'abierta' }
      ]);
      
      if (error) throw error;

      setMostrarModalApertura(false);
      setCajaVerificada(true);
      mostrarMensaje('exito', '¡Turno de caja iniciado con éxito!');
      setTimeout(() => buscadorRef.current?.focus(), 100);
    } catch (err) {
      console.error("Error al abrir caja:", err);
      alert('Error al abrir la caja.');
    }
  };

  const handleRetiroEfectivo = async (e) => {
    e.preventDefault();
    try {
      // Obtenemos la caja abierta para relacionar el retiro
      const { data: cajaAbierta } = await supabase
        .from('cajas')
        .select('id')
        .eq('estado', 'abierta')
        .maybeSingle();

      const { error } = await supabase.from('retiros').insert([
        {
          caja_id: cajaAbierta?.id,
          monto: parseFloat(montoRetiro),
          motivo: motivoRetiro
        }
      ]);

      if (error) throw error;

      setMostrarModalRetiro(false);
      setMontoRetiro('');
      setMotivoRetiro('');
      mostrarMensaje('exito', 'Retiro de efectivo registrado correctamente.');
      setTimeout(() => buscadorRef.current?.focus(), 100);
    } catch (err) {
      console.error("Error en retiro:", err);
      alert('Error al procesar el retiro.');
    }
  };

  // 🔥 Buscar producto por código de barras en Supabase con Control de Stock
  const buscarProducto = async (e) => {
    e.preventDefault();
    if (!codigo.trim() || !cajaVerificada) return;

    try {
      const { data: producto, error } = await supabase
        .from('productos')
        .select('*')
        .eq('codigo_barras', codigo)
        .maybeSingle();

      if (error || !producto) {
        mostrarMensaje('error', 'Producto no registrado.');
        return;
      }

      // 🛑 Control de stock disponible
      if (producto.stock <= 0) {
        mostrarMensaje('error', `¡Sin Stock! No quedan unidades disponibles de: ${producto.nombre}`);
        setCodigo('');
        return;
      }

      const existe = carrito.find(item => item.id === producto.id);
      if (existe) {
        // 🛑 Si ya está en el carrito, evitar que supere el stock máximo real
        if (existe.cantidad >= producto.stock) {
          mostrarMensaje('error', `Límite alcanzado: Solo hay ${producto.stock} u. disponibles de ${producto.nombre}`);
          setCodigo('');
          return;
        }

        setCarrito(carrito.map(item => 
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        ));
      } else {
        setCarrito([...carrito, { ...producto, cantidad: 1 }]);
      }
      setCodigo('');
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', 'Producto no encontrado o error de conexión.');
    }
  };

  const eliminarDelCarrito = (id) => {
    setCarrito(carrito.filter(item => item.id !== id));
  };

  const calcularTotal = () => {
    return carrito.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0);
  };

  const calcularVuelto = () => {
    const total = calcularTotal();
    const pago = parseFloat(pagoCon) || 0;
    return pago > total ? pago - total : 0;
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 4000);
  };

  const procesarVenta = async () => {
    if (!cajaVerificada) {
      mostrarMensaje('error', 'Debe abrir la caja para poder operar.');
      return;
    }
    if (carrito.length === 0) {
      mostrarMensaje('error', 'El carrito está vacío.');
      return;
    }

    try {
      // 1. Obtener el ID de la caja abierta actualmente desde Supabase
      const { data: cajaAbierta, error: errorCaja } = await supabase
        .from('cajas')
        .select('id')
        .eq('estado', 'abierta')
        .maybeSingle();

      if (errorCaja || !cajaAbierta) {
        throw new Error('No se encontró una caja abierta para registrar la venta.');
      }

      const totalVenta = calcularTotal();
      const abonaConMonto = parseFloat(pagoCon) || 0;
      const vueltoCalculado = calcularVuelto();

      // 2. Preparar los datos de la cabecera de la venta incluyendo el caja_id
      const datosVenta = {
        total: totalVenta,
        metodo_pago: metodoPago,
        caja_id: cajaAbierta.id,
        fecha: new Date().toISOString()
      };

      // 3. Insertar la venta
      const { data: ventaInsertada, error: errorVenta } = await supabase
        .from('ventas')
        .insert([datosVenta])
        .select()
        .single();

      if (errorVenta) throw errorVenta;

      // 4. Insertar detalle_ventas e ir descontando stock
const detalles = carrito.map(item => ({
  venta_id: ventaInsertada.id,
  producto_id: item.id,
  cantidad: item.cantidad,
  precio_unitario: item.precio_venta, // CORREGIDO: ahora coincide con la columna de tu BD
  precio_costo: item.precio_costo || 0 
}));

const { error: errorDetalles } = await supabase.from('detalle_ventas').insert(detalles);

      if (errorDetalles) throw errorDetalles;

      for (const item of carrito) {
        await supabase
          .from('productos')
          .update({ stock: item.stock - item.cantidad })
          .eq('id', item.id);
      }
      
      mostrarMensaje('exito', '¡Venta procesada con éxito!');
      
      setDatosUltimaVenta({
        ticketId: ventaInsertada.id,
        items: carrito,
        total: totalVenta,
        metodo_pago: metodoPago,
        abonado: abonaConMonto,
        vuelto: vueltoCalculado,
        cajero: usuario?.nombre || 'Personal DyM',
        fecha: new Date().toLocaleString('es-AR')
      });
      
    } catch (err) {
      console.error(err);
      mostrarMensaje('error', err.message || 'Error al registrar la venta.');
    }
  };const obtenerResumenCierre = async () => {
    // 1. Primero obtenemos el ID de la caja abierta
    const { data: cajaAbierta } = await supabase
      .from('cajas')
      .select('id')
      .eq('estado', 'abierta')
      .maybeSingle();

    if (!cajaAbierta) {
      alert("No hay una caja abierta actualmente.");
      return;
    }

    try {
      // 2. Consulta segura de detalles y ventas vinculadas
      const { data: detalles, error } = await supabase
        .from('detalle_ventas')
        .select(`
          cantidad, 
          precio_venta, 
          precio_costo,
          ventas!inner(metodo_pago)
        `)
        .eq('ventas.caja_id', cajaAbierta.id);

      if (error) throw error;

      // 3. Procesar resultados
      const resumen = detalles.reduce((acc, d) => {
        acc.ganancia_total += (d.cantidad * (d.precio_venta - d.precio_costo));
        const metodo = d.ventas.metodo_pago;
        if (metodo === 'efectivo') acc.ventas_efectivo += (d.cantidad * d.precio_venta);
        else if (metodo === 'transferencia') acc.ventas_transferencia += (d.cantidad * d.precio_venta);
        else if (metodo === 'tarjeta') acc.ventas_tarjeta += (d.cantidad * d.precio_venta);
        return acc;
      }, { ganancia_total: 0, ventas_efectivo: 0, ventas_transferencia: 0, ventas_tarjeta: 0, total_retiros: 0 });

      // 4. Sumar retiros específicos de esta caja
      const { data: retiros } = await supabase
        .from('retiros')
        .select('monto')
        .eq('caja_id', cajaAbierta.id);

      if (retiros) {
        resumen.total_retiros = retiros.reduce((acc, r) => acc + r.monto, 0);
      }

      setDatosCierre(resumen); // Esto abrirá tu ModalCierre
    } catch (err) {
      console.error("Error al calcular cierre:", err);
      alert("Error al obtener los datos de cierre.");
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-100 flex flex-col font-sans relative">
      
      {/* Navbar Superior */}
      <header className="bg-[#1e1e1e] border-b border-zinc-800 px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <ShoppingCart className="text-yellow-400" size={24} />
          <h1 className="text-xl font-black tracking-tight">
            DyM <span className="text-yellow-400">Almacén</span>
          </h1>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-md font-mono border border-zinc-700">POS v1.0</span>
        </div>
        
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              if (typeof cajaVerificada !== 'undefined' && !cajaVerificada) return; 
              setMostrarModalRetiro(true);
            }}
            disabled={typeof cajaVerificada !== 'undefined' ? !cajaVerificada : false}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase border border-red-500/30 px-3 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>💸 Retiro de Efectivo</span>
          </button>

          <div className="flex items-center gap-2 text-sm bg-zinc-900/50 px-4 py-2 rounded-lg border border-zinc-800">
            <User size={16} className="text-yellow-400" />
            <span className="text-zinc-300 font-medium">{usuario?.nombre}</span>
            <span className="text-[10px] uppercase bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded font-bold">{usuario?.rol}</span>
          </div>

          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-zinc-400 hover:text-red-400 text-sm transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Salir</span>
          </button>
        </div>

      </header>

      {/* Panel Principal */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 p-6 gap-6">
        
        {/* Lado Izquierdo */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <form onSubmit={buscarProducto} className="bg-[#1e1e1e] border border-zinc-800 p-4 rounded-xl shadow-lg">
            <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">Escanear Código de Barras o Enter</label>
            <div className="relative">
              <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={22} />
              <input
                type="text"
                ref={buscadorRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={!cajaVerificada}
                placeholder={cajaVerificada ? "Pase el lector de barras por el producto..." : "Abra la caja para iniciar..."}
                className="w-full bg-[#151515] border border-zinc-700 rounded-lg pl-12 pr-4 py-3.5 text-white placeholder-zinc-600 font-mono text-lg focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </form>

          <div className="flex-1 bg-[#1e1e1e] border border-zinc-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
              <h3 className="font-bold text-zinc-200">Detalle de la Compra Actual</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {carrito.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 p-8">
                  <ShoppingCart size={48} className="stroke-1" />
                  <p className="text-sm font-medium">No hay productos cargados en esta venta.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-400 bg-zinc-900/20">
                      <th className="py-3 px-6">Descripción</th>
                      <th className="py-3 px-6 text-center">Cant.</th>
                      <th className="py-3 px-6 text-right">Precio Unit.</th>
                      <th className="py-3 px-6 text-right">Subtotal</th>
                      <th className="py-3 px-6 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 font-medium">
                    {carrito.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-950/40 transition-colors">
                        <td className="py-4 px-6">
                          <div className="text-white font-semibold">{item.nombre}</div>
                          <div className="text-xs text-zinc-500 font-mono mt-0.5">{item.codigo_barras}</div>
                        </td>
                        <td className="py-4 px-6 text-center text-yellow-400 font-mono text-lg">{item.cantidad}</td>
                        <td className="py-4 px-6 text-right text-zinc-300 font-mono">${parseFloat(item.precio_venta).toFixed(2)}</td>
                        <td className="py-4 px-6 text-right text-white font-mono text-lg">${(item.precio_venta * item.cantidad).toFixed(2)}</td>
                        <td className="py-4 px-6 text-center">
                          <button 
                            onClick={() => eliminarDelCarrito(item.id)}
                            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md hover:bg-zinc-900 transition-colors cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Lado Derecho */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#1e1e1e] border border-zinc-800 rounded-xl p-6 shadow-lg flex flex-col justify-between h-full">
            
            <div>
              <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-6 border-b border-zinc-800 pb-2">Totales y Cobro</h3>
              
              {mensaje.texto && (
                <div className={`p-3 rounded-lg text-sm mb-4 font-medium border ${
                  mensaje.tipo === 'exito' 
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-950/30 border-red-500/30 text-red-300'
                }`}>
                  {mensaje.texto}
                </div>
              )}

              <div className="bg-[#151515] border border-zinc-800 p-6 rounded-xl text-center mb-6">
                <span className="block text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1">Total a Pagar</span>
                <span className="text-4xl font-black text-yellow-400 font-mono">${calcularTotal().toFixed(2)}</span>
              </div>

              <div className="space-y-2 mb-6">
                <label className="block text-zinc-400 text-sm font-medium">Abona con ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="number"
                    value={pagoCon}
                    onChange={(e) => setPagoCon(e.target.value)}
                    disabled={!cajaVerificada}
                    placeholder="0.00"
                    className="w-full bg-[#151515] border border-zinc-700 rounded-lg pl-9 pr-4 py-3 text-white font-mono text-xl focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/80 mb-6">
                <span className="text-sm font-medium text-zinc-400">Vuelto para el Cliente:</span>
                <span className="text-2xl font-bold text-emerald-400 font-mono">${calcularVuelto().toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-zinc-800 space-y-3 mb-6">
              <label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">
                Seleccionar Medio de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'efectivo', label: 'Efectivo', icon: '💵' },
                  { id: 'transferencia', label: 'Transf.', icon: '📱' },
                  { id: 'tarjeta', label: 'Tarjeta', icon: '💳' }
                ].map((tipo) => (
                  <button
                    key={tipo.id}
                    type="button"
                    disabled={!cajaVerificada}
                    onClick={() => setMetodoPago(tipo.id)}
                    className={`flex flex-col items-center justify-center py-3 rounded-lg border-2 transition-all cursor-pointer disabled:opacity-40 ${
                      metodoPago === tipo.id 
                        ? 'bg-yellow-400 border-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]' 
                        : 'bg-[#121212] border-zinc-800 text-zinc-500 hover:border-zinc-600'
                    }`}
                  >
                    <span className="text-lg mb-1">{tipo.icon}</span>
                    <span className="text-[10px] font-bold uppercase">{tipo.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={procesarVenta}
                disabled={!cajaVerificada}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 px-4 rounded-xl text-lg transition-all transform active:scale-[0.99] shadow-lg shadow-yellow-400/10 cursor-pointer flex justify-center items-center gap-2 disabled:opacity-50"
              >
                <DollarSign size={20} />
                <span>Registrar Venta (F10)</span>
              </button>
              <div className="text-center text-[11px] text-zinc-500 font-mono">
                Presioná <span className="bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700 text-zinc-400">F10</span> desde cualquier campo para facturar.
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 🔒 MODAL DE CONTROL DE APERTURA OBLIGATORIA */}
      {mostrarModalApertura && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border-2 border-yellow-400 text-zinc-100 p-8 rounded-2xl max-w-md w-full shadow-[0_0_40px_rgba(250,204,21,0.15)] transform transition-all">
            <div className="flex items-center gap-3 mb-4 border-b border-zinc-800 pb-3">
              <div className="bg-yellow-400/10 p-2 rounded-lg border border-yellow-400/20">
                <Wallet className="text-yellow-400" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-yellow-400">
                  Apertura de Caja
                </h2>
                <p className="text-zinc-500 text-xs">P.O.S. Control Turno — DyM Almacén</p>
              </div>
            </div>
            
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Para comenzar, ingrese el <span className="text-white font-semibold">saldo inicial en efectivo</span> disponible.
            </p>
            
            <form onSubmit={handleAperturaCaja} className="space-y-5">
              <div>
                <label className="block text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2">
                  Monto Inicial en Efectivo ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-400" size={20} />
                  <input 
                    type="number" 
                    step="any"
                    className="w-full bg-[#111111] border-2 border-zinc-800 text-yellow-400 font-mono text-2xl pl-10 pr-4 py-3.5 rounded-xl focus:border-yellow-400 focus:outline-none transition-all shadow-inner placeholder-zinc-800"
                    placeholder="0.00"
                    value={montoInicial}
                    onChange={(e) => setMontoInicial(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 px-4 rounded-xl uppercase tracking-wider transition-all transform active:scale-[0.98] shadow-lg shadow-yellow-400/20 text-sm flex justify-center items-center gap-2 cursor-pointer"
              >
                🚀 Iniciar Turno Comercial
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔒 MODAL DE RETIRO DE EFECTIVO */}
      {mostrarModalRetiro && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border-2 border-red-500/50 text-zinc-100 p-8 rounded-2xl max-w-md w-full shadow-[0_0_40px_rgba(239,68,68,0.15)] transform transition-all">
            
            <div className="flex items-center gap-3 mb-4 border-b border-zinc-800 pb-3">
              <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                <DollarSign className="text-red-400" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-red-400">
                  Retirar Efectivo
                </h2>
                <p className="text-zinc-500 text-xs">Egresos de caja — DyM Almacén</p>
              </div>
            </div>
            
            <form onSubmit={handleRetiroEfectivo} className="space-y-4">
              <div>
                <label className="block text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">
                  Monto a Retirar ($)
                </label>
                <input 
                  type="number" 
                  step="any"
                  className="w-full bg-[#111111] border-2 border-zinc-800 text-red-400 font-mono text-2xl px-4 py-3 rounded-xl focus:border-red-500 focus:outline-none transition-all"
                  placeholder="0.00"
                  value={montoRetiro}
                  onChange={(e) => setMontoRetiro(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">
                  Motivo / Proveedor
                </label>
                <input 
                  type="text" 
                  className="w-full bg-[#111111] border-2 border-zinc-800 text-zinc-300 px-4 py-3 rounded-xl focus:border-red-500 focus:outline-none text-sm transition-all placeholder-zinc-700"
                  placeholder="Ej: Pago a Distribuidora Las Chicas / Coca-Cola"
                  value={motivoRetiro}
                  onChange={(e) => setMotivoRetiro(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setMostrarModalRetiro(false);
                    setTimeout(() => buscadorRef.current?.focus(), 100);
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold py-3 px-4 rounded-xl uppercase tracking-wider text-xs border border-zinc-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-red-500 hover:bg-red-600 text-white font-black py-3 px-4 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-red-500/10 transition-all cursor-pointer"
                >
                  Confirmar Salida
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Componente oculto de impresión */}
      <TicketImpresion ref={ticketRef} datosVenta={datosUltimaVenta} />

      {/* Estilos de Inyección Directa para la Tiquetera Térmica */}
      <style>{`
        .ticket-termico-container {
          display: none;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #000;
          line-height: 1.3;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .ticket-termico-container, .ticket-termico-container * {
            visibility: visible;
          }
          .ticket-termico-container {
            display: block;
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm;
            padding: 2mm;
            background: #fff;
          }
          @page {
            margin: 0;
          }
        }

        .ticket-header { text-align: center; margin-bottom: 6px; }
        .ticket-header h2 { margin: 0; font-size: 15px; font-weight: bold; }
        .ticket-header p { margin: 2px 0; font-size: 11px; }
        .ticket-divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .ticket-info p { margin: 2px 0; font-size: 11px; }
        .ticket-tabla-productos { width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0; }
        .txt-izq { text-align: left; }
        .txt-der { text-align: right; }
        .ticket-totales { font-size: 11px; margin-top: 6px; }
        .ticket-total-linea { font-size: 13px; display: flex; justify-content: space-between; margin: 5px 0; font-weight: bold; }
        .ticket-footer { text-align: center; margin-top: 15px; font-size: 9px; font-weight: bold; }
      `}</style>

    </div>
  );
}