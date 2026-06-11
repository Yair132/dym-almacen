import React from 'react';

export const TicketImpresion = React.forwardRef(({ datosVenta }, ref) => {
    if (!datosVenta) return null;

    const { ticketId, items, total, metodo_pago, abonado, vuelto } = datosVenta;
    const fechaActual = new Date().toLocaleString('es-AR');

    return (
        <div ref={ref} className="ticket-termico-container">
            <div className="ticket-header">
                <h2>DyM Almacén</h2>
                <p>¡Gracias por su compra!</p>
                <p>Rosario, Santa Fe</p>
                <hr className="ticket-divider" />
            </div>

            <div className="ticket-info">
                <p><strong>Ticket N°:</strong> #{ticketId}</p>
                <p><strong>Fecha:</strong> {fechaActual}</p>
                <p><strong>Atendido por:</strong> DyM</p>
                <hr className="ticket-divider" />
            </div>

            <table className="ticket-tabla-productos">
                <thead>
                    <tr>
                        <th className="txt-izq">Cant x Descripción</th>
                        <th className="txt-der">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td className="txt-izq">
                                {item.cantidad} x {item.nombre || item.descripcion}
                            </td>
                            <td className="txt-der">
                                ${(item.cantidad * item.precio_venta).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <hr className="ticket-divider" />

            <div className="ticket-totales">
                <p className="ticket-total-linea">
                    <span>TOTAL:</span> <strong>${parseFloat(total).toFixed(2)}</strong>
                </p>
                <p><span>Pago:</span> {metodo_pago.toUpperCase()}</p>
                {abonado > 0 && (
                    <>
                        <p><span>Abonó con:</span> ${parseFloat(abonado).toFixed(2)}</p>
                        <p><span>Vuelto:</span> ${parseFloat(vuelto).toFixed(2)}</p>
                    </>
                )}
            </div>

            <div className="ticket-footer">
                <hr className="ticket-divider" />
                <p>*** No válido como factura ***</p>
            </div>
        </div>
    );
});