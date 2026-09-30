import nodemailer from 'nodemailer';
import { config } from '../config/config.js';

export class EmailNotifier {
  static transporter = null;

  static getTransporter() {
    if (!this.transporter && config.email.enabled && config.email.user) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }
    return this.transporter;
  }

  /**
   * Dispatches an anomaly alert email if enabled
   */
  static async sendAlertEmail(metric, anomaly) {
    if (!config.email.enabled || !config.email.recipient) {
      return { sent: false, reason: 'Email alerting is disabled in configuration' };
    }

    try {
      const transporter = this.getTransporter();
      if (!transporter) {
        return { sent: false, reason: 'SMTP transporter not configured' };
      }

      const subject = `[${anomaly.severity}] API Alert: ${anomaly.api_name} - ${anomaly.anomaly_type}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: ${anomaly.severity === 'CRITICAL' ? '#d32f2f' : '#f57c00'}; color: white; padding: 16px;">
            <h2 style="margin: 0;">${subject}</h2>
          </div>
          <div style="padding: 20px; color: #333;">
            <p><strong>API Endpoint:</strong> ${metric.api_name}</p>
            <p><strong>HTTP Status:</strong> ${metric.status_code}</p>
            <p><strong>Latency:</strong> ${metric.response_time_ms} ms</p>
            <p><strong>Records:</strong> ${metric.records_returned}</p>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <p><strong>AI Alert Summary:</strong></p>
            <blockquote style="background: #f9f9f9; padding: 12px; border-left: 4px solid #00bcd4; margin: 0 0 16px 0;">
              ${anomaly.ai_alert}
            </blockquote>
            <p><strong>AI Diagnosis:</strong></p>
            <p>${anomaly.ai_analysis || 'N/A'}</p>
            <p><strong>Recommended Action:</strong></p>
            <p>${anomaly.suggested_action || 'N/A'}</p>
          </div>
        </div>
      `;

      const info = await transporter.sendMail({
        from: `"API Monitor" <${config.email.user}>`,
        to: config.email.recipient,
        subject,
        html,
      });

      console.log(`[Email Alert] Dispatched notification to ${config.email.recipient} (Message ID: ${info.messageId})`);
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Email Alert] Error sending alert email: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
}
