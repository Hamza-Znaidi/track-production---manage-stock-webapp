const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_LOOKBACK_DAYS = 7;
const QUALITY_KEYWORDS = ['issue', 'problem', 'error', 'delay', 'blocked', 'fix', 'bug', 'urgent'];

const toDateRange = (options = DEFAULT_LOOKBACK_DAYS) => {
  if (typeof options === 'object' && options !== null) {
    const startDate = options.startDate ? new Date(options.startDate) : null;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new Error('Invalid start date');
    }

    if (Number.isNaN(endDate.getTime())) {
      throw new Error('Invalid end date');
    }

    const resolvedStartDate = startDate || (() => {
      const fallback = new Date(endDate);
      fallback.setDate(fallback.getDate() - DEFAULT_LOOKBACK_DAYS);
      return fallback;
    })();

    resolvedStartDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (resolvedStartDate > endDate) {
      throw new Error('Start date must be before end date');
    }

    return { startDate: resolvedStartDate, endDate };
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Math.max(1, Number(options) || DEFAULT_LOOKBACK_DAYS));
  return { startDate, endDate };
};

const safeDurationMs = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return end - start;
};

const formatDurationHours = (durationMs) => {
  if (durationMs === null) return null;
  return Number((durationMs / (1000 * 60 * 60)).toFixed(2));
};

