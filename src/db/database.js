import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config/config.js';

let db = null;
let useMemoryFallback = false;

// In-memory fallback data structures for serverless environments
let memoryMetrics = [];
let memoryAnomalies = [];
let nextMetricId = 1;
let nextAnomalyId = 1;

try {
  const Database = (await import('better-sqlite3')).default;
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);
  if (!process.env.VERCEL) {
    db.pragma('journal_mode = WAL');
  }

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
} catch (err) {
  console.warn(`[Database] Native SQLite unavailable (${err.message}). Using resilient in-memory storage.`);
  useMemoryFallback = true;
  seedInitialData();
}

// Seed helper for initial presentation
function seedInitialData() {
  if (memoryMetrics.length > 0) return;
  const initial = [
    { api_name: 'PatientDataAPI', response_time_ms: 180, status_code: 200, records_returned: 45, has_anomaly: false },
    { api_name: 'AppointmentAPI', response_time_ms: 5500, status_code: 500, records_returned: 0, has_anomaly: true },
    { api_name: 'BillingServiceAPI', response_time_ms: 3200, status_code: 200, records_returned: 120, has_anomaly: true },
    { api_name: 'MedicationScheduleAPI', response_time_ms: 210, status_code: 200, records_returned: 0, has_anomaly: true },
    { api_name: 'CaregiverDispatchAPI', response_time_ms: 6200, status_code: 504, records_returned: 0, has_anomaly: true },
    { api_name: 'AuthTokenService', response_time_ms: 95, status_code: 401, records_returned: 0, has_anomaly: true },
    { api_name: 'HealthRecordsSyncAPI', response_time_ms: 340, status_code: 200, records_returned: 18, has_anomaly: false },
  ];

  for (const m of initial) {
    const id = nextMetricId++;
    memoryMetrics.push({ ...m, id, created_at: new Date().toISOString() });
    if (m.has_anomaly) {
      const anomId = nextAnomalyId++;
      let type = 'SERVER_ERROR';
      let sev = 'CRITICAL';
      let alert = `${m.api_name} failed with status ${m.status_code}`;
      let analysis = 'Server error or timeout';
      let action = 'Check application logs';

      if (m.status_code === 504) {
        type = 'GATEWAY_TIMEOUT';
        sev = 'CRITICAL';
        alert = `CRITICAL: ${m.api_name} timed out after ${m.response_time_ms}ms`;
        analysis = 'Upstream proxy timeout';
        action = 'Verify backend replicas and gateway limits';
      } else if (m.status_code === 401) {
        type = 'AUTHENTICATION_FAILURE';
        sev = 'HIGH';
        alert = `SECURITY ALERT: ${m.api_name} rejected auth with HTTP 401`;
        analysis = 'Expired token or rotated credentials';
        action = 'Refresh service account credentials';
      } else if (m.records_returned === 0 && m.status_code === 200) {
        type = 'ZERO_RECORDS_EMPTY_PAYLOAD';
        sev = 'HIGH';
        alert = `DATA INTEGRITY: ${m.api_name} returned 200 OK with 0 records`;
        analysis = 'Silent data loss / empty dataset';
        action = 'Verify data pipeline and SQL queries';
      } else if (m.response_time_ms > 3000) {
        type = 'HIGH_LATENCY';
        sev = 'MEDIUM';
        alert = `WARNING: ${m.api_name} elevated latency of ${m.response_time_ms}ms`;
        analysis = 'Resource saturation or missing index';
        action = 'Profile database queries and monitor CPU';
      }

      memoryAnomalies.push({
        id: anomId,
        metric_id: id,
        api_name: m.api_name,
        anomaly_type: type,
        severity: sev,
        description: `Automated detection trigger for ${m.api_name}`,
        ai_alert: alert,
        ai_analysis: analysis,
        suggested_action: action,
        status: 'active',
        created_at: new Date().toISOString(),
      });
    }
  }
}

/**
 * Inserts a recorded API health metric
 */
export function insertMetric(metric) {
  if (useMemoryFallback) {
    const id = nextMetricId++;
    memoryMetrics.push({
      ...metric,
      id,
      has_anomaly: metric.has_anomaly ? 1 : 0,
      created_at: new Date().toISOString(),
    });
    return id;
  }

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
  if (useMemoryFallback) {
    const id = nextAnomalyId++;
    memoryAnomalies.push({
      ...anomaly,
      id,
      status: anomaly.status || 'active',
      created_at: new Date().toISOString(),
    });
    return id;
  }

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
  if (useMemoryFallback) {
    let list = [...memoryAnomalies];
    if (filters.status) {
      list = list.filter((a) => a.status === filters.status);
    }
    if (filters.severity) {
      list = list.filter((a) => a.severity.toUpperCase() === filters.severity.toUpperCase());
    }
    if (filters.api_name) {
      list = list.filter((a) => a.api_name.toLowerCase().includes(filters.api_name.toLowerCase()));
    }
    list.sort((a, b) => b.id - a.id);
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return list.slice(offset, offset + limit);
  }

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
  if (useMemoryFallback) {
    return memoryAnomalies.find((a) => a.id === Number(id)) || null;
  }
  return db.prepare('SELECT * FROM anomalies WHERE id = ?').get(id);
}

/**
 * Update the resolution status of an anomaly
 */
export function updateAnomalyStatus(id, status) {
  if (useMemoryFallback) {
    const anom = memoryAnomalies.find((a) => a.id === Number(id));
    if (anom) {
      anom.status = status;
      return true;
    }
    return false;
  }

  const stmt = db.prepare('UPDATE anomalies SET status = ? WHERE id = ?');
  const info = stmt.run(status, id);
  return info.changes > 0;
}

/**
 * Fetch aggregated metrics and summary stats
 */
export function getMetricsSummary() {
  if (useMemoryFallback) {
    const totalCalls = memoryMetrics.length;
    const totalAnomalies = memoryAnomalies.length;
    const activeAnomalies = memoryAnomalies.filter((a) => a.status === 'active').length;
    const criticalAnomalies = memoryAnomalies.filter((a) => a.status === 'active' && a.severity === 'CRITICAL').length;
    const avgResponseTime = totalCalls > 0
      ? Math.round(memoryMetrics.reduce((sum, m) => sum + m.response_time_ms, 0) / totalCalls)
      : 0;

    const groupMap = {};
    for (const m of memoryMetrics) {
      if (!groupMap[m.api_name]) {
        groupMap[m.api_name] = { total: 0, anomalies: 0, totalLatency: 0, successes: 0 };
      }
      groupMap[m.api_name].total++;
      if (m.has_anomaly) groupMap[m.api_name].anomalies++;
      groupMap[m.api_name].totalLatency += m.response_time_ms;
      if (m.status_code < 400) groupMap[m.api_name].successes++;
    }

    const apis = Object.keys(groupMap).map((name) => {
      const g = groupMap[name];
      return {
        api_name: name,
        total_requests: g.total,
        anomaly_count: g.anomalies,
        avg_latency_ms: Math.round((g.totalLatency / g.total) * 10) / 10,
        success_rate: Math.round((100.0 * g.successes / g.total) * 10) / 10,
      };
    }).sort((a, b) => b.anomaly_count - a.anomaly_count);

    return {
      totalCalls,
      totalAnomalies,
      activeAnomalies,
      criticalAnomalies,
      avgResponseTime,
      apis,
    };
  }

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
  if (useMemoryFallback) {
    return memoryMetrics.slice(-limit);
  }
  return db.prepare(`
    SELECT * FROM api_metrics 
    ORDER BY id DESC 
    LIMIT ?
  `).all(limit).reverse();
}
