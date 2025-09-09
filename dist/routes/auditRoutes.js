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
exports.default = router;
//# sourceMappingURL=auditRoutes.js.map