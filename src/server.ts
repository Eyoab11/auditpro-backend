// src/server.ts
import app from './app';
import connectDB from './config/database';

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 AuditPro Backend Server running on port ${PORT}`);
  console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error, promise) => {
  console.log(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.log(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

export default server;
