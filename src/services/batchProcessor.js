import fs from 'node:fs';
import { AnomalyDetector } from './anomalyDetector.js';
import { AiAlertService } from './aiAlertService.js';
import { insertMetric, insertAnomaly } from '../db/database.js';
import { EmailNotifier } from './emailNotifier.js';

export class BatchProcessor {
  /**
   * Process a single API metric record
   * @param {Object} metric - { api_name, response_time_ms, status_code, records_returned }
   * @param {Object} options - { sendEmail: boolean }
   * @returns {Promise<Object>}
   */
  static async processSingle(metric, options = { sendEmail: false }) {
    // 1. Evaluate anomaly
    const evalResult = AnomalyDetector.evaluate(metric);
    const hasAnomaly = evalResult.hasAnomaly;

    // 2. Persist metric record
    const metricId = insertMetric({
      ...metric,
      has_anomaly: hasAnomaly,
    });

    const recordedAnomalies = [];

    // 3. For each detected anomaly, generate AI diagnosis and persist
    for (const anomaly of evalResult.anomalies) {
      const aiResponse = await AiAlertService.generateAlert(metric, anomaly);

      const anomalyRecord = {
        metric_id: metricId,
        api_name: metric.api_name,
        anomaly_type: anomaly.anomaly_type,
        severity: anomaly.severity,
        description: anomaly.description,
        ai_alert: aiResponse.ai_alert,
        ai_analysis: aiResponse.ai_analysis,
        suggested_action: aiResponse.suggested_action,
        status: 'active',
      };

      const anomalyId = insertAnomaly(anomalyRecord);
      anomalyRecord.id = anomalyId;
      recordedAnomalies.push(anomalyRecord);

      // Optional email notification for CRITICAL / HIGH
      if (options.sendEmail && (anomaly.severity === 'CRITICAL' || anomaly.severity === 'HIGH')) {
        try {
          await EmailNotifier.sendAlert(anomalyRecord, metric);
        } catch (err) {
          console.error(`[Email Alert Error] Failed to send email: ${err.message}`);
        }
      }
    }

    return {
      metric_id: metricId,
      api_name: metric.api_name,
      has_anomaly: hasAnomaly,
      anomalies: recordedAnomalies,
    };
  }

  /**
   * Process a batch of metrics (array or JSON file path)
   * @param {Array|string} input - Array of metric objects or path to JSON file
   * @param {Object} options - { sendEmail: boolean }
   * @returns {Promise<Object>}
   */
  static async processBatch(input, options = { sendEmail: false }) {
    let metrics = [];
    if (typeof input === 'string') {
      const raw = fs.readFileSync(input, 'utf-8');
      metrics = JSON.parse(raw);
    } else if (Array.isArray(input)) {
      metrics = input;
    } else {
      throw new Error('Invalid input: Expected an array of metrics or a file path string.');
    }

    const results = [];
    let anomalyCount = 0;

    for (const metric of metrics) {
      const result = await this.processSingle(metric, options);
      if (result.has_anomaly) {
        anomalyCount += result.anomalies.length;
      }
      results.push(result);
    }

    return {
      total_processed: metrics.length,
      anomalies_detected: anomalyCount,
      results,
    };
  }
}
