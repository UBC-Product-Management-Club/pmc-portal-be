import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    preset: 'ts-jest', 
    testEnvironment: 'node',  
    clearMocks: true, 
    restoreMocks: true,           
    testMatch: ['**/tests/**/*.test.ts'],  
    setupFilesAfterEnv: ['./tests/testSetup.ts'], 
    modulePathIgnorePatterns: ['<rootDir>/build/'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.test.json' }]
    },
    reporters: [
        'default',
        ['jest-junit', {outputDirectory: 'output', outputName: 'test-results.xml'}],
    ],
};

export default config;
