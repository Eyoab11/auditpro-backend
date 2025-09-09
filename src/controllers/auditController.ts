// src/controllers/auditController.ts
import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { validateAuditRequest } from '../utils/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, SubmitAuditResponse, AuditJobResponse, AuditResultsResponse, AuditHistoryResponse } from '../types';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const submitAudit = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const validation = validateAuditRequest(req.body);

  if (!validation.isValid) {
    const response: ApiResponse = {
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
  const result: SubmitAuditResponse = await AuditService.createAuditJob(url, userId);

  const response: ApiResponse<SubmitAuditResponse> = {
    success: true,
    data: result,
  };

  res.status(202).json(response);
});

export const getAuditStatus = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { jobId } = req.params;

  if (!jobId) {
    const response: ApiResponse = {
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
    const result: AuditJobResponse = await AuditService.getAuditStatus(jobId, currentUserId);

    const response: ApiResponse<AuditJobResponse> = {
      success: true,
      data: result,
    };

    res.json(response);
  } catch (error: any) {
    if (error.message === 'Audit job not found') {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      };
      res.status(404).json(response);
      return;
    }

    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid Job ID format',
      };
      res.status(400).json(response);
      return;
    }

    throw error;
  }
});

export const getAuditResults = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { jobId } = req.params;

  if (!jobId) {
    const response: ApiResponse = {
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
    const result: AuditResultsResponse = await AuditService.getAuditResults(jobId, currentUserId);

    const response: ApiResponse<AuditResultsResponse> = {
      success: true,
      data: result,
    };

    res.json(response);
  } catch (error: any) {
    if (error.message === 'Audit job not found') {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      };
      res.status(404).json(response);
      return;
    }

    if (error.message.includes('not yet available')) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
        message: 'Results are not yet available',
      };
      res.status(409).json(response);
      return;
    }

    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid Job ID format',
      };
      res.status(400).json(response);
      return;
    }

    throw error;
  }
});

export const listAudits = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const currentUserId = req.user?._id || req.user?.id;
  if (!currentUserId) {
    res.status(401).json({ success: false, error: 'Not authorized' });
    return;
  }

  const limit = parseInt((req.query.limit as string) || '25', 10);
  const page = parseInt((req.query.page as string) || '1', 10);

  const result: AuditHistoryResponse = await AuditService.listUserAudits(currentUserId, limit, page);
  const response: ApiResponse<AuditHistoryResponse> = { success: true, data: result };
  res.json(response);
});

// Generate PDF report for a completed audit
export const generateAuditPdf = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { jobId } = req.params;
  const currentUserId = req.user?._id || req.user?.id;
  if (!currentUserId) {
    res.status(401).json({ success: false, error: 'Not authorized' });
    return;
  }
  if (!jobId) {
    res.status(400).json({ success: false, error: 'Job ID is required' });
    return;
  }

  // Reuse existing service to fetch results (ensures auth/ownership)
  const results: AuditResultsResponse = await AuditService.getAuditResults(jobId, currentUserId);
  if (!results || (results as any).status !== 'completed') {
    res.status(409).json({ success: false, error: 'Audit not completed yet' });
    return;
  }

  // Build simple HTML (could be improved with a template engine later)
  const audit = (results as any).audit || (results as any).results || results; // fallback
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>Audit Report ${jobId}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    h1 { color: #4B0082; }
    h2 { margin-top: 32px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
    th { background: #f5f5f5; text-align: left; }
    .badge { display:inline-block; padding:2px 6px; border-radius:4px; background:#eee; font-size:11px; }
  </style></head><body>
  <h1>Audit Report</h1>
  <p><strong>URL:</strong> ${audit.url}</p>
  <p><strong>Date:</strong> ${(audit.createdAt || audit.timestamp || new Date()).toString()}</p>
  <h2>Performance Metrics</h2>
  <table><tbody>
    ${(audit.performanceMetrics ? Object.entries(audit.performanceMetrics).map(([k,v])=>`<tr><th>${k}</th><td>${v}</td></tr>`).join('') : '<tr><td colspan="2">No metrics</td></tr>')}
  </tbody></table>
  <h2>Detected Scripts (${audit.detectedScripts?.length || 0})</h2>
  <table><thead><tr><th>Src/Type</th><th>Location</th><th>Async</th><th>Defer</th></tr></thead><tbody>
  ${(audit.detectedScripts||[]).slice(0,100).map((s:any)=>`<tr><td>${s.src || 'inline'}</td><td>${s.location||''}</td><td>${s.async}</td><td>${s.defer}</td></tr>`).join('') || '<tr><td colspan="4">None</td></tr>'}
  </tbody></table>
  <h2>Injected Tags (${audit.injectedTags?.length || 0})</h2>
  <table><thead><tr><th>Type</th><th>ID</th><th>Status</th></tr></thead><tbody>
  ${(audit.injectedTags||[]).map((t:any)=>`<tr><td>${t.type}</td><td>${t.id||t.pixelId||t.measurementId||''}</td><td>${t.status}</td></tr>`).join('') || '<tr><td colspan="3">None</td></tr>'}
  </tbody></table>
  <h2>Network Requests (${audit.networkRequests?.length || 0})</h2>
  <table><thead><tr><th>URL</th><th>Type</th><th>Initiator</th></tr></thead><tbody>
  ${(audit.networkRequests||[]).slice(0,200).map((r:any)=>`<tr><td>${r.url}</td><td>${r.type}</td><td>${r.initiator}</td></tr>`).join('') || '<tr><td colspan="3">None</td></tr>'}
  </tbody></table>
  </body></html>`;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${jobId}.pdf"`);
    res.send(pdfBuffer);
    return;
  } catch (err: any) {
    console.error('Failed to generate PDF:', err?.message || err);
    // Fallback: respond with error and suggestion
    res.status(500).json({ success: false, error: 'PDF generation failed', message: err?.message || String(err) });
    return;
  }
});
