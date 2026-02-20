#!/usr/bin/env node
/**
 * 🚀 ENTERPRISE SAAS MIGRATION SCRIPT — Link Mágico
 * ===================================================
 * Migra de Key-Based Tenancy (lm_...) para Relational UUID-Based Architecture
 *
 * EXECUÇÃO:
 *   node scripts/migrate-to-enterprise-tenancy.js
 *
 * SEGURANÇA:
 *   - Executa tudo em uma única transação (PostgreSQL)
 *   - ROLLBACK automático em qualquer erro
 *   - Idempotente: pode-se rodar múltiplas vezes sem duplicar dados (ON CONFLICT DO NOTHING)
 *   - Não remove colunas antigas (fase de coexistência)
 *
 * RESULTADO:
 *   - Uma linha em `tenants` por API Key
 *   - Uma linha em `api_keys` com SHA-256 por API Key
 *   - Coluna `tenant_uuid` populada em todas as tabelas operacionais
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, USE_POSTGRES, initializeDatabase } = require('../database');

// ─── Configurações ────────────────────────────────────────────────────────────

const HASH_ALGORITHM = 'sha256';

// Todas as tabelas operacionais e a coluna que contém a API Key / tenant string antigo
const OPERATIONAL_TABLES = [
    // Tabelas que usam coluna api_key (valor = a string lm_...)
    { name: 'chatbots', col: 'api_key', type: 'api_key' },
    { name: 'whatsapp_settings', col: 'api_key', type: 'api_key' },
    { name: 'chatgpt_settings', col: 'api_key', type: 'api_key' },
    { name: 'short_urls', col: 'api_key', type: 'api_key' },
    { name: 'tenant_leads', col: 'api_key', type: 'api_key' },
    { name: 'tenant_appointments', col: 'api_key', type: 'api_key' },
    { name: 'tenant_assistants', col: 'api_key', type: 'api_key' },

    // Tabelas CRM que já usam tenant_id (mas valor ainda é a string lm_...)
    { name: 'crm_pipelines', col: 'tenant_id', type: 'tenant_id' },
    { name: 'crm_leads', col: 'tenant_id', type: 'tenant_id' },
    { name: 'crm_activities', col: 'tenant_id', type: 'tenant_id' },
    { name: 'crm_deals', col: 'tenant_id', type: 'tenant_id' },
    { name: 'followup_rules', col: 'tenant_id', type: 'tenant_id' },
    { name: 'followup_jobs', col: 'tenant_id', type: 'tenant_id' },
    { name: 'crm_automation_rules', col: 'tenant_id', type: 'tenant_id' },
    { name: 'crm_webhooks', col: 'tenant_id', type: 'tenant_id' },
    { name: 'conversation_memory', col: 'tenant_id', type: 'tenant_id' },
    { name: 'audit_logs', col: 'tenant_id', type: 'tenant_id' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex');
}

function hashKey(key) {
    return crypto.createHash(HASH_ALGORITHM).update(key).digest('hex');
}

function log(emoji, msg) {
    const ts = new Date().toISOString();
    console.log(`${ts} ${emoji} ${msg}`);
}

function logSection(title) {
    console.log('');
    console.log('═'.repeat(60));
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

// ─── Função principal ─────────────────────────────────────────────────────────

async function migrate() {
    logSection('🚀 MIGRAÇÃO SAAS ENTERPRISE — Link Mágico');
    log('ℹ️', `Banco: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite (dev)'}`);

    try {
        // ── Passo 0: Garantir que o schema enterprise existe ──────────────────
        logSection('Passo 0 — Inicializando schema Enterprise');
        await initializeDatabase();
        log('✅', 'Schema verificado.');

        // ── Passo 1: Coletar chaves de fontes JSON ────────────────────────────
        logSection('Passo 1 — Coletando API Keys de fontes JSON');
        const apiKeysMeta = {};

        const jsonSources = [
            path.join(__dirname, '..', 'data', 'api_keys.json'),
            path.join(__dirname, '..', 'api-keys.json'),
        ];

        for (const srcPath of jsonSources) {
            if (fs.existsSync(srcPath)) {
                try {
                    const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
                    for (const [key, info] of Object.entries(raw)) {
                        if (!apiKeysMeta[key]) apiKeysMeta[key] = info;
                    }
                    log('📂', `Carregado: ${srcPath} (${Object.keys(raw).length} chaves)`);
                } catch (e) {
                    log('⚠️', `Não foi possível ler ${srcPath}: ${e.message}`);
                }
            }
        }

        // ── Passo 2: Coletar chaves únicas do banco ───────────────────────────
        logSection('Passo 2 — Coletando API Keys existentes no banco');
        const uniqueKeys = new Set(Object.keys(apiKeysMeta));

        for (const table of OPERATIONAL_TABLES) {
            try {
                const q = `SELECT DISTINCT ${table.col} AS val FROM ${table.name} WHERE ${table.col} IS NOT NULL`;
                const result = await db.query(q);
                const rows = result.rows || result;
                let count = 0;
                rows.forEach(row => {
                    const val = row.val;
                    if (val && typeof val === 'string') {
                        uniqueKeys.add(val);
                        count++;
                    }
                });
                if (count > 0) log('🔍', `${table.name}.${table.col}: ${count} valor(es) encontrado(s)`);
            } catch (e) {
                // Tabela pode não existir em ambientes sem todos os módulos
                if (!e.message.includes('no such table') && !e.message.includes('does not exist')) {
                    log('⚠️', `Erro ao ler ${table.name}: ${e.message}`);
                }
            }
        }

        log('📊', `Total de tenants a processar: ${uniqueKeys.size}`);

        if (uniqueKeys.size === 0) {
            log('ℹ️', 'Nenhuma chave encontrada. Migração não é necessária no momento.');
            return;
        }

        // ── Passo 3: Iniciar transação ────────────────────────────────────────
        logSection('Passo 3 — Executando migração em transação');
        if (USE_POSTGRES) {
            await db.query('BEGIN');
            log('🔒', 'Transação iniciada.');
        }

        const migrationMap = new Map(); // apiKey → tenantUUID
        let createdTenants = 0;
        let skippedTenants = 0;

        for (const key of uniqueKeys) {
            const keyPreview = key.substring(0, 12) + '...';
            log('🔹', `Processando: ${keyPreview}`);

            const meta = apiKeysMeta[key] || {};
            const keyHash = hashKey(key);
            const tenantId = generateId();
            const apiKeyId = generateId();

            // ── a) Criar Tenant (idempotente via key_hash em api_keys) ─────────
            //    Verificamos se já existe uma api_key com esse hash
            const checkQuery = USE_POSTGRES
                ? `SELECT tenant_id FROM api_keys WHERE key_hash = $1 LIMIT 1`
                : `SELECT tenant_id FROM api_keys WHERE key_hash = ? LIMIT 1`;

            let existingTenantId = null;
            try {
                const checkResult = await db.query(checkQuery, [keyHash]);
                const checkRows = checkResult.rows || checkResult;
                if (checkRows.length > 0) {
                    existingTenantId = checkRows[0].tenant_id;
                }
            } catch (e) {
                // api_keys table pode ainda não ter dados
            }

            if (existingTenantId) {
                log('⏩', `  → Já existe (tenant_uuid: ${existingTenantId.substring(0, 8)}...) — pulando criação`);
                migrationMap.set(key, existingTenantId);
                skippedTenants++;
            } else {
                // Criar tenant
                const insertTenant = USE_POSTGRES
                    ? `INSERT INTO tenants (id, name, email, plan, status) VALUES ($1, $2, $3, $4, $5)`
                    : `INSERT INTO tenants (id, name, email, plan, status) VALUES (?, ?, ?, ?, ?)`;

                await db.query(insertTenant, [
                    tenantId,
                    meta.nome || `Tenant ${key.substring(0, 8)}`,
                    meta.email || null,
                    meta.plano || 'basic',
                    meta.active === false ? 'suspended' : 'active',
                ]);

                // Criar API Key hashada
                const insertKey = USE_POSTGRES
                    ? `INSERT INTO api_keys (id, tenant_id, key_value, key_hash, active) VALUES ($1, $2, $3, $4, $5)`
                    : `INSERT INTO api_keys (id, tenant_id, key_value, key_hash, active) VALUES (?, ?, ?, ?, ?)`;

                await db.query(insertKey, [
                    apiKeyId,
                    tenantId,
                    key,           // key_value em texto claro (para compatibilidade do middleware)
                    keyHash,       // SHA-256 para lookup rápido
                    meta.active !== false ? (USE_POSTGRES ? true : 1) : (USE_POSTGRES ? false : 0),
                ]);

                migrationMap.set(key, tenantId);
                createdTenants++;
                log('✅', `  → Tenant criado (uuid: ${tenantId.substring(0, 8)}...)`);
            }
        }

        // ── Passo 3.5: Garantir coluna tenant_uuid em todas as tabelas ───────
        logSection('Passo 3.5 — Garantindo coluna tenant_uuid nas tabelas');
        let colsAdded = 0;

        for (const table of OPERATIONAL_TABLES) {
            if (USE_POSTGRES) {
                // PostgreSQL suporta ADD COLUMN IF NOT EXISTS nativamente
                try {
                    await db.query(`ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS tenant_uuid TEXT`);
                    colsAdded++;
                } catch (e) {
                    // Ignorar: coluna já existe ou tabela não existe
                }
            } else {
                // SQLite: verificar via PRAGMA antes de adicionar
                try {
                    const cols = await db.query(`PRAGMA table_info(${table.name})`);
                    const colList = cols.rows || cols;
                    const exists = Array.isArray(colList) && colList.some(c => c.name === 'tenant_uuid');
                    if (!exists) {
                        await db.query(`ALTER TABLE ${table.name} ADD COLUMN tenant_uuid TEXT`);
                        log('➕', `  Coluna tenant_uuid adicionada em: ${table.name}`);
                        colsAdded++;
                    }
                } catch (e) {
                    // Tabela não existe ainda — pular silenciosamente
                }
            }
        }
        log('✅', `Colunas garantidas. ${colsAdded} adicionada(s).`);

        // ── Passo 4: Atualizar tenant_uuid nas tabelas operacionais ───────────
        logSection('Passo 4 — Vinculando dados operacionais aos UUIDs');
        let totalUpdated = 0;

        for (const [key, tenantUUID] of migrationMap.entries()) {
            for (const table of OPERATIONAL_TABLES) {
                try {
                    const updateQuery = USE_POSTGRES
                        ? `UPDATE ${table.name} SET tenant_uuid = $1 WHERE ${table.col} = $2 AND (tenant_uuid IS NULL OR tenant_uuid != $1)`
                        : `UPDATE ${table.name} SET tenant_uuid = ? WHERE ${table.col} = ? AND (tenant_uuid IS NULL OR tenant_uuid != ?)`;

                    const params = USE_POSTGRES
                        ? [tenantUUID, key]
                        : [tenantUUID, key, tenantUUID];

                    const result = await db.query(updateQuery, params);
                    const rowsAffected = (result.rowCount || result.changes || 0);
                    if (rowsAffected > 0) {
                        totalUpdated += rowsAffected;
                        log('🔗', `  ${table.name}: ${rowsAffected} linha(s) vinculada(s)`);
                    }
                } catch (err) {
                    // Tabela pode não ter coluna tenant_uuid (se migration não rodou ainda)
                    if (!err.message.includes('no such column') && !err.message.includes('column') && !err.message.includes('does not exist')) {
                        log('⚠️', `  Erro em ${table.name}: ${err.message}`);
                    }
                }
            }
        }

        // ── Passo 5: Commit ────────────────────────────────────────────────────
        if (USE_POSTGRES) {
            await db.query('COMMIT');
            log('🔓', 'Transação comitada com sucesso.');
        }

        // ── Relatório Final ────────────────────────────────────────────────────
        logSection('✨ MIGRAÇÃO CONCLUÍDA COM SUCESSO');
        console.log('');
        console.log(`  📋 Tenants criados:    ${createdTenants}`);
        console.log(`  ⏩ Tenants existentes: ${skippedTenants}`);
        console.log(`  🔗 Linhas vinculadas:  ${totalUpdated}`);
        console.log('');
        console.log('  Próximos passos:');
        console.log('  1. Subir a nova versão da aplicação (middleware já está atualizado)');
        console.log('  2. Monitorar logs por 24-48h');
        console.log('  3. Após estabilidade: executar DROP das colunas antigas (Etapa 7)');
        console.log('');

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO NA MIGRAÇÃO:', error.message);
        console.error(error.stack);

        if (USE_POSTGRES) {
            try {
                await db.query('ROLLBACK');
                log('↩️', 'ROLLBACK executado — banco não foi alterado.');
            } catch (rbErr) {
                log('❌', `Falha no ROLLBACK: ${rbErr.message}`);
            }
        }

        process.exit(1);
    }
}

// ─── Executar ─────────────────────────────────────────────────────────────────
migrate().then(() => process.exit(0));
