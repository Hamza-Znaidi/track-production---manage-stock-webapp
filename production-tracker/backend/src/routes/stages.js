const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const {
  createNotification,
  createNotificationsForUsers,
  getAdminUserIds,
} = require('../lib/notifications');

const router = express.Router();
const prisma = new PrismaClient();

const STAGE_ORDER = [
  'SALES',
  'CAD',
  'CAM',
  'STORE',
  'CNC',
  'ASSEMBLY',
  'QUALITY',
  'DELIVERY',
];

const FINAL_STAGE_STATUSES = ['COMPLETED', 'SKIPPED'];

function getPreviousSubRoles(subRole) {
  const currentIndex = STAGE_ORDER.indexOf(subRole);
  if (currentIndex <= 0) return [];
  return STAGE_ORDER.slice(0, currentIndex);
}

function getBlockingStageFor(subRole, stagesBySubRole) {
  const previousSubRoles = getPreviousSubRoles(subRole);

  for (const previousSubRole of previousSubRoles) {
    const previousStage = stagesBySubRole.get(previousSubRole);
    if (!previousStage) continue;

    // Unassigned stages are treated as skipped for dependency blocking
    if (!previousStage.assignedToId) {
      continue;
    }

    if (!FINAL_STAGE_STATUSES.includes(previousStage.status)) {
      return previousStage;
    }
  }

  return null;
}

/**
 * GET /api/stages/my-tasks
 * Worker gets ONLY stages that are explicitly assigned to them
 */
