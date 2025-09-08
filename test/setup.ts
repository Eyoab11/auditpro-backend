import { beforeAll, afterAll } from '@jest/globals';
import connectDB from '../src/config/database';

// Connect to test database before running tests
beforeAll(async () => {
  await connectDB();
});

// Clean up after all tests
afterAll(async () => {
  // Close database connection
  const mongoose = require('mongoose');
  await mongoose.connection.close();
});
