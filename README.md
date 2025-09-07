# AuditPro Backend

A Node.js/TypeScript backend API for the AuditPro web accessibility auditing platform. This service handles audit job submissions, status tracking, and result retrieval using MongoDB for data persistence.

## Features

- **Audit Job Management**: Submit URLs for accessibility audits and track their progress
- **RESTful API**: Clean API endpoints for frontend integration
- **MongoDB Integration**: Document-based storage for audit data
- **TypeScript**: Type-safe development with full IntelliSense support
- **Error Handling**: Comprehensive error handling and validation

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (planned for future implementation)
- **Development**: Nodemon for hot reloading

## Project Structure

```
auditpro-backend/
├── src/
│   ├── models/
│   │   └── AuditJob.ts      # MongoDB schema for audit jobs
│   ├── database.ts          # MongoDB connection setup
│   └── server.ts            # Express server and API routes
├── .env                     # Environment variables
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── nodemon.json             # Development server config
```

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
   - Copy the `.env` file and update the values:
     ```env
     PORT=5000
     MONGODB_URI=your_mongodb_connection_string
     JWT_SECRET=your_super_secret_jwt_key
     ```

4. **Build the project**:
   ```bash
   npm run build
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## API Endpoints

### Submit Audit Job
- **POST** `/api/audit/submit`
- **Body**: `{ "url": "https://example.com" }`
- **Response**: Job ID and initial status

### Get Audit Status
- **GET** `/api/audit/:jobId/status`
- **Response**: Current job status, URL, timestamps, and error messages if applicable

### Get Audit Results
- **GET** `/api/audit/:jobId/results`
- **Response**: Complete audit results for completed jobs

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

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Add proper error handling for new features
3. Update this README for any new endpoints or features
4. Test API endpoints thoroughly before committing

## License

ISC</content>
<parameter name="filePath">d:\Documents\Projects\AuditPro\auditpro-backend\README.md
