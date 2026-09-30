import { config } from '../config/config.js';

/**
 * Anomaly Detection Service
 * Evaluates individual API metrics against behavioral and performance baselines.
 */
export class AnomalyDetector {
  /**
   * Evaluates a single API metric for health anomalies
   * @param {Object} metric - { api_name, response_time_ms, status_code, records_returned }
   * @returns {Object} - { hasAnomaly: boolean, anomalies: Array }
   */
  static evaluate(metric) {
    const anomalies = [];
    const thresholds = config.thresholds;

    // 1. Server Error Check (HTTP 5xx)
    if (metric.status_code >= 500) {
      const isTimeout = metric.status_code === 504 || metric.status_code === 502;
      anomalies.push({
        anomaly_type: isTimeout ? 'GATEWAY_TIMEOUT' : 'SERVER_ERROR',
        severity: 'CRITICAL',
        description: `${metric.api_name} returned server error HTTP ${metric.status_code} with 0 records returned.`,
      });
    }

    // 2. Client / Auth Error Check (HTTP 4xx)
    else if (metric.status_code >= 400) {
      const isAuth = metric.status_code === 401 || metric.status_code === 403;
      anomalies.push({
        anomaly_type: isAuth ? 'AUTHENTICATION_FAILURE' : 'CLIENT_ERROR',
        severity: isAuth ? 'HIGH' : 'MEDIUM',
        description: `${metric.api_name} returned HTTP ${metric.status_code} (${isAuth ? 'Unauthorized/Forbidden credential or token expiration' : 'Bad request'}).`,
      });
    }

    // 3. Latency Anomaly Checks
    if (metric.response_time_ms >= thresholds.latencyCriticalMs) {
      anomalies.push({
        anomaly_type: 'CRITICAL_LATENCY',
        severity: 'CRITICAL',
        description: `Severe latency spike on ${metric.api_name}: ${metric.response_time_ms}ms (Critical threshold: ${thresholds.latencyCriticalMs}ms).`,
      });
    } else if (metric.response_time_ms >= thresholds.latencyWarningMs) {
      anomalies.push({
        anomaly_type: 'HIGH_LATENCY',
        severity: 'MEDIUM',
        description: `Elevated response latency on ${metric.api_name}: ${metric.response_time_ms}ms (Warning threshold: ${thresholds.latencyWarningMs}ms).`,
      });
    }

    // 4. Data / Payload Anomaly: 0 Records on 200 OK
    // When an operational API returns HTTP 200 OK but 0 records, it often signifies
    // database desynchronization, query filter bugs, or unexpected empty datasets.
    if (metric.status_code === 200 && metric.records_returned === 0) {
      anomalies.push({
        anomaly_type: 'ZERO_RECORDS_EMPTY_PAYLOAD',
        severity: 'HIGH',
        description: `${metric.api_name} responded with HTTP 200 OK but returned 0 records. Potential silent data drop or empty dataset condition.`,
      });
    }

    return {
      hasAnomaly: anomalies.length > 0,
      anomalies,
    };
  }
}
