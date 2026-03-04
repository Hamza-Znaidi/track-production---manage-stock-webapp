const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All stages in production order
const PRODUCTION_STAGES = [
  'SALES',
  'CAD',
  'CAM',
  'STORE',
  'CNC',
  'ASSEMBLY',
  'QUALITY',
  'DELIVERY',
];

const normalizeDeliveryWeek = (deliveryInput) => {
  if (deliveryInput === undefined || deliveryInput === null) {
    return null;
  }

  const normalizedInput = String(deliveryInput).trim().toUpperCase();
  const match = normalizedInput.match(/^(?:WK)?\s*(\d+)$/);

  if (!match) {
    return null;
  }

  return `WK${parseInt(match[1], 10)}`;
};

/**
 * GET /api/workorders
 * Get all work orders (Admin) or assigned work orders (Worker)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    let workOrders;

    if (req.user.role === 'ADMIN') {
      // Admin sees all work orders
      workOrders = await prisma.workOrder.findMany({
        include: {
          createdBy: {
            select: { id: true, username: true },
          },
          stages: {
            include: {
              assignedTo: {
                select: { id: true, username: true },
              },
            },
            orderBy: { subRole: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Worker sees only work orders that have stages assigned to them
      const userSubRoles = req.user.subRoles || [];

      workOrders = await prisma.workOrder.findMany({
        where: {
          stages: {
            some: {
              subRole: { in: userSubRoles },
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
          },
        },
        include: {
          createdBy: {
            select: { id: true, username: true },
          },
          stages: {
            where: {
              subRole: { in: userSubRoles },
            },
            include: {
              assignedTo: {
                select: { id: true, username: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Calculate progress for each work order
    const workOrdersWithProgress = workOrders.map((wo) => {
      const totalStages = wo.stages.length;
      const completedStages = wo.stages.filter(
        (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'
      ).length;
      const progress =
        totalStages > 0
          ? Math.round((completedStages / totalStages) * 100)
          : 0;

      return { ...wo, progress };
    });

    res.json({ workOrders: workOrdersWithProgress });
  } catch (error) {
    console.error('Get work orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/workorders/:id
 * Get single work order with all stages
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const workOrderId = parseInt(req.params.id);
    if (isNaN(workOrderId)) {
      return res.status(400).json({ error: 'Invalid work order ID' });
    }

    if (req.user.role !== 'ADMIN') {
      const assignmentCount = await prisma.workOrderStage.count({
        where: {
          workOrderId,
          assignedToId: req.user.id,
        },
      });

      if (assignmentCount === 0) {
        return res.status(403).json({
          error: 'You are not authorized to view this work order',
        });
      }
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
        stages: {
          include: {
            assignedTo: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    // Calculate progress
    const totalStages = workOrder.stages.length;
    const completedStages = workOrder.stages.filter(
      (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'
    ).length;
    const progress =
      totalStages > 0
        ? Math.round((completedStages / totalStages) * 100)
        : 0;

    res.json({ workOrder: { ...workOrder, progress } });
  } catch (error) {
    console.error('Get work order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workorders
 * Create new work order (Admin only)
 * Creates stages for all departments with optional worker assignments
 */
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const {
      workOrderNumber,
      date,
      client,
      project,
      item,
      reference,
      colorAndWay,
      type,
      quantity,
      designNumber,
      deliveryWeek,
      notes,
      stageAssignments, // NEW: { SALES: userId, CAD: userId, ... }
    } = req.body;

    // Validate required fields
    const requiredFields = {
      workOrderNumber,
      date, client, project, item,
      reference, colorAndWay, type,
      quantity, designNumber, deliveryWeek,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    const normalizedDeliveryWeek = normalizeDeliveryWeek(deliveryWeek);
    if (!normalizedDeliveryWeek) {
      return res.status(400).json({ error: 'Delivery must be a valid week number' });
    }

    // Validate stage assignments if provided
    if (stageAssignments) {
      const assignedUserIds = Object.values(stageAssignments).filter(Boolean);
      
      if (assignedUserIds.length > 0) {
        // Check that all assigned users exist and are workers
        const users = await prisma.user.findMany({
          where: { id: { in: assignedUserIds } },
          include: { subRoles: true },
        });

        // Validate each assignment
        for (const [subRole, userId] of Object.entries(stageAssignments)) {
          if (!userId) continue; // Skip unassigned stages

          const user = users.find(u => u.id === userId);
          
          if (!user) {
            return res.status(400).json({
              error: `User with ID ${userId} not found for stage ${subRole}`,
            });
          }

          if (user.role !== 'WORKER') {
            return res.status(400).json({
              error: `${user.username} is not a worker and cannot be assigned to ${subRole} stage`,
            });
          }

          // Check if user has the required sub-role
          const hasSubRole = user.subRoles.some(sr => sr.subRole === subRole);
          if (!hasSubRole) {
            return res.status(400).json({
              error: `${user.username} does not have ${subRole} sub-role and cannot be assigned to this stage`,
            });
          }
        }
      }
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        workOrderNumber: workOrderNumber.trim(),
        date: new Date(date),
        client,
        project,
        item,
        reference,
        colorAndWay,
        type,
        quantity: parseInt(quantity),
        designNumber,
        deliveryWeek: normalizedDeliveryWeek,
        notes: notes || null,
        status: 'PENDING',
        createdById: req.user.id,
        stages: {
          create: PRODUCTION_STAGES.map((subRole) => ({
            subRole,
            status: 'PENDING',
            assignedToId: stageAssignments?.[subRole] || null,
          })),
        },
      },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
        stages: {
          include: {
            assignedTo: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Work order created successfully',
      workOrder,
    });
  } catch (error) {
    console.error('Create work order error:', error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Work order number already exists. Please use a unique WORK ORDER value.' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * PUT /api/workorders/:id
 * Update work order (Admin only)
 */
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const workOrderId = parseInt(req.params.id);
    if (isNaN(workOrderId)) {
  return res.status(400).json({ error: 'Invalid work order ID' });
}
    const {
      date, client, project, item,
      reference, colorAndWay, type,
      quantity, designNumber, deliveryWeek,
      status, notes,
    } = req.body;

    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (client) updateData.client = client;
    if (project) updateData.project = project;
    if (item) updateData.item = item;
    if (reference) updateData.reference = reference;
    if (colorAndWay) updateData.colorAndWay = colorAndWay;
    if (type) updateData.type = type;
    if (quantity) updateData.quantity = parseInt(quantity);
    if (designNumber) updateData.designNumber = designNumber;
    if (deliveryWeek) {
      const normalizedDeliveryWeek = normalizeDeliveryWeek(deliveryWeek);
      if (!normalizedDeliveryWeek) {
        return res.status(400).json({ error: 'Delivery must be a valid week number' });
      }
      updateData.deliveryWeek = normalizedDeliveryWeek;
    }
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const workOrder = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: updateData,
      include: {
        createdBy: { select: { id: true, username: true } },
        stages: {
          include: {
            assignedTo: { select: { id: true, username: true } },
          },
        },
      },
    });

    res.json({
      message: 'Work order updated successfully',
      workOrder,
    });
  } catch (error) {
    console.error('Update work order error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Work order not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/workorders/:id
 * Delete work order (Admin only)
 */
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const workOrderId = parseInt(req.params.id);
    if (isNaN(workOrderId)) {
  return res.status(400).json({ error: 'Invalid work order ID' });
}
    await prisma.workOrder.delete({
      where: { id: workOrderId },
    });

    res.json({ message: 'Work order deleted successfully' });
  } catch (error) {
    console.error('Delete work order error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Work order not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;