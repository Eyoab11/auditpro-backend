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
  // Defaults can be tuned via environment variables without code changes
  private static getMaxRetries(): number { return Number(process.env.MAX_RETRIES) || 5; }
  private static getBaseBackoffMs(): number { return Number(process.env.BASE_BACKOFF_MS) || 5000; }
  private static getRateLimitBackoffBaseMs(): number { return Number(process.env.RATE_LIMIT_BACKOFF_BASE_MS) || 15000; }
  private static getRateLimitBackoffMaxMs(): number { return Number(process.env.RATE_LIMIT_BACKOFF_MAX_MS) || 120000; }
  // Keep initial value but prefer dynamic lookup each call in case env injected after start
  private static initialPythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
  // Global rate-limit cooldown until timestamp (ms since epoch)
  private static rateLimitUntil: number | null = null;

  private static getPythonServiceUrl(): string {
    const envUrl = process.env.PYTHON_SERVICE_URL;
    return (envUrl && envUrl.trim().length > 0 ? envUrl.trim() : this.initialPythonServiceUrl).replace(/\/$/, '');
  }
  private static getGlobalCooldownMs(): number { return Number(process.env.RATE_LIMIT_GLOBAL_COOLDOWN_MS) || 60000; }
  private static addJitter(ms: number): number {
    const delta = Math.floor(ms * 0.2); // ±20%
    const jitter = Math.floor((Math.random() * 2 - 1) * delta);
    return Math.max(1000, ms + jitter);
  }

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
        const isRateLimit = !!(error as any)?.isRateLimit;
        const retryAfterSeconds = (error as any)?.retryAfterSeconds as number | undefined;
        if (isRateLimit) {
          const waitMsg = typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
            ? `${retryAfterSeconds}s`
            : `${Math.min(120, 15 * Math.max(1, job.retries))}s (no Retry-After)`;
          console.warn(`⏳ Job ${job.id} rate-limited by Python service (429). Will retry after ${waitMsg}.`);
        } else {
          console.error(`❌ Job ${job.id} failed:`, error.message);
        }
        // If error flagged as unrecoverable, don't retry
        if ((error as any)?.noRetry) {
          job.retries = this.getMaxRetries(); // force stop
          console.log(`⛔ Not retrying job ${job.id} due to unrecoverable error.`);
        } else {
          // increment retry counter (will be used to limit attempts)
          job.retries++;
        }

        if (job.retries < this.getMaxRetries()) {
          // base exponential/backoff delay (ms)
          let retryDelayMs = this.getBaseBackoffMs() * job.retries;
          if (isRateLimit) {
            if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
              retryDelayMs = retryAfterSeconds * 1000;
            } else {
              // longer backoff for unknown Retry-After (guarded, capped)
              retryDelayMs = Math.min(this.getRateLimitBackoffMaxMs(), this.getRateLimitBackoffBaseMs() * job.retries);
            }
          }

          const attempt = job.retries + 1;
          if (isRateLimit) {
            console.log(`🔁 Requeue due to rate-limit: job ${job.id} (attempt ${attempt}/${this.getMaxRetries()}) in ${retryDelayMs}ms`);
          } else {
            console.log(`🔄 Retrying job ${job.id} (attempt ${attempt}/${this.getMaxRetries()}) in ${retryDelayMs}ms`);
          }
          setTimeout(() => {
            this.jobQueue.unshift(job);
            // restart processing loop after delayed re-enqueue
            this.processQueue();
          }, retryDelayMs);
        } else {
          console.error(`💀 Job ${job.id} failed permanently after ${this.getMaxRetries()} retries`);
          if (job.type === 'audit') {
            try {
              const AuditJob = (await import('../models/AuditJob')).default;
              await AuditJob.findByIdAndUpdate(job.data.jobId, {
                status: 'failed',
                errorMessage: `Job processing failed after ${this.getMaxRetries()} retries: ${error.message}`,
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
  const { preflightUrlReachability } = await import('./network');

    try {
      // Preflight DNS reachability to prevent futile Puppeteer launches
      const preflight = await preflightUrlReachability(url);
      if (!preflight.reachable) {
        console.warn(`🌐 Preflight failed for ${url}: ${preflight.reason}`);
        await AuditJob.findByIdAndUpdate(jobId, {
          status: 'failed',
          errorMessage: preflight.reason || 'Unreachable host',
          updatedAt: new Date()
        });
        const err: any = new Error(`Unreachable host: ${preflight.reason}`);
        err.noRetry = true;
        throw err;
      }

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

      // Update status to analyzing (avoid storing heavy rawScanData to reduce memory/DB churn)
      await AuditJob.findByIdAndUpdate(jobId, {
        status: 'analyzing',
        updatedAt: new Date()
      });

  console.log(`🧠 Starting Python analysis for ${url}`);
  console.log(`🔧 Using PYTHON_SERVICE_URL=${this.getPythonServiceUrl()}`);

      // If we are in a global rate-limit cooldown window, requeue before calling service
      if (this.rateLimitUntil && Date.now() < this.rateLimitUntil) {
        const remaining = Math.max(0, this.rateLimitUntil - Date.now());
        const err: any = new Error('Deferred due to global rate-limit cooldown');
        err.isRateLimit = true;
        err.retryAfterSeconds = Math.ceil(remaining / 1000);
        throw err;
      }

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
      if (error?.response) {
        console.error('Python service response status:', error.response.status);
        console.error('Python service response body:', JSON.stringify(error.response.data));
      }
      if (error?.stack) {
        console.error(error.stack.split('\n').slice(0,6).join('\n'));
      }

      // Update job with error status (if not already set by preflight)
      try {
        if ((error as any)?.isRateLimit) {
          const retryAfter = (error as any)?.retryAfterSeconds;
          await AuditJob.findByIdAndUpdate(jobId, {
            status: 'analyzing',
            errorMessage: `Rate limited by analysis service. Will retry${typeof retryAfter === 'number' ? ` in ~${retryAfter}s` : ' shortly'}...`,
            updatedAt: new Date()
          });
        } else {
          await AuditJob.findByIdAndUpdate(jobId, {
            status: 'failed',
            errorMessage: error.message,
            updatedAt: new Date()
          });
        }
      } catch (dbErr) {
        console.error('Failed to persist failure status:', (dbErr as any)?.message);
      }

      throw error;
    }
  }

  private static async callPythonAnalysis(auditData: any): Promise<any> {
    try {
      const base = this.getPythonServiceUrl();
      const url = `${base}/analyze-audit-data`;
      console.log(`➡️  Posting audit payload to Python service: ${url}`);
      console.log(`📦 Payload size ~${JSON.stringify(auditData).length} bytes`);
      const response = await axios.post(url, auditData, {
        timeout: 40000,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: s => s < 500 // surface 4xx for logging
      });

      if (response.status === 429) {
        // construct a specialized error so callers can inspect rate-limit info
        const err: any = new Error(`Python analysis HTTP 429: ${JSON.stringify(response.data).slice(0,400)}`);
        err.isRateLimit = true;
        // honor Retry-After if provided (seconds or HTTP-date)
        const retryAfter = response.headers?.['retry-after'];
        if (retryAfter) {
          const parsed = Number(retryAfter);
          if (!Number.isNaN(parsed)) {
            err.retryAfterSeconds = parsed;
          } else {
            // try HTTP-date parse
            const date = Date.parse(String(retryAfter));
            if (!Number.isNaN(date)) {
              err.retryAfterSeconds = Math.max(0, Math.ceil((date - Date.now()) / 1000));
            }
          }
        }
        // Set global cooldown if Retry-After missing
        if (typeof err.retryAfterSeconds !== 'number') {
          this.rateLimitUntil = Date.now() + this.getGlobalCooldownMs();
        } else {
          this.rateLimitUntil = Date.now() + err.retryAfterSeconds * 1000;
        }
        throw err;
      }

      if (response.status >= 400) {
        throw new Error(`Python analysis HTTP ${response.status}: ${JSON.stringify(response.data).slice(0,400)}`);
      }

      return response.data;
    } catch (error: any) {
      // If a previous layer already marked this as rate-limited, bubble it up untouched
      if (error?.isRateLimit) {
        throw error;
      }
      console.error('Python analysis service error:', error.message);
      if (error?.response) {
        console.error('Raw response status:', error.response.status);
        console.error('Raw response body:', JSON.stringify(error.response.data));
        // if rate limited, surface special flags
        if (error.response.status === 429) {
          const rateErr: any = new Error(`Python analysis HTTP 429: ${JSON.stringify(error.response.data).slice(0,400)}`);
          rateErr.isRateLimit = true;
          const retryAfter = error.response.headers?.['retry-after'];
          if (retryAfter) {
            const parsed = Number(retryAfter);
            if (!Number.isNaN(parsed)) rateErr.retryAfterSeconds = parsed;
            else {
              const date = Date.parse(String(retryAfter));
              if (!Number.isNaN(date)) rateErr.retryAfterSeconds = Math.max(0, Math.ceil((date - Date.now()) / 1000));
            }
          }
          if (typeof rateErr.retryAfterSeconds !== 'number') {
            this.rateLimitUntil = Date.now() + this.getGlobalCooldownMs();
          } else {
            this.rateLimitUntil = Date.now() + rateErr.retryAfterSeconds * 1000;
          }
          throw rateErr;
        }
      }

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Python analysis service is not available. Please ensure the Python service is running.');
      }

      if (error.response) {
        throw new Error(`Python analysis failed: ${error.response.data?.message || error.response.statusText}`);
      }
      // Infer rate-limit from message when axios did not populate response
      const msg = String(error?.message || '');
      if (msg.includes('HTTP 429')) {
        const rateErr: any = new Error(msg);
        rateErr.isRateLimit = true;
        // Set default cooldown when we can’t parse Retry-After
        this.rateLimitUntil = Date.now() + this.getGlobalCooldownMs();
        throw rateErr;
      }

      throw new Error(`Python analysis request failed: ${msg}`);
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
