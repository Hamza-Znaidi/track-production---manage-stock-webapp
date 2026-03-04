const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Valid sub-roles list
const VALID_SUB_ROLES = [
  'SALES',
  'CAD',
  'CAM',
  'STORE',
  'CNC',
  'ASSEMBLY',
  'QUALITY',
  'DELIVERY',
];

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    // Find user and include their sub-roles
    const user = await prisma.user.findUnique({
      where: { username },
      include: { subRoles: true },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid username or password',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid username or password',
      });
    }

    // Extract sub-role strings from relation
    const subRoles = user.subRoles.map((s) => s.subRole);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        subRoles,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subRoles,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/register (Admin only)
 */
router.post('/register', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { username, password, role, subRoles } = req.body;

    // Basic validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    if (!role || !['ADMIN', 'WORKER'].includes(role)) {
      return res.status(400).json({
        error: 'Valid role is required (ADMIN or WORKER)',
      });
    }

    // Workers must have at least one sub-role
    if (role === 'WORKER') {
      if (!subRoles || !Array.isArray(subRoles) || subRoles.length === 0) {
        return res.status(400).json({
          error: 'Workers must have at least one sub-role',
        });
      }

      // Validate each sub-role
      const invalidSubRoles = subRoles.filter(
        (sr) => !VALID_SUB_ROLES.includes(sr)
      );
      if (invalidSubRoles.length > 0) {
        return res.status(400).json({
          error: `Invalid sub-roles: ${invalidSubRoles.join(', ')}`,
        });
      }
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Username already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with sub-roles in one transaction
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        // Create sub-roles only if role is WORKER
        subRoles:
          role === 'WORKER' && subRoles
            ? {
                create: subRoles.map((sr) => ({ subRole: sr })),
              }
            : undefined,
      },
      include: { subRoles: true },
    });

    const subRoleStrings = newUser.subRoles.map((s) => s.subRole);

    res.status(201).json({
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        subRoles: subRoleStrings,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { subRoles: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subRoles: user.subRoles.map((s) => s.subRole),
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/users (Admin only)
 */
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { subRoles: true },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      subRoles: user.subRoles.map((s) => s.subRole),
      createdAt: user.createdAt,
    }));

    res.json({ users: formattedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/users/:id (Admin only)
 */
router.put('/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, password, role, subRoles } = req.body;

    if (role && !['ADMIN', 'WORKER'].includes(role)) {
      return res.status(400).json({
        error: 'Valid role is required (ADMIN or WORKER)',
      });
    }

    // If updating to WORKER, must have sub-roles
    if (role === 'WORKER') {
      if (!subRoles || !Array.isArray(subRoles) || subRoles.length === 0) {
        return res.status(400).json({
          error: 'Workers must have at least one sub-role',
        });
      }

      const invalidSubRoles = subRoles.filter(
        (sr) => !VALID_SUB_ROLES.includes(sr)
      );
      if (invalidSubRoles.length > 0) {
        return res.status(400).json({
          error: `Invalid sub-roles: ${invalidSubRoles.join(', ')}`,
        });
      }
    }

    // Build update data
    const updateData = {};

    if (username && username.trim() !== '') {
      // Check username not taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { username: username.trim() },
      });
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      updateData.username = username.trim();
    }

    if (role) updateData.role = role;

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Use a transaction to update user and sub-roles together
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user fields
      const user = await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      // If role changed to ADMIN, delete all sub-roles
      if (role === 'ADMIN') {
        await tx.userSubRole.deleteMany({
          where: { userId },
        });
      }

      // If role is WORKER, replace all sub-roles
      if (role === 'WORKER' && subRoles) {
        // Delete existing sub-roles
        await tx.userSubRole.deleteMany({
          where: { userId },
        });

        // Insert new sub-roles
        await tx.userSubRole.createMany({
          data: subRoles.map((sr) => ({
            userId,
            subRole: sr,
          })),
        });
      }

      // Return updated user with sub-roles
      return tx.user.findUnique({
        where: { id: userId },
        include: { subRoles: true },
      });
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        subRoles: updatedUser.subRoles.map((s) => s.subRole),
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/auth/users/:id (Admin only)
 */
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'You cannot delete your own account',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = await prisma.$transaction(async (tx) => {
      await tx.workOrder.updateMany({
        where: { createdById: userId },
        data: { createdById: req.user.id },
      });

      await tx.stockItem.updateMany({
        where: { createdById: userId },
        data: { createdById: req.user.id },
      });

      await tx.stockReservation.updateMany({
        where: { reservedById: userId },
        data: { reservedById: req.user.id },
      });

      await tx.workOrderStage.updateMany({
        where: { assignedToId: userId },
        data: { assignedToId: null },
      });

      await tx.userSubRole.deleteMany({
        where: { userId },
      });

      return tx.user.delete({
        where: { id: userId },
        select: { id: true, username: true, role: true },
      });
    });

    res.json({
      message: 'User deleted successfully',
      user: deletedUser,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/users
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    // Fetch all users except the current user
    const users = await prisma.user.findMany({
      where: {
        id: {
          not: currentUserId,
        },
      },
      select: {
        id: true,
        username: true,
        role: true,
        subRoles: {
          select: {
            subRole: true,
          },
        },
      },
      orderBy: {
        username: 'asc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/chat-users
 * Returns users list for chat (all authenticated roles)
 */
router.get('/chat-users', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await prisma.user.findMany({
      where: {
        id: {
          not: currentUserId,
        },
      },
      select: {
        id: true,
        username: true,
        role: true,
        subRoles: {
          select: {
            subRole: true,
          },
        },
      },
      orderBy: {
        username: 'asc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Fetch chat users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;