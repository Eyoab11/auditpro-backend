// Global type declarations and module augmentations
import 'express';

declare module 'jsonwebtoken' {
  export interface JwtPayload {
    id?: string;
    [key: string]: any;
  }
}

// Fallback declaration if needed (should be provided by @types/express once installed)
declare namespace Express {
  interface Request {
    user?: {
      _id: string;
      id?: string;
      role?: string;
      email?: string;
      name?: string;
    };
  }
}
