import { Router } from 'express';
import { getAnomalies, getAnomalyById, updateAnomalyStatus } from '../db/database.js';

export const alertRouter = Router();

/**
 * GET /alerts
 * Fetch list of anomalies with filtering and pagination
 * Query params: status, severity, api_name, limit, offset
 */
alertRouter.get('/', (req, res) => {
  try {
    const { status, severity, api_name, limit, offset } = req.query;
    const filters = {
      status: status ? String(status).toLowerCase() : undefined,
      severity: severity ? String(severity).toUpperCase() : undefined,
      api_name: api_name ? String(api_name) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    const alerts = getAnomalies(filters);
    return res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error('[Alerts Route Error]', error);
    return res.status(500).json({ error: 'Failed to retrieve alerts', details: error.message });
  }
});

/**
 * GET /alerts/:id
 * Fetch single anomaly by ID
 */
alertRouter.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid alert ID' });
    }

    const alert = getAnomalyById(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({ success: true, data: alert });
  } catch (error) {
    console.error('[Alert Detail Error]', error);
    return res.status(500).json({ error: 'Failed to retrieve alert detail', details: error.message });
  }
});

/**
 * PATCH /alerts/:id/resolve
 * Mark an anomaly as resolved
 */
alertRouter.patch('/:id/resolve', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid alert ID' });
    }

    const alert = getAnomalyById(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updated = updateAnomalyStatus(id, 'resolved');
    return res.json({
      success: updated,
      message: `Alert #${id} marked as resolved.`,
      data: { id, status: 'resolved' },
    });
  } catch (error) {
    console.error('[Resolve Alert Error]', error);
    return res.status(500).json({ error: 'Failed to update alert status', details: error.message });
  }
});
