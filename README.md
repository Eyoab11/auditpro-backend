# AuditPro Backend

A Node.js/TypeScript backend API for the AuditPro web accessibility auditing platform. This service handles audit job submissions, status tracking, and result retrieval using MongoDB for data persistence.

## Features

- **Professional Architecture**: Layered architecture with separation of concerns (Routes → Controllers → Services → Models)
- **Puppeteer Integration**: Headless browser crawling for comprehensive website analysis
- **Marketing Tag Detection**: Automatic detection of GTM, GA4, Meta Pixel, LinkedIn, TikTok, Twitter, and Pinterest tags
- **Performance Metrics**: Core Web Vitals and page load performance analysis
- **Background Processing**: Asynchronous job queue system for scalable audit processing
- **Network Monitoring**: Tracking of tracking-related network requests
- **Audit Job Management**: Submit URLs for accessibility audits and track their progress
- **RESTful API**: Clean, standardized API endpoints with consistent response formats
- **MongoDB Integration**: Document-based storage for audit data with Mongoose ODM
- **TypeScript**: Full type safety with custom interfaces and type definitions
- **Error Handling**: Comprehensive error handling with custom middleware and async error catching
- **Input Validation**: Robust request validation with detailed error messages
- **Health Monitoring**: Built-in health check and job queue status endpoints

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Web Scraping**: Puppeteer (headless Chrome automation)
- **Authentication**: JWT (planned for future implementation)
- **Development**: Nodemon for hot reloading
- **Job Processing**: Custom background job queue system

## Project Structure

```
auditpro-backend/
├── src/
│   ├── config/
│   │   └── database.ts          # MongoDB connection configuration
│   ├── controllers/
│   │   └── auditController.ts   # HTTP request handlers for audit routes
│   ├── middleware/
│   │   └── errorHandler.ts      # Global error handling middleware
│   ├── models/
│   │   └── AuditJob.ts          # MongoDB schema for audit jobs
│   ├── routes/
│   │   └── auditRoutes.ts       # API route definitions
│   ├── services/
│   │   └── auditService.ts      # Business logic layer
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── utils/
│   │   └── validation.ts        # Utility functions for validation
│   ├── app.ts                   # Express application configuration
│   └── server.ts                # Server startup and configuration
├── .env                         # Environment variables
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
└── nodemon.json                 # Development server config
```

## Architecture

The backend follows a layered architecture pattern for better maintainability and scalability:

### **Layers Overview**

- **Routes Layer** (`/routes`): Defines API endpoints and maps them to controller functions
- **Controller Layer** (`/controllers`): Handles HTTP requests, validates input, and orchestrates responses
- **Service Layer** (`/services`): Contains business logic and interacts with data models
- **Model Layer** (`/models`): Defines MongoDB schemas and data structures
- **Middleware Layer** (`/middleware`): Handles cross-cutting concerns like error handling and authentication
- **Utils Layer** (`/utils`): Contains reusable utility functions and helpers

### **Key Features**

- **Separation of Concerns**: Each layer has a specific responsibility
- **Error Handling**: Centralized error handling with custom error classes
- **Type Safety**: Full TypeScript support with custom type definitions
- **Validation**: Input validation utilities for request data
- **Async Handling**: Proper async/await patterns with error catching

```

## Puppeteer Crawling Engine

The backend includes a comprehensive Puppeteer-based crawling engine that performs detailed website analysis:

### **Tag Detection**
- **Google Tag Manager (GTM)**: Detects GTM containers and extracts container IDs
- **Google Analytics 4 (GA4)**: Identifies gtag implementations and measurement IDs
- **Meta Pixel**: Finds Facebook pixel implementations and pixel IDs
- **LinkedIn Insight Tag**: Detects LinkedIn tracking pixels
- **TikTok Pixel**: Identifies TikTok advertising pixels
- **Twitter Pixel**: Finds Twitter conversion tracking
- **Pinterest Tag**: Detects Pinterest advertising tags

### **Performance Analysis**
- **Core Web Vitals**: Largest Contentful Paint (LCP), First Input Delay (FID), Cumulative Layout Shift (CLS)
- **Load Times**: Navigation start, DOM content loaded, page load complete
- **First Contentful Paint**: Time to first visual content

### **Network Monitoring**
- Tracks all network requests during page load
- Identifies tracking domains and third-party scripts
- Monitors script loading patterns and timing

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account or local MongoDB instance
- npm or yarn package manager

### Installation

1. **Clone the repository** (if applicable) and navigate to the backend directory:
   ```bash
   cd auditpro-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
  - Copy `.env.example` to `.env` and adjust values.
  - For production (Render): set `MONGODB_URI`, `JWT_SECRET`, `PYTHON_SERVICE_URL`, `CLIENT_URL` in the dashboard.
  - Do NOT hard‑code secrets in the repo.
  - Render auto-assigns `PORT`; keep fallback in code (`process.env.PORT || 5000`).

