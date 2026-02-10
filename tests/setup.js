/**
 * Jest Setup File
 * Configurações globais para todos os testes
 */

// Aumentar timeout para testes de integração
jest.setTimeout(30000);

// Mock de variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SESSION_SECRET = 'test-secret-key';

// Silenciar logs durante testes (descomente se necessário)
// console.log = jest.fn();
// console.warn = jest.fn();
// console.error = jest.fn();

// Cleanup após todos os testes
afterAll(async () => {
    // Fechar conexões pendentes se existirem
    await new Promise(resolve => setTimeout(resolve, 500));
});
