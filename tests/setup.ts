import dotenv from 'dotenv';

dotenv.config({path: './.secret/.env'});

jest.mock("../src/config/supabase")
jest.mock('../src/storage/UserRepository');
jest.mock('../src/storage/AttendeeRepository');
jest.mock('../src/storage/EventRepository');
jest.mock('../src/storage/PaymentRepository');
jest.mock('../src/storage/ProductRepository');

// Lifecycle hooks
afterEach(() => {
    jest.clearAllMocks();
});

