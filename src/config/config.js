import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  env: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || (process.env.VERCEL ? path.join('/tmp', 'monitor.db') : path.join(ROOT_DIR, 'data', 'monitor.db')),

  // Anomaly Detection Thresholds
  thresholds: {
    latencyWarningMs: parseInt(process.env.LATENCY_WARNING_MS || '1500', 10),
    latencyCriticalMs: parseInt(process.env.LATENCY_CRITICAL_MS || '4000', 10),
  },

  // AI Configuration
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  },

  // Email Alerts
  email: {
    enabled: process.env.ENABLE_EMAIL_ALERTS === 'true',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    recipient: process.env.ALERT_EMAIL_RECIPIENT || '',
  },
};
