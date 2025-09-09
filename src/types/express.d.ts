import 'express';

declare module 'express' {
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
