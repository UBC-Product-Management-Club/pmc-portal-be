import { toHaveCalledWithMailInfo } from './customMatchers/emailMatchers';
import dotenv from 'dotenv';
dotenv.config({path: './.secret/.env'});

// Mock firebase calls 
jest.mock('../src/config/firebase', () => ({
  db: {
    collection: jest.fn(),
  },
  stripe: {
    paymentIntents: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Custom matchers imports
expect.extend({
    toHaveCalledWithMailInfo,
});

// Lifecycle hooks
afterEach(() => {
    jest.clearAllMocks();
});