const buildStageActivityWhere = (startDate, endDate) => ({
  OR: [
    { createdAt: { gte: startDate, lte: endDate } },
    { updatedAt: { gte: startDate, lte: endDate } },
    { startedAt: { gte: startDate, lte: endDate } },
    { completedAt: { gte: startDate, lte: endDate } },
    {
      noteEntries: {
        some: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    },
  ],
});

const extractQualitySignals = (notes) => {
  return notes
    .filter((note) => {
      const lowerContent = note.content.toLowerCase();
      return QUALITY_KEYWORDS.some((keyword) => lowerContent.includes(keyword));
    })
    .map((note) => ({
      noteId: note.id,
      stageId: note.stageId,
      stage: note.stage?.subRole || 'Unknown',
      workOrderNumber: note.stage?.workOrder?.workOrderNumber || 'Unknown',
      worker: note.author?.username || 'Unknown',
      content: note.content,
      createdAt: note.createdAt,
    }));
};

const getStageDurationHours = (stage) => {
  const durationMs = safeDurationMs(stage.startedAt || stage.createdAt, stage.completedAt || new Date());
  return formatDurationHours(durationMs);
};

async function aggregateReportData(rangeInput = DEFAULT_LOOKBACK_DAYS) {
  const { startDate, endDate } = toDateRange(rangeInput);
  const stageActivityWhere = buildStageActivityWhere(startDate, endDate);

  const [workOrders, stageNotes, users] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        OR: [
          {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            updatedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            stages: {
              some: stageActivityWhere,
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
        stages: {
          where: stageActivityWhere,
          orderBy: { createdAt: 'asc' },
          include: {
            assignedTo: {
              select: { id: true, username: true },
            },
            noteEntries: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              orderBy: { createdAt: 'desc' },
              include: {
                author: {
                  select: { id: true, username: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.workOrderStageNote.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, username: true },
        },
        stage: {
          select: {
            id: true,
            subRole: true,
            status: true,
            workOrder: {
              select: { id: true, workOrderNumber: true },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assignedStages: {
          include: {
            noteEntries: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const totalStages = workOrders.reduce((count, workOrder) => count + workOrder.stages.length, 0);
  const completedStages = workOrders.reduce(
    (count, workOrder) => count + workOrder.stages.filter((stage) => stage.status === 'COMPLETED').length,
    0,
  );
  const activeStages = workOrders.reduce(
    (count, workOrder) => count + workOrder.stages.filter((stage) => stage.status === 'IN_PROGRESS').length,
    0,
  );

  const workOrderCycleTimes = workOrders
    .map((workOrder) => {
      const completedAt = [...workOrder.stages]
        .filter((stage) => stage.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]?.completedAt;
      const totalDurationHours = formatDurationHours(safeDurationMs(workOrder.createdAt, completedAt || endDate));
      return {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        status: workOrder.status,
        client: workOrder.client,
        project: workOrder.project,
        createdAt: workOrder.createdAt,
        completedAt,
        cycleTimeHours: totalDurationHours,
        totalStages: workOrder.stages.length,
        completedStages: workOrder.stages.filter((stage) => stage.status === 'COMPLETED').length,
      };
    })
    .filter((item) => item.cycleTimeHours !== null);

  const workerStatsMap = new Map();
  users.forEach((user) => {
    if (user.role !== 'WORKER') return;
    workerStatsMap.set(user.id, {
      userId: user.id,
      username: user.username,
      assignedStages: 0,
      completedStages: 0,
      activeStages: 0,
      notesAuthored: 0,
      avgStageDurationHours: null,
      stageDurations: [],
    });
  });

  workOrders.forEach((workOrder) => {
    workOrder.stages.forEach((stage) => {
      if (!stage.assignedToId || !workerStatsMap.has(stage.assignedToId)) return;
      const worker = workerStatsMap.get(stage.assignedToId);
      worker.assignedStages += 1;
      if (stage.status === 'COMPLETED') worker.completedStages += 1;
      if (stage.status === 'IN_PROGRESS') worker.activeStages += 1;
      const stageDuration = getStageDurationHours(stage);
      if (stageDuration !== null) worker.stageDurations.push(stageDuration);
    });
  });

  stageNotes.forEach((note) => {
    if (workerStatsMap.has(note.authorId)) {
      workerStatsMap.get(note.authorId).notesAuthored += 1;
    }
  });

  const workerStats = [...workerStatsMap.values()]
    .map((worker) => {
      const avgStageDurationHours = worker.stageDurations.length
        ? Number((worker.stageDurations.reduce((sum, value) => sum + value, 0) / worker.stageDurations.length).toFixed(2))
        : null;

      const efficiencyScore = (() => {
        const completionRate = worker.assignedStages > 0 ? worker.completedStages / worker.assignedStages : 0;
        const notesBoost = Math.min(worker.notesAuthored / 10, 1);
        const activePenalty = worker.activeStages > 0 ? 0.15 : 0;
        return Number(((completionRate * 0.75 + notesBoost * 0.25 - activePenalty) * 100).toFixed(2));
      })();

      return {
        ...worker,
        avgStageDurationHours,
        efficiencyScore,
      };
    })
    .sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  const qualityIssues = extractQualitySignals(stageNotes);

  const stagePerformance = workOrders.flatMap((workOrder) =>
    workOrder.stages.map((stage) => ({
      stageId: stage.id,
      subRole: stage.subRole,
      status: stage.status,
      assignedTo: stage.assignedTo?.username || null,
      notesCount: stage.noteEntries.length,
      durationHours: getStageDurationHours(stage),
      createdAt: stage.createdAt,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      workOrderNumber: workOrder.workOrderNumber,
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    range: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    stats: {
      totalWorkOrders: workOrders.length,
      completedWorkOrders: workOrders.filter((workOrder) => workOrder.status === 'COMPLETED').length,
      inProgressWorkOrders: workOrders.filter((workOrder) => workOrder.status === 'IN_PROGRESS').length,
      pendingWorkOrders: workOrders.filter((workOrder) => workOrder.status === 'PENDING').length,
      totalStages,
      completedStages,
      activeStages,
      totalNotes: stageNotes.length,
      totalWorkers: workerStats.length,
    },
    workOrders: workOrders.map((workOrder) => ({
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      status: workOrder.status,
      client: workOrder.client,
      project: workOrder.project,
      createdAt: workOrder.createdAt,
      createdBy: workOrder.createdBy?.username || null,
      stages: workOrder.stages.map((stage) => ({
        id: stage.id,
        subRole: stage.subRole,
        status: stage.status,
        assignedTo: stage.assignedTo?.username || null,
        notesCount: stage.noteEntries.length,
        durationHours: getStageDurationHours(stage),
        createdAt: stage.createdAt,
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
      })),
    })),
    stageNotes: stageNotes.map((note) => ({
      id: note.id,
      content: note.content,
      createdAt: note.createdAt,
      author: note.author?.username || null,
      stage: note.stage
        ? {
            id: note.stage.id,
            subRole: note.stage.subRole,
            status: note.stage.status,
            workOrderNumber: note.stage.workOrder?.workOrderNumber || null,
          }
        : null,
    })),
    qualityIssues,
    workerStats,
    stagePerformance,
    cycleTimes: workOrderCycleTimes,
  };
}

module.exports = {
  aggregateReportData,
  DEFAULT_LOOKBACK_DAYS,
};
