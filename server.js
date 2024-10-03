const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // Para generar UUIDs únicos

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  }
});

// Almacenar las sesiones y sus gráficos en memoria (puede ser reemplazado por una base de datos)
let sessions = {};

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado: ' + socket.id);

  // Crear una nueva sesión y devolver el ID al cliente
  socket.on('create-session', (callback) => {
    const sessionId = uuidv4();  // Generar un ID único para la sesión
    sessions[sessionId] = { cells: [] };  // Inicializar la sesión con celdas vacías
    callback(sessionId);  // Devolver el ID de la sesión al cliente
  });

  // Unirse a una sesión existente
  socket.on('join-session', (sessionId) => {
    if (!sessions[sessionId]) {
      sessions[sessionId] = { cells: [] };  // Crear una nueva sesión si no existe
    }
    socket.join(sessionId);  // Unirse a la sala de la sesión

    // Enviar el estado actual de la sesión al cliente que se une
    socket.emit('initialize', { cells: sessions[sessionId].cells });
  });

  // Escuchar los cambios en el gráfico
  socket.on('updateGraph', (data) => {
    const { sessionId, cells } = data;

    // Verificar que la sesión existe
    if (!sessions[sessionId]) return;

    // Guardar los cambios en la sesión actual
    sessions[sessionId].cells = cells;

    // Propagar los cambios a los otros clientes conectados a la misma sesión
    socket.to(sessionId).emit('updateGraph', data);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado: ' + socket.id);
  });
});

server.listen(3000, () => {
  console.log('Servidor corriendo en puerto 3000');
});
