"use strict";
// src/utils/jobProcessor.ts
// Removed circular import - will use dynamic imports instead
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobProcessor = void 0;
const axios_1 = __importDefault(require("axios"));
class JobProcessor {
    static addAuditJob(jobId, url) {
        const job = {
            id: `audit_${jobId}_${Date.now()}`,
            type: 'audit',
            data: { jobId, url },
            createdAt: new Date(),
            retries: 0
        };
        this.jobQueue.push(job);
        console.log(`📋 Added audit job ${jobId} to queue. Queue length: ${this.jobQueue.length}`);
        // Start processing if not already running
        this.processQueue();
    }
    static async processQueue() {
        if (this.isProcessing || this.jobQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        console.log('🔄 Starting job queue processing...');
        while (this.jobQueue.length > 0) {
            const job = this.jobQueue.shift();
            if (!job)
                continue;
            try {
                console.log(`⚙️ Processing job ${job.id} (${job.type})`);
                switch (job.type) {
                    case 'audit':
                        await this.processAuditJob(job);
                        break;
                    default:
                        console.warn(`Unknown job type: ${job.type}`);
                }
                console.log(`✅ Job ${job.id} completed successfully`);
            }
            catch (error) {
                console.error(`❌ Job ${job.id} failed:`, error.message);
                job.retries++;
                if (job.retries < this.maxRetries) {
                    console.log(`🔄 Retrying job ${job.id} (attempt ${job.retries + 1}/${this.maxRetries})`);
                    // Add back to queue with delay
                    setTimeout(() => {
                        this.jobQueue.unshift(job);
                    }, 5000 * job.retries); // Exponential backoff
                }
                else {
                    console.error(`💀 Job ${job.id} failed permanently after ${this.maxRetries} retries`);
                    // Mark job as failed in database
                    if (job.type === 'audit') {
                        try {
                            const AuditJob = (await Promise.resolve().then(() => __importStar(require('../models/AuditJob')))).default;
                            await AuditJob.findByIdAndUpdate(job.data.jobId, {
                                status: 'failed',
                                errorMessage: `Job processing failed after ${this.maxRetries} retries: ${error.message}`,
                                updatedAt: new Date()
                            });
                        }
                        catch (dbError) {
                            console.error('Failed to update job status in database:', dbError);
                        }
                    }
                }
            }
        }
        this.isProcessing = false;
        console.log('🏁 Job queue processing completed');
    }
    static async processAuditJob(job) {
        const { jobId, url } = job.data;
        // Use dynamic imports to avoid circular dependency
        const { PuppeteerService } = await Promise.resolve().then(() => __importStar(require('../services/puppeteerService')));
        const AuditJob = (await Promise.resolve().then(() => __importStar(require('../models/AuditJob')))).default;
        try {
            // Update status to scanning
            await AuditJob.findByIdAndUpdate(jobId, {
                status: 'scanning',
                updatedAt: new Date()
            });
            console.log(`🔍 Starting Puppeteer audit for ${url}`);
            // Perform the audit
            const auditData = await PuppeteerService.performAudit(url, jobId);
            if (auditData.errors && auditData.errors.length > 0) {
                throw new Error(`Puppeteer scan failed: ${auditData.errors.join(', ')}`);
            }
            // Update status to analyzing
            await AuditJob.findByIdAndUpdate(jobId, {
                status: 'analyzing',
                rawScanData: auditData,
                updatedAt: new Date()
            });
            console.log(`🧠 Starting Python analysis for ${url}`);
            // Send data to Python service for analysis
            const analysisResult = await this.callPythonAnalysis(auditData);
            // Process and combine results
            const enhancedResults = this.processEnhancedResults(auditData, analysisResult);
            // Update job with enhanced results
            await AuditJob.findByIdAndUpdate(jobId, {
                status: 'completed',
                results: enhancedResults,
                analysisData: analysisResult,
                updatedAt: new Date()
            });
            console.log(`📊 Audit completed for job ${jobId} with ${analysisResult.auditFindings?.length || 0} findings`);
        }
        catch (error) {
            console.error(`Audit processing failed for job ${jobId}:`, error.message);
            // Update job with error status
            await AuditJob.findByIdAndUpdate(jobId, {
                status: 'failed',
                errorMessage: error.message,
                updatedAt: new Date()
            });
            throw error;
        }
    }
    static async callPythonAnalysis(auditData) {
        try {
            const response = await axios_1.default.post(`${this.pythonServiceUrl}/analyze-audit-data`, auditData, {
                timeout: 30000, // 30 second timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Python analysis service error:', error.message);
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Python analysis service is not available. Please ensure the Python service is running.');
            }
            if (error.response) {
                throw new Error(`Python analysis failed: ${error.response.data?.message || error.response.statusText}`);
            }
            throw new Error(`Python analysis request failed: ${error.message}`);
        }
    }
    static processEnhancedResults(auditData, analysisResult) {
        // Combine basic processing with Python analysis results
        const basicResults = this.processAuditResults(auditData);
        // Enhanced results from Python service
        return {
            ...basicResults,
            analysis: {
                summary: analysisResult.auditSummary || {},
                findings: analysisResult.auditFindings || [],
                processedTags: analysisResult.processedTags || [],
                performanceScores: analysisResult.performanceScores || {}
            },
            metadata: {
                processedByPython: true,
                analysisTimestamp: analysisResult.analysisTimestamp,
                processingTimeMs: analysisResult.processingTimeMs
            }
        };
    }
    static processAuditResults(auditData) {
        // Process raw audit data into structured results
        const results = {
            summary: {
                url: auditData.url,
                timestamp: auditData.timestamp,
                totalScripts: auditData.detectedScripts?.length || 0,
                totalTags: auditData.injectedTags?.length || 0,
                totalNetworkRequests: auditData.networkRequests?.length || 0
            },
            tags: auditData.injectedTags || [],
            performance: auditData.performanceMetrics || {},
            scripts: (auditData.detectedScripts || []).filter((script) => script.src?.includes('googletagmanager') ||
                script.src?.includes('google-analytics') ||
                script.src?.includes('facebook') ||
                script.src?.includes('linkedin') ||
                script.src?.includes('tiktok')),
            network: (auditData.networkRequests || []).slice(0, 50) // Limit to first 50 requests
        };
        return results;
    }
    // Get queue status for monitoring
    static getQueueStatus() {
        return {
            queueLength: this.jobQueue.length,
            isProcessing: this.isProcessing,
            jobs: this.jobQueue.map(job => ({
                id: job.id,
                type: job.type,
                createdAt: job.createdAt,
                retries: job.retries
            }))
        };
    }
}
exports.JobProcessor = JobProcessor;
JobProcessor.jobQueue = [];
JobProcessor.isProcessing = false;
JobProcessor.maxRetries = 3;
JobProcessor.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
//# sourceMappingURL=jobProcessor.js.map