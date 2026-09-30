import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config/config.js';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS api_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_name TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    records_returned INTEGER NOT NULL,
    has_anomaly INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_id INTEGER,
    api_name TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    ai_alert TEXT NOT NULL,
    ai_analysis TEXT,
    suggested_action TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(metric_id) REFERENCES api_metrics(id)
  );

  CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
  CREATE INDEX IF NOT EXISTS idx_anomalies_created_at ON anomalies(created_at);
  CREATE INDEX IF NOT EXISTS idx_metrics_api ON api_metrics(api_name);
`);

/**
 * Inserts a recorded API health metric
 */
export function insertMetric(metric) {
  const stmt = db.prepare(`
    INSERT INTO api_metrics (api_name, response_time_ms, status_code, records_returned, has_anomaly)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    metric.api_name,
    metric.response_time_ms,
    metric.status_code,
    metric.records_returned,
    metric.has_anomaly ? 1 : 0
  );
  return info.lastInsertRowid;
}

/**
 * Inserts a detected anomaly with AI generated insights
 */
export function insertAnomaly(anomaly) {
  const stmt = db.prepare(`
    INSERT INTO anomalies (
      metric_id, api_name, anomaly_type, severity, description,
      ai_alert, ai_analysis, suggested_action, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    anomaly.metric_id,
    anomaly.api_name,
    anomaly.anomaly_type,
    anomaly.severity,
    anomaly.description,
    anomaly.ai_alert,
    anomaly.ai_analysis || '',
    anomaly.suggested_action || '',
    anomaly.status || 'active'
  );
  return info.lastInsertRowid;
}

/**
 * Fetch anomalies with optional filters
 */
export function getAnomalies(filters = {}) {
  let query = 'SELECT * FROM anomalies WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.severity) {
    query += ' AND severity = ?';
    params.push(filters.severity.toUpperCase());
  }
  if (filters.api_name) {
    query += ' AND api_name LIKE ?';
    params.push(`%${filters.api_name}%`);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 50);
  params.push(filters.offset || 0);

  return db.prepare(query).all(...params);
}

/**
 * Fetch a single anomaly by ID
 */
export function getAnomalyById(id) {
  return db.prepare('SELECT * FROM anomalies WHERE id = ?').get(id);
}

/**
 * Update the resolution status of an anomaly
 */
export function updateAnomalyStatus(id, status) {
  const stmt = db.prepare('UPDATE anomalies SET status = ? WHERE id = ?');
  const info = stmt.run(status, id);
  return info.changes > 0;
}

/**
 * Fetch aggregated metrics and summary stats
 */
export function getMetricsSummary() {
  const totalCalls = db.prepare('SELECT COUNT(*) as count FROM api_metrics').get().count;
  const totalAnomalies = db.prepare('SELECT COUNT(*) as count FROM anomalies').get().count;
  const activeAnomalies = db.prepare("SELECT COUNT(*) as count FROM anomalies WHERE status = 'active'").get().count;
  const criticalAnomalies = db.prepare("SELECT COUNT(*) as count FROM anomalies WHERE severity = 'CRITICAL' AND status = 'active'").get().count;
  const avgResponseTime = db.prepare('SELECT AVG(response_time_ms) as avg FROM api_metrics').get().avg || 0;

  const apis = db.prepare(`
    SELECT 
      api_name,
      COUNT(*) as total_requests,
      SUM(CASE WHEN has_anomaly = 1 THEN 1 ELSE 0 END) as anomaly_count,
      ROUND(AVG(response_time_ms), 1) as avg_latency_ms,
      ROUND(100.0 * SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
    FROM api_metrics
    GROUP BY api_name
    ORDER BY anomaly_count DESC
  `).all();

  return {
    totalCalls,
    totalAnomalies,
    activeAnomalies,
    criticalAnomalies,
    avgResponseTime: Math.round(avgResponseTime),
    apis,
  };
}

/**
 * Get recent metrics history for charts
 */
export function getRecentMetrics(limit = 20) {
  return db.prepare(`
    SELECT * FROM api_metrics 
    ORDER BY id DESC 
    LIMIT ?
  `).all(limit).reverse();
}