router.get('/my-tasks', authenticateToken, async (req, res) => {
  try {
    const stages = await prisma.workOrderStage.findMany({
      where: {
        assignedToId: req.user.id,              // ONLY assigned to me
        status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
      },
      include: {
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            client: true,
            project: true,
            item: true,
            quantity: true,
            deliveryWeek: true,
            status: true,
          },
        },
        assignedTo: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workOrderIds = [...new Set(stages.map((stage) => stage.workOrderId))];

    let stagesByWorkOrder = new Map();
    if (workOrderIds.length > 0) {
      const allStages = await prisma.workOrderStage.findMany({
        where: {
          workOrderId: { in: workOrderIds },
        },
        select: {
          workOrderId: true,
          subRole: true,
          status: true,
          assignedToId: true,
        },
      });

      stagesByWorkOrder = allStages.reduce((acc, stage) => {
        if (!acc.has(stage.workOrderId)) {
          acc.set(stage.workOrderId, new Map());
        }
        acc.get(stage.workOrderId).set(stage.subRole, stage);
        return acc;
      }, new Map());
    }

    const enrichedStages = stages.map((stage) => {
      const stagesBySubRole = stagesByWorkOrder.get(stage.workOrderId) || new Map();
      const blockingStage = getBlockingStageFor(stage.subRole, stagesBySubRole);

      return {
        ...stage,
        isBlocked: Boolean(blockingStage),
        blockedBySubRole: blockingStage?.subRole || null,
        blockedByStatus: blockingStage?.status || null,
      };
    });

    res.json({ stages: enrichedStages });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stages/my-completed
 * Worker gets stages explicitly assigned to them that are completed/skipped
 */
router.get('/my-completed', authenticateToken, async (req, res) => {
  try {
    const stages = await prisma.workOrderStage.findMany({
      where: {
        assignedToId: req.user.id,
        status: { in: ['COMPLETED', 'SKIPPED'] },
      },
      include: {
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            client: true,
            project: true,
            item: true,
            quantity: true,
            deliveryWeek: true,
            status: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    res.json({ stages });
  } catch (error) {
    console.error('Get my completed stages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * PUT /api/stages/:id
 * Worker updates their stage status
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const stageId = parseInt(req.params.id);
    if (isNaN(stageId)) {
      return res.status(400).json({ error: 'Invalid stage ID' });
    }

    const { status, notes, assignedToId } = req.body;

    // Validate status
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the stage FIRST (before validation)
    const stage = await prisma.workOrderStage.findUnique({
      where: { id: stageId },
      include: { workOrder: true },
    });

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Workers can only update stages explicitly assigned to them (unless admin)
    if (req.user.role !== 'ADMIN') {
      if (stage.assignedToId !== req.user.id) {
        return res.status(403).json({
          error: 'You are not authorized to update this stage',
        });
      }
    }

    // Validate assignedToId if provided
    if (assignedToId !== undefined && assignedToId !== null) {
      const worker = await prisma.user.findUnique({
        where: { id: assignedToId },
        include: { subRoles: true },
      });

      if (!worker) {
        return res.status(400).json({ error: 'Worker not found' });
      }

      if (worker.role !== 'WORKER') {
        return res.status(400).json({ error: 'User is not a worker' });
      }

      const hasSubRole = worker.subRoles.some(sr => sr.subRole === stage.subRole);
      if (!hasSubRole) {
        return res.status(400).json({
          error: `Worker does not have ${stage.subRole} sub-role`,
        });
      }
    }

    // Enforce sequence: previous stages must be completed/skipped before execution
    if (status && ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'].includes(status)) {
      const workOrderStages = await prisma.workOrderStage.findMany({
        where: { workOrderId: stage.workOrderId },
        select: {
          subRole: true,
          status: true,
          assignedToId: true,
        },
      });

      const stagesBySubRole = new Map();
      workOrderStages.forEach((workOrderStage) => {
        stagesBySubRole.set(workOrderStage.subRole, workOrderStage);
      });

      const blockingStage = getBlockingStageFor(stage.subRole, stagesBySubRole);
      if (blockingStage) {
        return res.status(400).json({
          error: `Cannot set ${stage.subRole} to ${status}. Previous stage ${blockingStage.subRole} must be COMPLETED or SKIPPED first.`,
          blockedBySubRole: blockingStage.subRole,
          blockedByStatus: blockingStage.status,
        });
      }
    }

    const previousStatus = stage.status;
    const previousAssignedToId = stage.assignedToId;

    // Build update data
    const updateData = {
      notes: notes !== undefined ? notes : stage.notes,
    };

    // Update status if provided
    if (status) {
      updateData.status = status;
    }

    // Admin can manually reassign workers
    if (req.user.role === 'ADMIN' && assignedToId !== undefined) {
      updateData.assignedToId = assignedToId;
    }

    // Set timestamps based on status
    if (status === 'IN_PROGRESS' && !stage.startedAt) {
      updateData.startedAt = new Date();
      // Auto-assign to current user if not already assigned
      if (!stage.assignedToId && !updateData.assignedToId) {
        updateData.assignedToId = req.user.id;
      }
    }

    if ((status === 'COMPLETED' || status === 'SKIPPED') && !stage.completedAt) {
      updateData.completedAt = new Date();
      // Auto-assign to current user if not already assigned
      if (!stage.assignedToId && !updateData.assignedToId) {
        updateData.assignedToId = req.user.id;
      }
    }

    // Clear timestamps when resetting to PENDING
    if (status === 'PENDING') {
      updateData.startedAt = null;
      updateData.completedAt = null;
      // Optionally unassign the worker (uncomment if you want this behavior)
      // updateData.assignedToId = null;
    }
    // Update the stage
    const updatedStage = await prisma.workOrderStage.update({
      where: { id: stageId },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, username: true } },
        workOrder: { select: { id: true, workOrderNumber: true } },
      },
    });

    // Update work order status based on all stages
    await updateWorkOrderStatus(stage.workOrderId);

    if (
      req.user.role === 'ADMIN'
      && assignedToId !== undefined
      && updatedStage.assignedToId
      && updatedStage.assignedToId !== previousAssignedToId
    ) {
      await createNotification(prisma, {
        recipientUserId: updatedStage.assignedToId,
        actorUserId: req.user.id,
        type: 'STAGE_ASSIGNED',
        severity: 'INFO',
        title: `New stage assigned: ${stage.subRole}`,
        message: `You were assigned to ${stage.subRole} for work order ${updatedStage.workOrder.workOrderNumber}.`,
        workOrderId: stage.workOrderId,
        stageId: stage.id,
      });
    }

    if (status && status !== previousStatus) {
      const recipientUserIds = new Set();

      if (updatedStage.assignedTo?.id && updatedStage.assignedTo.id !== req.user.id) {
        recipientUserIds.add(updatedStage.assignedTo.id);
      }

      const adminUserIds = await getAdminUserIds(prisma, { excludeUserId: req.user.id });
      adminUserIds.forEach((adminId) => recipientUserIds.add(adminId));

      await createNotificationsForUsers(prisma, [...recipientUserIds], {
        actorUserId: req.user.id,
        type: 'STAGE_STATUS_CHANGED',
        severity: status === 'COMPLETED' ? 'INFO' : 'INFO',
        title: `Stage status updated: ${stage.subRole}`,
        message: `${stage.subRole} for work order ${updatedStage.workOrder.workOrderNumber} is now ${status.replace('_', ' ')}.`,
        workOrderId: stage.workOrderId,
        stageId: stage.id,
        metadata: {
          previousStatus,
          newStatus: status,
        },
      });
    }

    res.json({
      message: 'Stage updated successfully',
      stage: updatedStage,
    });
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/stages/:id
 * Worker removes their own completed task from their list
 */
/**
 * Helper: Auto-update work order status based on stages
 */
async function updateWorkOrderStatus(workOrderId) {
  const stages = await prisma.workOrderStage.findMany({
    where: { workOrderId },
  });

  const allCompleted = stages.every(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'
  );
  const anyInProgress = stages.some((s) => s.status === 'IN_PROGRESS');
  const anyCompleted = stages.some(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'
  );

  let newStatus = 'PENDING';
  if (allCompleted) newStatus = 'COMPLETED';
  else if (anyInProgress || anyCompleted) newStatus = 'IN_PROGRESS';

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: newStatus },
  });
}

module.exports = router;