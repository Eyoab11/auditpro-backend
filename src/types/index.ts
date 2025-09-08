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
