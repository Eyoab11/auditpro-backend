// src/models/AuditJob.ts
import mongoose, { Document, Schema } from 'mongoose';

// Define the interface for AuditJob document
export interface IAuditJob extends Document {
  url: string;
  user: mongoose.Types.ObjectId; // Reference to User
  status: 'pending' | 'scanning' | 'analyzing' | 'completed' | 'failed';
  results?: any; // Will store the final processed audit results
  rawScanData?: any; // Will store the raw data from Puppeteer before Python processing
  analysisData?: any; // Will store the enhanced analysis data from Python service
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string; // To store error details if job fails
}

// Define the Mongoose Schema
const AuditJobSchema: Schema = new Schema({
  url: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'scanning', 'analyzing', 'completed', 'failed'],
    default: 'pending',
    required: true,
  },
  results: { type: mongoose.Schema.Types.Mixed }, // Mixed type for flexible JSON structure
  rawScanData: { type: mongoose.Schema.Types.Mixed }, // Mixed type for raw data
  analysisData: { type: mongoose.Schema.Types.Mixed }, // Mixed type for Python analysis data
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update 'updatedAt' field on save
AuditJobSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Create and export the model
const AuditJob = mongoose.model<IAuditJob>('AuditJob', AuditJobSchema);
export default AuditJob;