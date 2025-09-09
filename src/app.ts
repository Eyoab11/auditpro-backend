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

// CORS middleware
// Normalize configured client origins (support comma-separated list) and strip trailing slashes
const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (like curl / server-to-server) with no origin
    if (!origin) return callback(null, true);
    const cleaned = origin.replace(/\/$/, '');
    if (configuredOrigins.includes(cleaned)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));

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
