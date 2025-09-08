// src/types/index.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuditJobRequest {
  url: string;
}

export interface AuditJobResponse {
  jobId: string;
  url: string;
  status: 'pending' | 'scanning' | 'analyzing' | 'completed' | 'failed';
  updatedAt: Date;
  errorMessage?: string;
}

export interface AuditResultsResponse {
  jobId: string;
  url: string;
  status: string;
  results: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitAuditResponse {
  msg: string;
  jobId: string;
  status: string;
}

// Puppeteer Audit Types
export interface DetectedScript {
  src: string;
  type: 'script' | 'inline';
  location: 'head' | 'body';
  async?: boolean;
  defer?: boolean;
}

export interface InjectedTag {
  type: 'GTM' | 'GA4' | 'MetaPixel' | 'LinkedIn' | 'TikTok' | 'Twitter' | 'Pinterest' | 'Other';
  id?: string;
  measurementId?: string;
  pixelId?: string;
  code: string;
  status: 'found' | 'active' | 'inactive';
}

export interface NetworkRequest {
  url: string;
  type: 'script' | 'image' | 'xhr' | 'fetch';
  initiator: string;
  size?: number;
  timing?: any;
}

export interface PerformanceMetrics {
  loadTimeMs: number;
  domContentLoadedMs: number;
  firstContentfulPaintMs?: number;
  largestContentfulPaintMs?: number;
  firstInputDelayMs?: number;
  cumulativeLayoutShift?: number;
  navigationStart: number;
  loadEventEnd: number;
  domContentLoadedEventEnd: number;
}

export interface RawAuditData {
  url: string;
  timestamp: string;
  rawHtml?: string;
  detectedScripts: DetectedScript[];
  injectedTags: InjectedTag[];
  networkRequests: NetworkRequest[];
  performanceMetrics: PerformanceMetrics;
  errors?: string[];
}
