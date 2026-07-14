module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
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
    modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
    testPathIgnorePatterns: ['/node_modules/'],
    // Ignora warnings de módulos opcionais
    moduleNameMapper: {
        '^puppeteer$': '<rootDir>/tests/mocks/puppeteer.mock.js'
    }
};
