// src/routes/auditRoutes.ts
import { Router } from 'express';
import {
  submitAudit,
  getAuditStatus,
  getAuditResults,
} from '../controllers/auditController';

const router = Router();

// @route    POST /api/audit/submit
// @desc     Submit a URL for a new audit
// @access   Public (for now, will be authenticated later)
router.post('/submit', submitAudit);

// @route    GET /api/audit/:jobId/status
// @desc     Get the current status of an audit job
// @access   Public
router.get('/:jobId/status', getAuditStatus);

// @route    GET /api/audit/:jobId/results
// @desc     Get the full results of a completed audit job
// @access   Public
router.get('/:jobId/results', getAuditResults);

export default router;
