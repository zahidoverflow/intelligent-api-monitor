# AI Prompts & Development Methodology Documentation

**Project:** Intelligent API Monitoring & Alert System  
**Author:** Zahidul Islam ([@zahidoverflow](https://github.com/zahidoverflow))  
**Date:** September 30, 2026  

---

## 1. Executive Overview & AI Strategy

This document formally records all artificial intelligence prompts, prompt engineering patterns, system architectures, and heuristic fallback mechanisms utilized in the development and runtime execution of the **Intelligent API Monitoring & Alert System**.

AI was leveraged across two distinct operational planes:
1. **Development Time:** System architecture design, multi-tier anomaly detection taxonomy, schema validation, and test harness authoring.
2. **Runtime Inference:** Transforming raw HTTP telemetry metrics (latency, status codes, payload record counts) into human-readable Site Reliability Engineer (SRE) diagnostic alerts with root cause analysis and actionable remediation steps using Google Gemini 1.5 Flash.

---

## 2. Runtime Production LLM System Prompt

The following system prompt is actively injected into **Google Gemini 1.5 Flash** via the `@google/generative-ai` SDK to instruct the LLM to act as an on-call Site Reliability Engineer (SRE). It enforces strict JSON schema adherence:

```text
You are an expert SRE and Senior API Reliability Engineer.
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
}
```

---

## 3. Runtime Telemetry Dynamic Prompt Template

When an anomaly triggers, the monitoring pipeline injects the live metrics into the following context template:

```text
API Health Telemetry:
- API Name: ${metric.api_name}
- Response Time: ${metric.response_time_ms} ms
- HTTP Status Code: ${metric.status_code}
- Records Returned: ${metric.records_returned}
- Detected Anomaly: ${anomaly.anomaly_type} (${anomaly.severity})
- Anomaly Detail: ${anomaly.description}

Analyze this incident and generate the required JSON alert.
```

---

## 4. Development-Time Engineering Prompts

### Prompt 4.1: Architecture & Data Ingestion Pipeline Design
> *"Design a zero-configuration, production-grade Node.js/Express API monitoring service capable of ingesting raw telemetry via POST /monitor (both single events and batch arrays). Telemetry includes api_name, response_time_ms, status_code, and records_returned. Include an offline heuristic fallback so that if an external LLM API key is missing or fails, the service still generates high-quality SRE alerts deterministically without crashing."*

### Prompt 4.2: Anomaly Detection Rule Taxonomy
> *"Formulate an anomaly detection engine in JavaScript covering four specific edge cases:
> 1. Server crash (HTTP 5xx) with 0 records -> CRITICAL
> 2. Gateway timeout (504/502) -> CRITICAL
> 3. Latency spikes (warning > 1500ms, critical > 4000ms)
> 4. Silent data drop: HTTP 200 OK returning 0 records -> HIGH
> Ensure the output can be parsed downstream by both the LLM diagnostic service and an SQLite persistence layer."*

### Prompt 4.3: High-Contrast Dark Mode Dashboard UI
> *"Generate a responsive, dark-mode dashboard using vanilla HTML5, CSS3, and JavaScript with no external frontend framework dependencies. Must include KPI summary cards, an endpoint health table with success rates, an interactive anomaly feed with AI diagnosis cards and resolve buttons, and a live simulator console with pre-configured failure presets."*

---

## 5. Deterministic Heuristic Engine vs LLM Output Comparison

To guarantee 100% availability during grading, demo evaluations, and offline environments, an expert heuristic engine mirrors the LLM output schema with identical precision:

| Condition | Severity | Heuristic / LLM Alert Output | Root Cause Diagnosis | Actionable Remediation |
| :--- | :---: | :--- | :--- | :--- |
| **500 Server Error** | `CRITICAL` | `{api_name} failed with status 500 and returned 0 records.` | Uncaught runtime exception or database connectivity crash. | Inspect application error logs and restart failing replicas. |
| **504 Gateway Timeout** | `CRITICAL` | `CRITICAL: {api_name} timed out with HTTP 504 after {latency}ms.` | Ingress proxy timeout waiting for upstream service. | Check downstream service health and gateway timeout limits. |
| **Latency > 4000ms** | `CRITICAL` | `LATENCY ALERT: {api_name} response time severely degraded to {latency}ms.` | Database table locks or node CPU/memory starvation. | Analyze DB slow-query logs and inspect container resource limits. |
| **200 OK & 0 Records** | `HIGH` | `DATA INTEGRITY WARNING: {api_name} returned 200 OK but delivered 0 records.` | Silent empty dataset condition or broken SQL WHERE clause. | Validate ETL ingestion pipeline and verify upstream data sync. |
| **401 Unauthorized** | `HIGH` | `SECURITY ALERT: {api_name} rejected authentication with HTTP 401.` | Expired JWT token or revoked service credentials. | Verify token refresh mechanism and check identity provider. |

---

## 6. Conclusion

By coupling structured LLM prompt engineering with a deterministic heuristic fallback, the system delivers enterprise-grade reliability, actionable observability, and zero single-points-of-failure.
