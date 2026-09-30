import test from 'node:test';
import assert from 'node:assert/strict';
import { AnomalyDetector } from '../src/services/anomalyDetector.js';
import { AiAlertService } from '../src/services/aiAlertService.js';
import { insertMetric, insertAnomaly, getAnomalies, updateAnomalyStatus, getMetricsSummary } from '../src/db/database.js';

test('AnomalyDetector: Healthy metric produces no anomalies', () => {
  const metric = {
    api_name: 'TestHealthyAPI',
    response_time_ms: 180,
    status_code: 200,
    records_returned: 45,
  };
  const result = AnomalyDetector.evaluate(metric);
  assert.equal(result.hasAnomaly, false);
  assert.equal(result.anomalies.length, 0);
});

test('AnomalyDetector: 500 Internal Server Error flagged as CRITICAL', () => {
  const metric = {
    api_name: 'TestCrashAPI',
    response_time_ms: 220,
    status_code: 500,
    records_returned: 0,
  };
  const result = AnomalyDetector.evaluate(metric);
  assert.equal(result.hasAnomaly, true);
  const serverError = result.anomalies.find((a) => a.anomaly_type === 'SERVER_ERROR');
  assert.ok(serverError, 'Should contain SERVER_ERROR anomaly');
  assert.equal(serverError.severity, 'CRITICAL');
});

test('AnomalyDetector: 504 Gateway Timeout flagged as GATEWAY_TIMEOUT', () => {
  const metric = {
    api_name: 'TestTimeoutAPI',
    response_time_ms: 6000,
    status_code: 504,
    records_returned: 0,
  };
  const result = AnomalyDetector.evaluate(metric);
  assert.equal(result.hasAnomaly, true);
  const timeoutAnom = result.anomalies.find((a) => a.anomaly_type === 'GATEWAY_TIMEOUT');
  assert.ok(timeoutAnom);
  assert.equal(timeoutAnom.severity, 'CRITICAL');
});

test('AnomalyDetector: 401 Unauthorized flagged as AUTHENTICATION_FAILURE', () => {
  const metric = {
    api_name: 'TestAuthAPI',
    response_time_ms: 120,
    status_code: 401,
    records_returned: 0,
  };
  const result = AnomalyDetector.evaluate(metric);
  assert.equal(result.hasAnomaly, true);
  const authAnom = result.anomalies.find((a) => a.anomaly_type === 'AUTHENTICATION_FAILURE');
  assert.ok(authAnom);
  assert.equal(authAnom.severity, 'HIGH');
});

test('AnomalyDetector: Latency warning and critical thresholds', () => {
  const warnMetric = {
    api_name: 'TestWarnAPI',
    response_time_ms: 2500,
    status_code: 200,
    records_returned: 10,
  };
  const warnResult = AnomalyDetector.evaluate(warnMetric);
  assert.ok(warnResult.anomalies.some((a) => a.anomaly_type === 'HIGH_LATENCY'));

  const critMetric = {
    api_name: 'TestCritAPI',
    response_time_ms: 4500,
    status_code: 200,
    records_returned: 10,
  };
  const critResult = AnomalyDetector.evaluate(critMetric);
  assert.ok(critResult.anomalies.some((a) => a.anomaly_type === 'CRITICAL_LATENCY'));
});

test('AnomalyDetector: HTTP 200 with 0 records flagged as ZERO_RECORDS_EMPTY_PAYLOAD', () => {
  const metric = {
    api_name: 'TestEmptyAPI',
    response_time_ms: 250,
    status_code: 200,
    records_returned: 0,
  };
  const result = AnomalyDetector.evaluate(metric);
  assert.equal(result.hasAnomaly, true);
  const emptyAnom = result.anomalies.find((a) => a.anomaly_type === 'ZERO_RECORDS_EMPTY_PAYLOAD');
  assert.ok(emptyAnom);
  assert.equal(emptyAnom.severity, 'HIGH');
});

test('AiAlertService: Heuristic generation delivers all required fields', () => {
  const metric = {
    api_name: 'PatientBilling',
    response_time_ms: 4200,
    status_code: 500,
    records_returned: 0,
  };
  const anomaly = {
    anomaly_type: 'SERVER_ERROR',
    severity: 'CRITICAL',
    description: 'Server error 500',
  };

  const alert = AiAlertService.generateHeuristicAlert(metric, anomaly);
  assert.ok(alert.ai_alert, 'Must have ai_alert');
  assert.ok(alert.ai_analysis, 'Must have ai_analysis');
  assert.ok(alert.suggested_action, 'Must have suggested_action');
});

test('Database: Metric & Anomaly persistence and query lifecycle', () => {
  const metricId = insertMetric({
    api_name: 'LifecycleTestAPI',
    response_time_ms: 320,
    status_code: 500,
    records_returned: 0,
    has_anomaly: true,
  });
  assert.ok(metricId > 0);

  const anomalyId = insertAnomaly({
    metric_id: metricId,
    api_name: 'LifecycleTestAPI',
    anomaly_type: 'SERVER_ERROR',
    severity: 'CRITICAL',
    description: 'Test anomaly description',
    ai_alert: 'Test AI alert',
    ai_analysis: 'Test AI analysis',
    suggested_action: 'Test suggested action',
    status: 'active',
  });
  assert.ok(anomalyId > 0);

  const alerts = getAnomalies({ api_name: 'LifecycleTestAPI' });
  assert.ok(alerts.length >= 1);
  const found = alerts.find((a) => a.id === anomalyId);
  assert.equal(found.status, 'active');

  const resolved = updateAnomalyStatus(anomalyId, 'resolved');
  assert.equal(resolved, true);

  const summary = getMetricsSummary();
  assert.ok(summary.totalCalls >= 1);
  assert.ok(summary.totalAnomalies >= 1);
});
