/**
 * Mock do Puppeteer para testes
 * Evita carregar Puppeteer real durante testes unitários
 */

const mockPage = {
    goto: jest.fn().mockResolvedValue(null),
    content: jest.fn().mockResolvedValue('<html><body>Test</body></html>'),
    waitForSelector: jest.fn().mockResolvedValue(null),
    evaluate: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(null),
    setViewport: jest.fn().mockResolvedValue(null),
    setUserAgent: jest.fn().mockResolvedValue(null)
};

const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(null),
    pages: jest.fn().mockResolvedValue([mockPage])
};

module.exports = {
    launch: jest.fn().mockResolvedValue(mockBrowser)
};
