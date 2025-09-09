"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.protect = void 0;
// src/middleware/auth.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
// Protect routes - require authentication
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')) {
        // Set token from Bearer token in header
        token = req.headers.authorization.split(' ')[1];
    }
    // Make sure token exists
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Not authorized to access this route'
        });
    }
    try {
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'defaultsecret');
        const found = await User_1.default.findById(decoded.id).select('_id email name');
        if (!found) {
            return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
        }
        req.user = { _id: found._id.toString(), email: found.email, name: found.name };
        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            error: 'Not authorized to access this route'
        });
    }
};
exports.protect = protect;
// Grant access to specific roles (optional, for future use)
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
        }
        if (req.user.role && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.js.map