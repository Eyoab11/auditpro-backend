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
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'AuditPro Backend is running',
    timestamp: new Date().toISOString(),
  });
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
