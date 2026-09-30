# Video Walkthrough Script: Intelligent API Monitoring & Alert System

**Target Duration:** 3 - 5 Minutes  
**Presenter:** Zahidul Islam  
**Screen Setup:** 
1. Browser window open to `http://localhost:4000` (PulseGuard AI Dashboard)
2. Terminal window open to `/mnt/data/Git/intelligent-api-monitor`
3. Code editor (VS Code / IDE) showing project folder structure

---

## ⏱️ Timeline & Segment Breakdown

### Segment 1: Introduction & Task Breakdown (0:00 - 0:45)
**Visual:** Webcam / Intro slide + Dashboard overview.

**Talking Points:**
> "Hi everyone, I'm Zahidul Islam, and today I'm excited to present my solution for the **Intelligent API Monitoring & Alert System** — named **PulseGuard AI**."
> 
> "When approaching this challenge, I broke down the requirements into three core engineering pillars:
> 1. **Robust Anomaly Detection:** We needed to detect not just obvious 500 server crashes, but subtle anomalies like gateway timeouts, severe latency degradation, and critical silent failures — such as when an endpoint returns HTTP 200 OK but unexpectedly drops to zero records.
> 2. **Actionable AI Diagnostics:** Rather than sending noisy error dumps to on-call engineers, we needed an SRE-level intelligence layer that produces clear alerts, probable root-cause diagnoses, and immediate remediation steps.
> 3. **Production-Ready Observability:** Delivering this with a zero-configuration SQLite backend, full REST API endpoints, a CLI batch processor, and an interactive dark-mode dashboard with built-in simulation presets."

---

### Segment 2: Architecture & Key Design Decisions (0:45 - 1:45)
**Visual:** VS Code displaying `src/` folder and `AnomalyDetector.js`.

**Talking Points:**
> "Let's take a look under the hood at our architecture.
> 
> - **Ingestion Pipeline (`/monitor`):** The system accepts both single telemetry events and bulk arrays. This allows real microservices or batch pipelines to stream metrics without friction.
> - **Multi-Tier Detection Engine (`src/services/anomalyDetector.js`):** We evaluate metrics against dual-tier latency thresholds — warning at 1500 milliseconds and critical at 4000 milliseconds — alongside HTTP status categorization and zero-record payload detection.
> - **Dual AI & Heuristic Reliability Engine (`src/services/aiAlertService.js`):** A key design decision was ensuring high availability. We integrated **Google Gemini 1.5 Flash** with strict JSON schema outputs. However, if an API key is missing or external rate limits hit, our deterministic **Heuristic Fallback Engine** seamlessly takes over. The system never crashes or hangs, guaranteeing 100% operational uptime.
> - **Zero-Config Storage (`better-sqlite3`):** We chose SQLite in WAL mode for persistent, instantaneous local storage requiring zero Docker or database server setup for any reviewer."

---

### Segment 3: How AI Was Leveraged During Development (1:45 - 2:30)
**Visual:** Showing `AI_Prompts.md` / `AI_Prompts.docx`.

**Talking Points:**
> "Regarding my use of AI during development:
> - I utilized AI as an architectural co-pilot to iterate on edge-case taxonomy and structure our prompt engineering strategy.
> - For runtime inference, we formulated a strict SRE role prompt that transforms raw metric parameters into structured JSON with three precise keys: `ai_alert`, `ai_analysis`, and `suggested_action`.
> - All system prompts, runtime templates, and engineering prompts have been thoroughly documented in `AI_Prompts.docx` and `AI_Prompts.md` as requested in the task guidelines."

---

### Segment 4: Live Demonstration & Simulation (2:30 - 4:00)
**Visual:** Browser Dashboard (`http://localhost:4000`).

**Talking Points:**
> "Now let's jump into a live demonstration.
> 
> 1. **Metrics & Health Table:** Here at the top, you can see our live KPI cards: Total Monitored Calls, Critical Incidents, Active Anomalies, and Average Response Latency. Below, our Endpoint Health table calculates real-time success rates and marks degraded services.
> 2. **Batch Ingestion:** Clicking **'Run Sample Batch'** triggers our batch processor against our sample dataset. You can see the alerts immediately populate in real-time.
> 3. **AI Alert Cards:** Looking at this AppointmentAPI alert, we see:
>    - Severity tag: **CRITICAL**
>    - Human alert: Explaining that the service crashed with status 500.
>    - AI Root Cause: Highlighting potential database connection pool exhaustion.
>    - Suggested Action: Recommending inspecting container logs and checking DB pool metrics.
> 4. **One-Click Incident Resolution:** Clicking **'Resolve Alert'** updates the status in SQLite and dynamically marks the card as resolved.
> 5. **Interactive Simulator:** On the right panel, we can simulate real-world failure modes. If I click **'Silent 0 Records Drop'** and hit Ingest, the system detects that HTTP 200 returned 0 records and alerts us to a possible broken data pipeline.
> 6. **CLI Batch Runner:** Over in the terminal, running `npm run batch` executes the command-line evaluation with formatted terminal outputs, and `npm test` runs our automated test suite with 100% passing tests."

---

### Segment 5: Conclusion & Wrap-Up (4:00 - 4:30)
**Visual:** Return to camera / README on GitHub.

**Talking Points:**
> "In summary, PulseGuard AI delivers an end-to-end, resilient monitoring solution that bridges raw telemetry and actionable engineering remediation through AI.
> 
> The entire codebase, setup instructions, automated tests, and documentation are available in the GitHub repository.
> 
> Thank you for your time, and I look forward to your feedback!"
