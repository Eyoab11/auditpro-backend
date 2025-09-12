// src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import User from '../models/User';

interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: {
    _id: string;
    id?: string;
    role?: string;
    email?: string;
    name?: string;
  };
}

// Protect routes - require authentication
export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as { id: string };
    const found = await User.findById(decoded.id).select('_id email name');
    if (!found) {
      return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
    }
    req.user = { _id: (found._id as unknown as string).toString(), email: found.email, name: found.name };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles (optional, for future use)
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
