import dotenv from 'dotenv';

dotenv.config({path: './.secret/.env'});

// The Auth0 middleware (jwtCheck) is constructed at import time and throws
// without an issuer URL. Provide a dummy so importing Session.ts works in tests.
process.env.AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'https://test.us.auth0.com/';

jest.mock("../src/config/supabase")
jest.mock('../src/storage/UserRepository');
jest.mock('../src/storage/AttendeeRepository');
jest.mock('../src/storage/EventRepository');
jest.mock('../src/storage/PaymentRepository');
jest.mock('../src/storage/ProductRepository');
jest.mock('../src/storage/CheckoutSessionRepository');
jest.mock('../src/storage/ApplicationRepository');
