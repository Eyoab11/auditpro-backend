// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './database';
import AuditJob from './models/AuditJob';

dotenv.config();

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(express.json()); // Body parser for JSON requests
app.use(cors()); // Enable CORS

// --- Routes ---

// @route    POST /api/audit/submit
// @desc     Submit a URL for a new audit
// @access   Public (for now, will be authenticated later)
app.post('/api/audit/submit', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ msg: 'Please provide a valid URL starting with http:// or https://' });
  }

  try {
    const newAuditJob = new AuditJob({ url, status: 'pending' });
    await newAuditJob.save();

    // TODO: In Phase 2, this is where we'll delegate the actual scanning
    // to a background worker/queue using the newAuditJob._id

    res.status(202).json({
      msg: 'Audit job submitted successfully. Processing will begin shortly.',
      jobId: newAuditJob._id,
      status: newAuditJob.status,
    });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET /api/audit/:jobId/status
// @desc     Get the current status of an audit job
// @access   Public
app.get('/api/audit/:jobId/status', async (req: Request, res: Response) => {
  try {
    const auditJob = await AuditJob.findById(req.params.jobId);

    if (!auditJob) {
      return res.status(404).json({ msg: 'Audit job not found' });
    }

    res.json({
      jobId: auditJob._id,
      url: auditJob.url,
      status: auditJob.status,
      updatedAt: auditJob.updatedAt,
      errorMessage: auditJob.errorMessage, // Include error message if applicable
    });
  } catch (err: any) {
    console.error(err.message);
    if (err.kind === 'ObjectId') { // Handle invalid MongoDB ObjectId format
      return res.status(400).json({ msg: 'Invalid Job ID format' });
    }
    res.status(500).send('Server Error');
  }
});

// @route    GET /api/audit/:jobId/results
// @desc     Get the full results of a completed audit job
// @access   Public
app.get('/api/audit/:jobId/results', async (req: Request, res: Response) => {
  try {
    const auditJob = await AuditJob.findById(req.params.jobId);

    if (!auditJob) {
      return res.status(404).json({ msg: 'Audit job not found' });
    }

    if (auditJob.status !== 'completed') {
      return res.status(409).json({
        msg: `Audit job status is '${auditJob.status}'. Results are not yet available.`,
        status: auditJob.status,
      });
    }

    res.json({
      jobId: auditJob._id,
      url: auditJob.url,
      status: auditJob.status,
      results: auditJob.results,
      createdAt: auditJob.createdAt,
      updatedAt: auditJob.updatedAt,
    });
  } catch (err: any) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid Job ID format' });
    }
    res.status(500).send('Server Error');
  }
});


// Basic Global Error Handling Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