4. **Build the project**:
   ```bash
   npm run build
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

### Deploying to Render (No Docker)

This service is configured to run as a native Node web service (no Docker needed):

1. Push repository to GitHub.
2. In Render: New + Web Service → pick repo.
3. Environment = Node, Build Command: `npm install && npm run build`, Start Command: `npm start`.
4. Set Environment Variables:
  - `NODE_ENV=production`
  - `MONGODB_URI=...` (secret)
  - `JWT_SECRET=...` (secret)
  - `PYTHON_SERVICE_URL=https://<python-service>.onrender.com` (once that service is deployed)
  - `CLIENT_URL=https://<frontend>.onrender.com` (or your custom domain)
5. Deploy. Health check path `/health` returns JSON when healthy.

If you ever reintroduce Docker, ensure devDependencies are available during the build (multi-stage or omit `--only=production`).

## API Endpoints

All API responses follow a standardized format:

```json
{
  "success": true|false,
  "data": { ... }, // Present when success is true
  "error": "error message", // Present when success is false
  "message": "additional message" // Optional additional context
}
```

### Submit Audit Job
- **POST** `/api/audit/submit`
- **Body**: `{ "url": "https://example.com" }`
- **Success Response (202)**:
  ```json
  {
    "success": true,
    "data": {
      "msg": "Audit job submitted successfully. Processing will begin shortly.",
      "jobId": "64f...",
      "status": "pending"
    }
  }
  ```
- **Error Response (400)**:
  ```json
  {
    "success": false,
    "error": "Please provide a valid URL starting with http:// or https://"
  }
  ```

### Get Audit Status
- **GET** `/api/audit/:jobId/status`
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "jobId": "64f...",
      "url": "https://example.com",
      "status": "pending",
      "updatedAt": "2025-09-08T...",
      "errorMessage": null
    }
  }
  ```
- **Error Responses**:
  - **404**: `{"success": false, "error": "Audit job not found"}`
  - **400**: `{"success": false, "error": "Invalid Job ID format"}`

### Get Audit Results
- **GET** `/api/audit/:jobId/results`
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "jobId": "64f...",
      "url": "https://example.com",
      "status": "completed",
      "results": { ... },
      "createdAt": "2025-09-08T...",
      "updatedAt": "2025-09-08T..."
    }
  }
  ```
- **Error Responses**:
  - **404**: `{"success": false, "error": "Audit job not found"}`
  - **409**: `{"success": false, "error": "Audit job status is 'pending'. Results are not yet available."}`

### Health Check
- **GET** `/health`
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "AuditPro Backend is running",
    "timestamp": "2025-09-08T..."
  }
  ```

### Job Queue Status
- **GET** `/api/jobs/status`
- **Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "queueLength": 2,
      "isProcessing": true,
      "jobs": [
        {
          "id": "audit_64f..._1694190000000",
          "type": "audit",
          "createdAt": "2025-09-08T...",
          "retries": 0
        }
      ]
    }
  }
  ```

## Database Schema

### AuditJob Model
- `url`: String (required) - The URL being audited
- `status`: Enum - 'pending', 'scanning', 'analyzing', 'completed', 'failed'
- `results`: Mixed - Final processed audit results
- `rawScanData`: Mixed - Raw data from scanning tools
- `errorMessage`: String - Error details if job fails
- `createdAt`: Date - Job creation timestamp
- `updatedAt`: Date - Last update timestamp

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server (requires build first)

### Environment Variables

- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens (for future auth features)

## Future Enhancements

- User authentication and authorization
- Background job processing with queues (e.g., Bull.js)
- Integration with accessibility scanning tools
- Webhook notifications for job completion
- Rate limiting and API throttling
- Comprehensive logging and monitoring

## Development Best Practices

### **Adding New Features**

1. **Routes**: Add new endpoints in the appropriate route file (`/routes`)
2. **Controllers**: Create controller functions to handle HTTP requests and responses
3. **Services**: Implement business logic in service classes
4. **Models**: Define data schemas in the models directory
5. **Types**: Add TypeScript interfaces in `/types/index.ts`
6. **Validation**: Create validation functions in `/utils/validation.ts`

### **Error Handling**

- Use the `asyncHandler` wrapper for async controller functions
- Throw descriptive errors from services
- Let the global error handler format responses
- Return appropriate HTTP status codes

### **Response Format**

Always follow the standardized response format:
- **Success**: `{ success: true, data: {...} }`
- **Error**: `{ success: false, error: "message" }`

### **Code Organization**

- Keep controllers thin - delegate to services
- Services should contain business logic only
- Models should only define schemas and basic queries
- Use middleware for cross-cutting concerns

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Add proper error handling for new features
3. Update this README for any new endpoints or features
4. Test API endpoints thoroughly before committing

## License

ISC</content>
<parameter name="filePath">d:\Documents\Projects\AuditPro\auditpro-backend\README.md
