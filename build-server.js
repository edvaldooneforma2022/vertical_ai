const fs = require('fs');
const path = require('path');

console.log('🔨 Construindo server.js melhorado...');

// Ler o server original
const originalServer = fs.readFileSync(path.join(__dirname, 'server.js.original'), 'utf8');

// Encontrar onde inserir os imports dos novos módulos
const dotenvLine = originalServer.indexOf('require("dotenv").config();');

if (dotenvLine === -1) {
    console.error('❌ Não foi possível encontrar a linha do dotenv');
    process.exit(1);
}

// Criar novo conteúdo do server
let newServer = originalServer.substring(0, dotenvLine + 'require("dotenv").config();'.length);

// Adicionar imports dos novos módulos
newServer += `

// ===== NOVOS MÓDULOS - MELHORIAS IMPLEMENTADAS =====
const { db, initializeDatabase, DatabaseHelpers, USE_POSTGRES } = require('./database');
const { initializeCache, CacheManager, rateLimitMiddleware, isRedisConnected } = require('./cache');
const { webhookManager, WebhookEvents } = require('./webhooks');
const { billingManager, PLANS } = require('./billing');
const { analyticsManager } = require('./analytics');
const { llmOptimizer } = require('./llm-optimizer');
const { knowledgeBaseManager } = require('./knowledge-base');

console.log('✅ Módulos de melhorias carregados');
`;

// Adicionar o restante do código original (pulando a primeira linha do dotenv)
const restOfOriginal = originalServer.substring(dotenvLine + 'require("dotenv").config();'.length);
newServer += restOfOriginal;

// Salvar novo server.js
fs.writeFileSync(path.join(__dirname, 'server-new.js'), newServer);

console.log('✅ server-new.js criado com sucesso!');
console.log('📝 Total de linhas:', newServer.split('\n').length);
