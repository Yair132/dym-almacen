const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Definimos el puerto dinámico para producción (Render) o local (5000)
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306, // <--- Agregá esta línea
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

pool.getConnection()
    .then(conn => {
        console.log('🔌 Conectado con éxito a MySQL (Aiven / dym_almacen).');
        conn.release();
    })
    .catch(err => console.error('❌ Error crítico al conectar a MySQL:', err.message));

// MIDDLEWARES DE PROTECCIÓN (SEGURIDAD)

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ mensaje: 'Acceso denegado. No se proporcionó un token.' });
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = verificado;
        next();
    } catch (error) {
        res.status(403).json({ mensaje: 'Token inválido o expirado.' });
    }
};

const esAdmin = (req, res, next) => {
    if (req.usuario?.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'Acceso restringido. Se requieren permisos de Administrador.' });
    }
    next();
};

// ==========================================
// ENDPOINTS DE AUTENTICACIÓN (AUTH)
// ==========================================

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { usuario, password } = req.body;

    try {
        const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE usuario = ?', [usuario.trim()]);

        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: 'El usuario ingresado no existe.' });
        }

        const user = usuarios[0];
        
        // --- AQUÍ ESTÁ EL CAMBIO PARA DEPURAR ---
        const passwordValida = await bcrypt.compare(password.trim(), user.password);
        
        console.log("--- DEPURACIÓN LOGIN ---");
        console.log("Usuario buscado:", usuario);
        console.log("Password recibido (trim):", password.trim());
        console.log("Hash encontrado en BD:", user.password);
        console.log("¿Coinciden según bcrypt?:", passwordValida);
        // ----------------------------------------

        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'La contraseña es incorrecta.' });
        }

        const token = jwt.sign(
            { id: user.id, usuario: user.usuario, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ mensaje: '¡Ingreso exitoso!', token, usuario: { id: user.id, nombre: user.nombre, rol: user.rol } });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});

// VALIDAR TOKEN EN EL FRONTEND
app.get('/api/auth/validar', verificarToken, (req, res) => {
    res.json({ valido: true, usuario: req.usuario });
});


// ==========================================
// ENDPOINTS DE PRODUCTOS (INVENTARIO)
// ==========================================

