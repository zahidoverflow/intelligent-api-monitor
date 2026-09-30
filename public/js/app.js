let currentFilter = 'all';

// Presets data
const PRESETS = {
  healthy: { api_name: 'PatientDataAPI', status_code: 200, response_time_ms: 180, records_returned: 45 },
  crash: { api_name: 'AppointmentAPI', status_code: 500, response_time_ms: 320, records_returned: 0 },
  timeout: { api_name: 'CaregiverDispatchAPI', status_code: 504, response_time_ms: 6200, records_returned: 0 },
  empty: { api_name: 'MedicationScheduleAPI', status_code: 200, response_time_ms: 210, records_returned: 0 },
  auth: { api_name: 'AuthTokenService', status_code: 401, response_time_ms: 95, records_returned: 0 },
  latency: { api_name: 'BillingServiceAPI', status_code: 200, response_time_ms: 5200, records_returned: 85 },
};

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadDashboardData();
  // Poll every 10 seconds for live updates
  setInterval(loadDashboardData, 10000);
});

function setupEventListeners() {
  // Refresh button
  document.getElementById('btn-refresh').addEventListener('click', () => {
    loadDashboardData();
    showToast('Telemetry refreshed.');
  });

  // Batch run button
  document.getElementById('btn-batch-run').addEventListener('click', async () => {
    try {
      showToast('Running batch evaluation on sample dataset...');
      // Sample batch data
      const samplePayload = [
        { api_name: 'PatientDataAPI', response_time_ms: 180, status_code: 200, records_returned: 45 },
        { api_name: 'AppointmentAPI', response_time_ms: 5500, status_code: 500, records_returned: 0 },
        { api_name: 'BillingServiceAPI', response_time_ms: 3200, status_code: 200, records_returned: 120 },
        { api_name: 'MedicationScheduleAPI', response_time_ms: 210, status_code: 200, records_returned: 0 },
        { api_name: 'CaregiverDispatchAPI', response_time_ms: 6200, status_code: 504, records_returned: 0 },
        { api_name: 'AuthTokenService', response_time_ms: 95, status_code: 401, records_returned: 0 },
        { api_name: 'HealthRecordsSyncAPI', response_time_ms: 340, status_code: 200, records_returned: 18 },
      ];

      const res = await fetch('/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      });
      const data = await res.json();
      showToast(`Batch completed: ${data.data.anomalies_detected} anomalies recorded.`);
      loadDashboardData();
    } catch (err) {
      showToast(`Batch run failed: ${err.message}`);
    }
  });

  // Filter tabs
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadAlerts();
    });
  });

  // Preset buttons
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      const data = PRESETS[presetKey];
      if (data) {
        document.getElementById('input-api-name').value = data.api_name;
        document.getElementById('input-status-code').value = data.status_code;
        document.getElementById('input-latency').value = data.response_time_ms;
        document.getElementById('input-records').value = data.records_returned;
        showToast(`Loaded preset: ${presetKey}`);
      }
    });
  });

  // Ingestion form submit
  const form = document.getElementById('simulator-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      api_name: document.getElementById('input-api-name').value.trim(),
      status_code: parseInt(document.getElementById('input-status-code').value, 10),
      response_time_ms: parseInt(document.getElementById('input-latency').value, 10),
      records_returned: parseInt(document.getElementById('input-records').value, 10),
    };

    try {
      const res = await fetch('/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        if (result.data.has_anomaly) {
          showToast(`⚠️ Anomaly detected for ${payload.api_name}!`);
        } else {
          showToast(`✅ Operational telemetry recorded for ${payload.api_name}.`);
        }
        loadDashboardData();
      } else {
        showToast(`Error: ${result.error}`);
      }
    } catch (err) {
      showToast(`Ingestion failed: ${err.message}`);
    }
  });
}

async function loadDashboardData() {
  await Promise.all([loadMetricsSummary(), loadAlerts()]);
}

