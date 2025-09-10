"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auditRoutes.ts
const express_1 = require("express");
const auditController_1 = require("../controllers/auditController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// @route    POST /api/audit/submit
// @desc     Submit a URL for a new audit
// @access   Private (requires authentication)
router.post('/submit', auth_1.protect, auditController_1.submitAudit);
// @route    GET /api/audit/:jobId/status
// @desc     Get the current status of an audit job
// @access   Private
router.get('/:jobId/status', auth_1.protect, auditController_1.getAuditStatus);
// @route    GET /api/audit/:jobId/results
// @desc     Get the full results of a completed audit job
// @access   Private
router.get('/:jobId/results', auth_1.protect, auditController_1.getAuditResults);
// @route    GET /api/audit/:jobId/pdf
// @desc     Download PDF report for a completed audit
// @access   Private
router.get('/:jobId/pdf', auth_1.protect, auditController_1.generateAuditPdf);
// @route    GET /api/audit
// @desc     List current user's audit jobs (history)
// @access   Private
router.get('/', auth_1.protect, auditController_1.listAudits);
exports.default = router;
//# sourceMappingURL=auditRoutes.js.map