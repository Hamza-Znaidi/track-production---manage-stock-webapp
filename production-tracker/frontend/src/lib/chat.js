import api from './axios';

/**
 * Get or create a direct message thread
 */
const getOrCreateDMThread = async (otherUserId) => {
  const response = await api.post('/chat/dm', { otherUserId });
  return response.data.thread;
};

/**
 * Create a work order chat thread
 */
const createWorkOrderThread = async (workOrderId, name = null) => {
  const response = await api.post(`/chat/workorder/${workOrderId}`, { name });
  return response.data.thread;
};

/**
 * Get user's threads
 */
const getThreads = async () => {
  const response = await api.get('/chat/threads');
  return response.data.threads;
};

/**
 * Get thread details
 */
const getThread = async (threadId) => {
  const response = await api.get(`/chat/${threadId}`);
  return response.data.thread;
};

/**
 * Get thread messages
 */
const getMessages = async (threadId, limit = 50, offset = 0) => {
  const response = await api.get(`/chat/${threadId}/messages`, {
    params: { limit, offset },
  });
  return response.data.messages;
};

/**
 * Send a message
 */
const sendMessage = async (threadId, content, attachments = []) => {
  const response = await api.post(`/chat/${threadId}/messages`, {
    content,
    attachments,
  });
  return response.data.message;
};

/**
 * Upload one chat attachment
 */
const uploadAttachment = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/chat/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.attachment;
};

/**
 * Mark message as read
 */
const markMessageAsRead = async (threadId, messageId) => {
  const response = await api.post(`/chat/${threadId}/messages/${messageId}/read`);
  return response.data.read;
};

/**
 * Add participant to thread
 */
const addParticipant = async (threadId, userId) => {
  const response = await api.post(`/chat/${threadId}/participants`, { userId });
  return response.data.participant;
};

/**
 * Delete a chat thread
 */
const deleteThread = async (threadId) => {
  const response = await api.delete(`/chat/${threadId}`);
  return response.data;
};

export default {
  getOrCreateDMThread,
  createWorkOrderThread,
  getThreads,
  getThread,
  getMessages,
  sendMessage,
  uploadAttachment,
  markMessageAsRead,
  addParticipant,
  deleteThread,
};
