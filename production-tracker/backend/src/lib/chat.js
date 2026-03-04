const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Get or create a direct message thread between two users
 */
const getOrCreateDMThread = async (userId1, userId2) => {
  // Ensure consistent order for DM lookup
  const [smaller, larger] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

  // Check if DM thread already exists by checking for a thread with both users
  let thread = await prisma.chatThread.findFirst({
    where: {
      type: 'DIRECT',
      participants: {
        some: { userId: smaller },
      },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
      messages: {
        include: {
          sender: { select: { id: true, username: true } },
          attachments: true,
          reads: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  // Verify the thread has both participants
  if (thread && !thread.participants.some(p => p.userId === larger)) {
    thread = null;
  }

  if (!thread) {
    // Create new DM thread
    thread = await prisma.chatThread.create({
      data: {
        type: 'DIRECT',
        createdById: userId1,
        participants: {
          create: [
            { userId: smaller },
            { userId: larger },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
        messages: {
          include: {
            sender: { select: { id: true, username: true } },
            attachments: true,
            reads: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  return thread;
};

/**
 * Create a work order thread
 */
const createWorkOrderThread = async (workOrderId, createdById, name = null) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      workOrderNumber: true,
      createdById: true,
      stages: {
        select: {
          assignedToId: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw new Error('Work order not found');
  }

  let thread = await prisma.chatThread.findFirst({
    where: {
      type: 'WORK_ORDER',
      workOrderId,
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
      messages: {
        include: {
          sender: { select: { id: true, username: true } },
          attachments: true,
          reads: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      workOrder: { select: { id: true, workOrderNumber: true, client: true } },
    },
  });

  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        type: 'WORK_ORDER',
        workOrderId,
        name: name || workOrder.workOrderNumber,
        createdById,
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true } },
          },
        },
        messages: {
          include: {
            sender: { select: { id: true, username: true } },
            attachments: true,
            reads: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        workOrder: { select: { id: true, workOrderNumber: true, client: true } },
      },
    });
  }

  const participantIds = new Set([
    createdById,
    workOrder.createdById,
    ...workOrder.stages.map((stage) => stage.assignedToId).filter(Boolean),
  ]);

  await Promise.all(
    Array.from(participantIds).map((participantUserId) =>
      addParticipant(thread.id, participantUserId)
    )
  );

  const refreshedThread = await prisma.chatThread.findUnique({
    where: { id: thread.id },
    include: {
      participants: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
      messages: {
        include: {
          sender: { select: { id: true, username: true } },
          attachments: true,
          reads: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      workOrder: { select: { id: true, workOrderNumber: true, client: true } },
    },
  });

  return refreshedThread;
};

/**
 * Add participant to thread
 */
const addParticipant = async (threadId, userId) => {
  try {
    const participant = await prisma.chatParticipant.create({
      data: {
        threadId,
        userId,
      },
    });
    return participant;
  } catch (error) {
    // Participant already exists
    if (error.code === 'P2002') {
      return await prisma.chatParticipant.findUnique({
        where: { threadId_userId: { threadId, userId } },
      });
    }
    throw error;
  }
};

/**
 * Save a message to thread
 */
const saveMessage = async (threadId, senderId, content, attachmentUrls = []) => {
  const message = await prisma.chatMessage.create({
    data: {
      threadId,
      senderId,
      content,
      attachments: {
        create: attachmentUrls.map((att) => ({
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          url: att.url,
        })),
      },
    },
    include: {
      sender: { select: { id: true, username: true } },
      attachments: true,
      reads: true,
    },
  });

  return message;
};

/**
 * Get thread messages with pagination
 */
const getThreadMessages = async (threadId, limit = 50, offset = 0) => {
  const messages = await prisma.chatMessage.findMany({
    where: {
      threadId,
      deletedAt: null,
    },
    include: {
      sender: { select: { id: true, username: true } },
      attachments: true,
      reads: {
        select: { userId: true, readAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return messages.reverse(); // Return in ascending order
};

/**
 * Mark message as read
 */
const markMessageAsRead = async (messageId, userId) => {
  try {
    const read = await prisma.messageRead.create({
      data: {
        messageId,
        userId,
      },
    });
    return read;
  } catch (error) {
    // Already marked as read
    if (error.code === 'P2002') {
      return await prisma.messageRead.findUnique({
        where: { messageId_userId: { messageId, userId } },
      });
    }
    throw error;
  }
};

/**
 * Get user's threads with metadata
 */
const getUserThreads = async (userId) => {
  const threads = await prisma.chatThread.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: { select: { userId: true, user: { select: { id: true, username: true } } } },
      messages: {
        select: { id: true, content: true, createdAt: true, sender: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      workOrder: { select: { id: true, workOrderNumber: true, client: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Calculate unread count per thread
  const threadsWithUnread = await Promise.all(
    threads.map(async (thread) => {
      const unreadCount = await prisma.chatMessage.count({
        where: {
          threadId: thread.id,
          deletedAt: null,
          senderId: {
            not: userId,
          },
          reads: {
            none: {
              userId,
            },
          },
        },
      });

      return {
        ...thread,
        unreadCount,
      };
    })
  );

  return threadsWithUnread;
};

/**
 * Check if user can access thread
 */
const canAccessThread = async (threadId, userId, userRole = null) => {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    include: {
      participants: { select: { userId: true } },
      workOrder: true,
    },
  });

  if (!thread) return false;

  // Check if user is a participant
  const isParticipant = thread.participants.some((p) => p.userId === userId);
  if (isParticipant) return true;

  // For work order threads, admins can always access
  if (thread.type === 'WORK_ORDER' && userRole === 'ADMIN') {
    return true;
  }

  return false;
};

module.exports = {
  getOrCreateDMThread,
  createWorkOrderThread,
  addParticipant,
  saveMessage,
  getThreadMessages,
  markMessageAsRead,
  getUserThreads,
  canAccessThread,
};
