import { Router } from 'express';
import { getMetricsSummary, getRecentMetrics } from '../db/database.js';

export const metricRouter = Router();

/**
 * GET /metrics/summary
 * Returns global stats, uptime health, and per-API breakdown
 */
metricRouter.get('/summary', (req, res) => {
  try {
    const summary = getMetricsSummary();
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[Metric Summary Error]', error);
    return res.status(500).json({ error: 'Failed to retrieve metrics summary', details: error.message });
  }
});

/**
 * GET /metrics/history
 * Returns recent telemetry records for timeline / sparkline charts
 */
metricRouter.get('/history', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    const history = getRecentMetrics(limit);
    return res.json({ success: true, data: history });
  } catch (error) {
    console.error('[Metric History Error]', error);
    return res.status(500).json({ error: 'Failed to retrieve metric history', details: error.message });
  }
});
