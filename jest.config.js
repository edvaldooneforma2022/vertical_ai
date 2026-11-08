module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: [
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/tests/**/*.spec.js'
    ],
    collectCoverageFrom: [
        '*.js',
        'modules/**/*.js',
        '!node_modules/**',
        '!coverage/**',
        '!jest.config.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 30000,
    setupFilesAfterEnv: ['./tests/setup.js'],
    modulePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/vertical_ai/'],
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/vertical_ai/'],
    // Ignora warnings de módulos opcionais
    moduleNameMapper: {
        '^puppeteer$': '<rootDir>/tests/mocks/puppeteer.mock.js'
    }
};
