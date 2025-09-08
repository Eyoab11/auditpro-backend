// src/controllers/auditController.ts
import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { validateAuditRequest } from '../utils/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, SubmitAuditResponse, AuditJobResponse, AuditResultsResponse } from '../types';

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
  const userId = req.user.id; // Get user ID from authenticated request
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
    const result: AuditJobResponse = await AuditService.getAuditStatus(jobId, req.user.id);

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
    const result: AuditResultsResponse = await AuditService.getAuditResults(jobId, req.user.id);

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
