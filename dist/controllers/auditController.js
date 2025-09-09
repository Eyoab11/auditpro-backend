"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditResults = exports.getAuditStatus = exports.submitAudit = void 0;
const auditService_1 = require("../services/auditService");
const validation_1 = require("../utils/validation");
const errorHandler_1 = require("../middleware/errorHandler");
exports.submitAudit = (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
    const validation = (0, validation_1.validateAuditRequest)(req.body);
    if (!validation.isValid) {
        const response = {
            success: false,
            error: validation.error,
        };
        res.status(400).json(response);
        return;
    }
    const { url } = req.body;
    const userId = req.user?._id || req.user?.id; // Get user ID from authenticated request
    if (!userId) {
        res.status(401).json({ success: false, error: 'Not authorized' });
        return;
    }
    const result = await auditService_1.AuditService.createAuditJob(url, userId);
    const response = {
        success: true,
        data: result,
    };
    res.status(202).json(response);
});
exports.getAuditStatus = (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
    const { jobId } = req.params;
    if (!jobId) {
        const response = {
            success: false,
            error: 'Job ID is required',
        };
        res.status(400).json(response);
        return;
    }
    try {
        const currentUserId = req.user?._id || req.user?.id;
        if (!currentUserId) {
            res.status(401).json({ success: false, error: 'Not authorized' });
            return;
        }
        const result = await auditService_1.AuditService.getAuditStatus(jobId, currentUserId);
        const response = {
            success: true,
            data: result,
        };
        res.json(response);
    }
    catch (error) {
        if (error.message === 'Audit job not found') {
            const response = {
                success: false,
                error: error.message,
            };
            res.status(404).json(response);
            return;
        }
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            const response = {
                success: false,
                error: 'Invalid Job ID format',
            };
            res.status(400).json(response);
            return;
        }
        throw error;
    }
});
exports.getAuditResults = (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
    const { jobId } = req.params;
    if (!jobId) {
        const response = {
            success: false,
            error: 'Job ID is required',
        };
        res.status(400).json(response);
        return;
    }
    try {
        const currentUserId = req.user?._id || req.user?.id;
        if (!currentUserId) {
            res.status(401).json({ success: false, error: 'Not authorized' });
            return;
        }
        const result = await auditService_1.AuditService.getAuditResults(jobId, currentUserId);
        const response = {
            success: true,
            data: result,
        };
        res.json(response);
    }
    catch (error) {
        if (error.message === 'Audit job not found') {
            const response = {
                success: false,
                error: error.message,
            };
            res.status(404).json(response);
            return;
        }
        if (error.message.includes('not yet available')) {
            const response = {
                success: false,
                error: error.message,
                message: 'Results are not yet available',
            };
            res.status(409).json(response);
            return;
        }
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            const response = {
                success: false,
                error: 'Invalid Job ID format',
            };
            res.status(400).json(response);
            return;
        }
        throw error;
    }
});
//# sourceMappingURL=auditController.js.map