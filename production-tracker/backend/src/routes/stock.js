const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { notifyLowStockCrossing } = require('../lib/notifications');

const router = express.Router();
const prisma = new PrismaClient();

const VALID_CATEGORIES = [
  'RAW_MATERIAL',
  'COMPONENT',
  'FINISHED_PRODUCT',
  'TOOL',
  'CONSUMABLE',
];

/**
 * GET /api/stock
 * Get all stock items (All users can view)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, lowStock, search } = req.query;

    const where = {};

    // Filter by category
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    // Search by name
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const stockItems = await prisma.stockItem.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Add isLowStock flag to each item
    let itemsWithFlags = stockItems.map(item => ({
      ...item,
      isLowStock: item.quantity <= item.minQuantity,
    }));

    // Filter by low stock (safe comparison in application layer)
    if (lowStock === 'true') {
      itemsWithFlags = itemsWithFlags.filter(item => item.isLowStock);
    }

    res.json({ stockItems: itemsWithFlags });
  } catch (error) {
    console.error('Get stock items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/stock
 * Create new stock item (Admin only)
 */
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      quantity,
      unit,
      minQuantity,
      location,
      supplier,
      price,
      notes,
    } = req.body;

    // Validate required fields
    if (!name || !category || !unit) {
      return res.status(400).json({
        error: 'Name, category, and unit are required',
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    const stockItem = await prisma.stockItem.create({
      data: {
        name,
        description: description || null,
        category,
        quantity: parseInt(quantity) || 0,
        unit,
        minQuantity: parseInt(minQuantity) || 10,
        location: location || null,
        supplier: supplier || null,
        price: price ? parseFloat(price) : null,
        notes: notes || null,
        createdById: req.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
    });

    res.status(201).json({
      message: 'Stock item created successfully',
      stockItem,
    });
  } catch (error) {
    console.error('Create stock item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/stock/:id
 * Update stock item (Admin only)
 */
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);
    if (isNaN(stockId)) {
      return res.status(400).json({ error: 'Invalid stock ID' });
    }

    const {
      name,
      description,
      category,
      quantity,
      unit,
      minQuantity,
      location,
      supplier,
      price,
      notes,
    } = req.body;

    const existingStockItem = await prisma.stockItem.findUnique({
      where: { id: stockId },
    });

    if (!existingStockItem) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category && VALID_CATEGORIES.includes(category)) {
      updateData.category = category;
    }
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (unit) updateData.unit = unit;
    if (minQuantity !== undefined) updateData.minQuantity = parseInt(minQuantity);
    if (location !== undefined) updateData.location = location;
    if (supplier !== undefined) updateData.supplier = supplier;
    if (price !== undefined) updateData.price = price ? parseFloat(price) : null;
    if (notes !== undefined) updateData.notes = notes;

    const stockItem = await prisma.stockItem.update({
      where: { id: stockId },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
    });

    await notifyLowStockCrossing(prisma, {
      stockItem,
      previousQuantity: existingStockItem.quantity,
      newQuantity: stockItem.quantity,
      actorUserId: req.user.id,
    });

    res.json({
      message: 'Stock item updated successfully',
      stockItem,
    });
  } catch (error) {
    console.error('Update stock item error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Stock item not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/stock/:id
 * Delete stock item (Admin only)
 */
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);
    if (isNaN(stockId)) {
      return res.status(400).json({ error: 'Invalid stock ID' });
    }

    await prisma.stockItem.delete({
      where: { id: stockId },
    });

    res.json({ message: 'Stock item deleted successfully' });
  } catch (error) {
    console.error('Delete stock item error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Stock item not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/stock/:id/quantity
 * Adjust stock quantity (Admin only)
 * Use this for quick quantity updates (add/remove stock)
 */
router.patch('/:id/quantity', authenticateToken, isAdmin, async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);
    if (isNaN(stockId)) {
      return res.status(400).json({ error: 'Invalid stock ID' });
    }

    const { adjustment } = req.body; // positive = add, negative = remove

    if (adjustment === undefined || isNaN(adjustment)) {
      return res.status(400).json({ error: 'Adjustment value is required' });
    }

    const stockItem = await prisma.stockItem.findUnique({
      where: { id: stockId },
    });

    if (!stockItem) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    const newQuantity = stockItem.quantity + parseInt(adjustment);

    if (newQuantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }

    const updatedItem = await prisma.stockItem.update({
      where: { id: stockId },
      data: { quantity: newQuantity },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
    });

    await notifyLowStockCrossing(prisma, {
      stockItem: updatedItem,
      previousQuantity: stockItem.quantity,
      newQuantity,
      actorUserId: req.user.id,
    });

    res.json({
      message: 'Quantity updated successfully',
      stockItem: updatedItem,
    });
  } catch (error) {
    console.error('Adjust quantity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * GET /api/stock/reservations (Admin only)
 * Get all reservations
 */
router.get('/reservations', authenticateToken, isAdmin, async (req, res) => {
  try {
    const reservations = await prisma.stockReservation.findMany({
      include: {
        stockItem: true,
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            client: true,
            project: true,
          },
        },
        reservedBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reservations });
  } catch (error) {
    console.error('Get all reservations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stock/:id
 * Get single stock item
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);
    if (isNaN(stockId)) {
      return res.status(400).json({ error: 'Invalid stock ID' });
    }

    const stockItem = await prisma.stockItem.findUnique({
      where: { id: stockId },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
    });

    if (!stockItem) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    res.json({
      stockItem: {
        ...stockItem,
        isLowStock: stockItem.quantity <= stockItem.minQuantity,
      },
    });
  } catch (error) {
    console.error('Get stock item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





/**
 * GET /api/stock/reservations/my-reservations
 * Worker gets their stock reservations
 */
router.get('/reservations/my-reservations', authenticateToken, async (req, res) => {
  try {
    const reservations = await prisma.stockReservation.findMany({
      where: {
        reservedById: req.user.id,
        status: { in: ['RESERVED', 'CONSUMED'] },
      },
      include: {
        stockItem: true,
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            client: true,
            project: true,
            item: true,
          },
        },
        reservedBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reservations });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stock/reservations/work-order/:workOrderId
 * Get all reservations for a specific work order
 */
router.get('/reservations/work-order/:workOrderId', authenticateToken, async (req, res) => {
  try {
    const workOrderId = parseInt(req.params.workOrderId);
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
          error: 'You are not authorized to view reservations for this work order',
        });
      }
    }

    const reservations = await prisma.stockReservation.findMany({
      where: { workOrderId },
      include: {
        stockItem: true,
        reservedBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reservations });
  } catch (error) {
    console.error('Get work order reservations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/stock/reserve
 * Worker reserves stock for their assigned work order
 */
router.post('/reserve', authenticateToken, async (req, res) => {
  try {
    const { stockItemId, workOrderId, quantity, notes } = req.body;

    if (!stockItemId || !workOrderId || !quantity) {
      return res.status(400).json({
        error: 'Stock item, work order, and quantity are required',
      });
    }

    const reserveQty = parseInt(quantity);
    if (reserveQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' });
    }

    // Check if stock item exists and has enough quantity
    const stockItem = await prisma.stockItem.findUnique({
      where: { id: parseInt(stockItemId) },
    });

    if (!stockItem) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    if (stockItem.quantity < reserveQty) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${stockItem.quantity} ${stockItem.unit}`,
      });
    }

    // Check if work order exists
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: parseInt(workOrderId) },
      include: { stages: true },
    });

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    // Workers can only reserve for work orders they're assigned to
    if (req.user.role !== 'ADMIN') {
      const isAssigned = workOrder.stages.some(
        stage => stage.assignedToId === req.user.id
      );

      if (!isAssigned) {
        return res.status(403).json({
          error: 'You can only reserve stock for work orders assigned to you',
        });
      }
    }

    // Create reservation and update stock quantity in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create reservation
      const reservation = await tx.stockReservation.create({
        data: {
          stockItemId: parseInt(stockItemId),
          workOrderId: parseInt(workOrderId),
          reservedById: req.user.id,
          quantity: reserveQty,
          notes: notes || null,
          status: 'RESERVED',
        },
        include: {
          stockItem: true,
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              client: true,
              project: true,
            },
          },
          reservedBy: {
            select: { id: true, username: true },
          },
        },
      });

      // Decrease stock quantity
      await tx.stockItem.update({
        where: { id: parseInt(stockItemId) },
        data: { quantity: stockItem.quantity - reserveQty },
      });

      return reservation;
    });

    await notifyLowStockCrossing(prisma, {
      stockItem,
      previousQuantity: stockItem.quantity,
      newQuantity: stockItem.quantity - reserveQty,
      actorUserId: req.user.id,
    });

    res.status(201).json({
      message: 'Stock reserved successfully',
      reservation: result,
    });
  } catch (error) {
    console.error('Reserve stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});






/**
 * PATCH /api/stock/reservations/:id/status
 * Update reservation status (mark as consumed or cancel)
 */
router.patch('/reservations/:id/status', authenticateToken, async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id);
    if (isNaN(reservationId)) {
      return res.status(400).json({ error: 'Invalid reservation ID' });
    }

    const { status } = req.body;

    if (!['CONSUMED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be CONSUMED or CANCELLED',
      });
    }

    const reservation = await prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: { stockItem: true },
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Only the person who reserved or admin can update
    if (req.user.role !== 'ADMIN' && reservation.reservedById !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // If cancelling, return stock to inventory
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status },
        include: {
          stockItem: true,
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              client: true,
            },
          },
          reservedBy: {
            select: { id: true, username: true },
          },
        },
      });

      // If cancelled, return quantity to stock
      if (status === 'CANCELLED' && reservation.status === 'RESERVED') {
        await tx.stockItem.update({
          where: { id: reservation.stockItemId },
          data: {
            quantity: reservation.stockItem.quantity + reservation.quantity,
          },
        });
      }

      return updated;
    });

    res.json({
      message: `Reservation ${status.toLowerCase()} successfully`,
      reservation: result,
    });
  } catch (error) {
    console.error('Update reservation status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;