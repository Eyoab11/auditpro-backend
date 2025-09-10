"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
// src/services/auditService.ts
const AuditJob_1 = __importDefault(require("../models/AuditJob"));
const jobProcessor_1 = require("../utils/jobProcessor");
class AuditService {
    static async createAuditJob(url, userId) {
        try {
            const newAuditJob = new AuditJob_1.default({ url, user: userId, status: 'pending' });
            await newAuditJob.save();
            // Add to background job processor
            jobProcessor_1.JobProcessor.addAuditJob(newAuditJob._id, url);
            return {
                msg: 'Audit job submitted successfully. Processing will begin shortly.',
                jobId: newAuditJob._id,
                status: newAuditJob.status,
            };
        }
        catch (error) {
            console.error('Error creating audit job:', error.message);
            throw new Error('Failed to create audit job');
        }
    }
    static async getAuditStatus(jobId, userId) {
        try {
            const auditJob = await AuditJob_1.default.findOne({ _id: jobId, user: userId });
            if (!auditJob) {
                throw new Error('Audit job not found');
            }
            return {
                jobId: auditJob._id,
                url: auditJob.url,
                status: auditJob.status,
                updatedAt: auditJob.updatedAt,
                errorMessage: auditJob.errorMessage,
            };
        }
        catch (error) {
            if (error.message === 'Audit job not found') {
                throw error;
            }
            console.error('Error fetching audit status:', error.message);
            throw new Error('Failed to fetch audit status');
        }
    }
    static async getAuditResults(jobId, userId) {
        try {
            const auditJob = await AuditJob_1.default.findOne({ _id: jobId, user: userId });
            if (!auditJob) {
                throw new Error('Audit job not found');
            }
            if (auditJob.status !== 'completed') {
                throw new Error(`Audit job status is '${auditJob.status}'. Results are not yet available.`);
            }
            return {
                jobId: auditJob._id,
                url: auditJob.url,
                status: auditJob.status,
                results: auditJob.results,
                createdAt: auditJob.createdAt,
                updatedAt: auditJob.updatedAt,
            };
        }
        catch (error) {
            if (error.message.includes('not found') || error.message.includes('not yet available')) {
                throw error;
            }
            console.error('Error fetching audit results:', error.message);
            throw new Error('Failed to fetch audit results');
        }
    }
    static async listUserAudits(userId, limit = 25, page = 1) {
        try {
            const skip = (page - 1) * limit;
            const [itemsRaw, total] = await Promise.all([
                AuditJob_1.default.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                AuditJob_1.default.countDocuments({ user: userId })
            ]);
            const items = itemsRaw.map(job => ({
                jobId: job._id,
                url: job.url,
                status: job.status,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                score: job.results?.healthScore ?? job.analysisData?.healthScore
            }));
            return { items, total };
        }
        catch (error) {
            console.error('Error listing audit jobs:', error.message);
            throw new Error('Failed to list audit jobs');
        }
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=auditService.js.map