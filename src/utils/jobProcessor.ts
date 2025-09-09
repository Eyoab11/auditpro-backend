// src/utils/jobProcessor.ts
// Removed circular import - will use dynamic imports instead

import axios from 'axios';

interface Job {
  id: string;
  type: 'audit';
  data: {
    jobId: string;
    url: string;
  };
  createdAt: Date;
  retries: number;
}

export class JobProcessor {
  private static jobQueue: Job[] = [];
  private static isProcessing = false;
  private static maxRetries = 3;
  private static pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

  static addAuditJob(jobId: string, url: string): void {
    const job: Job = {
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

  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log('🔄 Starting job queue processing...');

    while (this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      if (!job) continue;

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

      } catch (error: any) {
        console.error(`❌ Job ${job.id} failed:`, error.message);

        job.retries++;

        if (job.retries < this.maxRetries) {
          console.log(`🔄 Retrying job ${job.id} (attempt ${job.retries + 1}/${this.maxRetries})`);
          // Add back to queue with delay
          setTimeout(() => {
            this.jobQueue.unshift(job);
          }, 5000 * job.retries); // Exponential backoff
        } else {
          console.error(`💀 Job ${job.id} failed permanently after ${this.maxRetries} retries`);

          // Mark job as failed in database
          if (job.type === 'audit') {
            try {
              const AuditJob = (await import('../models/AuditJob')).default;
              await AuditJob.findByIdAndUpdate(job.data.jobId, {
                status: 'failed',
                errorMessage: `Job processing failed after ${this.maxRetries} retries: ${error.message}`,
                updatedAt: new Date()
              });
            } catch (dbError) {
              console.error('Failed to update job status in database:', dbError);
            }
          }
        }
      }
    }

    this.isProcessing = false;
    console.log('🏁 Job queue processing completed');
  }

  private static async processAuditJob(job: Job): Promise<void> {
    const { jobId, url } = job.data;

    // Use dynamic imports to avoid circular dependency
    const { PuppeteerService } = await import('../services/puppeteerService');
    const AuditJob = (await import('../models/AuditJob')).default;

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

    } catch (error: any) {
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

  private static async callPythonAnalysis(auditData: any): Promise<any> {
    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/analyze-audit-data`,
        auditData,
        {
          timeout: 30000, // 30 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
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

  private static processEnhancedResults(auditData: any, analysisResult: any): any {
    // Combine basic processing with Python analysis results
    const basicResults = this.processAuditResults(auditData);

    // Enhanced results from Python service
    const findings = analysisResult.auditFindings || [];
    const perf = analysisResult.performanceScores || {};
    const processedTags = analysisResult.processedTags || [];

    const healthScore = this.calculateHealthScore({ findings, perf, tags: processedTags });

    return {
      ...basicResults,
      healthScore,
      analysis: {
        summary: analysisResult.auditSummary || {},
        findings,
        processedTags,
        performanceScores: perf
      },
      metadata: {
        processedByPython: true,
        analysisTimestamp: analysisResult.analysisTimestamp,
        processingTimeMs: analysisResult.processingTimeMs
      }
    };
  }

  private static processAuditResults(auditData: any): any {
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
      scripts: (auditData.detectedScripts || []).filter((script: any) =>
        script.src?.includes('googletagmanager') ||
        script.src?.includes('google-analytics') ||
        script.src?.includes('facebook') ||
        script.src?.includes('linkedin') ||
        script.src?.includes('tiktok')
      ),
      network: (auditData.networkRequests || []).slice(0, 50) // Limit to first 50 requests
    };

    return results;
  }

  private static calculateHealthScore(input: { findings: any[]; perf: any; tags: any[] }): number {
    // Start from 100, subtract penalties
    let score = 100;
    const { findings, perf, tags } = input;

    // Penalties based on findings severity
    findings.forEach(f => {
      switch (f.severity) {
        case 'high': score -= 20; break;
        case 'medium': score -= 12; break;
        case 'low': score -= 5; break;
        default:
          if (f.type === 'issue') score -= 10;
          else if (f.type === 'warning') score -= 6;
      }
    });

    // Performance penalties
    const load = perf.loadTimeMs || 0;
    if (load > 8000) score -= 25; else if (load > 5000) score -= 15; else if (load > 3500) score -= 8; else if (load > 2500) score -= 4;
    const lcp = perf.largestContentfulPaintMs || 0;
    if (lcp > 6000) score -= 15; else if (lcp > 4000) score -= 10; else if (lcp > 2500) score -= 5;
    const cls = perf.cumulativeLayoutShift;
    if (typeof cls === 'number') {
      if (cls > 0.4) score -= 10; else if (cls > 0.25) score -= 6; else if (cls > 0.1) score -= 3;
    }

    // Reward for presence of core tracking tags (up to +5)
    const tagNames = new Set(tags.map((t: any) => t.name));
    let bonus = 0;
    if (tagNames.has('Google Analytics 4')) bonus += 2;
    if (tagNames.has('Google Tag Manager')) bonus += 1;
    if (tagNames.has('Meta Pixel')) bonus += 1;
    if (tagNames.has('LinkedIn Insight Tag') || tagNames.has('Twitter Pixel')) bonus += 1;
    score += Math.min(bonus, 5);

    // Clamp and round
    score = Math.max(1, Math.min(100, Math.round(score)));
    return score;
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
