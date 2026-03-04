async function createNotification(prisma, payload) {
  const {
    recipientUserId,
    actorUserId,
    type,
    severity = 'INFO',
    title,
    message,
    workOrderId,
    stageId,
    stockItemId,
    metadata,
  } = payload;

  if (!recipientUserId || !type || !title || !message) {
    return null;
  }

  return prisma.notification.create({
    data: {
      recipientUserId,
      actorUserId: actorUserId || null,
      type,
      severity,
      title,
      message,
      workOrderId: workOrderId || null,
      stageId: stageId || null,
      stockItemId: stockItemId || null,
      metadata: metadata || null,
    },
  });
}

async function createNotificationsForUsers(prisma, userIds, payload) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return { count: 0 };
  }

  const notificationsData = uniqueUserIds.map((recipientUserId) => ({
    recipientUserId,
    actorUserId: payload.actorUserId || null,
    type: payload.type,
    severity: payload.severity || 'INFO',
    title: payload.title,
    message: payload.message,
    workOrderId: payload.workOrderId || null,
    stageId: payload.stageId || null,
    stockItemId: payload.stockItemId || null,
    metadata: payload.metadata || null,
  }));

  return prisma.notification.createMany({ data: notificationsData });
}

async function getAdminUserIds(prisma, { excludeUserId } = {}) {
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return admins.map((admin) => admin.id);
}

async function notifyLowStockCrossing(prisma, {
  stockItem,
  previousQuantity,
  newQuantity,
  actorUserId,
}) {
  if (!stockItem) return;

  const crossedToLowStock = previousQuantity > stockItem.minQuantity
    && newQuantity <= stockItem.minQuantity;

  if (!crossedToLowStock) return;

  const adminUserIds = await getAdminUserIds(prisma);

  await createNotificationsForUsers(prisma, adminUserIds, {
    actorUserId,
    type: 'LOW_STOCK',
    severity: 'WARNING',
    title: `Low stock alert: ${stockItem.name}`,
    message: `${stockItem.name} dropped to ${newQuantity} ${stockItem.unit} (threshold ${stockItem.minQuantity}).`,
    stockItemId: stockItem.id,
    metadata: {
      previousQuantity,
      newQuantity,
      minQuantity: stockItem.minQuantity,
    },
  });
}

module.exports = {
  createNotification,
  createNotificationsForUsers,
  getAdminUserIds,
  notifyLowStockCrossing,
};
