import { app } from './src/app.js';
import { config } from './src/config/config.js';

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(` 🚀 Intelligent API Monitoring & Alert System Started`);
  console.log(` 🌐 Dashboard UI : http://localhost:${config.port}`);
  console.log(` 📡 Health Check : http://localhost:${config.port}/health`);
  console.log(` 📥 Ingest Telemetry: POST http://localhost:${config.port}/monitor`);
  console.log(` 🔔 Active Alerts : GET http://localhost:${config.port}/alerts`);
  console.log(` 📊 Metrics API  : GET http://localhost:${config.port}/metrics/summary`);
  console.log(`=======================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
