const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { aggregateReportData, DEFAULT_LOOKBACK_DAYS } = require('../lib/reportGenerator');
const { generateAIInsights } = require('../lib/aiAnalysis');

const router = express.Router();

router.post('/generate', authenticateToken, isAdmin, async (req, res) => {
  try {
    const hasCustomRange = Boolean(req.body?.startDate || req.body?.endDate);
    const rangeInput = hasCustomRange
      ? {
          startDate: req.body?.startDate,
          endDate: req.body?.endDate,
        }
      : Number(req.body?.days) || DEFAULT_LOOKBACK_DAYS;

    const reportData = await aggregateReportData(rangeInput);
    const aiInsights = await generateAIInsights(reportData);

    return res.json({
      message: 'AI report generated successfully',
      report: {
        ...reportData,
        ...aiInsights,
      },
    });
  } catch (error) {
    console.error('Report generation failed:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate report',
    });
  }
});

module.exports = router;
