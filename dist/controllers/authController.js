"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const User_1 = __importDefault(require("../models/User"));
// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        // Create user
        const user = await User_1.default.create({
            name,
            email,
            password
        });
        // Get token
        const token = user.getSignedJwtToken();
        res.status(201).json({
            success: true,
            token,
            data: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    }
    catch (err) {
        // Handle duplicate email error
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Email already exists'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Server error during registration'
        });
    }
};
exports.register = register;
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an email and password'
            });
        }
        // Check for user
        const user = await User_1.default.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        // Check if password matches
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        // Get token
        const token = user.getSignedJwtToken();
        res.status(200).json({
            success: true,
            token,
            data: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
};
exports.login = login;
// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized to access this route'
            });
        }
        const user = await User_1.default.findById(req.user._id);
        res.status(200).json({
            success: true,
            data: user
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};
exports.getMe = getMe;
//# sourceMappingURL=authController.js.map