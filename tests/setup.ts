import { toHaveCalledWithMailInfo } from './customMatchers/emailMatchers';
import dotenv from 'dotenv';

dotenv.config({path: './.secret/.env'});

jest.mock('../src/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../src/storage/UserRepository');
jest.mock('../src/storage/AttendeeRepository');
jest.mock('../src/storage/EventRepository');
jest.mock('../src/storage/PaymentRepository');
jest.mock('../src/storage/ProductRepository');

// Custom matchers imports
expect.extend({
    toHaveCalledWithMailInfo,
});

// Lifecycle hooks
afterEach(() => {
    jest.clearAllMocks();
});

