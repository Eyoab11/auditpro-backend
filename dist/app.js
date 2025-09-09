"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import routes
const auditRoutes_1 = __importDefault(require("./routes/auditRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
// Body parser middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// CORS middleware
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
}));
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'AuditPro Backend is running',
        timestamp: new Date().toISOString(),
    });
});
// Job queue status endpoint (for monitoring)
app.get('/api/jobs/status', (req, res) => {
    const { JobProcessor } = require('./utils/jobProcessor');
    const status = JobProcessor.getQueueStatus();
    res.status(200).json({
        success: true,
        data: status,
    });
});
// API routes
app.use('/api/audit', auditRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});
// Global error handler (must be last)
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map