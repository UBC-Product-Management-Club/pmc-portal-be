import dotenv from 'dotenv';

dotenv.config({path: './.secret/.env'});

jest.mock("../src/config/supabase")
// CI has no Stripe key, and creating the client without one throws. Tests that
// call Stripe mock the functions they need in their own file.
jest.mock("../src/config/stripe", () => ({ stripe: {} }));
jest.mock('../src/storage/UserRepository');
jest.mock('../src/storage/AttendeeRepository');
jest.mock('../src/storage/EventRepository');
jest.mock('../src/storage/PaymentRepository');
jest.mock('../src/storage/ProductRepository');
jest.mock('../src/storage/CheckoutSessionRepository');
