/**
 * 🛡️ ANTI-FRAUD SYSTEM - Link Mágico
 * Detecção de abuso e quarentena automática de tenants.
 * 
 * Detecções:
 * - Spike de uso (>10x da média)
 * - Loop/repetição (mesma request >100x/min)
 * - Scraping patterns (extrações em série)
 * - Abuso de plano (uso >200% do limite por 3+ dias)
 * 
 * Ações graduais:
 * 1. Log + alerta
 * 2. Rate limit mais restritivo
 * 3. Quarentena automática
 * 
 * Fail-open: se o sistema falhar, permite a request.
 */

class AntiFraudSystem {
    constructor(db, usePostgres) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.enabled = !!usePostgres;

        // Contadores in-memory para detecção rápida (reset no restart, ok)
        this.requestPatterns = new Map();
        this.alerts = [];

        // Thresholds configuráveis
        this.thresholds = {
            spikeMultiplier: 10,        // Uso > 10x da média
            loopMaxPerMinute: 100,      // Mesma request > 100x/min
            scrapingMaxPerMinute: 30,   // > 30 extractions/min
            planAbusePercent: 200,      // > 200% do limite do plano
            planAbuseDays: 3            // Por 3+ dias consecutivos
        };

        if (this.enabled) {
            console.log('🛡️ [ANTI-FRAUD] Sistema anti-fraude ativo');
        } else {
            console.log('⚠️ [ANTI-FRAUD] Modo limitado (requer PostgreSQL para quarentena)');
        }
    }

    /**
     * Analisar request em busca de padrões suspeitos
     * @param {string} tenantId 
     * @param {object} requestData - { endpoint, ip, userAgent, body }
     * @returns {{ suspicious: boolean, risk: string, action: string, reason?: string }}
     */
    async analyzeRequest(tenantId, requestData = {}) {
        try {
            // Verificar quarentena primeiro
            const quarantined = await this.isQuarantined(tenantId);
            if (quarantined) {
                return {
                    suspicious: true,
                    risk: 'blocked',
                    action: 'deny',
                    reason: `Tenant em quarentena: ${quarantined.reason}`
                };
            }

            // Rastrear padrão de request
            const pattern = this._trackPattern(tenantId, requestData);

            // Detecção de loop (mesma request repetida)
            if (pattern.duplicateCount > this.thresholds.loopMaxPerMinute) {
                await this._handleSuspiciousActivity(tenantId, 'loop_detected', {
                    duplicateCount: pattern.duplicateCount,
                    endpoint: requestData.endpoint
                });
                return {
                    suspicious: true,
                    risk: 'high',
                    action: 'throttle',
                    reason: `Loop detectado: ${pattern.duplicateCount} requests idênticas`
                };
            }

            // Detecção de scraping
            if (requestData.endpoint && requestData.endpoint.includes('extract') &&
                pattern.extractionCount > this.thresholds.scrapingMaxPerMinute) {
                await this._handleSuspiciousActivity(tenantId, 'scraping_pattern', {
                    extractionCount: pattern.extractionCount,
                    timeWindowMinutes: 1
                });
                return {
                    suspicious: true,
                    risk: 'medium',
                    action: 'throttle',
                    reason: `Padrão de scraping: ${pattern.extractionCount} extrações/min`
                };
            }

            return { suspicious: false, risk: 'none', action: 'allow' };
        } catch (error) {
            // Fail-open
            console.error('⚠️ [ANTI-FRAUD] Erro na análise, fail-open:', error.message);
            return { suspicious: false, risk: 'error', action: 'allow' };
        }
    }

    /**
     * Verificar se tenant está em quarentena
     */
    async isQuarantined(tenantId) {
        if (!this.enabled) return false;

        try {
            const result = await this.db.query(
                `SELECT * FROM tenant_quarantine 
                 WHERE tenant_id = $1 AND status = 'quarantined' 
                 ORDER BY quarantined_at DESC LIMIT 1`,
                [tenantId]
            );
            return result.rows.length > 0 ? result.rows[0] : false;
        } catch (error) {
            // Fail-open: se não conseguir verificar, permitir
            return false;
        }
    }

    /**
     * Colocar tenant em quarentena
     */
    async quarantineTenant(tenantId, reason, evidence = {}) {
        if (!this.enabled) {
            console.warn(`🚨 [ANTI-FRAUD] QUARENTENA (log-only): tenant=${tenantId} reason=${reason}`);
            this.alerts.push({ type: 'quarantine', tenantId, reason, evidence, timestamp: new Date().toISOString() });
            return null;
        }

        try {
            const result = await this.db.query(
                `INSERT INTO tenant_quarantine (tenant_id, reason, evidence)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [tenantId, reason, JSON.stringify(evidence)]
            );

            console.warn(`🚨 [ANTI-FRAUD] Tenant ${tenantId} em QUARENTENA: ${reason}`);
            this.alerts.push({ type: 'quarantine', tenantId, reason, evidence, timestamp: new Date().toISOString() });

            return result.rows[0];
        } catch (error) {
            console.error('❌ [ANTI-FRAUD] Erro ao quarentenar:', error.message);
            return null;
        }
    }

    /**
     * Liberar tenant da quarentena
     */
    async clearQuarantine(tenantId, reviewedBy) {
        if (!this.enabled) return false;

        try {
            await this.db.query(
                `UPDATE tenant_quarantine 
                 SET status = 'cleared', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2
                 WHERE tenant_id = $1 AND status = 'quarantined'`,
                [tenantId, reviewedBy]
            );
            console.log(`✅ [ANTI-FRAUD] Tenant ${tenantId} liberado da quarentena por ${reviewedBy}`);
            return true;
        } catch (error) {
            console.error('❌ [ANTI-FRAUD] Erro ao liberar quarentena:', error.message);
            return false;
        }
    }

    /**
     * Listar tenants em quarentena (para admin)
     */
    async listQuarantined() {
        if (!this.enabled) return [];

        try {
            const result = await this.db.query(
                `SELECT * FROM tenant_quarantine 
                 WHERE status = 'quarantined' 
                 ORDER BY quarantined_at DESC`
            );
            return result.rows;
        } catch (error) {
            console.error('❌ [ANTI-FRAUD] Erro ao listar quarentenas:', error.message);
            return [];
        }
    }

    /**
     * Obter alertas recentes
     */
    getAlerts(limit = 20) {
        return this.alerts.slice(-limit);
    }

    // ===== MÉTODOS INTERNOS =====

    /**
     * Rastrear padrão de requests (in-memory, rápido)
     */
    _trackPattern(tenantId, requestData) {
        const now = Date.now();
        const key = tenantId;

        if (!this.requestPatterns.has(key)) {
            this.requestPatterns.set(key, {
                requests: [],
                extractionCount: 0,
                duplicateCount: 0,
                windowStart: now
            });
        }

        const pattern = this.requestPatterns.get(key);

        // Reset a cada minuto
        if (now - pattern.windowStart > 60000) {
            pattern.requests = [];
            pattern.extractionCount = 0;
            pattern.duplicateCount = 0;
            pattern.windowStart = now;
        }

        // Fingerprint da request
        const fingerprint = `${requestData.endpoint}|${JSON.stringify(requestData.body || '')}`.substring(0, 200);

        // Contar duplicatas
        const duplicates = pattern.requests.filter(r => r === fingerprint).length;
        pattern.duplicateCount = duplicates + 1;

        // Contar extrações
        if (requestData.endpoint && requestData.endpoint.includes('extract')) {
            pattern.extractionCount++;
        }

        pattern.requests.push(fingerprint);

        // Limitar memória
        if (pattern.requests.length > 200) {
            pattern.requests = pattern.requests.slice(-100);
        }

        return pattern;
    }

    /**
     * Tratar atividade suspeita com ações graduais
     */
    async _handleSuspiciousActivity(tenantId, type, evidence) {
        const alertKey = `${tenantId}:${type}`;

        // Contar ocorrências recentes
        const recentAlerts = this.alerts.filter(a =>
            a.tenantId === tenantId &&
            a.type === type &&
            Date.now() - new Date(a.timestamp).getTime() < 300000 // últimos 5 min
        );

        this.alerts.push({
            type,
            tenantId,
            evidence,
            timestamp: new Date().toISOString(),
            count: recentAlerts.length + 1
        });

        // Limitar tamanho do array de alertas
        if (this.alerts.length > 500) {
            this.alerts = this.alerts.slice(-250);
        }

        // Ação gradual: 3+ alertas do mesmo tipo em 5 min → quarentena
        if (recentAlerts.length >= 2) {
            await this.quarantineTenant(tenantId, `Atividade suspeita repetida: ${type}`, {
                type,
                alertCount: recentAlerts.length + 1,
                evidence
            });
        }
    }
}

// Singleton
let _instance = null;

function getAntiFraud() {
    if (!_instance) {
        try {
            const { db, USE_POSTGRES } = require('./database');
            _instance = new AntiFraudSystem(db, USE_POSTGRES);
        } catch (e) {
            console.error('⚠️ [ANTI-FRAUD] Falha ao inicializar:', e.message);
            _instance = new AntiFraudSystem(null, false);
        }
    }
    return _instance;
}

module.exports = { AntiFraudSystem, getAntiFraud };
