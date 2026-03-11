const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const chatService = require('../lib/chat');
const { createNotificationsForUsers } = require('../lib/notifications');

const router = express.Router();
const prisma = new PrismaClient();

const buildPublicFileUrl = (req, filename) => {
  const configuredBaseUrl = process.env.PUBLIC_BASE_URL || process.env.BACKEND_URL;
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.get('host');

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, '')}/uploads/chat/${filename}`;
  }

  const protocol = forwardedProto || req.protocol;
  const normalizedProtocol =
    protocol === 'http' && host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
      ? 'https'
      : protocol;

  return `${normalizedProtocol}://${host}/uploads/chat/${filename}`;
};

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'chat');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || '');
      const baseName = path
        .basename(file.originalname || 'file', extension)
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60);
      cb(null, `${Date.now()}_${baseName}${extension}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/chat/dm
 * Get or create a direct message thread
 */
router.post('/dm', authenticateToken, async (req, res) => {
  try {
    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({ error: 'otherUserId is required' });
    }

    if (otherUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot chat with yourself' });
    }

    const thread = await chatService.getOrCreateDMThread(req.user.id, otherUserId);

    res.json({ thread });
  } catch (error) {
    console.error('Get or create DM thread error:', error);
    res.status(500).json({ error: 'Failed to get or create thread' });
  }
});

/**
 * POST /api/chat/workorder/:workOrderId
 * Create a work order chat thread
 */
router.post('/workorder/:workOrderId', authenticateToken, async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { name } = req.body;

    const workOrderIdNum = parseInt(workOrderId);
    if (isNaN(workOrderIdNum)) {
      return res.status(400).json({ error: 'Invalid work order ID' });
    }

    const thread = await chatService.createWorkOrderThread(
      workOrderIdNum,
      req.user.id,
      name
    );

    res.json({ thread });
  } catch (error) {
    console.error('Create work order thread error:', error);
    if (error.message === 'Work order not found') {
      return res.status(404).json({ error: 'Work order not found' });
    }
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

/**
 * POST /api/chat/:threadId/participants
 * Add participant to thread
 */
router.post('/:threadId/participants', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { userId } = req.body;

    const threadIdNum = parseInt(threadId);
    const userIdNum = parseInt(userId);

    if (isNaN(threadIdNum) || isNaN(userIdNum)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Check authorization - only admins or thread creator can add participants
    const canAccess = await chatService.canAccessThread(threadIdNum, req.user.id, req.user.role);
    if (!canAccess && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const participant = await chatService.addParticipant(threadIdNum, userIdNum);

    res.status(201).json({ participant });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

/**
 * GET /api/chat/threads
 * Get user's chat threads
 */
router.get('/threads', authenticateToken, async (req, res) => {
  try {
    const threads = await chatService.getUserThreads(req.user.id);
    res.json({ threads });
  } catch (error) {
    console.error('Get user threads error:', error);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

/**
 * GET /api/chat/:threadId
 * Get thread details
 */
router.get('/:threadId', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const threadIdNum = parseInt(threadId);

    if (isNaN(threadIdNum)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    // Check authorization
    const canAccess = await chatService.canAccessThread(threadIdNum, req.user.id, req.user.role);
    if (!canAccess) {
      return res.status(403).json({ error: 'Not authorized to access this thread' });
    }

    // Fetch thread (implicitly exists if we get here)
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadIdNum },
      include: {
        participants: {
          select: { userId: true, user: { select: { id: true, username: true } }, lastReadAt: true },
        },
        workOrder: { select: { id: true, workOrderNumber: true, client: true } },
      },
    });

    res.json({ thread });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

/**
 * GET /api/chat/:threadId/messages
 * Get thread messages with pagination
 */
router.get('/:threadId/messages', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const threadIdNum = parseInt(threadId);
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;

    if (isNaN(threadIdNum)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    // Check authorization
    const canAccess = await chatService.canAccessThread(threadIdNum, req.user.id, req.user.role);
    if (!canAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const messages = await chatService.getThreadMessages(threadIdNum, limitNum, offsetNum);

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

/**
 * DELETE /api/chat/:threadId
 * Delete a chat thread (admin only)
 */
router.delete('/:threadId', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const threadIdNum = parseInt(threadId);

    if (isNaN(threadIdNum)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete chat threads' });
    }

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadIdNum },
      include: {
        participants: {
          select: {
            userId: true,
            user: { select: { role: true } },
          },
        },
      },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const isWorkOrderThread = thread.type === 'WORK_ORDER';
    const isAdminParticipant = thread.participants.some((participant) => participant.userId === req.user.id);
    const hasWorkerParticipant = thread.participants.some(
      (participant) => participant.userId !== req.user.id && participant.user?.role === 'WORKER'
    );

    const canDeleteDirectThread = thread.type === 'DIRECT' && isAdminParticipant && hasWorkerParticipant;

    if (!isWorkOrderThread && !canDeleteDirectThread) {
      return res.status(403).json({
        error: 'Admin can only delete work order chats or their direct chats with workers',
      });
    }

    await prisma.chatThread.delete({
      where: { id: threadIdNum },
    });

    return res.json({ message: 'Thread deleted successfully' });
  } catch (error) {
    console.error('Delete thread error:', error);
    return res.status(500).json({ error: 'Failed to delete thread' });
  }
});

/**
 * POST /api/chat/upload
 * Upload one attachment and return metadata for message payload
 */
router.post('/upload', authenticateToken, (req, res) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      const message = error.message || 'Upload failed';
      const statusCode = message === 'Unsupported file type' ? 400 : 413;
      return res.status(statusCode).json({ error: message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = buildPublicFileUrl(req, req.file.filename);
    return res.status(201).json({
      attachment: {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
      },
    });
  });
});

/**
 * POST /api/chat/:threadId/messages
 * Send a message
 */
router.post('/:threadId/messages', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content, attachments = [] } = req.body;

    const threadIdNum = parseInt(threadId);

    if (isNaN(threadIdNum)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    const normalizedContent = (content || '').trim();
    if (!normalizedContent && (!Array.isArray(attachments) || attachments.length === 0)) {
      return res.status(400).json({ error: 'Message content or attachment is required' });
    }

    // Check authorization
    const canAccess = await chatService.canAccessThread(threadIdNum, req.user.id, req.user.role);
    if (!canAccess) {
      return res.status(403).json({ error: 'Not authorized to post in this thread' });
    }

    // Ensure user is a participant
    await chatService.addParticipant(threadIdNum, req.user.id);

    // Save message
    const message = await chatService.saveMessage(
      threadIdNum,
      req.user.id,
      normalizedContent,
      attachments
    );

    const participants = await prisma.chatParticipant.findMany({
      where: {
        threadId: threadIdNum,
        userId: { not: req.user.id },
      },
      select: { userId: true },
    });

    const recipientUserIds = participants.map((participant) => participant.userId);

    if (recipientUserIds.length > 0) {
      const thread = await prisma.chatThread.findUnique({
        where: { id: threadIdNum },
        select: {
          type: true,
          name: true,
          workOrder: {
            select: { id: true, workOrderNumber: true },
          },
        },
      });

      const threadLabel = thread?.workOrder?.workOrderNumber || thread?.name || `Thread #${threadIdNum}`;
      const messagePreview = (normalizedContent || '').slice(0, 120);

      try {
        await createNotificationsForUsers(prisma, recipientUserIds, {
          actorUserId: req.user.id,
          type: 'CHAT_MESSAGE',
          severity: 'INFO',
          title: `New message from ${req.user.username}`,
          message: messagePreview
            ? `${req.user.username}: ${messagePreview}`
            : `${req.user.username} sent an attachment in ${threadLabel}.`,
          workOrderId: thread?.workOrder?.id || null,
          metadata: {
            threadId: threadIdNum,
            threadType: thread?.type || null,
            hasAttachments: Array.isArray(attachments) && attachments.length > 0,
            messageId: message.id,
          },
        });
      } catch (notificationError) {
        console.error('Chat notification creation error:', notificationError);
      }
    }

    // Emit to connected clients via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const roomName = `thread:${threadIdNum}`;
      console.log(`📨 Emitting message:new to room ${roomName}`, {
        messageId: message.id,
        senderId: req.user.id,
        threadId: threadIdNum,
      });
      io.to(roomName).emit('message:new', {
        id: message.id,
        threadId: threadIdNum,
        senderId: req.user.id,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt,
        attachments: message.attachments,
        reads: message.reads,
      });
    } else {
      console.warn('⚠️ Socket.IO instance not available');
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * POST /api/chat/:threadId/messages/:messageId/read
 * Mark message as read
 */
router.post('/:threadId/messages/:messageId/read', authenticateToken, async (req, res) => {
  try {
    const { threadId, messageId } = req.params;

    const threadIdNum = parseInt(threadId);
    const messageIdNum = parseInt(messageId);

    if (isNaN(threadIdNum) || isNaN(messageIdNum)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Check authorization
    const canAccess = await chatService.canAccessThread(threadIdNum, req.user.id, req.user.role);
    if (!canAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const read = await chatService.markMessageAsRead(messageIdNum, req.user.id);

    // Emit read receipt via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`thread:${threadIdNum}`).emit('message:marked-read', {
        messageId: messageIdNum,
        userId: req.user.id,
        readAt: read.readAt,
      });
    }

    res.json({ read });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

module.exports = router;
