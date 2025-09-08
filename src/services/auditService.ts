// src/services/auditService.ts
import AuditJob from '../models/AuditJob';
import { JobProcessor } from '../utils/jobProcessor';
import { AuditJobResponse, AuditResultsResponse, SubmitAuditResponse } from '../types';

export class AuditService {
  static async createAuditJob(url: string, userId: string): Promise<SubmitAuditResponse> {
    try {
      const newAuditJob = new AuditJob({ url, user: userId, status: 'pending' });
      await newAuditJob.save();

      // Add to background job processor
      JobProcessor.addAuditJob(newAuditJob._id as string, url);

      return {
        msg: 'Audit job submitted successfully. Processing will begin shortly.',
        jobId: newAuditJob._id as string,
        status: newAuditJob.status,
      };
    } catch (error: any) {
      console.error('Error creating audit job:', error.message);
      throw new Error('Failed to create audit job');
    }
  }

  static async getAuditStatus(jobId: string, userId: string): Promise<AuditJobResponse> {
    try {
      const auditJob = await AuditJob.findOne({ _id: jobId, user: userId });

      if (!auditJob) {
        throw new Error('Audit job not found');
      }

      return {
        jobId: auditJob._id as string,
        url: auditJob.url,
        status: auditJob.status,
        updatedAt: auditJob.updatedAt,
        errorMessage: auditJob.errorMessage,
      };
    } catch (error: any) {
      if (error.message === 'Audit job not found') {
        throw error;
      }
      console.error('Error fetching audit status:', error.message);
      throw new Error('Failed to fetch audit status');
    }
  }

  static async getAuditResults(jobId: string, userId: string): Promise<AuditResultsResponse> {
    try {
      const auditJob = await AuditJob.findOne({ _id: jobId, user: userId });

      if (!auditJob) {
        throw new Error('Audit job not found');
      }

      if (auditJob.status !== 'completed') {
        throw new Error(`Audit job status is '${auditJob.status}'. Results are not yet available.`);
      }

      return {
        jobId: auditJob._id as string,
        url: auditJob.url,
        status: auditJob.status,
        results: auditJob.results,
        createdAt: auditJob.createdAt,
        updatedAt: auditJob.updatedAt,
      };
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('not yet available')) {
        throw error;
      }
      console.error('Error fetching audit results:', error.message);
      throw new Error('Failed to fetch audit results');
    }
  }
}
