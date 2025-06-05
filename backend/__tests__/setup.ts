import { jest } from '@jest/globals';

// Set up environment variables for testing
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in test output
global.console.log = jest.fn();
global.console.info = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();

// Set a longer timeout for async tests
jest.setTimeout(10000);

// Clean up mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 