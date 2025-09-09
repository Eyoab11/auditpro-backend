"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./config/database"));
const PORT = process.env.PORT || 5000;
// Connect to Database
(0, database_1.default)();
// Start server
const server = app_1.default.listen(PORT, () => {
    console.log(`🚀 AuditPro Backend Server running on port ${PORT}`);
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    server.close(() => {
        process.exit(1);
    });
});
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.log(`Uncaught Exception: ${err.message}`);
    process.exit(1);
});
exports.default = server;
//# sourceMappingURL=server.js.map