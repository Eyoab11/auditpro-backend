// src/app.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import auditRoutes from './routes/auditRoutes';
import authRoutes from './routes/authRoutes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app: Application = express();

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware (improved)
// Accept multiple origins (comma-separated). Normalize by removing trailing slashes.
const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ''));

// Helper to decide if origin allowed
function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return true; // non-browser / same-origin
  const cleaned = origin.replace(/\/$/, '');
  if (configuredOrigins.includes(cleaned)) return true;
  // Allow localhost variants automatically in development for convenience
  if (process.env.NODE_ENV !== 'production' && /^(http:\/\/localhost:\d+)$/.test(cleaned)) return true;
  return false;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin.replace(/\/$/, ''));
    }
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
  // Preflight short‑circuit
  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return res.status(403).send('CORS: Origin not allowed');
    }
    return res.sendStatus(204);
  }
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ success: false, error: 'CORS: Origin not allowed', origin });
  }
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'AuditPro Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Chrome availability endpoint
app.get('/chrome-status', async (req: Request, res: Response) => {
  try {
    const path = process.env.PUPPETEER_EXECUTABLE_PATH || 'auto';
    res.json({ success: true, path });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Job queue status endpoint (for monitoring)
app.get('/api/jobs/status', (req: Request, res: Response) => {
  const { JobProcessor } = require('./utils/jobProcessor');
  const status = JobProcessor.getQueueStatus();

  res.status(200).json({
    success: true,
    data: status,
  });
});

// API routes
app.use('/api/audit', auditRoutes);
app.use('/api/auth', authRoutes);

// 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