// OBTENER TODOS LOS PRODUCTOS
app.get('/api/productos', verificarToken, async (req, res) => {
    try {
        const [productos] = await pool.query('SELECT * FROM productos ORDER BY nombre ASC');
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREAR PRODUCTO
app.post('/api/productos', verificarToken, async (req, res) => {
    const { codigo_barras, nombre, precio_costo, precio_venta, stock, stock_minimo, categoria } = req.body;

    if (!nombre || precio_venta === undefined || stock === undefined) {
        return res.status(400).json({ mensaje: 'Nombre, precio de venta y stock son campos obligatorios.' });
    }

    try {
        const [resultado] = await pool.query(
            'INSERT INTO productos (codigo_barras, nombre, precio_costo, precio_venta, stock, stock_minimo, categoria) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [codigo_barras || null, nombre, precio_costo || 0, precio_venta, stock, stock_minimo || 0, categoria || 'General']
        );
        res.status(201).json({ id: resultado.insertId, mensaje: 'Producto registrado correctamente.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ mensaje: 'El código de barras ya está registrado en otro producto.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ACTUALIZAR PRODUCTO COMPLETAMENTE
app.put('/api/productos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { codigo_barras, nombre, precio_costo, precio_venta, stock, stock_minimo, categoria } = req.body;

    try {
        await pool.query(
            'UPDATE productos SET codigo_barras = ?, nombre = ?, precio_costo = ?, precio_venta = ?, stock = ?, stock_minimo = ?, categoria = ? WHERE id = ?',
            [codigo_barras || null, nombre, precio_costo || 0, precio_venta, stock, stock_minimo || 0, categoria || 'General', id]
        );
        res.json({ mensaje: 'Producto actualizado con éxito.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ELIMINAR PRODUCTO
app.delete('/api/productos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM productos WHERE id = ?', [id]);
        res.json({ mensaje: 'Producto eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// ENDPOINTS DE VENTAS (CAJA / FACTURACIÓN)
// ==========================================

// REGISTRAR NUEVA VENTA (CON TRANSACCIÓN AUTOMÁTICA)
app.post('/api/ventas', verificarToken, async (req, res) => {
    const { items, total, metodo_pago } = req.body;
    const usuario_id = req.usuario.id; 

    if (!items || items.length === 0 || !total) {
        return res.status(400).json({ mensaje: 'No hay productos en la orden de venta.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insertar la cabecera de la venta
        const [ventaResult] = await connection.query(
            'INSERT INTO ventas (total, metodo_pago, usuario_id) VALUES (?, ?, ?)',
            [total, metodo_pago || 'Efectivo', usuario_id]
        );
        const ventaId = ventaResult.insertId;

        // 2. Procesar cada artículo
        for (const item of items) {
            // Insertar detalle
            await connection.query(
                'INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                [ventaId, item.id, item.cantidad, item.precio_venta]
            );

            // Descontar el stock en la base de datos
            await connection.query(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                [item.cantidad, item.id]
            );
        }

        await connection.commit();
        res.status(201).json({ id: ventaId, mensaje: 'Venta registrada e inventario descontado con éxito.' });

    } catch (error) {
        await connection.rollback();
        console.error('Error procesando la venta:', error);
        res.status(500).json({ error: 'Error al procesar la venta en el servidor.' });
    } finally {
        connection.release();
    }
});

// HISTORIAL GENERAL DE VENTAS (PARA EL ADMINISTRADOR)
app.get('/api/ventas', verificarToken, async (req, res) => {
    try {
        const [ventas] = await pool.query(`
            SELECT v.*, u.nombre AS vendedor 
            FROM ventas v
            JOIN usuarios u ON v.usuario_id = u.id
            ORDER BY v.fecha DESC
        `);
        res.json(ventas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// ENDPOINTS DE USUARIOS (GESTIÓN DE EMPLEADOS)
// ==========================================

// LISTAR EMPLEADOS (SOLO ADMIN)
app.get('/api/usuarios', verificarToken, esAdmin, async (req, res) => {
    try {
        const [usuarios] = await pool.query('SELECT id, nombre, usuario, rol, fecha_creacion FROM usuarios ORDER BY nombre ASC');
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// REGISTRAR NUEVO EMPLEADO (SOLO ADMIN)
app.post('/api/usuarios', verificarToken, esAdmin, async (req, res) => {
    const { nombre, usuario, password, rol } = req.body;

    if (!nombre || !usuario || !password || !rol) {
        return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password.trim(), salt);

        const [resultado] = await pool.query(
            'INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)',
            [nombre.trim(), usuario.trim(), passwordHasheada, rol]
        );

        res.status(201).json({ id: resultado.insertId, mensaje: 'Usuario creado con éxito.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ mensaje: 'El nombre de usuario ya está en uso.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// CAMBIAR CONTRASEÑA DE UN EMPLEADO (SOLO ADMIN)
app.put('/api/usuarios/:id/password', verificarToken, esAdmin, async (req, res) => {
    const { id } = req.params;
    const { nuevaPassword } = req.body;

    if (!nuevaPassword || nuevaPassword.trim().length < 4) {
        return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 4 caracteres.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(nuevaPassword.trim(), salt);

        await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashedPass, id]);
        res.json({ mensaje: '¡Contraseña actualizada correctamente!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ELIMINAR EMPLEADO (SOLO ADMIN)
app.delete('/api/usuarios/:id', verificarToken, esAdmin, async (req, res) => {
    const idUsuarioLogueado = req.usuario?.id;
    const { id } = req.params;

    if (parseInt(id) === parseInt(idUsuarioLogueado)) {
        return res.status(400).json({ mensaje: 'No podés eliminar tu propia cuenta de administrador.' });
    }

    try {
        const [resultado] = await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
        
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        res.json({ mensaje: 'Usuario eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/emergencia/crear-admin', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs'); // Asegúrate de tenerlo importado
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('admin123', salt);
        await pool.query('INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)', 
                        ['Dueño DyM', 'admin', hash, 'admin']);
        res.send('Admin creado con éxito con hash: ' + hash);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// ENDPOINTS DE REPORTES (PARA EL DASHBOARD)
// ==========================================

// GANANCIAS TOTALES
app.get('/api/reportes/ganancias', verificarToken, esAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT SUM(total) as total_vendido FROM ventas');
        res.json({ total_vendido: rows[0].total_vendido || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CAJA DIARIA
app.get('/api/reportes/caja-diaria', verificarToken, esAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT SUM(total) as total FROM ventas WHERE DATE(fecha) = CURDATE()");
        res.json({ total: rows[0].total || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EVOLUCIÓN MENSUAL (Últimos 30 días)
app.get('/api/reportes/evolucion-mensual', verificarToken, esAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT DATE(fecha) as dia, SUM(total) as total 
            FROM ventas 
            WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(fecha) 
            ORDER BY dia ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CORRECCIÓN PRODUCCIÓN: Único app.listen al final absoluto utilizando la interfaz universal 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor unificado y corriendo con éxito en el puerto ${PORT}`);
});