async function loadMetricsSummary() {
  try {
    const res = await fetch('/metrics/summary');
    const json = await res.json();
    if (!json.success) return;

    const s = json.data;
    document.getElementById('stat-total-calls').textContent = s.totalCalls.toLocaleString();
    document.getElementById('stat-critical-count').textContent = s.criticalAnomalies.toLocaleString();
    document.getElementById('stat-active-count').textContent = s.activeAnomalies.toLocaleString();
    document.getElementById('stat-avg-latency').textContent = `${s.avgResponseTime} ms`;

    // Render API Table
    const tbody = document.getElementById('api-table-body');
    if (!s.apis || s.apis.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No endpoint telemetry recorded yet. Run a batch or send a metric!</td></tr>`;
      return;
    }

    tbody.innerHTML = s.apis
      .map((api) => {
        const isProblem = api.anomaly_count > 0;
        const statusBadge = isProblem
          ? `<span class="badge badge-CRITICAL">Degraded</span>`
          : `<span class="badge badge-resolved">Healthy</span>`;

        return `
        <tr>
          <td><strong style="color: #fff;">${escapeHtml(api.api_name)}</strong></td>
          <td>${api.total_requests}</td>
          <td>
            <span style="color: ${api.success_rate < 90 ? 'var(--critical)' : 'var(--success)'}; font-weight: 600;">
              ${api.success_rate}%
            </span>
          </td>
          <td>${api.avg_latency_ms} ms</td>
          <td>
            <span style="color: ${api.anomaly_count > 0 ? 'var(--critical)' : 'var(--text-muted)'}; font-weight: 600;">
              ${api.anomaly_count}
            </span>
          </td>
          <td>${statusBadge}</td>
        </tr>
      `;
      })
      .join('');
  } catch (err) {
    console.error('Error fetching metrics summary:', err);
  }
}

async function loadAlerts() {
  const container = document.getElementById('alerts-container');
  try {
    let url = '/alerts?limit=50';
    if (currentFilter === 'active') {
      url += '&status=active';
    } else if (currentFilter === 'resolved') {
      url += '&status=resolved';
    } else if (['CRITICAL', 'HIGH', 'MEDIUM'].includes(currentFilter)) {
      url += `&severity=${currentFilter}`;
    }

    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    const alerts = json.data;
    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
          <div style="font-weight: 600;">No alerts matching filter "${currentFilter}"</div>
          <div style="font-size: 0.8rem; margin-top: 0.25rem;">Everything is operating within healthy parameters.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = alerts
      .map((alert) => {
        const isResolved = alert.status === 'resolved';
        return `
        <div class="alert-card ${alert.severity} ${isResolved ? 'resolved' : ''}" id="alert-card-${alert.id}">
          <div class="alert-card-top">
            <div class="alert-header-info">
              <span class="badge badge-${alert.severity}">${alert.severity}</span>
              <span class="badge ${isResolved ? 'badge-resolved' : 'badge-HIGH'}">${alert.status.toUpperCase()}</span>
              <span class="api-badge">${escapeHtml(alert.api_name)}</span>
              <span class="alert-time">${formatDate(alert.created_at)}</span>
            </div>
            ${
              !isResolved
                ? `<button class="btn btn-resolve" onclick="resolveAlert(${alert.id})">✔ Resolve Alert</button>`
                : `<span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">Resolved</span>`
            }
          </div>

          <div class="alert-headline">${escapeHtml(alert.ai_alert)}</div>
          
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            <strong>Detected Trigger:</strong> ${escapeHtml(alert.description)}
          </div>

          <div class="ai-diagnosis-box">
            <div class="ai-header">
              <span>🤖 AI Diagnostic Root Cause</span>
            </div>
            <div class="ai-content">
              ${escapeHtml(alert.ai_analysis || 'No detailed analysis generated.')}
            </div>
            <div class="ai-action">
              <strong>💡 Suggested Action:</strong> ${escapeHtml(alert.suggested_action || 'Review API logs.')}
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color: var(--critical);">Failed to load alerts: ${err.message}</div>`;
  }
}

window.resolveAlert = async function (id) {
  try {
    const res = await fetch(`/alerts/${id}/resolve`, { method: 'PATCH' });
    const json = await res.json();
    if (json.success) {
      showToast(`Alert #${id} marked as resolved!`);
      loadDashboardData();
    } else {
      showToast(`Error: ${json.error}`);
    }
  } catch (err) {
    showToast(`Failed to resolve alert: ${err.message}`);
  }
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}
