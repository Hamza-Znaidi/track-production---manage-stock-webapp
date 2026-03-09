'use client';

import { io } from 'socket.io-client';
import authService from './auth';

let socket = null;

/**
 * Initialize Socket.IO connection
 */
const initSocket = () => {
  if (socket?.connected) {
    return socket;
  }

  const token = authService.getToken();
  // Prefer explicit socket origin; fallback strips /api from API URL for compatibility.
  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
    'http://localhost:5000';

  socket = io(socketUrl, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('📡 Connected to chat server');
  });

  socket.on('disconnect', () => {
    console.log('📡 Disconnected from chat server');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

/**
 * Get Socket.IO instance
 */
const getSocket = () => {
  if (!socket || !socket.connected) {
    return initSocket();
  }
  return socket;
};

/**
 * Disconnect socket
 */
const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a thread room
 */
const joinThread = (threadId) => {
  const sock = getSocket();
  sock.emit('thread:join', { threadId });
};

/**
 * Leave a thread room
 */
const leaveThread = (threadId) => {
  const sock = getSocket();
  sock.emit('thread:leave', { threadId });
};

/**
 * Send a message
 */
const sendMessage = (threadId, content, attachments = []) => {
  const sock = getSocket();
  sock.emit('message:send', {
    threadId,
    content,
    attachments,
  });
};

/**
 * Mark message as read
 */
const markMessageRead = (threadId, messageId) => {
  const sock = getSocket();
  sock.emit('message:read', {
    threadId,
    messageId,
  });
};

/**
 * Start typing indicator
 */
const startTyping = (threadId) => {
  const sock = getSocket();
  sock.emit('typing:start', { threadId });
};

/**
 * Stop typing indicator
 */
const stopTyping = (threadId) => {
  const sock = getSocket();
  sock.emit('typing:stop', { threadId });
};

/**
 * Listen for new messages
 */
const onMessageNew = (callback) => {
  const sock = getSocket();
  sock.on('message:new', callback);
};

/**
 * Listen for message read receipts
 */
const onMessageRead = (callback) => {
  const sock = getSocket();
  sock.on('message:marked-read', callback);
};

/**
 * Listen for typing indicators
 */
const onUserTyping = (callback) => {
  const sock = getSocket();
  sock.on('typing:user-typing', callback);
};

const onUserStoppedTyping = (callback) => {
  const sock = getSocket();
  sock.on('typing:user-stopped', callback);
};

/**
 * Listen for user join/leave
 */
const onUserJoined = (callback) => {
  const sock = getSocket();
  sock.on('user:joined', callback);
};

const onUserLeft = (callback) => {
  const sock = getSocket();
  sock.on('user:left', callback);
};

/**
 * Remove event listener
 */
const removeListener = (event, callback) => {
  const sock = getSocket();
  sock.off(event, callback);
};

export {
  initSocket,
  getSocket,
  disconnectSocket,
  joinThread,
  leaveThread,
  sendMessage,
  markMessageRead,
  startTyping,
  stopTyping,
  onMessageNew,
  onMessageRead,
  onUserTyping,
  onUserStoppedTyping,
  onUserJoined,
  onUserLeft,
  removeListener,
};
