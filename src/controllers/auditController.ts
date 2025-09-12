// src/controllers/auditController.ts
import { Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { validateAuditRequest } from '../utils/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, SubmitAuditResponse, AuditJobResponse, AuditResultsResponse, AuditHistoryResponse } from '../types';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

interface AuthenticatedRequest {
  body: any;
  user?: {
    _id: string;
    id?: string;
    role?: string;
    email?: string;
    name?: string;
  };
  params: any;
  query: any;
}

export const submitAudit = asyncHandler(async (
  req: AuthenticatedRequest,
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
  const userId = req.user?._id || req.user?.id;
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
  req: AuthenticatedRequest,
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
  req: AuthenticatedRequest,
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
  req: AuthenticatedRequest,
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
  req: AuthenticatedRequest,
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

  // Map enhanced results structure to PDF-friendly shape
  const enhanced = (results as any).results || results;

  const summary = enhanced.summary || {};
  const analysis = enhanced.analysis || {};
  const performanceMetrics = enhanced.performance || analysis.performanceScores || {};
  const scripts = enhanced.scripts || [];
  const tags = enhanced.tags || analysis.processedTags || [];
  const findings = analysis.findings || analysis.auditFindings || [];
  const network = enhanced.network || [];
  const urlVal = summary.url || (results as any).url || enhanced.url || 'Unknown';
  const created = (results as any).createdAt || summary.timestamp || enhanced.timestamp || new Date();
  const healthScore = enhanced.healthScore || summary.healthScore || '';

  const esc = (v: any) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const perfRows = Object.entries(performanceMetrics).filter(([k]) => !/^(navigationStart|loadEventEnd|domContentLoadedEventEnd)$/i.test(k));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>Audit Report ${esc(jobId)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    h1 { color: #4B0082; margin-top:0; }
    h2 { margin-top: 32px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; vertical-align: top; }
    th { background: #f5f5f5; text-align: left; }
    .badge { display:inline-block; padding:2px 6px; border-radius:4px; background:#eee; font-size:11px; margin-left:6px; }
    .sev-high { color:#b91c1c; }
    .sev-medium { color:#d97706; }
    .sev-low { color:#2563eb; }
    .meta { font-size:12px; color:#555; margin-top:4px; }
  </style></head><body>
  <h1>Audit Report <span class="badge">${esc(jobId)}</span></h1>
  <p><strong>URL:</strong> ${esc(urlVal)}</p>
  <p><strong>Date:</strong> ${esc(new Date(created).toString())}</p>
  ${healthScore ? `<p><strong>Health Score:</strong> ${esc(healthScore)}</p>` : ''}

  <h2>Performance Metrics</h2>
  <table><tbody>
    ${perfRows.length ? perfRows.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('') : '<tr><td colspan="2">No metrics</td></tr>'}
  </tbody></table>

  <h2>Detected Scripts (${scripts.length})</h2>
  <table><thead><tr><th>Src/Type</th><th>Location</th><th>Async</th><th>Defer</th></tr></thead><tbody>
    ${scripts.length ? scripts.slice(0,120).map((s:any)=>`<tr><td>${esc(s.src||'inline')}</td><td>${esc(s.location||'')}</td><td>${esc(s.async)}</td><td>${esc(s.defer)}</td></tr>`).join('') : '<tr><td colspan="4">None</td></tr>'}
  </tbody></table>

  <h2>Tags (${tags.length})</h2>
  <table><thead><tr><th>Name / Type</th><th>ID</th><th>Status</th><th>Details</th></tr></thead><tbody>
    ${tags.length ? tags.slice(0,150).map((t:any)=>`<tr><td>${esc(t.name||t.type||'')}</td><td>${esc(t.id||t.pixelId||t.measurementId||'')}</td><td>${esc(t.status||'')}</td><td>${esc(t.details||'')}</td></tr>`).join('') : '<tr><td colspan="4">None</td></tr>'}
  </tbody></table>

  <h2>Findings (${findings.length})</h2>
  <table><thead><tr><th>Title</th><th>Type</th><th>Severity</th><th>Description</th></tr></thead><tbody>
    ${findings.length ? findings.slice(0,200).map((f:any)=>`<tr><td>${esc(f.title||f.id||'')}</td><td>${esc(f.type||'')}</td><td class="sev-${esc((f.severity||'').toLowerCase())}">${esc(f.severity||'')}</td><td>${esc(f.description||f.details||'')}</td></tr>`).join('') : '<tr><td colspan="4">None</td></tr>'}
  </tbody></table>

  <h2>Network Requests (${network.length})</h2>
  <table><thead><tr><th>URL</th><th>Type</th><th>Initiator</th></tr></thead><tbody>
    ${network.length ? network.slice(0,250).map((r:any)=>`<tr><td>${esc(r.url)}</td><td>${esc(r.type)}</td><td>${esc(r.initiator)}</td></tr>`).join('') : '<tr><td colspan="3">None</td></tr>'}
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
