import { toHaveCalledWithMailInfo } from './customMatchers/emailMatchers';
import dotenv from 'dotenv';
dotenv.config({path: '.env.test'});

//custom matchers imports
expect.extend({
    toHaveCalledWithMailInfo,
});

//mock external calls to firebase
jest.mock('../src/config/firebase', () => ({}));

//lifecycle hooks
afterEach(() => {
    jest.clearAllMocks();
});
