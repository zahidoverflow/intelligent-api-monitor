import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/config.js';

const SYSTEM_PROMPT = `You are an expert SRE and Senior API Reliability Engineer.
You analyze API telemetry metrics (response time, HTTP status code, records returned) and detected anomalies.
Your goal is to generate:
1. "ai_alert": A clear, urgent, 1-2 sentence human-readable alert message suitable for PagerDuty or Slack.
2. "ai_analysis": A technical diagnosis of the likely root cause (e.g., database connection pool exhaustion, unindexed query, upstream timeout, token expiration, schema drift).
3. "suggested_action": 1-2 concrete, prioritized troubleshooting and remediation steps for on-call engineers.

Respond STRICTLY in valid JSON matching this schema:
{
  "ai_alert": "...",
  "ai_analysis": "...",
  "suggested_action": "..."
}`;

export class AiAlertService {
  /**
   * Generates AI-powered diagnostic alert for an anomaly
   */
  static async generateAlert(metric, anomaly) {
    const key = config.ai.geminiApiKey;
    if (key && key !== 'your_gemini_api_key_here' && key.trim().length > 10) {
      try {
        return await this.callGemini(metric, anomaly);
      } catch (err) {
        console.warn(`[AI Alert] Gemini API call failed (${err.message}). Falling back to heuristic engine.`);
      }
    }

    return this.generateHeuristicAlert(metric, anomaly);
  }

  /**
   * Invokes Google Gemini API
   */
  static async callGemini(metric, anomaly) {
    const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.ai.model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const prompt = `API Health Telemetry:
- API Name: ${metric.api_name}
- Response Time: ${metric.response_time_ms} ms
- HTTP Status Code: ${metric.status_code}
- Records Returned: ${metric.records_returned}
- Detected Anomaly: ${anomaly.anomaly_type} (${anomaly.severity})
- Anomaly Detail: ${anomaly.description}

Analyze this incident and generate the required JSON alert.`;

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: prompt },
    ]);

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return {
      ai_alert: parsed.ai_alert,
      ai_analysis: parsed.ai_analysis,
      suggested_action: parsed.suggested_action,
    };
  }

  /**
   * Expert Heuristic Diagnostic Engine (Offline / Safe Fallback)
   */
  static generateHeuristicAlert(metric, anomaly) {
    const { api_name, response_time_ms, status_code, records_returned } = metric;
    const type = anomaly.anomaly_type;

    if (type === 'GATEWAY_TIMEOUT') {
      return {
        ai_alert: `CRITICAL: ${api_name} timed out with HTTP ${status_code} after ${response_time_ms}ms and 0 records returned. Upstream gateway or downstream service unresponsive.`,
        ai_analysis: `The reverse proxy or ingress gateway timed out waiting for the ${api_name} backend service. Typically caused by thread starvation, hanging database locks, or microservice cascade failures.`,
        suggested_action: `Check downstream service health, verify backend pod/container logs, and review upstream gateway timeout limits.`,
      };
    }

    if (type === 'SERVER_ERROR') {
      return {
        ai_alert: `${api_name} failed with status ${status_code} and returned ${records_returned} records. Possible service outage, uncaught exception, or database connectivity failure.`,
        ai_analysis: `Internal server failure on ${api_name}. No data was delivered to consumers. High risk of breaking dependent client workflows and patient operational pipelines.`,
        suggested_action: `Inspect application error logs for unhandled stack traces, check database connection pool saturation, and restart failing replicas if necessary.`,
      };
    }

    if (type === 'AUTHENTICATION_FAILURE') {
      return {
        ai_alert: `SECURITY ALERT: ${api_name} rejected authentication with HTTP ${status_code}. API consumer access blocked.`,
        ai_analysis: `Authentication or authorization failure. Likely caused by an expired OAuth/JWT token, rotated API keys, or invalidated service credentials.`,
        suggested_action: `Verify service account token refresh mechanism, review credential rotation logs, and check identity provider status.`,
      };
    }

    if (type === 'CLIENT_ERROR') {
      return {
        ai_alert: `CLIENT ERROR: ${api_name} responded with client error HTTP ${status_code}. Request invalid or malformed.`,
        ai_analysis: `API rejected client payload. Likely caused by frontend/backend schema mismatch, missing required headers, or malformed parameters.`,
        suggested_action: `Inspect client payload validation schemas and inspect API gateway request logs.`,
      };
    }

    if (type === 'CRITICAL_LATENCY') {
      return {
        ai_alert: `LATENCY ALERT: ${api_name} response time severely degraded to ${response_time_ms}ms (threshold: ${config.thresholds.latencyCriticalMs}ms) with ${records_returned} records.`,
        ai_analysis: `Severe latency indicates database table lock, unindexed query execution under high volume, or CPU/memory throttling on the hosting node.`,
        suggested_action: `Analyze database slow-query logs, inspect CPU/memory utilization of the service cluster, and enable query profiling.`,
      };
    }

    if (type === 'HIGH_LATENCY') {
      return {
        ai_alert: `WARNING: ${api_name} latency elevated to ${response_time_ms}ms (threshold: ${config.thresholds.latencyWarningMs}ms). Response degradation detected.`,
        ai_analysis: `Moderate response delay. If load increases, response times may compound and cross the critical threshold.`,
        suggested_action: `Monitor network ingress metrics, verify cache hit ratio, and prepare autoscaling rules.`,
      };
    }

    if (type === 'ZERO_RECORDS_EMPTY_PAYLOAD') {
      return {
        ai_alert: `DATA INTEGRITY WARNING: ${api_name} returned HTTP 200 OK but delivered 0 records. Silent empty dataset condition.`,
        ai_analysis: `Although the endpoint responded normally, returning 0 records for an active operational endpoint may indicate broken database filters, query regression, or data pipeline lag.`,
        suggested_action: `Validate ETL ingestion pipeline, test database query parameters manually, and verify if upstream data sync is delayed.`,
      };
    }

    return {
      ai_alert: `${api_name} triggered an anomaly: ${anomaly.description}`,
      ai_analysis: `Behavior deviated from expected baseline metrics.`,
      suggested_action: `Review recent deployments and monitor endpoint metrics over the next 15 minutes.`,
    };
  }
}
