"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/authRoutes.ts
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// @route    POST /api/auth/register
// @desc     Register a new user
// @access   Public
router.post('/register', authController_1.register);
// @route    POST /api/auth/login
// @desc     Login user
// @access   Public
router.post('/login', authController_1.login);
// @route    GET /api/auth/me
// @desc     Get current logged in user
// @access   Private
router.get('/me', auth_1.protect, authController_1.getMe);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map