require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const workOrderRoutes = require('./routes/workorders');
const stageRoutes = require('./routes/stages');
const stockRoutes = require('./routes/stock');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workorders', workOrderRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId = decoded.id;
    socket.role = decoded.role;
    socket.subRoles = decoded.subRoles || [];
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected (socket: ${socket.id})`);

  // User joins a chat thread
  socket.on('thread:join', (data) => {
    const { threadId } = data;
    const roomName = `thread:${threadId}`;
    socket.join(roomName);
    console.log(`User ${socket.userId} joined thread ${threadId} (room: ${roomName}, socket rooms: ${JSON.stringify(Array.from(socket.rooms))})`);
    socket.to(roomName).emit('user:joined', {
      userId: socket.userId,
      timestamp: new Date(),
    });
  });

  // User leaves a chat thread
  socket.on('thread:leave', (data) => {
    const { threadId } = data;
    const roomName = `thread:${threadId}`;
    console.log(`User ${socket.userId} left thread ${threadId}`);
    socket.to(roomName).emit('user:left', {
      userId: socket.userId,
      timestamp: new Date(),
    });
    socket.leave(roomName);
  });

  // Send message (handled by API, but socket broadcasts new message)
  socket.on('message:send', (data) => {
    const { threadId, content } = data;
    const roomName = `thread:${threadId}`;
    io.to(roomName).emit('message:new', {
      id: data.messageId,
      threadId,
      senderId: socket.userId,
      sender: data.sender,
      content,
      createdAt: new Date(),
      attachments: data.attachments || [],
      reads: [],
    });
  });

  // Mark message as read
  socket.on('message:read', (data) => {
    const { threadId, messageId } = data;
    const roomName = `thread:${threadId}`;
    io.to(roomName).emit('message:marked-read', {
      messageId,
      userId: socket.userId,
      readAt: new Date(),
    });
  });

  // Typing indicator
  socket.on('typing:start', (data) => {
    const { threadId } = data;
    const roomName = `thread:${threadId}`;
    socket.to(roomName).emit('typing:user-typing', {
      userId: socket.userId,
    });
  });

  socket.on('typing:stop', (data) => {
    const { threadId } = data;
    const roomName = `thread:${threadId}`;
    socket.to(roomName).emit('typing:user-stopped', {
      userId: socket.userId,
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
});

// Make io available to routes
app.set('io', io);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Production Tracker API is running',
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`💬 WebSocket ready for realtime chat`);
});
