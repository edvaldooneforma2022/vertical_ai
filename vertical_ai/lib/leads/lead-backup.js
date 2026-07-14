/**
 * 🔐 SISTEMA DE BACKUP AUTOMÁTICO DE LEADS - Link Mágico V8.0
 * 
 * Módulo extraído da refatoração Fase 5.
 * Gerencia backups automáticos de leads com:
 * - Backup diário automático
 * - Limpeza de backups antigos
 * - Restauração de backups
 */

const fs = require('fs');
const path = require('path');

// ===== FUNÇÕES AUXILIARES =====

function getTenantBackupDirPath(apiKey, baseDir = __dirname) {
    // Se baseDir aponta para lib/leads, subir 2 níveis para raiz do projeto
    const projectRoot = baseDir.includes('lib') ? path.resolve(baseDir, '..', '..') : baseDir;
    const dataDir = path.join(projectRoot, "data");
    const tenantDir = path.join(dataDir, "tenants");

    // Garantir que o diretório existe
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }

    const backupDir = path.join(tenantDir, apiKey, "backups");

    // Garantir que o diretório de backup existe
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    return backupDir;
}

// ===== CLASSE PRINCIPAL =====

class LeadBackupSystem {
    /**
     * @param {Object} leadSystem - Instância do LeadCaptureSystem
     * @param {string} apiKey - Chave da API do tenant
     * @param {Object} deps - Dependências injetadas
     * @param {string} deps.baseDir - Diretório base para arquivos
     */
    constructor(leadSystem, apiKey, deps = {}) {
        this.leadSystem = leadSystem;
        this.apiKey = apiKey;
        this.baseDir = deps.baseDir || __dirname;
        this.backupDir = getTenantBackupDirPath(this.apiKey, this.baseDir);
        this.ensureBackupDirectory();
        this.maxBackups = 7; // Manter últimos 7 dias
        this.backupInterval = 24 * 60 * 60 * 1000; // 24 horas
        console.log(`🔐 Sistema de Backup Inicializado`);
        console.log(`📁 Diretório de backups: ${this.backupDir}`);

        // Fazer backup inicial
        this.createBackup("startup");

        // Agendar backup diário
        this.scheduleAutomaticBackups();
    }

    ensureBackupDirectory() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
                console.log(`📁 Diretório de backups criado: ${this.backupDir}`);
            }
        } catch (error) {
            console.error("❌ Erro ao criar diretório de backups:", error);
        }
    }

    createBackup(type = "manual") {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `leads-backup-${type}-${timestamp}.json`;
            const backupPath = path.join(this.backupDir, filename);

            const backupData = {
                timestamp: new Date().toISOString(),
                type: type,
                leadsCount: this.leadSystem.leads.length,
                leads: this.leadSystem.leads
            };

            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            console.log(`✅ Backup criado: ${filename} (${this.leadSystem.leads.length} leads)`);

            // Limpar backups antigos
            this.cleanOldBackups();

            return { success: true, filename, path: backupPath };
        } catch (error) {
            console.error("❌ Erro ao criar backup:", error);
            return { success: false, error: error.message };
        }
    }

    cleanOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith("leads-backup-"))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            // Manter apenas os últimos maxBackups
            if (files.length > this.maxBackups) {
                const filesToDelete = files.slice(this.maxBackups);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    console.log(`🗑️ Backup antigo removido: ${file.name}`);
                });
            }
        } catch (error) {
            console.error("❌ Erro ao limpar backups antigos:", error);
        }
    }

    listBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith("leads-backup-"))
                .map(f => {
                    const filePath = path.join(this.backupDir, f);
                    const stats = fs.statSync(filePath);
                    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
                    return {
                        filename: f,
                        timestamp: data.timestamp,
                        type: data.type,
                        leadsCount: data.leadsCount,
                        size: stats.size,
                        created: stats.mtime
                    };
                })
                .sort((a, b) => new Date(b.created) - new Date(a.created));

            return files;
        } catch (error) {
            console.error("❌ Erro ao listar backups:", error);
            return [];
        }
    }

    restoreBackup(filename) {
        try {
            const backupPath = path.join(this.backupDir, filename);

            if (!fs.existsSync(backupPath)) {
                return { success: false, error: "Backup não encontrado" };
            }

            const backupData = JSON.parse(fs.readFileSync(backupPath, "utf8"));

            // Criar backup do estado atual antes de restaurar
            this.createBackup("pre-restore");

            // Restaurar leads
            this.leadSystem.leads = backupData.leads;
            this.leadSystem.saveLeads();

            console.log(`✅ Backup restaurado: ${filename} (${backupData.leadsCount} leads)`);

            return {
                success: true,
                leadsCount: backupData.leadsCount,
                timestamp: backupData.timestamp
            };
        } catch (error) {
            console.error("❌ Erro ao restaurar backup:", error);
            return { success: false, error: error.message };
        }
    }

    scheduleAutomaticBackups() {
        setInterval(() => {
            console.log("⏰ Executando backup automático diário...");
            this.createBackup("daily");
        }, this.backupInterval);

        console.log(`⏰ Backup automático agendado (a cada 24 horas)`);
    }

    setupShutdownHook() {
        const shutdown = () => {
            console.log("🛑 Servidor encerrando - Criando backup final...");
            this.createBackup("shutdown");
            process.exit(0);
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
}

// ===== FACTORY FUNCTIONS =====

function getBackupSystem(leadSystem, apiKey, deps = {}) {
    return new LeadBackupSystem(leadSystem, apiKey, deps);
}

// ===== EXPORTS =====
module.exports = {
    LeadBackupSystem,
    getBackupSystem,
    getTenantBackupDirPath
};
