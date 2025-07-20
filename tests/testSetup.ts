// Mock firebase calls 
jest.mock('../src/config/firebase', () => ({
    db: {
        collection: jest.fn(),
    },
}));

import { toHaveCalledWithMailInfo } from './customMatchers/emailMatchers';
import dotenv from 'dotenv';
dotenv.config({path: './.secret/.env'});

// Custom matchers imports
expect.extend({
    toHaveCalledWithMailInfo,
});

// Lifecycle hooks
afterEach(() => {
    jest.clearAllMocks();
});

