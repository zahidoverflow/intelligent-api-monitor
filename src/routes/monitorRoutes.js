import { Router } from 'express';
import { BatchProcessor } from '../services/batchProcessor.js';

export const monitorRouter = Router();

/**
 * POST /monitor
 * Receives either a single API metric object or an array of metric objects.
 * Payload schema:
 * {
 *   "api_name": string,
 *   "response_time_ms": number,
 *   "status_code": number,
 *   "records_returned": number
 * }
 */
monitorRouter.post('/', async (req, res) => {
  try {
    const payload = req.body;
    const sendEmail = req.query.email === 'true' || req.body.sendEmail === true;

    if (!payload) {
      return res.status(400).json({ error: 'Request body cannot be empty.' });
    }

    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return res.status(400).json({ error: 'Payload array cannot be empty.' });
      }

      // Validate each item
      for (const item of payload) {
        if (!item.api_name || item.response_time_ms === undefined || item.status_code === undefined || item.records_returned === undefined) {
          return res.status(400).json({
            error: 'Each item must include api_name, response_time_ms, status_code, and records_returned.',
            invalid_item: item,
          });
        }
      }

      const result = await BatchProcessor.processBatch(payload, { sendEmail });
      return res.status(201).json({
        success: true,
        message: `Processed ${result.total_processed} metrics, detected ${result.anomalies_detected} anomalies.`,
        data: result,
      });
    }

    // Single item handling
    const { api_name, response_time_ms, status_code, records_returned } = payload;
    if (!api_name || response_time_ms === undefined || status_code === undefined || records_returned === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: api_name, response_time_ms, status_code, records_returned are all required.',
      });
    }

    const metric = {
      api_name: String(api_name).trim(),
      response_time_ms: Number(response_time_ms),
      status_code: Number(status_code),
      records_returned: Number(records_returned),
    };

    const result = await BatchProcessor.processSingle(metric, { sendEmail });
    return res.status(201).json({
      success: true,
      message: result.has_anomaly
        ? `Anomaly detected and recorded for ${result.api_name}.`
        : `Metric recorded successfully for ${result.api_name}. No anomalies detected.`,
      data: result,
    });
  } catch (error) {
    console.error('[Monitor Route Error]', error);
    return res.status(500).json({
      error: 'Internal server error while processing API telemetry.',
      details: error.message,
    });
  }
});
