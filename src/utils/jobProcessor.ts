// src/utils/jobProcessor.ts
// Removed circular import - will use dynamic imports instead

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

      // Process results
      const results = this.processAuditResults(auditData);

      // Update job with results
      await AuditJob.findByIdAndUpdate(jobId, {
        status: auditData.errors ? 'failed' : 'completed',
        rawScanData: auditData,
        results: auditData.errors ? null : results,
        errorMessage: auditData.errors ? auditData.errors.join(', ') : null,
        updatedAt: new Date()
      });

      console.log(`📊 Audit completed for job ${jobId}`);

    } catch (error: any) {
      console.error(`Audit processing failed for job ${jobId}:`, error.message);
      throw error;
    }
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
