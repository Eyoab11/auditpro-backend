// src/routes/auditRoutes.ts
import { Router } from 'express';
import {
  submitAudit,
  getAuditStatus,
  getAuditResults,
} from '../controllers/auditController';
import { protect } from '../middleware/auth';

const router = Router();

// @route    POST /api/audit/submit
// @desc     Submit a URL for a new audit
// @access   Private (requires authentication)
router.post('/submit', protect, submitAudit);

// @route    GET /api/audit/:jobId/status
// @desc     Get the current status of an audit job
// @access   Private
router.get('/:jobId/status', protect, getAuditStatus);

// @route    GET /api/audit/:jobId/results
// @desc     Get the full results of a completed audit job
// @access   Private
router.get('/:jobId/results', protect, getAuditResults);

export default router;
