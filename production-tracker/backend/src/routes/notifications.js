const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const notifications = await prisma.notification.findMany({
      where: { recipientUserId: req.user.id },
      include: {
        actorUser: {
          select: { id: true, username: true },
        },
        workOrder: {
          select: { id: true, workOrderNumber: true },
        },
        stage: {
          select: { id: true, subRole: true, status: true },
        },
        stockItem: {
          select: { id: true, name: true, quantity: true, minQuantity: true, unit: true },
        },
        reads: {
          where: { userId: req.user.id },
          select: { id: true, readAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.notification.count({
      where: { recipientUserId: req.user.id },
    });

    const formatted = notifications.map((notification) => ({
      ...notification,
      isRead: notification.reads.length > 0,
      readAt: notification.reads[0]?.readAt || null,
      reads: undefined,
    }));

    res.json({
      notifications: formatted,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: {
        recipientUserId: req.user.id,
        reads: {
          none: {
            userId: req.user.id,
          },
        },
      },
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, recipientUserId: true },
    });

    if (!notification || notification.recipientUserId !== req.user.id) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId,
          userId: req.user.id,
        },
      },
      update: { readAt: new Date() },
      create: {
        notificationId,
        userId: req.user.id,
      },
    });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const unreadNotifications = await prisma.notification.findMany({
      where: {
        recipientUserId: req.user.id,
        reads: {
          none: {
            userId: req.user.id,
          },
        },
      },
      select: { id: true },
    });

    if (unreadNotifications.length === 0) {
      return res.json({ message: 'No unread notifications', markedCount: 0 });
    }

    await prisma.notificationRead.createMany({
      data: unreadNotifications.map((notification) => ({
        notificationId: notification.id,
        userId: req.user.id,
      })),
      skipDuplicates: true,
    });

    res.json({
      message: 'All notifications marked as read',
      markedCount: unreadNotifications.length,
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, recipientUserId: true },
    });

    if (!notification || notification.recipientUserId !== req.user.id) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', authenticateToken, async (req, res) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: { recipientUserId: req.user.id },
    });

    res.json({
      message: 'All notifications deleted successfully',
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
