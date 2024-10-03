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
let lockedElements = {}; // Para manejar los elementos bloqueados por sesión

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado: ' + socket.id);

  // Crear una nueva sesión y devolver el ID al cliente
  socket.on('create-session', (callback) => {
    const sessionId = uuidv4();  // Generar un ID único para la sesión
    sessions[sessionId] = { cells: [] };  // Inicializar la sesión con celdas vacías
    lockedElements[sessionId] = {};  // Inicializar la lista de elementos bloqueados para esa sesión
    callback(sessionId);  // Devolver el ID de la sesión al cliente
  });

  // Unirse a una sesión existente
  socket.on('join-session', (sessionId) => {
    if (!sessions[sessionId]) {
      sessions[sessionId] = { cells: [] };  // Crear una nueva sesión si no existe
      lockedElements[sessionId] = {};  // Inicializar la lista de elementos bloqueados
    }
    socket.join(sessionId);  // Unirse a la sala de la sesión

    // Enviar el estado actual de la sesión al cliente que se une
    socket.emit('initialize', { cells: sessions[sessionId].cells });
  });

  // Bloquear un elemento cuando un usuario comienza a moverlo
  socket.on('lockElement', (data) => {
    const { sessionId, elementId } = data;
    if (!lockedElements[sessionId][elementId]) {
      lockedElements[sessionId][elementId] = socket.id;  // Bloquear el elemento para el cliente actual
    }
  });

  // Desbloquear un elemento cuando el usuario deja de moverlo
  socket.on('unlockElement', (data) => {
    const { sessionId, elementId } = data;
    if (lockedElements[sessionId][elementId] === socket.id) {
      delete lockedElements[sessionId][elementId];  // Desbloquear el elemento
    }
  });

  // Mover un elemento, si no está bloqueado por otro usuario
  socket.on('moveElement', (data) => {
    const { sessionId, elementId, position } = data;

    // Verificar si el elemento está bloqueado por el usuario actual
    if (lockedElements[sessionId][elementId] === socket.id) {
      // Actualizar la posición del elemento en la sesión
      const element = sessions[sessionId].cells.find(cell => cell.id === elementId);
      if (element) {
        element.position = position;
      }

      // Emitir el cambio de posición a los otros clientes en la sesión
      socket.to(sessionId).emit('updateElementPosition', { elementId, position });
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado: ' + socket.id);

    // Limpiar los elementos bloqueados por el cliente desconectado
    Object.keys(lockedElements).forEach(sessionId => {
      Object.keys(lockedElements[sessionId]).forEach(elementId => {
        if (lockedElements[sessionId][elementId] === socket.id) {
          delete lockedElements[sessionId][elementId];
        }
      });
    });
  });
});

// Escuchar en el puerto 3000
server.listen(3000, () => {
  console.log('Servidor corriendo en puerto 3000');
});
