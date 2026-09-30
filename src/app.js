import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitorRouter } from './routes/monitorRoutes.js';
import { alertRouter } from './routes/alertRoutes.js';
import { metricRouter } from './routes/metricRoutes.js';

import { INDEX_HTML, STYLE_CSS, APP_JS } from './views/staticAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend UI statically if files exist on disk
app.use(express.static(path.join(__dirname, '../public')));

// Explicit frontend routes (works across local and serverless with 0 filesystem dependencies)
app.get(['/', '/index.html'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(INDEX_HTML);
});

app.get('/css/style.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.send(STYLE_CSS);
});

app.get('/js/app.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(APP_JS);
});

// API Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Intelligent API Monitoring & Alert System',
  });
});

// Routes
app.use('/monitor', monitorRouter);
app.use('/alerts', alertRouter);
app.use('/metrics', metricRouter);

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/monitor') || req.path.startsWith('/alerts') || req.path.startsWith('/metrics')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  next();
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});
