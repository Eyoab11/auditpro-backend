"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const express_1 = __importDefault(require("express"));
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
// CORS middleware (improved)
// Accept multiple origins (comma-separated). Normalize by removing trailing slashes.
const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
    .map(o => o.replace(/\/$/, ''));
// Helper to decide if origin allowed
function isAllowedOrigin(origin) {
    if (!origin)
        return true; // non-browser / same-origin
    const cleaned = origin.replace(/\/$/, '');
    if (configuredOrigins.includes(cleaned))
        return true;
    // Allow localhost variants automatically in development for convenience
    if (process.env.NODE_ENV !== 'production' && /^(http:\/\/localhost:\d+)$/.test(cleaned))
        return true;
    return false;
}
app.use((req, res, next) => {
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
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'AuditPro Backend is running',
        timestamp: new Date().toISOString(),
    });
});
// Chrome availability endpoint
app.get('/chrome-status', async (req, res) => {
    try {
        const path = process.env.PUPPETEER_EXECUTABLE_PATH || 'auto';
        res.json({ success: true, path });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
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