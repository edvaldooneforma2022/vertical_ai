/**
 * 📱 WHATSAPP CHANNEL - Link Mágico V21
 * Canal PURO de transporte — consome o mesmo endpoint do Link Curto
 *
 * SAFE PATCH - WA-CHANNEL-002 (V21 PARITY)
 *
 * PRINCÍPIO: Canal ≠ Inteligência
 * WhatsApp apenas: recebe → resolve tenant → envia ao Unified Brain → entrega resposta
 * Toda decisão comercial (intent, journey, CTA, captura, agendamento) vem do pipeline central.
 *
 * NÃO ALTERA: server.js, motores de IA, prompts, CRM core,
 * pipeline, analytics core, billing core, widget, link curto.
 *
 * Provedores:
 *   Fase 2A — Evolution API (principal)
 *   Fase 2B — Meta Cloud API (futuro)
 *   Fase 2C — Twilio (compatibilidade)
 */

const http = require('http');
const crypto = require('crypto');
const { validateTenantId } = require('./lib/tenant-identity-helper');
const { isWhatsAppOperational } = require('./lib/whatsapp-gate');

// ════════════════════════════════════════════════════════════════
// V21 PARITY: Auditoria de paridade WhatsApp ↔ Link Curto
// ════════════════════════════════════════════════════════════════
let waParityAudit = null;
try {
    waParityAudit = require('./lib/wa-parity-audit');
    console.log('📊 [WA-PARITY] Módulo de auditoria V21 carregado');
} catch (_auditLoadErr) {
    console.warn('📊 [WA-PARITY] Auditoria não disponível (sem impacto):', _auditLoadErr.message);
    waParityAudit = { log: () => {} }; // stub silencioso
}

// ============================================================
// CONSTANTES
// ============================================================
const WA_MSG_MAX_LEN    = 4096;
const RATE_LIMIT_MAX    = 30;       // msgs por minuto por telefone
const RATE_LIMIT_WINDOW = 60000;    // 1 minuto
const TENANT_CACHE_TTL  = 300000;   // 5 minutos
const AI_TIMEOUT        = 30000;    // 30 segundos para resposta da IA
const SCHED_EXPIRY_MS   = 86400000; // 24h — slots expiram após 1 dia

// ════════════════════════════════════════════════════════════════
// SEC-09: Deduplicação por waMessageId (anti-replay)
// Cache em memória com TTL de 5 minutos
// ════════════════════════════════════════════════════════════════
const PROCESSED_MSG_IDS = new Map();
const MSG_ID_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Cleanup periódico do cache de deduplicação (a cada 5 min)
const _msgIdDedupCleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, ts] of PROCESSED_MSG_IDS) {
        if (now - ts > MSG_ID_TTL_MS) {
            PROCESSED_MSG_IDS.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 [SEC-09] Cache dedup: ${cleaned} IDs expirados removidos, ${PROCESSED_MSG_IDS.size} ativos`);
    }
}, MSG_ID_TTL_MS);
if (_msgIdDedupCleanupTimer && typeof _msgIdDedupCleanupTimer.unref === 'function') {
    _msgIdDedupCleanupTimer.unref();
}

// ════════════════════════════════════════════════════════════════
// SEC-10: Feature Flag — Autenticação do webhook Evolution
// FEATURE_EVOLUTION_WEBHOOK_AUTH=true → obriga validação de apikey/instanceToken
// FEATURE_EVOLUTION_WEBHOOK_AUTH=false (default) → comportamento atual
// ════════════════════════════════════════════════════════════════
const FEATURE_EVOLUTION_WEBHOOK_AUTH = process.env.FEATURE_EVOLUTION_WEBHOOK_AUTH === 'true';
const EVOLUTION_WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET
    || process.env.CENTRAL_EVOLUTION_API_KEY
    || '';

// ════════════════════════════════════════════════════════════════
// SEC-12: Métricas de webhook (contadores in-memory)
// ════════════════════════════════════════════════════════════════
const webhookMetrics = {
    received: 0,
    rejected_auth: 0,
    rejected_rate_limit: 0,
    duplicated: 0,
    processed: 0,
    errors: 0,
    last_reset: new Date().toISOString()
};

// SEC-12: Rate limiting do webhook por IP (100 req/min)
const WEBHOOK_IP_LIMITS = new Map();
const WH_IP_MAX_PER_MIN = 100;
const WH_IP_WINDOW_MS = 60000;

// ════════════════════════════════════════════════════════════════
// V21 FEATURE FLAG: Rollback instantâneo para pipeline anterior
// WA_USE_FULL_PIPELINE=true  → /api/process-chat-inteligente (Link Curto)
// WA_USE_FULL_PIPELINE=false → /api/chat-universal (legado)
// ════════════════════════════════════════════════════════════════
const WA_USE_FULL_PIPELINE = process.env.WA_USE_FULL_PIPELINE !== 'false';

// ═══ V21 FIX — Channel Safe Routing (schedule URL correto no WhatsApp) ═══
const _channelSafeRouting = require('./lib/channel-safe-routing');

// ============================================================
// CLASSE PRINCIPAL
// ============================================================
class WhatsAppChannel {

    /**
     * @param {Object} deps - Dependências injetadas
     * @param {Object} deps.db            - Instância do banco
     * @param {boolean} deps.USE_POSTGRES - Flag PostgreSQL
     * @param {Function} deps.getLeadSystem - Factory de LeadCaptureSystem
     * @param {Object} deps.whatsappManager - whatsapp-integration singleton
     * @param {Object} deps.analytics       - Objeto de analytics global
     * @param {Function} deps.getApiKeyManager - Factory do ApiKeyManager (Fase 2B)
     */
    constructor(deps) {
        this.db            = deps.db;
        this.USE_POSTGRES  = deps.USE_POSTGRES;
        this.getLeadSystem = deps.getLeadSystem;
        this.whatsappMgr   = deps.whatsappManager;
        this.analytics     = deps.analytics;
        this.deps          = deps;  // Fase 2B: referência completa para _syncAppointmentToMemory
        this.serverPort    = parseInt(process.env.PORT, 10) || 3000;

        // Caches
        this._tenantCache  = new Map();   // instanceName → { apiKey, ... }
        this._rateLimits   = new Map();   // phone → [timestamps]
        this._currentApiKey = null;       // @deprecated - mantido para compatibilidade, não usar como identidade de requisições concorrentes

        // V22.1: Inicializar tabela de scheduling (PostgreSQL)
        this._initScheduleTable();

        // Fila persistente e recuperação durável de mensagens Meta
        this._isProcessingQueue = false;
        this._queueWorkerInterval = null;

        // Fase 2B: Reconciliar agendamentos travados em booking_in_progress (apenas se operacional)
        if (isWhatsAppOperational()) {
            this._reconcileStaleBookings();
            this._reconcileInterval = setInterval(() => this._reconcileStaleBookings(), 300000); // 5 min
            if (this._reconcileInterval && typeof this._reconcileInterval.unref === 'function') {
                this._reconcileInterval.unref();
            }
        }

        console.log('📱 [WA-CHANNEL] Módulo de canal WhatsApp inicializado');
    }

    /**
     * Encerramento explícito de recursos e timers (usado para teardown gracioso em testes e shutdown).
     */
    destroy() {
        if (this._reconcileInterval) {
            clearInterval(this._reconcileInterval);
            this._reconcileInterval = null;
        }
        this.stopQueueWorker();
    }

    // ============================================================
    // V22.1 SCHEDULING CONVERSACIONAL — Persistência em PostgreSQL
    // Tabela: wa_schedule_pending
    // Fluxo: interruptível + retomável + persistido
    // Reutiliza: /api/public/availability/:hash + /api/public/book/:hash
    // ============================================================
    async _initScheduleTable() {
        if (!this.USE_POSTGRES) return;
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS wa_schedule_pending (
                    id SERIAL PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    api_key TEXT NOT NULL,
                    calendar_hash TEXT NOT NULL,
                    slots_json TEXT NOT NULL,
                    state TEXT NOT NULL DEFAULT 'offered',
                    selected_date TEXT,
                    selected_time TEXT,
                    lead_id TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            console.log('📅 [WA-SCHED] Tabela wa_schedule_pending verificada/criada');
        } catch (err) {
            console.warn('📅 [WA-SCHED] Erro ao criar tabela (não bloqueia):', err.message);
        }
    }

    /**
     * Buscar agendamento pendente para esta conversa (não expirado).
     * Fase 2B: Filtrar por tenant_id para isolamento multi-tenant.
     * @param {string} conversationId
     * @param {string} tenantId - UUID do tenant (obrigatório)
     * @returns {Object|null} { id, calendar_hash, slots_json, state, selected_date, selected_time, api_key, tenant_id }
     */
    async _getSchedulePending(conversationId, tenantId) {
        if (!this.USE_POSTGRES) return null;
        if (!tenantId) {
            console.warn('📅 [WA-SCHED] _getSchedulePending: tenantId ausente — recusando busca');
            return null;
        }
        try {
            const result = await this.db.query(
                `SELECT * FROM wa_schedule_pending
                 WHERE conversation_id = $1
                   AND tenant_id = $2
                   AND state IN ('offered', 'selected')
                   AND created_at > NOW() - INTERVAL '24 hours'
                 ORDER BY created_at DESC LIMIT 1`,
                [conversationId, tenantId]
            );
            return result?.rows?.[0] || null;
        } catch (err) {
            console.warn('📅 [WA-SCHED] Erro ao buscar pending:', err.message);
            return null;
        }
    }

    /**
     * Salvar oferta de agendamento (slots disponíveis) — versão transacional.
     * Fase 2B: Usa transação PostgreSQL, inclui tenant_id, retorna boolean.
     * @param {string} conversationId
     * @param {string} apiKey
     * @param {string} calendarHash
     * @param {Array} slots
     * @param {string|null} leadId
     * @param {string} tenantId - UUID do tenant (obrigatório)
     * @returns {boolean} true se persistiu, false se falhou
     */
    async _saveScheduleOfferStrict(conversationId, apiKey, calendarHash, slots, leadId, tenantId) {
        if (!this.USE_POSTGRES) return false;
        if (!tenantId) {
            console.warn('📅 [WA-SCHED] _saveScheduleOfferStrict: tenantId ausente — persistência cancelada');
            return false;
        }

        // FASE 2B FAIL-CLOSED: Bloquear persistência se infraestrutura falhou
        if (this.deps?.isSchedulingInfrastructureReady && !this.deps.isSchedulingInfrastructureReady()) {
            console.error('🚫 [WA-SCHED][FAIL-CLOSED] _saveScheduleOfferStrict abortado: infraestrutura de agendamento indisponível');
            return false;
        }

        let client;
        try {
            client = await this.db.pool.connect();
            await client.query('BEGIN');

            // Invalidar ofertas anteriores desta conversa E tenant
            await client.query(
                `UPDATE wa_schedule_pending SET state = 'expired', updated_at = NOW()
                 WHERE conversation_id = $1 AND tenant_id = $2 AND state IN ('offered', 'selected')`,
                [conversationId, tenantId]
            );

            // Inserir nova oferta com tenant_id
            await client.query(
                `INSERT INTO wa_schedule_pending
                 (conversation_id, api_key, calendar_hash, slots_json, state, lead_id, tenant_id)
                 VALUES ($1, $2, $3, $4, 'offered', $5, $6)`,
                [conversationId, apiKey, calendarHash, JSON.stringify(slots), leadId || null, tenantId]
            );

            await client.query('COMMIT');
            console.log(`📅 [WA-SCHED] Oferta salva: ${slots.length} slots | conv=${conversationId.substring(0, 20)} | tenant=${tenantId.substring(0, 8)}`);
            return true;
        } catch (err) {
            if (client) {
                try { await client.query('ROLLBACK'); } catch {}
            }
            console.warn('📅 [WA-SCHED] Erro ao salvar oferta:', err.message);
            return false;
        } finally {
            if (client) {
                try { client.release(); } catch {}
            }
        }
    }

    /**
     * @deprecated Usar _saveScheduleOfferStrict. Mantido para referência.
     */
    async _saveScheduleOffer(conversationId, apiKey, calendarHash, slots, leadId) {
        if (!this.USE_POSTGRES) return;
        try {
            await this.db.query(
                `UPDATE wa_schedule_pending SET state = 'expired', updated_at = NOW()
                 WHERE conversation_id = $1 AND state IN ('offered', 'selected')`,
                [conversationId]
            );
            await this.db.query(
                `INSERT INTO wa_schedule_pending
                 (conversation_id, api_key, calendar_hash, slots_json, state, lead_id)
                 VALUES ($1, $2, $3, $4, 'offered', $5)`,
                [conversationId, apiKey, calendarHash, JSON.stringify(slots), leadId || null]
            );
            console.log(`📅 [WA-SCHED] Oferta salva (legado): ${slots.length} slots`);
        } catch (err) {
            console.warn('📅 [WA-SCHED] Erro ao salvar oferta:', err.message);
        }
    }

    /**
     * Atualizar estado do agendamento pendente.
     * Fase 2B: Filtrar por tenant_id, retornar boolean.
     * @param {number} pendingId
     * @param {string} state
     * @param {string|null} selectedDate
     * @param {string|null} selectedTime
     * @param {string} tenantId - UUID do tenant (obrigatório)
     * @returns {boolean} true se atualizou exatamente 1 linha
     */
    async _updateScheduleState(pendingId, state, selectedDate, selectedTime, tenantId) {
        if (!this.USE_POSTGRES || !tenantId) {
            console.warn('📅 [WA-SCHED] _updateScheduleState: postgres ou tenantId ausente');
            return false;
        }
        try {
            const result = await this.db.query(
                `UPDATE wa_schedule_pending
                 SET state = $1, selected_date = $2, selected_time = $3, updated_at = NOW()
                 WHERE id = $4 AND tenant_id = $5`,
                [state, selectedDate || null, selectedTime || null, pendingId, tenantId]
            );
            return result.rowCount === 1;
        } catch (err) {
            console.warn('📅 [WA-SCHED] Erro ao atualizar estado:', err.message);
            return false;
        }
    }

    /**
     * Verificar se a mensagem é uma resposta de agendamento.
     * Retorna a resposta pronta OU null (pass-through para pipeline normal).
     *
     * Fase 2B: Recebe tenantId para isolamento multi-tenant.
     * Usa _executeBookingDirect em vez de _executeBooking (HTTP loopback).
     *
     * INTERRUPTÍVEL: Se a mensagem não é numérica nem confirmação,
     * retorna null → pipeline normal responde → estado permanece.
     *
     * @param {string} conversationId
     * @param {string} message
     * @param {string} apiKey
     * @param {Object} lead
     * @param {string} tenantId - UUID do tenant (obrigatório)
     */
    async _handleScheduleResponse(conversationId, message, apiKey, lead, tenantId) {
        if (!tenantId) {
            console.warn('📅 [WA-SCHED] _handleScheduleResponse: tenantId ausente — ignorando');
            return null;
        }

        // FASE 2B FAIL-CLOSED: Se a infraestrutura de agendamento estiver indisponível
        if (this.deps?.isSchedulingInfrastructureReady && !this.deps.isSchedulingInfrastructureReady()) {
            console.warn('📅 [WA-SCHED][FAIL-CLOSED] Agendamento temporariamente indisponível devido a falha na infraestrutura de integridade');
            return '⚠️ O agendamento está temporariamente indisponível para manutenção de segurança. Por favor, tente novamente mais tarde.';
        }
        try {
            const pending = await this._getSchedulePending(conversationId, tenantId);
            if (!pending) return null;

            const msg = (message || '').trim().toLowerCase();

            // ── STATE: offered (aguardando seleção de horário) ──
            if (pending.state === 'offered') {
                // Verificar se é um número (seleção de slot)
                const num = parseInt(msg, 10);
                const slots = JSON.parse(pending.slots_json || '[]');
                if (!isNaN(num) && num >= 1 && num <= slots.length) {
                    const chosen = slots[num - 1];
                    await this._updateScheduleState(pending.id, 'selected', chosen.date, chosen.time, tenantId);
                    const dateFormatted = chosen.date.split('-').reverse().join('/');
                    console.log(`📅 [WA-SCHED] Slot selecionado: #${num} → ${chosen.dayName} ${chosen.date} ${chosen.time}`);
                    return `Perfeito! Confirme seu agendamento:\n\n📅 ${chosen.dayName} — ${dateFormatted}\n🕒 ${chosen.time}\n\nDigite *SIM* para confirmar ou *NÃO* para cancelar.`;
                }
                // NÃO é um número → interrupção normal, pipeline responde
                // O estado 'offered' permanece para retomada posterior
                return null;
            }

            // ── STATE: selected (aguardando confirmação SIM/NÃO) ──
            if (pending.state === 'selected') {
                if (msg === 'sim' || msg === 'confirmo' || msg === 'confirmar' || msg === 's') {
                    // Fase 2B: Booking direto via transação PostgreSQL (sem HTTP loopback)
                    const bookResult = await this._executeBookingDirect(pending, lead, tenantId);

                    if (bookResult.success) {
                        const dateFormatted = pending.selected_date.split('-').reverse().join('/');
                        if (bookResult.wasDuplicate) {
                            console.log(`📅 [WA-SCHED] Booking idempotente: ${bookResult.appointmentId}`);
                        } else {
                            console.log(`📅 [WA-SCHED] ✅ Booking confirmado: ${bookResult.appointmentId} | ${pending.selected_date} ${pending.selected_time}`);
                        }
                        // Atualizar array em memória (best-effort, com deduplicação e contexto seguro da requisição)
                        this._syncAppointmentToMemory(pending, lead, bookResult.appointmentId, { apiKey, tenantId });

                        return `✅ Agendamento confirmado!\n\n📅 ${dateFormatted}\n🕒 ${pending.selected_time}\n\nVocê receberá uma confirmação. Até breve! 🙌`;
                    }

                    // Falha — distinguir motivo para log adequado
                    if (bookResult.pendingState === 'completed') {
                        console.warn(`[SCHEDULE] Pending ${pending.id} completed sem appointment recuperável`);
                    }
                    console.warn(`📅 [WA-SCHED] Booking falhou: reason=${bookResult.reason}`);
                    return `⚠️ Houve um problema ao confirmar o agendamento. Por favor, tente novamente dizendo "quero agendar".`;
                }
                if (msg === 'não' || msg === 'nao' || msg === 'cancelar' || msg === 'n') {
                    await this._updateScheduleState(pending.id, 'cancelled', null, null, tenantId);
                    console.log(`📅 [WA-SCHED] Agendamento cancelado pelo usuário`);
                    return `Sem problemas! O agendamento foi cancelado. Se quiser reagendar, é só dizer "quero agendar" 😊`;
                }
                // Nem SIM nem NÃO → interrupção, pipeline responde
                // Estado 'selected' permanece para retomada
                return null;
            }

            return null;
        } catch (err) {
            console.warn('📅 [WA-SCHED] Erro no handleScheduleResponse:', err.message);
            return null; // Fallback: pipeline normal
        }
    }

    // ============================================================
    // FASE 2B: BOOKING DIRETO (TRANSAÇÃO POSTGRESQL)
    // Substitui o HTTP loopback (_executeBooking) para o fluxo WhatsApp.
    // Transação única: CAS → INSERT appointment → UPDATE pending → COMMIT
    // ============================================================

    /**
     * Executar booking diretamente no PostgreSQL com transação atômica.
     * @param {Object} pending - Registro de wa_schedule_pending
     * @param {Object} lead - Lead associado
     * @param {string} tenantId - UUID do tenant
     * @returns {{ success: boolean, appointmentId?: string, wasDuplicate?: boolean, reason?: string, pendingState?: string }}
     */
    async _executeBookingDirect(pending, lead, tenantId) {
        if (!this.USE_POSTGRES) return { success: false, reason: 'no_postgres' };
        if (!tenantId) return { success: false, reason: 'no_tenant' };

        // FASE 2B FAIL-CLOSED: Bloquear confirmação se infraestrutura de integridade falhou
        if (this.deps?.isSchedulingInfrastructureReady && !this.deps.isSchedulingInfrastructureReady()) {
            console.error('🚫 [WA-SCHED][FAIL-CLOSED] _executeBookingDirect abortado: infraestrutura de agendamento indisponível');
            return { success: false, reason: 'scheduling_infrastructure_unavailable' };
        }

        let client;
        try {
            client = await this.db.pool.connect();
            await client.query('BEGIN');

            // ── PASSO 1: CAS (Compare-And-Swap) ──
            const cas = await client.query(
                `UPDATE wa_schedule_pending
                 SET state = 'booking_in_progress', updated_at = NOW()
                 WHERE id = $1 AND tenant_id = $2 AND state = 'selected'
                 RETURNING id`,
                [pending.id, tenantId]
            );

            if (cas.rowCount !== 1) {
                // CAS não adquiriu o pending.
                await client.query('ROLLBACK');

                // ── RECUPERAÇÃO IDEMPOTENTE ──
                // Snapshot fresco após ROLLBACK — conexão ainda válida.
                const currentState = await client.query(
                    `SELECT state FROM wa_schedule_pending
                     WHERE id = $1 AND tenant_id = $2`,
                    [pending.id, tenantId]
                );

                const state = currentState.rows[0]?.state;

                if (state === 'completed' || state === 'booking_in_progress') {
                    // Pending já foi processado. Buscar appointment existente.
                    const existingAppt = await client.query(
                        `SELECT id FROM tenant_appointments
                         WHERE schedule_ref_id = $1 AND tenant_uuid = $2`,
                        [String(pending.id), tenantId]
                    );

                    if (existingAppt.rows.length > 0) {
                        // Appointment encontrado e pertence ao tenant — sucesso idempotente.
                        return {
                            success: true,
                            appointmentId: existingAppt.rows[0].id,
                            wasDuplicate: true
                        };
                    }

                    // Appointment não encontrado para este tenant — verificar inconsistência.
                    const orphanCheck = await client.query(
                        `SELECT id, tenant_uuid FROM tenant_appointments
                         WHERE schedule_ref_id = $1`,
                        [String(pending.id)]
                    );
                    if (orphanCheck.rows.length > 0) {
                        console.error(
                            `[SCHEDULE][INTEGRIDADE] schedule_ref_id=${pending.id} `
                            + `pertence a tenant_uuid=${orphanCheck.rows[0].tenant_uuid}, `
                            + `mas o pending pertence a tenant_id=${tenantId}`
                        );
                    }
                }

                return { success: false, reason: 'cas_failed', pendingState: state || 'not_found' };
            }

            // ── PASSO 2: INSERT appointment ──
            const appointmentId = crypto.randomBytes(8).toString('hex');
            const scheduleRefId = String(pending.id);

            const insertResult = await client.query(
                `INSERT INTO tenant_appointments
                    (id, api_key, lead_id, datetime, status, notes, metadata,
                     schedule_ref_id, tenant_uuid)
                 VALUES ($1, $2, $3, $4, 'pendente', $5, $6, $7, $8)
                 ON CONFLICT (schedule_ref_id)
                    WHERE schedule_ref_id IS NOT NULL
                 DO NOTHING
                 RETURNING id`,
                [
                    appointmentId,
                    pending.api_key,
                    lead?.id || null,
                    `${pending.selected_date} ${pending.selected_time}`,
                    'Agendado via WhatsApp Conversacional',
                    JSON.stringify({
                        leadName:  lead?.nome || lead?.name || 'WhatsApp',
                        leadEmail: lead?.email || '',
                        leadPhone: lead?.wa_phone || lead?.telefone || '',
                        robotName: 'WhatsApp Conversacional',
                        createdAt: new Date().toISOString()
                    }),
                    scheduleRefId,
                    tenantId
                ]
            );

            // ── PASSO 3: Recuperar appointment (novo ou existente) ──
            let finalAppointmentId;
            if (insertResult.rows.length > 0) {
                finalAppointmentId = insertResult.rows[0].id;
            } else {
                // Conflito no UNIQUE — SELECT separado com novo snapshot.
                const existing = await client.query(
                    `SELECT id FROM tenant_appointments
                     WHERE schedule_ref_id = $1 AND tenant_uuid = $2`,
                    [scheduleRefId, tenantId]
                );
                if (existing.rows.length === 0) {
                    // Conflito no UNIQUE mas appointment pertence a outro tenant.
                    const orphanCheck = await client.query(
                        `SELECT id, tenant_uuid FROM tenant_appointments
                         WHERE schedule_ref_id = $1`,
                        [scheduleRefId]
                    );
                    if (orphanCheck.rows.length > 0) {
                        console.error(
                            `[SCHEDULE][INTEGRIDADE] schedule_ref_id=${scheduleRefId} `
                            + `pertence a tenant_uuid=${orphanCheck.rows[0].tenant_uuid}, `
                            + `esperado=${tenantId}`
                        );
                    }
                    await client.query('ROLLBACK');
                    return { success: false, reason: 'appointment_tenant_mismatch' };
                }
                finalAppointmentId = existing.rows[0].id;
            }

            // ── PASSO 4: UPDATE pending → completed ──
            const complete = await client.query(
                `UPDATE wa_schedule_pending
                 SET state = 'completed', updated_at = NOW()
                 WHERE id = $1 AND tenant_id = $2 AND state = 'booking_in_progress'`,
                [pending.id, tenantId]
            );

            if (complete.rowCount !== 1) {
                await client.query('ROLLBACK');
                return { success: false, reason: 'completion_failed' };
            }

            // ── PASSO 5: COMMIT ──
            await client.query('COMMIT');

            return {
                success: true,
                appointmentId: finalAppointmentId,
                wasDuplicate: insertResult.rows.length === 0
            };

        } catch (err) {
            if (client) {
                try { await client.query('ROLLBACK'); } catch {}
            }
            console.warn('[SCHEDULE] Falha no booking direto:', err.message);
            return { success: false, reason: err.message };
        } finally {
            if (client) {
                try { client.release(); } catch {}
            }
        }
    }

    // ============================================================
    // FASE 2B: RECONCILIAÇÃO DE BOOKINGS TRAVADOS
    // Pendentes em 'booking_in_progress' por mais de 5 minutos.
    // ============================================================

    /**
     * Reconciliar bookings travados em 'booking_in_progress'.
     * Se o appointment foi criado (schedule_ref_id encontrado em tenant_appointments),
     * completar o pending. Caso contrário, reverter para 'selected' para retentativa.
     */
    async _reconcileStaleBookings() {
        if (!this.USE_POSTGRES) return;
        try {
            const staleResult = await this.db.query(
                `SELECT id, tenant_id FROM wa_schedule_pending
                 WHERE state = 'booking_in_progress'
                   AND updated_at < NOW() - INTERVAL '5 minutes'`
            );

            if (!staleResult.rows || staleResult.rows.length === 0) return;

            for (const stale of staleResult.rows) {
                try {
                    // Verificar se appointment foi criado
                    const apptCheck = await this.db.query(
                        `SELECT id FROM tenant_appointments
                         WHERE schedule_ref_id = $1 AND tenant_uuid = $2`,
                        [String(stale.id), stale.tenant_id]
                    );

                    if (apptCheck.rows.length > 0) {
                        // Appointment existe — completar o pending
                        await this.db.query(
                            `UPDATE wa_schedule_pending
                             SET state = 'completed', updated_at = NOW()
                             WHERE id = $1 AND tenant_id = $2 AND state = 'booking_in_progress'`,
                            [stale.id, stale.tenant_id]
                        );
                        console.log(`📅 [WA-SCHED][RECONCILE] Pending ${stale.id} → completed (appointment encontrado)`);
                    } else {
                        // Appointment NÃO existe — reverter para retentativa
                        await this.db.query(
                            `UPDATE wa_schedule_pending
                             SET state = 'selected', updated_at = NOW()
                             WHERE id = $1 AND tenant_id = $2 AND state = 'booking_in_progress'`,
                            [stale.id, stale.tenant_id]
                        );
                        console.log(`📅 [WA-SCHED][RECONCILE] Pending ${stale.id} → selected (sem appointment, retentativa habilitada)`);
                    }
                } catch (recErr) {
                    console.warn(`📅 [WA-SCHED][RECONCILE] Erro no pending ${stale.id}:`, recErr.message);
                }
            }
        } catch (err) {
            // Reconciliação é best-effort — não bloqueia
            console.warn('📅 [WA-SCHED][RECONCILE] Erro geral:', err.message);
        }
    }

    // ============================================================
    // FASE 2B: SINCRONIZAÇÃO DO APPOINTMENT NO ARRAY EM MEMÓRIA
    // Best-effort — PostgreSQL é a fonte de verdade.
    // ============================================================

    /**
     * Adicionar appointment ao array em memória do LeadCaptureSystem.
     * Deduplicação por appointmentId. Atualiza ambos os singletons
     * (key antiga do pending + key ativa do request) se diferentes.
     *
     * @param {Object} pending - Registro de wa_schedule_pending
     * @param {Object} lead - Lead associado
     * @param {string} appointmentId - ID do appointment criado
     * @param {string} tenantId - UUID do tenant
     */
    _syncAppointmentToMemory(pending, lead, appointmentId, contextOrTenantId) {
        try {
            const tenantId = (typeof contextOrTenantId === 'object' ? contextOrTenantId?.tenantId : contextOrTenantId) || pending.tenant_id;
            const requestApiKey = (typeof contextOrTenantId === 'object' ? contextOrTenantId?.apiKey : null);

            if (!tenantId) {
                console.warn('[SCHEDULE] _syncAppointmentToMemory: tenantId ausente — sync cancelado');
                return;
            }

            const appointmentObj = {
                id: appointmentId,
                leadId: lead?.id || null,
                datetime: `${pending.selected_date} ${pending.selected_time}`,
                status: 'pendente',
                notes: 'Agendado via WhatsApp Conversacional',
                createdAt: new Date().toISOString(),
                leadName:  lead?.nome || lead?.name || 'WhatsApp',
                leadEmail: lead?.email || '',
                leadPhone: lead?.wa_phone || lead?.telefone || '',
                robotName: 'WhatsApp Conversacional'
            };

            // Função de sincronização com validação estrita de tenant_uuid
            const syncToSingleton = async (targetApiKey) => {
                if (!targetApiKey || !this.deps?.getLeadSystem) return;

                let isTenantMatch = false;

                // 1. Validar via API Key Manager se disponível
                if (this.deps.getApiKeyManager) {
                    try {
                        const km = this.deps.getApiKeyManager();
                        if (km) {
                            const val = await km.validateKey(targetApiKey);
                            if (val?.valid && String(val.tenantId) === String(tenantId)) {
                                isTenantMatch = true;
                            }
                        }
                    } catch (e) {
                        console.warn('[SCHEDULE] Erro ao validar tenant da chave para sync:', e.message);
                    }
                }

                // 2. Verificar singleton existente
                const leadSystem = this.deps.getLeadSystem(targetApiKey);
                if (!leadSystem) return;

                if (!isTenantMatch && leadSystem.tenantUuid) {
                    if (String(leadSystem.tenantUuid) === String(tenantId)) {
                        isTenantMatch = true;
                    }
                }

                // Se API Key Manager está disponível e não validou o tenant, BLOQUEAR inserção!
                if (!isTenantMatch && this.deps.getApiKeyManager) {
                    console.warn(`[SCHEDULE][ISOLAMENTO] Bloqueada tentativa de inserir appointment no singleton ${targetApiKey.substring(0, 8)}...: tenantId incompatível com ${tenantId}`);
                    return;
                }

                // Associar tenantUuid ao singleton caso ainda não possua
                if (!leadSystem.tenantUuid) {
                    leadSystem.tenantUuid = tenantId;
                }

                // Inicializar array de appointments com segurança
                if (!leadSystem.appointments) {
                    if (typeof leadSystem.loadAppointments === 'function') {
                        leadSystem.appointments = leadSystem.loadAppointments();
                    } else if (typeof leadSystem.loadAppointmentsSync === 'function') {
                        leadSystem.appointments = leadSystem.loadAppointmentsSync();
                    } else {
                        leadSystem.appointments = [];
                    }
                }

                // Deduplicação por ID
                if (!leadSystem.appointments.some(a => a.id === appointmentId)) {
                    leadSystem.appointments.push(appointmentObj);
                }
            };

            // Sincronizar singleton da chave do pending
            if (pending.api_key) {
                syncToSingleton(pending.api_key).catch(() => {});
            }

            // Sincronizar singleton da chave ativa da requisição (se diferente e pertencer ao mesmo tenant)
            if (requestApiKey && requestApiKey !== pending.api_key) {
                syncToSingleton(requestApiKey).catch(() => {});
            }

            // Notificar recarga pontual de cache de tenant se disponível
            if (typeof this.deps?.reloadTenantAppointmentsCache === 'function') {
                this.deps.reloadTenantAppointmentsCache(tenantId).catch(() => {});
            }
        } catch (err) {
            // Best-effort — PostgreSQL é a fonte de verdade
            console.warn('[SCHEDULE] Erro ao sincronizar array:', err.message);
        }
    }

    /**
     * Buscar slots via API interna e formatar como mensagem conversacional.
     * Reutiliza GET /api/public/availability/:hash
     */
    async _fetchAndFormatSlots(calendarHash) {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: '127.0.0.1',
                port: this.serverPort,
                path: `/api/public/availability/${calendarHash}`,
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (!parsed.success || !parsed.slots || parsed.slots.length === 0) {
                            resolve(null);
                            return;
                        }
                        // Achatar slots: [{date, dayName, times: ['09:00','10:00']}] → [{date, dayName, time}]
                        const flat = [];
                        for (const day of parsed.slots) {
                            for (const time of (day.times || [])) {
                                flat.push({ date: day.date, dayName: day.dayName, time });
                                if (flat.length >= 10) break; // max 10 opções
                            }
                            if (flat.length >= 10) break;
                        }
                        if (flat.length === 0) { resolve(null); return; }

                        // Formatar mensagem numerada
                        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                        let msg = '📅 *Horários disponíveis:*\n\n';
                        flat.forEach((slot, i) => {
                            const dateFormatted = slot.date.split('-').reverse().join('/');
                            msg += `${numberEmojis[i] || (i+1)+'.'} ${slot.dayName} ${dateFormatted} — ${slot.time}\n`;
                        });
                        msg += '\nResponda apenas com o *número* desejado.';

                        resolve({ message: msg, slots: flat });
                    } catch (e) {
                        console.warn('📅 [WA-SCHED] Erro ao parsear slots:', e.message);
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(10000, () => { req.destroy(); resolve(null); });
            req.end();
        });
    }

    /**
     * Executar booking via API interna.
     * Reutiliza POST /api/public/book/:hash
     */
    async _executeBooking(calendarHash, date, time, lead) {
        return new Promise((resolve) => {
            const body = JSON.stringify({
                name: lead?.nome || lead?.name || 'WhatsApp',
                email: lead?.email || '',
                phone: lead?.wa_phone || lead?.telefone || '',
                leadId: lead?.id || null,
                date,
                time,
                notes: 'Agendado via WhatsApp Conversacional'
            });
            const req = http.request({
                hostname: '127.0.0.1',
                port: this.serverPort,
                path: `/api/public/book/${calendarHash}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(10000, () => { req.destroy(); resolve(null); });
            req.write(body);
            req.end();
        });
    }

    // ============================================================
    // REGISTRO DE ROTAS (chamado pelo server.js)
    // ============================================================
    registerRoutes(app) {
        // ── Webhooks de entrada ──
        app.post('/api/webhook/evolution', (req, res) => this._handleEvolutionWebhook(req, res));
        app.post('/api/webhook/twilio',    (req, res) => this._handleTwilioWebhook(req, res));
        app.get('/api/webhook/meta',       (req, res) => this._handleMetaWebhookVerify(req, res));
        app.post('/api/webhook/meta',      (req, res) => this._handleMetaWebhook(req, res));

        // ── Status do canal ──
        app.get('/api/whatsapp/channel/status', (req, res) => {
            res.json({
                channel: 'whatsapp',
                active: true,
                providers: ['evolution', 'twilio', 'meta'],
                version: 'WA-CHANNEL-003-META',
                security: {
                    webhookAuth: FEATURE_EVOLUTION_WEBHOOK_AUTH ? 'enabled' : 'disabled',
                    metaSignatureAuth: 'enabled',
                    dedup: 'enabled',
                    dedupCacheSize: PROCESSED_MSG_IDS.size
                }
            });
        });

        // ── SEC-12: Métricas de webhook (admin only via x-admin-key) ──
        app.get('/api/whatsapp/webhook-metrics', (req, res) => {
            const expectedKey = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET_KEY;

            // Se ADMIN_API_KEY não está configurada, rota indisponível
            if (!expectedKey) {
                return res.status(503).json({ error: 'Admin não configurado' });
            }

            const providedKey = req.headers['x-admin-key'] || '';

            if (!providedKey) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            // Comparação timing-safe
            const expectedBuf = Buffer.from(expectedKey, 'utf8');
            const providedBuf = Buffer.from(providedKey, 'utf8');

            if (expectedBuf.length !== providedBuf.length ||
                !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            res.json({
                success: true,
                metrics: webhookMetrics,
                dedupCacheSize: PROCESSED_MSG_IDS.size,
                ipRateLimitEntries: WEBHOOK_IP_LIMITS.size
            });
        });

        console.log(`📱 [WA-CHANNEL] Rotas registradas | Auth: ${FEATURE_EVOLUTION_WEBHOOK_AUTH ? '✅ ON' : '⚠️ OFF'} | Dedup: ✅ ON`);
        if (isWhatsAppOperational()) {
            this.startQueueWorker();
        } else {
            console.log('📱 [WA-CHANNEL] Queue worker não iniciado (canal WhatsApp desativado operacionalmente)');
        }
    }

    // ============================================================
    // FILA PERSISTENTE E RECUPERAÇÃO DE MENSAGENS (QUEUE WORKER)
    // ============================================================

    /**
     * Inicia o worker em segundo plano para varredura periódica da fila
     */
    startQueueWorker(intervalMs = 5000) {
        if (this._queueWorkerInterval) return;
        this._queueWorkerInterval = setInterval(() => {
            this.processPendingQueue().catch(err => {
                console.error('📱 [WA-QUEUE] Erro no worker periódico:', err.message);
            });
        }, intervalMs);
        if (this._queueWorkerInterval && typeof this._queueWorkerInterval.unref === 'function') {
            this._queueWorkerInterval.unref();
        }
        // Executar imediatamente a recuperação pós-boot
        this.processPendingQueue().catch(err => {
            console.error('📱 [WA-QUEUE] Erro na recuperação pós-boot:', err.message);
        });
    }

    /**
     * Encerra o worker de fila
     */
    stopQueueWorker() {
        if (this._queueWorkerInterval) {
            clearInterval(this._queueWorkerInterval);
            this._queueWorkerInterval = null;
        }
    }

    /**
     * Marca status de mensagem como delivered com sucesso durável
     */
    async _markMessageDelivered(recordId, tenantUuid, waMessageId, leaseToken = null) {
        if (!this.db) return;
        try {
            const q = this.USE_POSTGRES
                ? `UPDATE whatsapp_messages
                   SET status = 'delivered', locked_until = NULL, error_message = NULL, outbound_sent = true,
                       outbound_status = CASE WHEN outbound_status = 'pending' THEN 'delivered' ELSE outbound_status END
                   WHERE (id = $1 OR (tenant_uuid = $2 AND provider = 'meta' AND wa_message_id = $3))
                     ${leaseToken ? 'AND (lease_token = $4 OR lease_token IS NULL)' : ''}`
                : `UPDATE whatsapp_messages
                   SET status = 'delivered', locked_until = NULL, error_message = NULL, outbound_sent = 1,
                       outbound_status = CASE WHEN outbound_status = 'pending' THEN 'delivered' ELSE outbound_status END
                   WHERE (id = ? OR (tenant_uuid = ? AND provider = 'meta' AND wa_message_id = ?))
                     ${leaseToken ? 'AND (lease_token = ? OR lease_token IS NULL)' : ''}`;
            const params = leaseToken
                ? [recordId, tenantUuid, waMessageId, leaseToken]
                : [recordId, tenantUuid, waMessageId];
            await this.db.query(q, params);
            if (waMessageId) {
                PROCESSED_MSG_IDS.set(waMessageId, Date.now());
            }
        } catch (err) {
            console.warn('📱 [WA-QUEUE] Erro ao marcar status delivered:', err.message);
        }
    }

    /**
     * Confirmação defensiva do lease exclusivo antes de executar processamento
     */
    async _confirmLeaseBeforeProcessing(recordId, leaseToken = null) {
        if (!this.db || !recordId) return true;
        try {
            const q = this.USE_POSTGRES
                ? `SELECT id FROM whatsapp_messages WHERE id = $1 AND status = 'processing' AND (locked_until IS NULL OR locked_until > CURRENT_TIMESTAMP) ${leaseToken ? 'AND (lease_token = $2 OR lease_token IS NULL)' : ''} LIMIT 1`
                : `SELECT id FROM whatsapp_messages WHERE id = ? AND status = 'processing' AND (locked_until IS NULL OR locked_until > datetime('now')) ${leaseToken ? 'AND (lease_token = ? OR lease_token IS NULL)' : ''} LIMIT 1`;
            const params = leaseToken ? [recordId, leaseToken] : [recordId];
            const res = await this.db.query(q, params);
            const rows = res?.rows || res;
            return Array.isArray(rows) && rows.length > 0;
        } catch (_) {
            return true;
        }
    }

    /**
     * Renovação periódica do lease com CAS por lease_token
     * Retorna true se a posse foi renovada com sucesso, false se a posse foi perdida para outro worker
     */
    async _renewLease(recordId, leaseToken, leaseSeconds = 60) {
        if (!this.db || !recordId || !leaseToken) return false;
        try {
            const q = this.USE_POSTGRES
                ? `UPDATE whatsapp_messages
                   SET locked_until = CURRENT_TIMESTAMP + INTERVAL '${leaseSeconds} seconds'
                   WHERE id = $1 AND lease_token = $2 AND status = 'processing'
                   RETURNING id`
                : `UPDATE whatsapp_messages
                   SET locked_until = datetime('now', '+${leaseSeconds} seconds')
                   WHERE id = ? AND lease_token = ? AND status = 'processing'`;
            const res = await this.db.query(q, [recordId, leaseToken]);
            if (res) {
                if (typeof res.rowCount === 'number') return res.rowCount > 0;
                if (typeof res.changes === 'number') return res.changes > 0;
                if (Array.isArray(res.rows)) return res.rows.length > 0;
            }
            return false;
        } catch (err) {
            console.warn('⚠️ [WA-LEASE] Falha na query de renovação:', err.message);
            return false;
        }
    }

    /**
     * Registra falha de processamento com backoff ou status final failed
     */
    async _markMessageFailed(recordId, errMessage, attempts, maxAttempts = 3, leaseToken = null) {
        if (!this.db) return;
        try {
            const isFinalFailure = attempts >= maxAttempts;
            const nextStatus = isFinalFailure ? 'failed' : 'retryable';
            const backoffSeconds = Math.min(300, Math.pow(2, Math.max(1, attempts)) * 5); // 10s, 20s, 40s...

            const q = this.USE_POSTGRES
                ? `UPDATE whatsapp_messages
                   SET status = $1,
                       error_message = $2,
                       locked_until = ${isFinalFailure ? 'NULL' : `CURRENT_TIMESTAMP + INTERVAL '${backoffSeconds} seconds'`}
                   WHERE id = $3
                     ${leaseToken ? 'AND (lease_token = $4 OR lease_token IS NULL)' : ''}`
                : `UPDATE whatsapp_messages
                   SET status = ?,
                       error_message = ?,
                       locked_until = ${isFinalFailure ? 'NULL' : `datetime('now', '+${backoffSeconds} seconds')`}
                   WHERE id = ?
                     ${leaseToken ? 'AND (lease_token = ? OR lease_token IS NULL)' : ''}`;
            const params = leaseToken
                ? [nextStatus, String(errMessage || '').substring(0, 500), recordId, leaseToken]
                : [nextStatus, String(errMessage || '').substring(0, 500), recordId];
            await this.db.query(q, params);
        } catch (err) {
            console.warn('📱 [WA-QUEUE] Erro ao atualizar falha na mensagem:', err.message);
        }
    }

    /**
     * Processamento durável da fila de mensagens pendentes (received, retryable com backoff vencido, lease expirado)
     * Garante mutual exclusion via FOR UPDATE SKIP LOCKED (PostgreSQL) e atomic lease update
     * @param {Object} options
     * @param {number} [options.batchSize=10]
     * @param {number} [options.leaseSeconds=60]
     * @param {number} [options.maxAttempts=3]
     * @returns {Promise<{ processed: number, skipped?: boolean }>}
     */
    async processPendingQueue({ batchSize = 10, leaseSeconds = 60, maxAttempts = 3 } = {}) {
        if (!this.db || this._isProcessingQueue) return { processed: 0, skipped: true };
        this._isProcessingQueue = true;

        let processedCount = 0;
        try {
            let rowsToProcess = [];

            if (this.USE_POSTGRES) {
                const client = (typeof this.db.connect === 'function') ? await this.db.connect() : null;
                try {
                    if (client) {
                        await client.query('BEGIN');
                        const selectQ = `
                            SELECT id, tenant_id, api_key, wa_message_id, wa_phone, content, metadata,
                                   attempts, outbound_sent, outbound_status, outbound_wamid, tenant_uuid, status
                            FROM whatsapp_messages
                            WHERE provider = 'meta'
                              AND direction = 'inbound'
                              AND (
                                  status = 'received'
                                  OR (status = 'retryable' AND (locked_until IS NULL OR locked_until <= CURRENT_TIMESTAMP))
                                  OR (status = 'processing' AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP))
                              )
                              AND COALESCE(attempts, 0) < $1
                            ORDER BY created_at ASC
                            LIMIT $2
                            FOR UPDATE SKIP LOCKED
                        `;
                        const res = await client.query(selectQ, [maxAttempts, batchSize]);
                        rowsToProcess = res.rows || [];

                        if (rowsToProcess.length > 0) {
                            for (const row of rowsToProcess) {
                                const leaseToken = crypto.randomUUID();
                                row.leaseToken = leaseToken;
                                await client.query(`
                                    UPDATE whatsapp_messages
                                    SET status = 'processing',
                                        lease_token = $2,
                                        locked_until = CURRENT_TIMESTAMP + INTERVAL '${leaseSeconds} seconds',
                                        attempts = COALESCE(attempts, 0) + 1,
                                        last_attempt_at = CURRENT_TIMESTAMP
                                    WHERE id = $1
                                `, [row.id, leaseToken]);
                            }
                        }
                        await client.query('COMMIT');
                    } else {
                        const selectQ = `
                            SELECT id, tenant_id, api_key, wa_message_id, wa_phone, content, metadata,
                                   attempts, outbound_sent, outbound_status, outbound_wamid, tenant_uuid, status
                            FROM whatsapp_messages
                            WHERE provider = 'meta'
                              AND direction = 'inbound'
                              AND (
                                  status = 'received'
                                  OR (status = 'retryable' AND (locked_until IS NULL OR locked_until <= CURRENT_TIMESTAMP))
                                  OR (status = 'processing' AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP))
                              )
                              AND COALESCE(attempts, 0) < $1
                            ORDER BY created_at ASC
                            LIMIT $2
                        `;
                        const res = await this.db.query(selectQ, [maxAttempts, batchSize]);
                        rowsToProcess = res.rows || [];
                        for (const row of rowsToProcess) {
                            const leaseToken = crypto.randomUUID();
                            row.leaseToken = leaseToken;
                            await this.db.query(`
                                UPDATE whatsapp_messages
                                SET status = 'processing',
                                    lease_token = $2,
                                    locked_until = CURRENT_TIMESTAMP + INTERVAL '${leaseSeconds} seconds',
                                    attempts = COALESCE(attempts, 0) + 1,
                                    last_attempt_at = CURRENT_TIMESTAMP
                                WHERE id = $1
                            `, [row.id, leaseToken]);
                        }
                    }
                } catch (pgErr) {
                    if (client) {
                        try { await client.query('ROLLBACK'); } catch (_) {}
                    }
                    throw pgErr;
                } finally {
                    if (client && typeof client.release === 'function') {
                        client.release();
                    }
                }
            } else {
                // SQLite
                const selectQ = `
                    SELECT id, tenant_id, api_key, wa_message_id, wa_phone, content, metadata,
                           attempts, outbound_sent, outbound_status, outbound_wamid, tenant_uuid, status
                    FROM whatsapp_messages
                    WHERE provider = 'meta'
                      AND direction = 'inbound'
                      AND (
                          status = 'received'
                          OR (status = 'retryable' AND (locked_until IS NULL OR locked_until <= datetime('now')))
                          OR (status = 'processing' AND (locked_until IS NULL OR locked_until < datetime('now')))
                      )
                      AND COALESCE(attempts, 0) < ?
                    ORDER BY created_at ASC
                    LIMIT ?
                `;
                const res = await this.db.query(selectQ, [maxAttempts, batchSize]);
                rowsToProcess = res.rows || res || [];
                for (const row of rowsToProcess) {
                    const leaseToken = crypto.randomUUID();
                    row.leaseToken = leaseToken;
                    await this.db.query(`
                        UPDATE whatsapp_messages
                        SET status = 'processing',
                            lease_token = ?,
                            locked_until = datetime('now', '+${leaseSeconds} seconds'),
                            attempts = COALESCE(attempts, 0) + 1,
                            last_attempt_at = datetime('now')
                        WHERE id = ?
                    `, [leaseToken, row.id]);
                }
            }

            for (const row of rowsToProcess) {
                let meta = {};
                try {
                    meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
                } catch (_) {}

                const phoneNumberId = meta.phoneNumberId;
                const wabaId = meta.wabaId;
                const pushName = meta.pushName || '';
                const currentAttempts = (row.attempts || 0) + 1;
                const leaseToken = row.leaseToken || crypto.randomUUID();
                let leaseLost = false;

                // Heartbeat de renovação periódica do lease (a cada leaseSeconds / 3 segundos, ex: 20s para 60s)
                const heartbeatIntervalMs = Math.max(5000, Math.floor((leaseSeconds / 3) * 1000));
                const leaseHeartbeat = setInterval(async () => {
                    try {
                        const renewed = await this._renewLease(row.id, leaseToken, leaseSeconds);
                        if (!renewed) {
                            leaseLost = true;
                            clearInterval(leaseHeartbeat);
                            console.warn(`⚠️ [WA-LEASE] Perda de posse detectada para mensagem ${row.id}. Execução abortada.`);
                        }
                    } catch (heartbeatErr) {
                        console.warn(`⚠️ [WA-LEASE] Erro no heartbeat da mensagem ${row.id}:`, heartbeatErr.message);
                    }
                }, heartbeatIntervalMs);

                try {
                    if (leaseLost) {
                        console.warn(`⚠️ [WA-LEASE] Posse perdida antes do início para ${row.id}`);
                        continue;
                    }

                    const tenantSettings = await this._resolveMetaTenant(phoneNumberId, wabaId);
                    const apiKey = tenantSettings?.api_key || row.api_key;
                    const tenantUuid = tenantSettings?.tenant_uuid || row.tenant_uuid;
                    const token = tenantSettings?.meta_access_token;

                    if (!tenantUuid) {
                        throw new Error(`Tenant canônico não resolvido para mensagem ${row.id}`);
                    }

                    if (leaseLost) {
                        console.warn(`⚠️ [WA-LEASE] Posse perdida antes do pipeline de IA para ${row.id}`);
                        continue;
                    }

                    await this._processIncomingMessage({
                        apiKey,
                        channelMode: tenantSettings?.channel_mode || 'auto',
                        notifPhone: tenantSettings?.notification_phone,
                        phone: row.wa_phone,
                        pushName,
                        text: row.content,
                        waMessageId: row.wa_message_id,
                        provider: 'meta',
                        instanceName: `meta_${phoneNumberId}`,
                        instanceToken: token,
                        extraOptions: {
                            phoneNumberId,
                            wabaId,
                            accessToken: token,
                            tenantUuid,
                            persistedRecordId: row.id,
                            outboundSent: !!row.outbound_sent,
                            outboundStatus: row.outbound_status || (row.outbound_sent ? 'sent' : 'pending'),
                            outboundWamid: row.outbound_wamid || null,
                            leaseToken,
                            isLeaseActive: () => !leaseLost
                        }
                    });

                    if (leaseLost) {
                        console.warn(`⚠️ [WA-LEASE] Posse perdida durante pipeline para ${row.id}. Não marcando status delivered.`);
                        continue;
                    }

                    await this._markMessageDelivered(row.id, tenantUuid, row.wa_message_id, leaseToken);
                    processedCount++;
                } catch (err) {
                    if (!leaseLost) {
                        console.error(`📱 [WA-QUEUE] Erro no processamento de mensagem ${row.id}:`, err.message);
                        await this._markMessageFailed(row.id, err.message, currentAttempts, maxAttempts, leaseToken);
                    }
                } finally {
                    clearInterval(leaseHeartbeat);
                }
            }
        } finally {
            this._isProcessingQueue = false;
        }

        return { processed: processedCount };
    }

    // ============================================================
    // WEBHOOK — META WHATSAPP CLOUD API (Oficial v21.0)
    // ============================================================

    /**
     * Deduplicação resiliente L1 (memória) + L2 (PostgreSQL)
     * Garante deduplicação mesmo após reinicialização do servidor ou entre múltiplas instâncias
     */
    async _isMessageAlreadyProcessed(waMessageId, tenantUuid, provider) {
        if (!waMessageId) return false;
        // L1: Cache em memória (< 1ms)
        if (PROCESSED_MSG_IDS.has(waMessageId)) return true;

        // L2: Persistência relacional PostgreSQL (resiliente a reinício e multi-instância)
        if (this.db) {
            try {
                const query = this.USE_POSTGRES
                    ? (tenantUuid
                        ? `SELECT wa_message_id FROM whatsapp_messages WHERE wa_message_id = $1 AND tenant_uuid = $2 AND provider = $3 LIMIT 1`
                        : `SELECT wa_message_id FROM whatsapp_messages WHERE wa_message_id = $1 LIMIT 1`)
                    : (tenantUuid
                        ? `SELECT wa_message_id FROM whatsapp_messages WHERE wa_message_id = ? AND tenant_uuid = ? AND provider = ? LIMIT 1`
                        : `SELECT wa_message_id FROM whatsapp_messages WHERE wa_message_id = ? LIMIT 1`);
                const params = tenantUuid ? [waMessageId, tenantUuid, provider || 'meta'] : [waMessageId];
                const res = await this.db.query(query, params);
                const rows = res?.rows || res;
                if (rows && rows.length > 0 && rows[0].wa_message_id === waMessageId) {
                    PROCESSED_MSG_IDS.set(waMessageId, Date.now());
                    return true;
                }
            } catch (err) {
                // Em caso de erro temporário no DB, não interrompe o fluxo de consulta
            }
        }
        return false;
    }

    /**
     * Limpar cache de deduplicação (para testes e manutenção)
     */
    clearDedupCache() {
        PROCESSED_MSG_IDS.clear();
    }

    /**
     * Persistência durável e aquisição atômica antes do envio do ACK 200 (Requisitos B, C, D)
     * Deduplica concorrentemente por (tenant_uuid, provider, wa_message_id) via índice único parcial
     */
    async _claimAndPersistInboundMessage({
        apiKey, tenantUuid, waMessageId, senderPhone, text,
        phoneNumberId, wabaId, pushName
    }) {
        // Requisito D: Validação fail-closed da identidade canônica (UUID v4)
        if (!tenantUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(tenantUuid).trim())) {
            console.warn(`📱 [META-DURABLE] ❌ Mensagem descartada: tenant_uuid inválido ou ausente (${tenantUuid})`);
            return { claimed: false, reason: 'invalid_tenant_uuid' };
        }

        if (!waMessageId) {
            return { claimed: false, reason: 'missing_wamid' };
        }

        // L1: Otimização rápida em memória (< 1ms) para mensagens já entregues
        if (PROCESSED_MSG_IDS.has(waMessageId)) {
            return { claimed: false, duplicate: true };
        }

        if (!this.db) {
            return { claimed: false, reason: 'no_db' };
        }

        const id = crypto.randomBytes(12).toString('hex');
        const canonicalTenantUuid = tenantUuid.trim().toLowerCase();
        const metadata = JSON.stringify({ phoneNumberId, wabaId, pushName: pushName || '' });

        const q = this.USE_POSTGRES
            ? `INSERT INTO whatsapp_messages
                (id, tenant_id, api_key, wa_message_id, wa_phone, direction, content, provider, tenant_uuid, status, metadata, attempts, outbound_sent, outbound_status, locked_until, last_attempt_at)
                VALUES ($1, $2, $3, $4, $5, 'inbound', $6, 'meta', $7, 'received', $8, 0, false, 'pending', NULL, NULL)
                ON CONFLICT (tenant_uuid, provider, wa_message_id) WHERE wa_message_id IS NOT NULL
                DO NOTHING RETURNING id`
            : `INSERT INTO whatsapp_messages
                (id, tenant_id, api_key, wa_message_id, wa_phone, direction, content, provider, tenant_uuid, status, metadata, attempts, outbound_sent, outbound_status, locked_until, last_attempt_at)
                VALUES (?, ?, ?, ?, ?, 'inbound', ?, 'meta', ?, 'received', ?, 0, 0, 'pending', NULL, NULL)
                ON CONFLICT (tenant_uuid, provider, wa_message_id) WHERE wa_message_id IS NOT NULL
                DO NOTHING`;

        const params = [
            id, canonicalTenantUuid, apiKey, waMessageId, senderPhone,
            (text || '').substring(0, 10000), canonicalTenantUuid, metadata
        ];

        try {
            const res = await this.db.query(q, params);
            let isClaimed = false;
            if (res) {
                if (typeof res.rowCount === 'number') {
                    isClaimed = res.rowCount > 0;
                } else if (typeof res.changes === 'number') {
                    isClaimed = res.changes > 0;
                } else if (Array.isArray(res.rows)) {
                    isClaimed = res.rows.length > 0;
                }
            }

            if (isClaimed) {
                return { claimed: true, id };
            } else {
                // Registro já existe no banco: verificar o status do registro existente
                let existingStatus = 'delivered';
                let existingRowId = null;
                try {
                    const checkQ = this.USE_POSTGRES
                        ? `SELECT id, status, attempts, outbound_sent, outbound_status, outbound_wamid FROM whatsapp_messages WHERE tenant_uuid = $1 AND provider = 'meta' AND wa_message_id = $2 LIMIT 1`
                        : `SELECT id, status, attempts, outbound_sent, outbound_status, outbound_wamid FROM whatsapp_messages WHERE tenant_uuid = ? AND provider = 'meta' AND wa_message_id = ? LIMIT 1`;
                    const existingRes = await this.db.query(checkQ, [canonicalTenantUuid, waMessageId]);
                    const existingRow = existingRes?.rows?.[0] || existingRes?.[0];
                    if (existingRow) {
                        existingStatus = existingRow.status || 'delivered';
                        existingRowId = existingRow.id;
                    }
                } catch (_checkErr) {}

                if (existingStatus === 'received' || existingStatus === 'retryable' || existingStatus === 'processing') {
                    // Mensagem ainda em fila/processamento: disparar queue worker e indicar pendingQueue
                    if (typeof this.processPendingQueue === 'function') {
                        setImmediate(() => this.processPendingQueue().catch(() => {}));
                    }
                    return { claimed: false, pendingQueue: true, id: existingRowId };
                }

                PROCESSED_MSG_IDS.set(waMessageId, Date.now());
                return { claimed: false, duplicate: true, id: existingRowId };
            }
        } catch (dbErr) {
            console.error(`📱 [META-DURABLE] ❌ Falha de persistência no banco:`, dbErr.message);
            throw dbErr; // Fail-closed: impede ACK 200
        }
    }

    /**
     * Webhook GET: Verificação do desafio da Meta (Webhook Handshake)
     */
    async _handleMetaWebhookVerify(req, res) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token) {
            const globalToken = process.env.META_VERIFY_TOKEN;
            let isValid = (globalToken && token === globalToken);

            if (!isValid && this.db) {
                try {
                    const query = this.USE_POSTGRES
                        ? `SELECT id FROM whatsapp_settings WHERE meta_verify_token = $1 AND is_active = true LIMIT 1`
                        : `SELECT id FROM whatsapp_settings WHERE meta_verify_token = ? AND is_active = 1 LIMIT 1`;
                    const result = await this.db.query(query, [token]);
                    if (result && result.rows && result.rows.length > 0) {
                        isValid = true;
                    }
                } catch (err) {
                    console.warn('📱 [META-VERIFY] Erro ao verificar token no banco:', err.message);
                }
            }

            if (isValid) {
                console.log('📱 [META-VERIFY] Webhook challenge verificado com sucesso');
                return res.status(200).send(challenge);
            }
        }

        console.warn('📱 [META-VERIFY] Falha na verificação do token de webhook Meta');
        return res.status(403).send('Forbidden');
    }

    /**
     * Webhook POST: Recepção e despacho de eventos da Meta Cloud API
     */
    async _handleMetaWebhook(req, res) {
        try {
            // FASE 1: Graceful Blackhole se o canal estiver desativado operacionalmente
            if (!isWhatsAppOperational()) {
                console.log('📱 [META-WEBHOOK][BLACKHOLE] Webhook Meta recebido com canal desativado operacionalmente (ack 200 enviado, evento descartado)');
                return res.status(200).send('EVENT_RECEIVED');
            }

            const body = req.body || {};
            const signatureHeader = req.headers?.['x-hub-signature-256'] || '';
            const webhookIp = req.ip || req.connection?.remoteAddress || 'unknown';

            // 1. Validação de assinatura X-Hub-Signature-256 obrigatória (Correção A)
            if (!signatureHeader) {
                webhookMetrics.rejected_auth++;
                console.warn('📱 [META-WEBHOOK] Assinatura X-Hub-Signature-256 ausente');
                return res.status(403).json({ error: 'Signature header missing' });
            }

            const isValid = await this._verifyMetaSignature(req, signatureHeader, body);
            if (!isValid) {
                webhookMetrics.rejected_auth++;
                console.warn('📱 [META-WEBHOOK] Assinatura X-Hub-Signature-256 inválida');
                return res.status(403).json({ error: 'Invalid signature' });
            }

            // Verificar se o objeto é whatsapp_business_account
            if (body.object !== 'whatsapp_business_account') {
                return res.status(200).send('EVENT_RECEIVED');
            }

            const entries = body.entry || [];
            const claimedItems = [];

            for (const entry of entries) {
                const wabaId = entry.id;
                const changes = entry.changes || [];
                for (const change of changes) {
                    if (change.field !== 'messages') continue;
                    const value = change.value || {};
                    const metadata = value.metadata || {};
                    const phoneNumberId = metadata.phone_number_id;

                    // Log de status updates (sent, delivered, read, failed)
                    if (Array.isArray(value.statuses)) {
                        for (const status of value.statuses) {
                            console.log(`📱 [META-STATUS] id=${status.id} status=${status.status} recipient=${status.recipient_id}`);
                        }
                    }

                    // Processar mensagens recebidas
                    if (Array.isArray(value.messages)) {
                        for (const msg of value.messages) {
                            // Extrair texto da mensagem
                            let text = '';
                            if (msg.type === 'text') {
                                text = msg.text?.body || '';
                            } else if (msg.type === 'button') {
                                text = msg.button?.text || msg.button?.payload || '';
                            } else if (msg.type === 'interactive') {
                                text = msg.interactive?.button_reply?.title ||
                                       msg.interactive?.list_reply?.title ||
                                       msg.interactive?.button_reply?.id || '';
                            } else {
                                text = `[Mensagem recebida (${msg.type})]`;
                            }

                            const senderPhone = msg.from;
                            const contact = (value.contacts || []).find(c => c.wa_id === senderPhone);
                            const pushName = contact?.profile?.name || '';

                            // Resolver tenant por phoneNumberId ou wabaId
                            const tenantSettings = await this._resolveMetaTenant(phoneNumberId, wabaId);
                            if (!tenantSettings || !tenantSettings.tenant_uuid) {
                                console.warn(`📱 [META-TENANT] Nenhum tenant ativo com UUID canônico encontrado para phoneNumberId=${phoneNumberId} wabaId=${wabaId}`);
                                continue;
                            }

                            // 2. Persistência durável atômica ANTES do ACK HTTP 200 (Correções B e C)
                            const claim = await this._claimAndPersistInboundMessage({
                                apiKey: tenantSettings.api_key,
                                tenantUuid: tenantSettings.tenant_uuid,
                                waMessageId: msg.id,
                                senderPhone,
                                text,
                                phoneNumberId,
                                wabaId,
                                pushName
                            });

                            if (!claim.claimed) {
                                if (claim.duplicate) {
                                    webhookMetrics.duplicate_ignored++;
                                    console.log(`📱 [META-DEDUP] Mensagem duplicada ignorada: ${msg.id}`);
                                } else if (claim.pendingQueue) {
                                    console.log(`📱 [META-RETRY] Retry Meta recebido para mensagem pendente/em fila: ${msg.id}`);
                                }
                                continue;
                            }

                            claimedItems.push({
                                msgId: msg.id,
                                dbId: claim.id,
                                tenantSettings,
                                senderPhone,
                                pushName,
                                text,
                                phoneNumberId,
                                wabaId
                            });
                        }
                    }
                }
            }

            // 3. Ack HTTP 200 enviado à Meta APÓS a garantia de persistência durável no banco (Correção B)
            res.status(200).send('EVENT_RECEIVED');
            webhookMetrics.received++;

            // 4. O worker durável (processPendingQueue) é o único consumidor autorizado.
            // O webhook NÃO executa pipeline de IA, geração de resposta ou envio inline.
            if (claimedItems.length > 0 && typeof this.processPendingQueue === 'function') {
                setImmediate(() => {
                    this.processPendingQueue().catch(queueErr => {
                        console.error('📱 [WA-QUEUE] Erro no consumidor durável pós-webhook:', queueErr.message);
                    });
                });
            }

        } catch (error) {
            console.error('📱 [META-WEBHOOK] Erro ao processar webhook:', error.message);
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Internal server error processing webhook' });
            }
        }
    }

    /**
     * Validação timing-safe da assinatura HMAC SHA-256 do webhook Meta (Correção A)
     */
    async _verifyMetaSignature(req, signatureHeader, body) {
        if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
            return false;
        }

        const signatureHash = signatureHeader.substring(7);
        const globalSecret = process.env.META_APP_SECRET;
        let secretCandidates = [];
        if (globalSecret) {
            secretCandidates.push(globalSecret);
        }

        if (this.db) {
            try {
                let wabaId = body?.entry?.[0]?.id;
                let phoneId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
                if (wabaId || phoneId) {
                    const query = this.USE_POSTGRES
                        ? `SELECT meta_app_secret FROM whatsapp_settings WHERE (meta_waba_id = $1 OR meta_phone_number_id = $2) AND meta_app_secret IS NOT NULL AND is_active = true`
                        : `SELECT meta_app_secret FROM whatsapp_settings WHERE (meta_waba_id = ? OR meta_phone_number_id = ?) AND meta_app_secret IS NOT NULL AND is_active = 1`;
                    const res = await this.db.query(query, [wabaId || '', phoneId || '']);
                    for (const row of (res?.rows || [])) {
                        if (row.meta_app_secret && !secretCandidates.includes(row.meta_app_secret)) {
                            secretCandidates.push(row.meta_app_secret);
                        }
                    }
                }
            } catch (err) {
                console.warn('📱 [META-SIG] Erro ao buscar app_secret do tenant:', err.message);
            }
        }

        if (secretCandidates.length === 0) {
            return false;
        }

        let rawBody;
        if (req.rawBody) {
            rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody, 'utf8');
        } else if (typeof req.body === 'string') {
            rawBody = Buffer.from(req.body, 'utf8');
        } else {
            rawBody = Buffer.from(JSON.stringify(body));
        }

        for (const secret of secretCandidates) {
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(rawBody);
            const expectedHash = hmac.digest('hex');

            const sigBuf = Buffer.from(signatureHash, 'utf8');
            const expBuf = Buffer.from(expectedHash, 'utf8');

            if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Resolver configurações do tenant por Meta phoneNumberId ou wabaId
     */
    async _resolveMetaTenant(phoneNumberId, wabaId) {
        if (!this.db) return null;
        try {
            const query = this.USE_POSTGRES
                ? `SELECT * FROM whatsapp_settings WHERE (meta_phone_number_id = $1 OR meta_waba_id = $2) AND is_active = true LIMIT 1`
                : `SELECT * FROM whatsapp_settings WHERE (meta_phone_number_id = ? OR meta_waba_id = ?) AND is_active = 1 LIMIT 1`;
            const params = [phoneNumberId || '', wabaId || ''];
            const res = await this.db.query(query, params);
            return res?.rows?.[0] || null;
        } catch (e) {
            console.warn('📱 [META-RESOLVE] Erro ao buscar tenant por Meta ID:', e.message);
            return null;
        }
    }

    /**
     * Enviar mensagem diretamente pela WhatsApp Business Platform Cloud API (Meta Graph API v21.0)
     */
    async _sendMetaCloudResponse(phoneNumberId, accessToken, phone, message) {
        const axios = require('axios');
        const phoneClean = phone.replace(/\D/g, '');
        const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phoneClean,
            type: 'text',
            text: {
                preview_url: false,
                body: message
            }
        };

        try {
            const resp = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            console.log(`📱 [META RESPONSE SENT] ✅ phoneId=${phoneNumberId} to=${phoneClean} msgId=${resp.data?.messages?.[0]?.id}`);
            return {
                success: true,
                provider: 'meta_cloud_api',
                messageId: resp.data?.messages?.[0]?.id || null
            };
        } catch (err) {
            const errData = err.response?.data || {};
            console.error(`📱 [META-SEND] ❌ Erro ao enviar mensagem:`, JSON.stringify(errData || err.message));
            return {
                success: false,
                provider: 'meta_cloud_api',
                error: errData.error?.message || err.message,
                errorCode: errData.error?.code || null
            };
        }
    }

    // ============================================================
    // WEBHOOK — EVOLUTION API  (Fase 2A)
    // ============================================================
    async _handleEvolutionWebhook(req, res) {
        if (!isWhatsAppOperational()) {
            return res.status(200).json({ received: true, active: false });
        }

        // Ack imediato — Evolution reenvia se não receber 200 rápido
        res.status(200).json({ received: true });

        // SEC-12: Contabilizar recebimento
        webhookMetrics.received++;

        try {
            const body = req.body || {};
            const webhookIp = req.ip || req.connection?.remoteAddress || 'unknown';

            // ═══ SEC-12: Rate limiting por IP ═══
            const now = Date.now();
            const ipEntry = WEBHOOK_IP_LIMITS.get(webhookIp) || { count: 0, windowStart: now };
            if (now - ipEntry.windowStart > WH_IP_WINDOW_MS) {
                ipEntry.count = 0;
                ipEntry.windowStart = now;
            }
            ipEntry.count++;
            WEBHOOK_IP_LIMITS.set(webhookIp, ipEntry);

            if (ipEntry.count > WH_IP_MAX_PER_MIN) {
                webhookMetrics.rejected_rate_limit++;
                console.warn(`🚫 [SEC-12] Webhook rate limit excedido: IP=${webhookIp} count=${ipEntry.count}`);
                return;
            }

            // ═══ SEC-10: Autenticação do webhook (Feature Flag) ═══
            // Evolution Go NÃO suporta headers customizados em webhooks.
            // Solução: secret embutido na URL → ?webhook_secret=TOKEN
            if (FEATURE_EVOLUTION_WEBHOOK_AUTH && EVOLUTION_WEBHOOK_SECRET) {
                // Verificar: 1) query string  2) header apikey  3) body.instanceToken
                const querySecret = req.query?.webhook_secret || '';
                const headerKey = req.headers['apikey'] || req.headers['x-api-key'] || '';
                const bodyToken = body.instanceToken || '';
                const candidateKey = querySecret || headerKey || bodyToken;

                if (!candidateKey) {
                    webhookMetrics.rejected_auth++;
                    console.error(`🚫 [SEC-10] Webhook REJEITADO — sem webhook_secret/apikey/instanceToken | IP=${webhookIp}`);
                    return;
                }

                // Comparação timing-safe para evitar timing attacks
                try {
                    const keyBuffer = Buffer.from(candidateKey, 'utf8');
                    const secretBuffer = Buffer.from(EVOLUTION_WEBHOOK_SECRET, 'utf8');
                    if (keyBuffer.length !== secretBuffer.length ||
                        !crypto.timingSafeEqual(keyBuffer, secretBuffer)) {
                        webhookMetrics.rejected_auth++;
                        console.error(`🚫 [SEC-10] Webhook REJEITADO — secret inválido | IP=${webhookIp}`);
                        return;
                    }
                } catch (compareErr) {
                    webhookMetrics.rejected_auth++;
                    console.error(`🚫 [SEC-10] Webhook REJEITADO — erro na comparação | IP=${webhookIp}`);
                    return;
                }
            } else if (!FEATURE_EVOLUTION_WEBHOOK_AUTH) {
                // Log de aviso (apenas 1x a cada 100 requests para não poluir)
                if (webhookMetrics.received % 100 === 1) {
                    console.warn(`⚠️ [SEC-10] FEATURE_EVOLUTION_WEBHOOK_AUTH desligada — webhook operando sem autenticação`);
                }
            }

            // ═══ SEC-11: Log sanitizado (sem PII) ═══
            console.log(`📱 [WA-WEBHOOK] ══════════════════════════════════════`);
            console.log(`📱 [WA-WEBHOOK] POST /api/webhook/evolution RECEBIDO | IP=${webhookIp}`);
            console.log(`📱 [WA-WEBHOOK] Body keys: ${Object.keys(body).join(', ')}`);

            // ═══ EXTRAIR CAMPOS COMUNS ═══
            const event    = body.event || body.type || '';
            const instance = body.instanceName || body.instance || body.instance_name || '';

            console.log(`📱 [WA-WEBHOOK] event='${event}' instance='${instance}'`);

            // ═══ FILTRAR EVENTOS ═══
            // Evolution Go v0.7.1 envia event='Message'
            // Evolution API v1 envia event='messages.upsert'
            const eventLower = (event || '').toLowerCase();
            const isMessageEvent = eventLower === 'message' || eventLower === 'messages.upsert'
                || eventLower === 'messages_upsert';

            if (!isMessageEvent) {
                console.log(`📱 [WA-WEBHOOK] Evento ignorado: '${event}'`);
                return;
            }

            const data = body.data || {};

            // ═══ EXTRAIR METADADOS DA MENSAGEM ═══
            // Evolution Go v0.7.1: data.Info.Chat, data.Info.IsFromMe, data.Info.ID, data.Info.IsGroup
            // Evolution API v1:    data.key.remoteJid, data.key.fromMe, data.key.id
            let remoteJid, isFromMe, isGroup, waMessageId;

            if (data.Info) {
                // ── Formato Evolution Go v0.7.1 ──
                remoteJid   = data.Info.Chat || '';
                isFromMe    = data.Info.IsFromMe === true;
                isGroup     = data.Info.IsGroup === true;
                waMessageId = data.Info.ID || '';
                console.log(`📱 [WA-WEBHOOK] Formato: Evolution Go v0.7.1`);
            } else if (data.key) {
                // ── Formato Evolution API v1 (fallback) ──
                remoteJid   = data.key.remoteJid || '';
                isFromMe    = data.key.fromMe === true;
                isGroup     = (remoteJid || '').endsWith('@g.us');
                waMessageId = data.key.id || '';
                console.log(`📱 [WA-WEBHOOK] Formato: Evolution API v1`);
            } else {
                console.log(`📱 [WA-WEBHOOK] ❌ Formato desconhecido — sem data.Info nem data.key`);
                console.log(`📱 [WA-WEBHOOK] data keys: ${Object.keys(data).join(', ')}`);
                return;
            }

            console.log(`📱 [WA-WEBHOOK] remoteJid='${remoteJid}' isFromMe=${isFromMe} isGroup=${isGroup}`);

            // Filtros
            if (isFromMe) {
                console.log(`📱 [WA-WEBHOOK] Mensagem fromMe — ignorando`);
                return;
            }
            if (isGroup) {
                console.log(`📱 [WA-WEBHOOK] Mensagem de grupo — ignorando`);
                return;
            }
            if (!remoteJid) {
                console.log(`📱 [WA-WEBHOOK] ❌ remoteJid vazio — descartando`);
                return;
            }

            // ═══ EXTRAIR TEXTO DA MENSAGEM ═══
            // Evolution Go v0.7.1: data.Message.conversation ou data.Message.extendedTextMessage.text
            // Evolution API v1:    data.message.conversation ou data.message.extendedTextMessage.text
            const msgObj = data.Message || data.message || {};
            const text = msgObj.conversation
                      || msgObj.extendedTextMessage?.text
                      || '';

            // ═══ EXTRAIR PHONE E PUSHNAME ═══
            const phone    = this._normalizePhone(remoteJid.replace('@s.whatsapp.net', ''));
            // Evolution Go v0.7.1: PushName está dentro de data.Info.PushName
            const pushName = data.Info?.PushName || data.PushName || data.pushName || body.pushName || '';

            // SEC-11: Log sanitizado — telefone parcialmente mascarado, sem texto da mensagem
            console.log(`📱 [WA-WEBHOOK] phone='${phone.substring(0, 6)}***' text_len=${text.length}`);

            if (!phone || !text.trim()) {
                console.log(`📱 [WA-WEBHOOK] ❌ phone ou text vazio — descartando`);
                return;
            }

            // ═══ SEC-09: Deduplicação por waMessageId (L1 + L2) ═══
            if (waMessageId) {
                const isDup = await this._isMessageAlreadyProcessed(waMessageId);
                if (isDup) {
                    webhookMetrics.duplicated++;
                    console.log(`🔁 [SEC-09] Mensagem duplicada ignorada: ${waMessageId.substring(0, 16)}...`);
                    return;
                }
                PROCESSED_MSG_IDS.set(waMessageId, Date.now());
            }

            console.log(`📱 [EVOLUTION MESSAGE RECEIVED] phone=${phone.substring(0, 6)}*** len=${text.length} msgId=${(waMessageId || 'N/A').substring(0, 12)}`);

            // Rate limit
            if (!this._checkRateLimit(phone)) {
                console.warn(`📱 [WA-CHANNEL] Rate limit excedido para ${phone}`);
                return;
            }

            // ═══ RESOLVER TENANT ═══
            console.log(`📱 [WA-WEBHOOK] Resolvendo tenant para instância: '${instance}'`);
            const tenant = await this._resolveTenantByInstance(instance);
            if (!tenant) {
                console.warn(`📱 [WA-CHANNEL] ❌ Instância desconhecida: "${instance}" — tenant não encontrado no DB`);
                return;
            }
            console.log(`📱 [EVOLUTION TENANT RESOLVED] apiKey=${tenant.apiKey?.substring(0, 12)}... mode=${tenant.channelMode}`);

            // ═══ PROCESSAR MENSAGEM ═══
            console.log(`📱 [EVOLUTION MESSAGE PROCESSING]`);
            await this._processIncomingMessage({
                apiKey:      tenant.apiKey,
                channelMode: tenant.channelMode,
                notifPhone:  tenant.notificationPhone,
                phone,
                pushName,
                text,
                waMessageId,
                provider:    'evolution',
                instanceName: instance,  // ← instância que recebeu
                instanceToken: body.instanceToken || ''  // ← token para autenticação
            });
            webhookMetrics.processed++;
            console.log(`📱 [EVOLUTION MESSAGE PROCESSED] ✅`);

        } catch (error) {
            webhookMetrics.errors++;
            console.error('📱 [WA-CHANNEL] ❌ Erro no webhook Evolution:', error.message, error.stack);
        }
    }

    // ============================================================
    // WEBHOOK — TWILIO  (Compatibilidade)
    // ============================================================
    async _handleTwilioWebhook(req, res) {
        if (!isWhatsAppOperational()) {
            return res.status(200).send('<Response></Response>');
        }

        res.status(200).send('<Response></Response>');  // TwiML ack

        try {
            const body = req.body || {};
            const from = body.From || '';  // whatsapp:+5511999998888
            const text = body.Body || '';
            const sid  = body.MessageSid || '';

            if (!from || !text.trim()) return;

            const phone = this._normalizePhone(from.replace('whatsapp:', ''));
            const pushName = body.ProfileName || '';

            console.log(`📱 [WA-IN-TWILIO] ${phone}: "${text.substring(0, 60)}"`);

            if (!this._checkRateLimit(phone)) return;

            // Resolver tenant pelo número Twilio que recebeu a mensagem
            const tenant = await this._resolveTenantByTwilioNumber(body.To || '');
            if (!tenant) {
                console.warn(`📱 [WA-CHANNEL] Número Twilio não mapeado: ${body.To}`);
                return;
            }

            await this._processIncomingMessage({
                apiKey:      tenant.apiKey,
                channelMode: tenant.channelMode,
                notifPhone:  tenant.notificationPhone,
                phone,
                pushName,
                text,
                waMessageId: sid,
                provider:    'twilio'
            });

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro no webhook Twilio:', error.message);
        }
    }

    // ============================================================
    // DESPACHO SEGURO DE OUTBOUND (Máquina de estados: pending -> sending -> sent / outbound_unknown)
    // ============================================================
    async _dispatchOutboundWithSafety({
        apiKey, phone, message, provider, instanceName, instanceToken,
        extraOptions = {}, conversationId, lead, tenantId
    }) {
        if (!isWhatsAppOperational()) {
            console.warn('🚫 [WA-OUTBOUND][BLOCKED] Envio WhatsApp bloqueado: canal desativado operacionalmente');
            return { success: false, blocked: true, errorCode: 'WHATSAPP_CHANNEL_DISABLED', error: 'WhatsApp channel is operationally disabled' };
        }

        const recordId = extraOptions?.persistedRecordId;
        const leaseToken = extraOptions?.leaseToken;
        const isLeaseActive = typeof extraOptions?.isLeaseActive === 'function' ? extraOptions.isLeaseActive : () => true;

        // Se a posse do lease foi perdida pelo heartbeat, abortar imediatamente sem envio
        if (!isLeaseActive()) {
            console.warn(`⚠️ [WA-OUTBOUND] Posse do lease perdida pela flag de heartbeat. Envio outbound cancelado para ${recordId || phone}`);
            return { success: false, leaseLost: true, blocked: true };
        }

        // Validação CAS no banco se leaseToken foi fornecido
        if (recordId && leaseToken && this.db) {
            try {
                const leaseCheckQ = this.USE_POSTGRES
                    ? `SELECT id FROM whatsapp_messages WHERE id = $1 AND (lease_token = $2 OR lease_token IS NULL) AND status = 'processing' LIMIT 1`
                    : `SELECT id FROM whatsapp_messages WHERE id = ? AND (lease_token = ? OR lease_token IS NULL) AND status = 'processing' LIMIT 1`;
                const checkRes = await this.db.query(leaseCheckQ, [recordId, leaseToken]);
                const checkRows = checkRes?.rows || checkRes || [];
                if (!Array.isArray(checkRows) || checkRows.length === 0) {
                    console.warn(`⚠️ [WA-OUTBOUND] Posse do lease expirou no banco ou foi assumida por outro worker. Envio outbound abortado para ${recordId}`);
                    return { success: false, leaseLost: true, blocked: true };
                }
            } catch (_chkErr) {}
        }

        let currentOutboundStatus = extraOptions?.outboundStatus || (extraOptions?.outboundSent ? 'sent' : 'pending');
        let existingOutboundWamid = extraOptions?.outboundWamid || null;

        if (recordId && this.db) {
            try {
                const statusQ = this.USE_POSTGRES
                    ? `SELECT outbound_status, outbound_sent, outbound_wamid FROM whatsapp_messages WHERE id = $1 LIMIT 1`
                    : `SELECT outbound_status, outbound_sent, outbound_wamid FROM whatsapp_messages WHERE id = ? LIMIT 1`;
                const res = await this.db.query(statusQ, [recordId]);
                const row = (res?.rows || res)?.[0];
                if (row) {
                    currentOutboundStatus = row.outbound_status || (row.outbound_sent ? 'sent' : 'pending');
                    existingOutboundWamid = row.outbound_wamid || null;
                }
            } catch (_) {}
        }

        // 1. Mensagem já enviada com confirmação prévia
        if (extraOptions?.outboundSent || currentOutboundStatus === 'sent') {
            console.log(`📱 [WA-OUTBOUND] Outbound já havia sido enviado anteriormente para ${phone} (wamid=${existingOutboundWamid || 'already_sent'}), pulando reenvio.`);
            return { success: true, messageId: existingOutboundWamid || 'already_sent', alreadySent: true };
        }

        // 2. Estado ambíguo (outbound_unknown): bloqueia reenvio automático para prevenir duplicações
        if (currentOutboundStatus === 'outbound_unknown') {
            console.warn(`⚠️ [WA-OUTBOUND-AMBIGUOUS] Mensagem ${recordId} está em estado 'outbound_unknown'. Reenvio automático bloqueado para evitar duplicação.`);
            return { success: false, ambiguous: true, messageId: null, error: 'outbound_unknown' };
        }

        // 3. Estado 'sending' encontrado em retomada: indica interrupção ou queda durante o envio
        if (currentOutboundStatus === 'sending') {
            console.warn(`⚠️ [WA-OUTBOUND-AMBIGUOUS] Mensagem ${recordId} encontrada em estado 'sending' não concluído (provável crash). Marcando como 'outbound_unknown' e bloqueando reenvio.`);
            if (recordId && this.db) {
                try {
                    const updQ = this.USE_POSTGRES
                        ? `UPDATE whatsapp_messages SET outbound_status = 'outbound_unknown', error_message = 'Interrupção durante envio: resultado Meta ambíguo' WHERE id = $1`
                        : `UPDATE whatsapp_messages SET outbound_status = 'outbound_unknown', error_message = 'Interrupção durante envio: resultado Meta ambíguo' WHERE id = ?`;
                    await this.db.query(updQ, [recordId]);
                } catch (_) {}
            }
            return { success: false, ambiguous: true, messageId: null, error: 'outbound_unknown' };
        }

        // 4. Registrar duravelmente estado 'sending' ANTES do POST externo à Meta
        if (recordId && this.db) {
            try {
                const updQ = this.USE_POSTGRES
                    ? `UPDATE whatsapp_messages SET outbound_status = 'sending' WHERE id = $1 ${leaseToken ? 'AND (lease_token = $2 OR lease_token IS NULL)' : ''}`
                    : `UPDATE whatsapp_messages SET outbound_status = 'sending' WHERE id = ? ${leaseToken ? 'AND (lease_token = ? OR lease_token IS NULL)' : ''}`;
                const updParams = leaseToken ? [recordId, leaseToken] : [recordId];
                await this.db.query(updQ, updParams);
            } catch (sendingErr) {
                console.warn(`📱 [WA-OUTBOUND] Falha ao gravar status sending:`, sendingErr.message);
            }
        }

        // 5. Executar chamada de envio
        let sendResult = null;
        try {
            sendResult = await this._sendResponse(apiKey, phone, message, provider, instanceName, instanceToken, extraOptions);
        } catch (callErr) {
            console.error(`⚠️ [WA-OUTBOUND-TIMEOUT] Exceção na chamada de envio Meta:`, callErr.message);
            if (recordId && this.db) {
                try {
                    const updQ = this.USE_POSTGRES
                        ? `UPDATE whatsapp_messages SET outbound_status = 'outbound_unknown', error_message = $1 WHERE id = $2`
                        : `UPDATE whatsapp_messages SET outbound_status = 'outbound_unknown', error_message = ? WHERE id = ?`;
                    await this.db.query(updQ, [`Falha ambígua na chamada Meta: ${callErr.message}`.substring(0, 500), recordId]);
                } catch (_) {}
            }
            throw callErr;
        }

        // 6. Tratar resultado da Meta
        if (sendResult?.success) {
            const outboundWamid = sendResult.messageId || null;
            if (recordId && this.db) {
                try {
                    const updateSentQ = this.USE_POSTGRES
                        ? `UPDATE whatsapp_messages
                           SET outbound_status = 'sent', outbound_sent = true, outbound_wamid = $1, outbound_sent_at = CURRENT_TIMESTAMP
                           WHERE id = $2 ${leaseToken ? 'AND (lease_token = $3 OR lease_token IS NULL)' : ''}`
                        : `UPDATE whatsapp_messages
                           SET outbound_status = 'sent', outbound_sent = 1, outbound_wamid = ?, outbound_sent_at = datetime('now')
                           WHERE id = ? ${leaseToken ? 'AND (lease_token = ? OR lease_token IS NULL)' : ''}`;
                    const updateSentParams = leaseToken ? [outboundWamid, recordId, leaseToken] : [outboundWamid, recordId];
                    await this.db.query(updateSentQ, updateSentParams);
                } catch (_sentErr) {
                    console.warn('📱 [WA-QUEUE] Erro ao marcar outbound_status sent:', _sentErr.message);
                }
            }

            // Registrar mensagem no log com direção outbound
            await this._logMessage({
                apiKey,
                waMessageId: outboundWamid || '',
                waPhone: phone,
                direction: 'outbound',
                content: message,
                leadId: lead?.id,
                conversationId,
                provider,
                tenantId,
                tenantUuid: extraOptions?.tenantUuid || tenantId
            });

            return sendResult;
        } else {
            // Falha reportada pela Meta
            const isAmbiguous = sendResult?.errorCode === 'ETIMEDOUT' ||
                                sendResult?.errorCode === 'ECONNRESET' ||
                                (typeof sendResult?.errorCode === 'number' && sendResult.errorCode >= 500 && sendResult.errorCode < 600);
            const nextStatus = isAmbiguous ? 'outbound_unknown' : 'failed';
            if (recordId && this.db) {
                try {
                    const updateSentQ = this.USE_POSTGRES
                        ? `UPDATE whatsapp_messages SET outbound_status = $1, error_message = $2 WHERE id = $3`
                        : `UPDATE whatsapp_messages SET outbound_status = ?, error_message = ? WHERE id = ?`;
                    await this.db.query(updateSentQ, [nextStatus, String(sendResult?.error || '').substring(0, 500), recordId]);
                } catch (_) {}
            }
            return sendResult;
        }
    }

    // ============================================================
    // PROCESSAMENTO UNIFICADO (todos os provedores convergem aqui)
    // ============================================================
    async _processIncomingMessage({ apiKey, channelMode, notifPhone, phone, pushName, text, waMessageId, provider, instanceName, instanceToken, extraOptions = {} }) {
        try {
            // Fase 2B/2C: Resolver tenantId (UUID canônico) a partir de extraOptions ou apiKey
            let tenantId = extraOptions?.tenantUuid || null;
            if (!tenantId) {
                try {
                    if (this.deps.getApiKeyManager) {
                        const keyManager = this.deps.getApiKeyManager();
                        if (keyManager) {
                            const validation = await keyManager.validateKey(apiKey);
                            if (validation?.valid && validation.tenantId) {
                                tenantId = validation.tenantId;
                            }
                        }
                    }
                } catch (tenantErr) {
                    console.warn('📅 [WA-SCHED][TENANT] Erro ao resolver tenantId:', tenantErr.message);
                }
            }
            // Guardar apiKey ativa para _syncAppointmentToMemory (cenário pós-rotação)
            this._currentApiKey = apiKey;

            // 1. Resolver ou criar lead pelo telefone
            const lead = await this._resolveLeadByPhone(apiKey, phone, pushName, tenantId);
            // GARANTIA OMNICHANNEL (CENÁRIO B): Priorizar o conversationId do CRM (Widget) para unificar a memória da IA
            const conversationId = lead?.conversationId || this._makeConversationId(phone, apiKey);

            // 2. Registrar mensagem de entrada (Correção D: identidade canônica)
            await this._logMessage({
                apiKey, waMessageId, waPhone: phone, direction: 'inbound',
                content: text, leadId: lead?.id, conversationId, provider, tenantId,
                tenantUuid: extraOptions?.tenantUuid || tenantId
            });

            // 3. Atualizar histórico do lead
            if (lead) {
                try {
                    const ls = this.getLeadSystem(apiKey);
                    ls.updateLeadConversation(lead.id, text, true);
                } catch (e) { /* não bloqueia */ }
            }

            // 4. Incrementar analytics
            try {
                if (this.analytics) {
                    this.analytics.chatRequests = (this.analytics.chatRequests || 0) + 1;
                    if (this.analytics.activeChats) this.analytics.activeChats.add(conversationId);
                }
            } catch (e) { /* não bloqueia */ }

            // ── ⚫ DESLIGADO ──
            if (channelMode === 'off') {
                console.log(`📱 [WA-CHANNEL] Modo ⚫ Desligado — apenas notificação para dono`);
                await this._notifyOwner(apiKey, phone, pushName, text, notifPhone);
                return;
            }

            // ── V22.1: INTERCEPTAR RESPOSTAS DE AGENDAMENTO ANTES DO BRAIN ──
            // Se existe um agendamento pendente E a mensagem é numérica/confirmação,
            // responde direto sem chamar a IA (economia de tokens + fluxo limpo).
            // Se a mensagem NÃO é de agendamento, retorna null → pipeline normal.
            // Fase 2B: Requer tenantId para isolamento multi-tenant.
            try {
                const schedResponse = await this._handleScheduleResponse(conversationId, text, apiKey, lead, tenantId);
                if (schedResponse) {
                    // Resposta de agendamento — enviar com máquina de estados durável
                    const sendResult = await this._dispatchOutboundWithSafety({
                        apiKey,
                        phone,
                        message: schedResponse,
                        provider,
                        instanceName,
                        instanceToken,
                        extraOptions,
                        conversationId,
                        lead,
                        tenantId
                    });
                    console.log(`📅 [WA-SCHED] Resposta de agendamento processada | conv=${conversationId.substring(0, 20)} | success=${sendResult?.success}`);
                    return;
                }
            } catch (_schedErr) {
                console.warn('📅 [WA-SCHED] Erro na interceptação (continuando pipeline):', _schedErr.message);
            }

            // Verificar posse antes de chamar o modelo de IA
            if (typeof extraOptions?.isLeaseActive === 'function' && !extraOptions.isLeaseActive()) {
                console.warn('⚠️ [WA-PROCESS] Posse do lease perdida antes da chamada ao Brain. Abortando execução.');
                return;
            }

            // ── ⚡ AUTOMÁTICO / 🎛️ MANUAL ──
            // V21 PARITY: Chamar o mesmo endpoint do Link Curto
            const aiResult = await this._callUnifiedBrain(apiKey, text, conversationId, lead?.id);

            // Verificar posse após a chamada ao Brain
            if (typeof extraOptions?.isLeaseActive === 'function' && !extraOptions.isLeaseActive()) {
                console.warn('⚠️ [WA-PROCESS] Posse do lease perdida após chamada ao Brain. Abortando execução sem efeitos colaterais.');
                return;
            }

            if (!aiResult || !aiResult.response) {
                console.warn('📱 [WA-CHANNEL] IA sem resposta, enviando fallback');
                await this._dispatchOutboundWithSafety({
                    apiKey,
                    phone,
                    message: 'Recebi sua mensagem! Em breve retornaremos.',
                    provider,
                    instanceName,
                    instanceToken,
                    extraOptions,
                    conversationId,
                    lead,
                    tenantId
                });
                return;
            }

            // Adaptar resposta para WhatsApp + injetar CTA/links inline
            let adapted = this._adaptForWhatsApp(aiResult.response);

            // ═══ INJETAR CTA COMO TEXTO (widget renderiza como botão, WA precisa inline) ═══
            try {
                // 1. CTA do pipeline central (V17.2 Link Resolver)
                if (aiResult.cta && aiResult.cta.url && !adapted.includes(aiResult.cta.url)) {
                    const ctaLabel = aiResult.cta.label || aiResult.cta.text || '🚀 Acesse aqui';
                    adapted += `\n\n${ctaLabel}\n👉 ${aiResult.cta.url}`;
                    console.log(`📱 [WA-CTA] Injetado CTA inline: ${aiResult.cta.url.substring(0, 60)}`);
                }

                // 2. [V21-FIX-01] CTA fantasma REMOVIDO — injetava "Fale com a equipe: wa.me/..."
                // em TODAS as respostas (inclusive "obrigado", "o que é?", "não entendi")
                // Causa raiz: stripCTAText() removia wa.me → guarda !adapted.includes('wa.me') sempre true
                // CTA por intenção (bloco 1 acima) continua funcionando via V17.2 pipeline
            } catch (ctaErr) {
                console.warn(`📱 [WA-CTA] Erro ao injetar CTA (sem impacto):`, ctaErr.message);
            }

            // ════════════════════════════════════════════════════════════════
            // V21 PARITY: TRADUZIR sinais do pipeline central para WhatsApp
            // O WhatsApp NÃO decide — apenas traduz o que o Link Curto decidiu
            // ════════════════════════════════════════════════════════════════
            try {
                // ── CAPTURA: Traduzir sinal de leadCapture para texto ──
                // O pipeline retorna shouldCapture=true quando o Lead Score atingiu
                // o threshold. O WhatsApp apenas converte isso em pergunta textual.
                // REGRA: Nenhuma lógica de captura própria — apenas tradução.
                if (aiResult.leadCapture && aiResult.leadCapture.shouldCapture && !lead?.email_captured) {
                    const captureMsg = aiResult.leadCapture.captureMessage
                        || '📋 Para que eu possa te ajudar melhor, posso saber seu nome?';
                    adapted += `\n\n${captureMsg}`;
                    console.log(`📱 [WA-V21-CAPTURE] Sinal de captura traduzido do pipeline central`);
                }

                // ── V22.1 AGENDAMENTO CONVERSACIONAL ──
                // O pipeline retorna calendarHash quando detecta intenção de agendamento.
                // No Link Curto, isso renderiza um widget calendário inline.
                // No WhatsApp, buscamos os slots via API e oferecemos opções numeradas.
                // Reutiliza: GET /api/public/availability/:hash + POST /api/public/book/:hash
                // Estado: persistido em PostgreSQL (wa_schedule_pending)
                // Fluxo: INTERRUPTÍVEL (perguntas normais passam) + RETOMÁVEL (número retoma)
                // Fase 2B: Requer tenantId para isolamento multi-tenant.
                if (aiResult.calendarHash && !adapted.includes('/agendar/')) {
                    if (!tenantId) {
                        console.log('📅 [WA-SCHED][TENANT] tenantId ausente — agendamento indisponível');
                    } else {
                    const hasLeadData = lead && (lead.email || lead.telefone || lead.wa_phone);
                    if (hasLeadData || (aiResult.leadCapture && !aiResult.leadCapture.shouldCapture)) {
                        // Lead já capturado OU pipeline não pediu captura → oferecer slots
                        // Fase 2B: try/catch separado (1) buscar slots, (2) persistir, (3) injetar
                        let slotsResult = null;
                        try {
                            slotsResult = await this._fetchAndFormatSlots(aiResult.calendarHash);
                        } catch (fetchErr) {
                            console.warn(`📅 [WA-SCHED] Erro ao buscar slots:`, fetchErr.message);
                        }

                        if (slotsResult && slotsResult.slots.length > 0) {
                            // Fase 2B: Persistir com transação e tenant_id
                            const saved = await this._saveScheduleOfferStrict(
                                conversationId, apiKey, aiResult.calendarHash,
                                slotsResult.slots, lead?.id, tenantId
                            );
                            if (saved) {
                                adapted += `\n\n${slotsResult.message}`;
                                console.log(`📅 [WA-SCHED] Slots oferecidos: ${slotsResult.slots.length} opções | conv=${conversationId.substring(0, 20)}`);
                            } else {
                                console.warn('📅 [WA-SCHED] Slots buscados mas não persistidos — não injetando no chat');
                            }
                        } else if (slotsResult) {
                            // Sem slots disponíveis — fallback texto
                            adapted += `\n\n📅 No momento não há horários disponíveis para agendamento. Tente novamente mais tarde.`;
                            console.log(`📅 [WA-SCHED] Sem slots disponíveis`);
                        }
                        // Se slotsResult é null (erro na busca), não injetar nada — mais seguro que URL fallback
                    } else {
                        // Lead NÃO capturado E pipeline PEDIU captura → captura primeiro
                        // O agendamento aparecerá na próxima interação após captura
                        console.log(`📅 [WA-SCHED] Agendamento ADIADO — aguardando captura do lead`);
                    }
                    } // fim if (tenantId)
                }
            } catch (_v21TranslateErr) {
                console.warn(`📱 [WA-V21] Erro na tradução de sinais (sem impacto):`, _v21TranslateErr.message);
            }

            // Enviar resposta através do pipeline outbound com máquina de estados durável
            const sendResult = await this._dispatchOutboundWithSafety({
                apiKey,
                phone,
                message: adapted,
                provider,
                instanceName,
                instanceToken,
                extraOptions,
                conversationId,
                lead,
                tenantId
            });

            // Atualizar histórico com resposta da IA se envio for bem-sucedido
            if (sendResult?.success && lead) {
                try {
                    const ls = this.getLeadSystem(apiKey);
                    ls.updateLeadConversation(lead.id, adapted, false);
                } catch (e) { /* não bloqueia */ }
            }

            // ════════════════════════════════════════════════════════════════
            // V21 PARITY AUDIT: Registrar telemetria para comparação
            // ════════════════════════════════════════════════════════════════
            try {
                waParityAudit.log({
                    message: text,
                    channel: 'whatsapp',
                    conversationId,
                    leadId: lead?.id || '',
                    journeyStage: aiResult.journeyStage || 'N/A',
                    intentDetected: aiResult.inteligenciasDetectadas || {},
                    leadScore: aiResult.leadCapture?.score || 0,
                    ctaTriggered: !!(aiResult.cta && aiResult.cta.url),
                    captureTriggered: !!(aiResult.leadCapture && aiResult.leadCapture.shouldCapture),
                    scheduleTriggered: !!aiResult.calendarHash,
                    generateAIResponseExecuted: true,
                    responseSource: WA_USE_FULL_PIPELINE ? 'process-chat-inteligente' : 'chat-universal',
                    responsePreview: adapted?.substring(0, 120),
                    wouldMatchLinkCurto: WA_USE_FULL_PIPELINE
                });
            } catch (_auditErr) {
                // Auditoria NUNCA impacta o fluxo
            }

            console.log(`📱 [WA-OUT] ${phone}: enviado ${adapted.length} chars | cta=${!!(aiResult.cta && aiResult.cta.url)} | journey=${aiResult.journeyStage || 'N/A'} | capture=${!!(aiResult.leadCapture?.shouldCapture)} | schedule=${!!aiResult.calendarHash}`);

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao processar mensagem:', error.message);
            throw error;
        }
    }

    // ============================================================
    // V21 PARITY: CHAMAR UNIFIED BRAIN VIA HTTP INTERNO
    // Mesmo endpoint do Link Curto: /api/process-chat-inteligente
    // Feature flag WA_USE_FULL_PIPELINE para rollback
    // (zero acoplamento — reutiliza toda a stack: auth, billing, IA, inteligências)
    // ============================================================
    async _callUnifiedBrain(apiKey, message, conversationId, leadId) {
        return new Promise(async (resolve) => {
            const timeout = setTimeout(() => {
                console.warn('📱 [WA-CHANNEL] Timeout da IA (30s)');
                resolve(null);
            }, AI_TIMEOUT);

            try {
                // ═══ BUSCAR TODOS os dados DO ASSISTENTE (idêntico ao link curto) ═══
                let salesUrl = null;
                let robotName = null;
                let instructions = null;
                let checkoutLink = null;
                let pageData = null;

                try {
                    if (this.USE_POSTGRES && this.db) {
                        // 1. Dados do assistente (short_urls) — mesma fonte do Link Curto
                        const urlResult = await this.db.query(
                            `SELECT sales_url, robot_name, instructions FROM short_urls WHERE api_key = $1 ORDER BY id DESC LIMIT 1`,
                            [apiKey]
                        );
                        const urlRow = (urlResult.rows || urlResult)[0];
                        if (urlRow) {
                            salesUrl = urlRow.sales_url || null;
                            robotName = urlRow.robot_name || null;
                            instructions = urlRow.instructions || null;
                        }

                        // 2. Checkout confirmado (checkout_links)
                        if (salesUrl) {
                            try {
                                const urlHash = crypto.createHash('md5').update(salesUrl).digest('hex').substring(0, 16);
                                const ckResult = await this.db.query(
                                    `SELECT checkout_url FROM checkout_links WHERE api_key = $1 AND url_hash = $2 AND confirmed = true LIMIT 1`,
                                    [apiKey, urlHash]
                                );
                                const ckRow = (ckResult.rows || ckResult)[0];
                                if (ckRow && ckRow.checkout_url) {
                                    checkoutLink = ckRow.checkout_url;
                                }
                            } catch (ckErr) {
                                console.warn(`📱 [WA-CHANNEL] Checkout DB lookup falhou:`, ckErr.message);
                            }
                        }

                        // 3. Extração do site (mesma que o Link Curto faz via extractPageData no /chatbot)
                        if (salesUrl) {
                            try {
                                const { extractPageData } = require('./server-utils') || {};
                                if (typeof extractPageData === 'function') {
                                    pageData = await extractPageData(salesUrl);
                                }
                            } catch (exErr) {
                                // extractPageData pode não estar disponível como módulo separado
                                // Nesse caso, o endpoint fará a extração via url
                            }
                        }

                        console.log(`📱 [WA-V21] Assistente: name=${robotName} url=${(salesUrl || '').substring(0, 50)} checkout=${(checkoutLink || 'N/A').substring(0, 50)} pageData=${pageData ? 'SIM' : 'via-url'}`);
                    }
                } catch (e) {
                    console.warn(`📱 [WA-CHANNEL] Erro ao buscar dados do assistente:`, e.message);
                }

                // Montar pageData com checkout se disponível
                const enrichedPageData = pageData ? { ...pageData } : undefined;
                if (enrichedPageData && checkoutLink) {
                    enrichedPageData.checkoutLink = checkoutLink;
                    enrichedPageData.checkoutSource = 'db_confirmed';
                }

                // ════════════════════════════════════════════════════════════════
                // V21: PAYLOAD IDÊNTICO AO LINK CURTO (linhas 11448-11456 server.js)
                // Campos: message, pageData, robotName, instructions, conversationId, leadId, apiKey
                // ════════════════════════════════════════════════════════════════
                const postData = JSON.stringify({
                    message,
                    apiKey,
                    conversationId,
                    leadId: leadId || undefined,
                    url: salesUrl || undefined,
                    robotName: robotName || undefined,
                    instructions: instructions || undefined,
                    pageData: enrichedPageData || undefined,
                    context: checkoutLink ? { checkoutLink } : undefined
                });

                // V21: Selecionar endpoint baseado na feature flag
                const endpointPath = WA_USE_FULL_PIPELINE
                    ? '/api/process-chat-inteligente'
                    : '/api/chat-universal';

                console.log(`📱 [WA-V21] Endpoint: ${endpointPath} | pipeline=${WA_USE_FULL_PIPELINE ? 'FULL' : 'LEGACY'}`);

                const options = {
                    hostname: '127.0.0.1',
                    port: this.serverPort,
                    path: endpointPath,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                        'X-Internal-Channel': 'whatsapp'   // Marcador de canal (não altera lógica)
                    }
                };

                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        clearTimeout(timeout);
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        } catch (e) {
                            console.error('📱 [WA-CHANNEL] Erro ao parsear resposta da IA:', e.message);
                            resolve(null);
                        }
                    });
                });

                req.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('📱 [WA-CHANNEL] Erro HTTP interno:', err.message);
                    resolve(null);
                });

                req.write(postData);
                req.end();

            } catch (err) {
                clearTimeout(timeout);
                console.error('📱 [WA-CHANNEL] Erro ao chamar Unified Brain:', err.message);
                resolve(null);
            }
        });
    }

    // ============================================================
    // RESOLUÇÃO DE LEAD POR TELEFONE
    // ============================================================
    async _resolveLeadByPhone(apiKey, phone, pushName, tenantId = null) {
        try {
            const leadSystem = this.getLeadSystem(apiKey, tenantId);
            const leads = leadSystem.getLeads();

            // 1. Buscar por wa_phone (campo novo)
            let lead = leads.find(l => l.wa_phone === phone);
            if (lead) return lead;

            // 2. Buscar por telefone normalizado existente
            const phoneVariants = [phone, phone.replace('+', ''), phone.replace('+55', '')];
            lead = leads.find(l => {
                if (!l.telefone) return false;
                const norm = this._normalizePhone(l.telefone);
                return phoneVariants.includes(norm) || phoneVariants.includes(l.telefone);
            });

            if (lead) {
                // Vincular wa_phone ao lead existente
                lead.wa_phone = phone;
                lead.channel = lead.channel || 'widget';  // preservar canal original
                if (tenantId) lead.tenantUuid = tenantId;
                leadSystem.saveLeads(tenantId);
                console.log(`📱 [WA-CHANNEL] Lead existente vinculado via telefone: ${lead.nome || lead.email} ← ${phone}`);
                return lead;
            }

            // 3. Criar lead novo automaticamente
            const newLead = leadSystem.addLead({
                nome: pushName || 'WhatsApp ' + phone.slice(-4),
                email: 'Não informado',
                telefone: phone,
                wa_phone: phone,
                url_origem: 'whatsapp://' + phone,
                robotName: 'Assistente IA',
                source: 'whatsapp',
                channel: 'whatsapp',
                tenantUuid: tenantId
            });

            console.log(`📱 [WA-CHANNEL] Novo lead criado via WhatsApp: ${newLead.nome} (${phone})`);

            // Sync com CRM (fire-and-forget)
            try {
                const { crmManager } = require('./lib/crm/index');
                if (crmManager && typeof crmManager.syncLeadToCRM === 'function') {
                    crmManager.syncLeadToCRM(tenantId || apiKey, newLead).catch(() => {});
                }
            } catch (e) { /* CRM sync não bloqueia */ }

            return newLead;

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao resolver lead:', error.message);
            return null;
        }
    }

    // ============================================================
    // ENVIAR RESPOSTA VIA WHATSAPP
    // ============================================================
    async _sendResponse(apiKey, phone, message, provider, instanceName, instanceToken, extraOptions = {}) {
        try {
            if (!isWhatsAppOperational()) {
                console.warn('🚫 [WA-CHANNEL][BLOCKED] _sendResponse bloqueado: canal desativado operacionalmente');
                return {
                    success: false,
                    provider: provider || 'unknown',
                    errorCode: 'WHATSAPP_CHANNEL_DISABLED',
                    error: 'WhatsApp channel is operationally disabled'
                };
            }

            // ═══ PRIORIDADE 0: Envio DIRETO via Meta WhatsApp Cloud API (Oficial) ═══
            // REGRA INVIOLÁVEL: provider === 'meta' NUNCA transborda para outros provedores
            const isMeta = provider === 'meta';
            if (isMeta) {
                try {
                    // 1. Verificação Fail-Closed da infraestrutura de banco
                    if (!this.db) {
                        console.error('❌ [META-FAIL-CLOSED] Banco de dados indisponível para envio Meta Cloud API');
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'DB_UNAVAILABLE', error: 'Database service unavailable' };
                    }

                    // 2. Resolver gerenciador de API keys com tratamento de exceção
                    let apiKeyManager = null;
                    try {
                        apiKeyManager = typeof this.deps?.getApiKeyManager === 'function'
                            ? this.deps.getApiKeyManager()
                            : (this.deps?.apiKeyManager || null);
                    } catch (mgrErr) {
                        console.error('❌ [META-FAIL-CLOSED] Exceção ao obter ApiKeyManager:', mgrErr.message);
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'AUTH_SERVICE_UNAVAILABLE', error: 'Authentication service unavailable' };
                    }

                    if (!apiKeyManager || typeof apiKeyManager.validateKey !== 'function') {
                        console.error('❌ [META-FAIL-CLOSED] ApiKeyManager indisponível para validação de autorização');
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'AUTH_SERVICE_UNAVAILABLE', error: 'Authentication service unavailable' };
                    }

                    // 3. Validação estrita de autorização em tempo real (Moderno e Legado)
                    let keyVal = null;
                    try {
                        keyVal = await apiKeyManager.validateKey(apiKey);
                    } catch (authErr) {
                        console.error('❌ [META-FAIL-CLOSED] Erro ao validar API key no ApiKeyManager:', authErr.message);
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'AUTH_SERVICE_ERROR', error: 'Authentication service error' };
                    }

                    if (!keyVal || !keyVal.valid) {
                        const reason = keyVal?.reasonCode || 'KEY_INVALID';
                        console.error(`🚫 [META-FAIL-CLOSED] Autorização negada para apiKey (${reason})`);
                        if (reason === 'KEY_REVOKED') {
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'KEY_REVOKED', error: 'API key has been revoked' };
                        }
                        if (reason === 'KEY_EXPIRED') {
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'KEY_EXPIRED', error: 'API key has expired' };
                        }
                        if (reason === 'TENANT_SUSPENDED') {
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'TENANT_SUSPENDED', error: 'Tenant account is inactive or suspended' };
                        }
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'SECURITY_MISMATCH', error: 'Security validation failed' };
                    }

                    // 4. Identidade canônica obrigatória a partir de keyVal.tenantId
                    let canonicalTenantUuid = null;
                    try {
                        canonicalTenantUuid = validateTenantId(keyVal.tenantId);
                    } catch (_) {
                        console.error('🚫 [META-FAIL-CLOSED] tenantId retornado pela validação não é um UUID válido');
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'SECURITY_MISMATCH', error: 'Security validation failed' };
                    }

                    // Se tenantUuid foi fornecido em extraOptions, exigir correspondência exata
                    if (extraOptions?.tenantUuid) {
                        let claimedUuid = null;
                        try {
                            claimedUuid = validateTenantId(extraOptions.tenantUuid);
                        } catch (_) {
                            console.error('🚫 [META-FAIL-CLOSED] extraOptions.tenantUuid não é um UUID válido');
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'SECURITY_MISMATCH', error: 'Security validation failed' };
                        }
                        if (claimedUuid !== canonicalTenantUuid) {
                            console.error('🚫 [META-FAIL-CLOSED] Divergência de identidade: claimed tenantUuid !== canonicalTenantUuid');
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'SECURITY_MISMATCH', error: 'Security validation failed' };
                        }
                    }

                    const tenantUuid = canonicalTenantUuid;
                    let row = null;

                    // 5. CENÁRIO A: Registro Moderno (Correspondência Conjunta Obrigatória: tenant_uuid AND api_key)
                    const queryA = this.USE_POSTGRES
                        ? `SELECT * FROM whatsapp_settings WHERE tenant_uuid = $1::uuid AND api_key = $2 AND provider = 'meta' AND is_active = true LIMIT 1`
                        : `SELECT * FROM whatsapp_settings WHERE tenant_uuid = ? AND api_key = ? AND provider = 'meta' AND is_active = 1 LIMIT 1`;
                    try {
                        const resA = await this.db.query(queryA, [tenantUuid, apiKey]);
                        row = (resA?.rows || resA)?.[0] || null;
                    } catch (dbErrA) {
                        console.error('❌ [META-FAIL-CLOSED] Erro ao consultar whatsapp_settings (Cenário A):', dbErrA.message);
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'DB_QUERY_ERROR', error: 'Failed to retrieve WhatsApp configuration' };
                    }

                    // 6. CENÁRIO B: Registro Legado (Somente se Cenário A não encontrou)
                    if (!row) {
                        const queryB = this.USE_POSTGRES
                            ? `SELECT * FROM whatsapp_settings WHERE tenant_uuid IS NULL AND api_key = $1 AND provider = 'meta' AND is_active = true LIMIT 1`
                            : `SELECT * FROM whatsapp_settings WHERE tenant_uuid IS NULL AND api_key = ? AND provider = 'meta' AND is_active = 1 LIMIT 1`;
                        try {
                            const resB = await this.db.query(queryB, [apiKey]);
                            const legacyRow = (resB?.rows || resB)?.[0] || null;
                            if (legacyRow) {
                                if (legacyRow.tenant_uuid !== null && legacyRow.tenant_uuid !== undefined && legacyRow.tenant_uuid !== tenantUuid) {
                                    console.error('🚫 [META-FAIL-CLOSED] Registro legado possui tenant_uuid conflitante');
                                    return { success: false, provider: 'meta_cloud_api', errorCode: 'SECURITY_MISMATCH', error: 'Security validation failed' };
                                }
                                row = legacyRow;
                            }
                        } catch (dbErrB) {
                            console.error('❌ [META-FAIL-CLOSED] Erro ao consultar whatsapp_settings (Cenário B):', dbErrB.message);
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'DB_QUERY_ERROR', error: 'Failed to retrieve WhatsApp configuration' };
                        }
                    }

                    // 7. Configuração Meta ativa não encontrada
                    if (!row) {
                        console.error('❌ [META-FAIL-CLOSED] Configuração Meta ativa não encontrada para o tenant');
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'META_NOT_CONFIGURED', error: 'Active Meta WhatsApp configuration not found' };
                    }

                    // 8. Autoridade exclusiva das credenciais: estritamente o registro do banco
                    const rawPhoneId = row.meta_phone_number_id;
                    let rawToken = row.meta_access_token;

                    if (extraOptions?.phoneNumberId && extraOptions.phoneNumberId !== rawPhoneId) {
                        console.warn('⚠️ [META-AUTH] phoneNumberId em extraOptions ignorado; usando estritamente o banco');
                    }

                    // 9. Validação do Phone Number ID
                    const cleanPhoneId = typeof rawPhoneId === 'string' ? rawPhoneId.trim() : (rawPhoneId != null ? String(rawPhoneId).trim() : '');
                    if (!cleanPhoneId || !/^\d+$/.test(cleanPhoneId) || cleanPhoneId.length < 5) {
                        console.error('❌ [META-FAIL-CLOSED] Phone Number ID inválido no registro');
                        return { success: false, provider: 'meta_cloud_api', errorCode: 'INVALID_PHONE_NUMBER_ID', error: 'Invalid Meta Phone Number ID' };
                    }

                    // 10. Descriptografia do Access Token (contexto determinístico comprovado)
                    if (rawToken && typeof rawToken === 'string' && rawToken.startsWith('ENC:')) {
                        const encMgr = this.deps?.encryptionManager;
                        if (!encMgr || !encMgr.enabled) {
                            console.error('❌ [META-FAIL-CLOSED] EncryptionManager indisponível para descriptografar token');
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'ENCRYPTION_UNAVAILABLE', error: 'Encryption manager unavailable' };
                        }
                        const decryptionContext = row.tenant_uuid ? row.tenant_uuid : row.api_key;
                        try {
                            rawToken = encMgr.decrypt(rawToken, decryptionContext);
                        } catch (decErr) {
                            console.error('❌ [META-FAIL-CLOSED] Exceção durante descriptografia do token:', decErr.message);
                            return { success: false, provider: 'meta_cloud_api', errorCode: 'DECRYPTION_FAILED', error: 'Failed to decrypt Meta access credentials' };
                        }
                    }

                    // 11. Validação e sanitização do Access Token
                    const cleanToken = typeof rawToken === 'string' ? rawToken.trim() : '';
                    if (!cleanToken || cleanToken.length < 15 || cleanToken.startsWith('ENC:') || cleanToken.startsWith('[')) {
                        console.error('❌ [META-FAIL-CLOSED] Access Token inválido ou falha de descriptografia');
                        const errorCode = cleanToken.includes('DECRYPTION_FAILED') ? 'DECRYPTION_FAILED' : 'INVALID_ACCESS_TOKEN';
                        const errorMsg = errorCode === 'DECRYPTION_FAILED' ? 'Failed to decrypt Meta access credentials' : 'Invalid Meta Access Token';
                        return { success: false, provider: 'meta_cloud_api', errorCode, error: errorMsg };
                    }

                    // 12. Despacho exclusivo via Meta Cloud API oficial
                    return await this._sendMetaCloudResponse(cleanPhoneId, cleanToken, phone, message);
                } catch (metaErr) {
                    console.error('❌ [META-FAIL-CLOSED] Exceção inesperada no fluxo Meta:', metaErr.message);
                    return { success: false, provider: 'meta_cloud_api', errorCode: 'INTERNAL_ERROR', error: 'Internal error processing Meta dispatch' };
                }
            }

            // ═══ PRIORIDADE 1: Envio DIRETO pela mesma instância que RECEBEU ═══
            const centralUrl = process.env.CENTRAL_EVOLUTION_URL;
            const centralKey = process.env.CENTRAL_EVOLUTION_API_KEY;

            if (instanceName && centralUrl) {
                // Evolution Go v0.7.1: POST /send/text
                // Body: { number, text }
                // Header apikey: instanceToken (preferencial) ou centralKey (fallback)
                const authKey = instanceToken || centralKey;
                if (!authKey) {
                    console.warn(`📱 [WA-SEND] Sem token para instância ${instanceName}`);
                } else {
                    console.log(`📱 [WA-SEND] Enviando via /send/text: instance=${instanceName} token=${authKey.substring(0, 8)}...`);
                    const axios = require('axios');
                    const phoneClean = phone.replace(/\D/g, '');

                    try {
                        const sendResp = await axios.post(
                            `${centralUrl}/send/text`,
                            { number: phoneClean, text: message },
                            {
                                headers: { 'Content-Type': 'application/json', apikey: authKey },
                                timeout: 15000
                            }
                        );
                        console.log(`📱 [EVOLUTION RESPONSE SENT] ✅ instance=${instanceName} status=${sendResp.status}`);
                        return { success: true, provider: 'evolution_go_direct', messageId: sendResp.data?.key?.id || sendResp.data?.data?.id || null };
                    } catch (err1) {
                        console.warn(`📱 [WA-SEND] /send/text com instanceToken falhou:`, JSON.stringify(err1.response?.data || err1.message));

                        // Fallback: tentar com centralKey se o instanceToken falhou
                        if (instanceToken && centralKey && instanceToken !== centralKey) {
                            try {
                                const sendResp2 = await axios.post(
                                    `${centralUrl}/send/text`,
                                    { number: phoneClean, text: message },
                                    {
                                        headers: { 'Content-Type': 'application/json', apikey: centralKey },
                                        timeout: 15000
                                    }
                                );
                                console.log(`📱 [EVOLUTION RESPONSE SENT] ✅ (centralKey) instance=${instanceName}`);
                                return { success: true, provider: 'evolution_go_centralkey', messageId: sendResp2.data?.key?.id || null };
                            } catch (err2) {
                                console.error(`📱 [WA-SEND] ❌ /send/text com centralKey também falhou:`, JSON.stringify(err2.response?.data || err2.message));
                            }
                        }
                    }
                }
            }

            // ═══ PRIORIDADE 2: Instância tenant via whatsapp_settings ═══
            try {
                const instance = await this.whatsappMgr.getTenantInstance(apiKey);
                if (instance && instance !== this.whatsappMgr && instance.isReady()) {
                    return await instance.sendMessage(phone, message);
                }
            } catch (e) {
                console.warn(`📱 [WA-SEND] getTenantInstance falhou:`, e.message);
            }

            // ═══ PRIORIDADE 3: Instância global ═══
            if (this.whatsappMgr.isReady()) {
                return await this.whatsappMgr.sendMessage(phone, message);
            }

            console.warn('📱 [WA-CHANNEL] Nenhuma instância WhatsApp disponível para envio');
            return { success: false, error: 'No WhatsApp instance' };
        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao enviar resposta:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ============================================================
    // ADAPTAR RESPOSTA DA IA PARA WHATSAPP
    // ============================================================
    _adaptForWhatsApp(response) {
        if (!response) return '';

        let text = String(response);

        // Remover marcadores internos do sistema
        text = text.replace(/\[CALENDAR_WIDGET\]/g, '📅 Para agendar, me diga qual dia e horário você prefere.');
        text = text.replace(/\[CTA:[^\]]*\]/g, '');
        text = text.replace(/\[OUT\]/g, '');
        text = text.replace(/<s>\s*/g, '');

        // Converter Markdown → WhatsApp formatting
        text = text.replace(/\*\*(.*?)\*\*/g, '*$1*');     // **bold** → *bold*
        text = text.replace(/__(.*?)__/g, '_$1_');           // __italic__ → _italic_
        text = text.replace(/~~(.*?)~~/g, '~$1~');           // ~~strike~~ → ~strike~

        // Remover tags HTML
        text = text.replace(/<[^>]*>/g, '');

        // Limpar espaços extras
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.trim();

        // FIX-09: Truncar com proteção de surrogate pairs + limpar emojis quebrados
        if (text.length > WA_MSG_MAX_LEN) {
            // Truncar respeitando surrogate pairs
            let end = WA_MSG_MAX_LEN - 20;
            const code = text.charCodeAt(end - 1);
            if (code >= 0xD800 && code <= 0xDBFF) end--;
            text = text.slice(0, end) + '\n\n_(continua...)_';
        }
        // FIX-09: Remover emojis quebrados (U+FFFD) e surrogate pairs órfãos
        text = text
            .replace(/\uFFFD/g, '')
            .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
            .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');

        return text;
    }

    // ============================================================
    // NOTIFICAR DONO (modo ⚫ Desligado)
    // ============================================================
    async _notifyOwner(apiKey, phone, pushName, messageText, notifPhone) {
        try {
            const targetPhone = notifPhone
                || process.env.NOTIFICATION_PHONE
                || process.env.ADMIN_PHONE;

            if (!targetPhone) {
                console.warn('📱 [WA-CHANNEL] Sem telefone de notificação configurado');
                return;
            }

            const notification = `📱 *Nova mensagem WhatsApp*\n\n`
                + `👤 *De:* ${pushName || 'Desconhecido'} (${phone})\n`
                + `💬 *Mensagem:* ${messageText.substring(0, 500)}\n\n`
                + `⏰ ${new Date().toLocaleString('pt-BR')}\n\n`
                + `_O canal WhatsApp está no modo ⚫ Desligado. Responda manualmente._`;

            await this._sendResponse(apiKey, targetPhone, notification, 'evolution');
        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao notificar dono:', error.message);
        }
    }

    // ============================================================
    // RESOLVER TENANT POR INSTÂNCIA EVOLUTION
    // ============================================================
    async _resolveTenantByInstance(instanceName) {
        if (!instanceName) return null;

        // Cache
        const cached = this._tenantCache.get(`evo_${instanceName}`);
        if (cached && cached._expiresAt > Date.now()) return cached;

        try {
            // Tentativa 1: Buscar na tabela whatsapp_settings
            const q = this.USE_POSTGRES
                ? `SELECT api_key, notification_phone, is_active FROM whatsapp_settings
                   WHERE (evolution_instance_name = $1 OR saas_instance_name = $1) AND is_active = true LIMIT 1`
                : `SELECT api_key, notification_phone, is_active FROM whatsapp_settings
                   WHERE (evolution_instance_name = ? OR saas_instance_name = ?) AND is_active = 1 LIMIT 1`;

            const params = this.USE_POSTGRES ? [instanceName] : [instanceName, instanceName];
            const result = await this.db.query(q, params);
            let row = (result.rows || result)[0];

            // Tentativa 2 (FALLBACK): Se não encontrou, resolver pelo padrão lm_{tenantIdPrefix}
            // A instância é nomeada como lm_{first8chars_of_tenant_id}
            if (!row && instanceName.startsWith('lm_')) {
                const tenantIdPrefix = instanceName.replace('lm_', '');
                console.log(`📱 [WA-CHANNEL] Fallback: buscando tenant por ID prefix '${tenantIdPrefix}%'`);
                try {
                    const q2 = this.USE_POSTGRES
                        ? `SELECT ak.key_value as api_key FROM api_keys ak
                           JOIN tenants t ON ak.tenant_id = t.id
                           WHERE t.id::text LIKE $1 AND t.status = 'active' AND ak.active = true
                           LIMIT 1`
                        : `SELECT ak.key_value as api_key FROM api_keys ak
                           JOIN tenants t ON ak.tenant_id = t.id
                           WHERE t.id LIKE ? AND t.status = 'active' AND ak.active = 1
                           LIMIT 1`;
                    const r2 = await this.db.query(q2, [`${tenantIdPrefix}%`]);
                    const row2 = (r2.rows || r2)[0];
                    if (row2) {
                        console.log(`📱 [WA-CHANNEL] ✅ Fallback: tenant encontrado via ID prefix: ${row2.api_key?.substring(0, 12)}...`);
                        row = { api_key: row2.api_key, notification_phone: null, is_active: true };
                    }
                } catch (fbErr) {
                    console.warn(`📱 [WA-CHANNEL] Fallback tenant error:`, fbErr.message);
                }
            }

            if (!row) return null;

            // Buscar channel_mode (pode não existir ainda — fallback 'auto')
            let channelMode = 'auto';
            try {
                const q2 = this.USE_POSTGRES
                    ? `SELECT channel_mode FROM whatsapp_settings WHERE api_key = $1 LIMIT 1`
                    : `SELECT channel_mode FROM whatsapp_settings WHERE api_key = ? LIMIT 1`;
                const r2 = await this.db.query(q2, [row.api_key]);
                const row2 = (r2.rows || r2)[0];
                if (row2 && row2.channel_mode) channelMode = row2.channel_mode;
            } catch (e) {
                // Coluna pode não existir ainda — fallback para 'auto'
            }

            const tenant = {
                apiKey: row.api_key,
                notificationPhone: row.notification_phone,
                channelMode,
                _expiresAt: Date.now() + TENANT_CACHE_TTL
            };

            this._tenantCache.set(`evo_${instanceName}`, tenant);
            return tenant;

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao resolver tenant por instância:', error.message);
            return null;
        }
    }

    // ============================================================
    // RESOLVER TENANT POR NÚMERO TWILIO
    // ============================================================
    async _resolveTenantByTwilioNumber(twilioNumber) {
        if (!twilioNumber) return null;

        const cleanNumber = twilioNumber.replace('whatsapp:', '');
        const cached = this._tenantCache.get(`twilio_${cleanNumber}`);
        if (cached && cached._expiresAt > Date.now()) return cached;

        try {
            const q = this.USE_POSTGRES
                ? `SELECT api_key, notification_phone FROM whatsapp_settings
                   WHERE twilio_from_number = $1 AND is_active = true LIMIT 1`
                : `SELECT api_key, notification_phone FROM whatsapp_settings
                   WHERE twilio_from_number = ? AND is_active = 1 LIMIT 1`;

            const result = await this.db.query(q, [cleanNumber]);
            const row = (result.rows || result)[0];
            if (!row) return null;

            let channelMode = 'auto';
            try {
                const q2 = this.USE_POSTGRES
                    ? `SELECT channel_mode FROM whatsapp_settings WHERE api_key = $1 LIMIT 1`
                    : `SELECT channel_mode FROM whatsapp_settings WHERE api_key = ? LIMIT 1`;
                const r2 = await this.db.query(q2, [row.api_key]);
                const row2 = (r2.rows || r2)[0];
                if (row2 && row2.channel_mode) channelMode = row2.channel_mode;
            } catch (e) { /* coluna pode não existir */ }

            const tenant = {
                apiKey: row.api_key,
                notificationPhone: row.notification_phone,
                channelMode,
                _expiresAt: Date.now() + TENANT_CACHE_TTL
            };

            this._tenantCache.set(`twilio_${cleanNumber}`, tenant);
            return tenant;

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao resolver tenant Twilio:', error.message);
            return null;
        }
    }

    // ============================================================
    // LOG DE MENSAGENS (whatsapp_messages)
    // ============================================================
    async _logMessage({ apiKey, waMessageId, waPhone, direction, content, leadId, conversationId, provider, tenantId, tenantUuid }) {
        try {
            if (!this.USE_POSTGRES && !this.db) return; // Só loga se houver banco disponível

            const candidateUuid = tenantUuid || tenantId;
            const resolvedTenantUuid = (typeof candidateUuid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateUuid.trim()))
                ? candidateUuid.trim().toLowerCase()
                : null;

            // Requisito D: Fail-closed para provider Meta sem tenant_uuid canônico
            if (provider === 'meta' && !resolvedTenantUuid) {
                console.error('📱 [WA-LOG] ❌ Rejeição fail-closed: Mensagem Meta sem tenant_uuid canônico.');
                return;
            }

            const canonicalTenantId = resolvedTenantUuid || apiKey;

            // Se for mensagem de entrada da Meta já persistida no claim, atualizar lead e conversa (sem alterar status prematuramente)
            if (provider === 'meta' && direction === 'inbound' && waMessageId) {
                const updateQ = this.USE_POSTGRES
                    ? `UPDATE whatsapp_messages
                       SET lead_id = COALESCE($1, lead_id),
                           conversation_id = COALESCE($2, conversation_id)
                       WHERE tenant_uuid = $3 AND provider = 'meta' AND wa_message_id = $4`
                    : `UPDATE whatsapp_messages
                       SET lead_id = COALESCE(?, lead_id),
                           conversation_id = COALESCE(?, conversation_id)
                       WHERE tenant_uuid = ? AND provider = 'meta' AND wa_message_id = ?`;
                const updateRes = await this.db.query(updateQ, [leadId || null, conversationId || '', resolvedTenantUuid, waMessageId]);
                const updated = (updateRes?.rowCount > 0 || updateRes?.changes > 0);
                if (updated) return;
            }

            const id = crypto.randomBytes(12).toString('hex');
            const q = this.USE_POSTGRES
                ? `INSERT INTO whatsapp_messages
                    (id, tenant_id, api_key, wa_message_id, wa_phone, direction, content, lead_id, conversation_id, provider, tenant_uuid, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'delivered')
                    ON CONFLICT (tenant_uuid, provider, wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING`
                : `INSERT INTO whatsapp_messages
                    (id, tenant_id, api_key, wa_message_id, wa_phone, direction, content, lead_id, conversation_id, provider, tenant_uuid, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'delivered')
                    ON CONFLICT (tenant_uuid, provider, wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING`;

            await this.db.query(q, [
                id, canonicalTenantId, apiKey,
                waMessageId || '', waPhone, direction,
                (content || '').substring(0, 10000),
                leadId || null, conversationId || '', provider || '',
                resolvedTenantUuid
            ]);
        } catch (error) {
            console.warn('📱 [WA-CHANNEL] Erro ao salvar log de mensagem:', error.message);
        }
    }

    // ============================================================
    // RATE LIMITING (por telefone)
    // ============================================================
    _checkRateLimit(phone) {
        const now = Date.now();
        let timestamps = this._rateLimits.get(phone) || [];

        // Remover timestamps fora da janela
        timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);

        if (timestamps.length >= RATE_LIMIT_MAX) return false;

        timestamps.push(now);
        this._rateLimits.set(phone, timestamps);

        // Limpar map periodicamente (evitar memory leak)
        if (this._rateLimits.size > 5000) {
            const cutoff = now - RATE_LIMIT_WINDOW;
            for (const [key, val] of this._rateLimits) {
                if (val.every(t => t < cutoff)) this._rateLimits.delete(key);
            }
        }

        return true;
    }

    // ============================================================
    // UTILITÁRIOS
    // ============================================================

    /** Normalizar telefone para formato E.164 (+55...) */
    _normalizePhone(phone) {
        if (!phone) return '';
        let cleaned = String(phone).replace(/\D/g, '');

        // Adicionar código do país Brasil se ausente
        if (cleaned.length <= 11 && !cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }

        return '+' + cleaned;
    }

    /** Gerar conversationId estável para WhatsApp */
    _makeConversationId(phone, apiKey) {
        // Formato: wa_<phone>_<apiKey8chars>
        const keyPart = (apiKey || '').substring(0, 8);
        const phonePart = phone.replace(/\D/g, '');
        return `wa_${phonePart}_${keyPart}`;
    }

    /** Invalidar cache de tenant */
    clearTenantCache(apiKey) {
        for (const [key, val] of this._tenantCache) {
            if (val.apiKey === apiKey) this._tenantCache.delete(key);
        }
    }
}

// ============================================================
// EXPORTAÇÃO / REGISTRO
// ============================================================

let _channelInstance = null;

/**
 * Registrar canal WhatsApp no Express app
 * Chamado uma vez em server.js com injeção de dependências
 *
 * @param {Object} app - Express app
 * @param {Object} deps - { db, USE_POSTGRES, getLeadSystem, whatsappManager, analytics }
 * @returns {WhatsAppChannel}
 */
function registerWhatsAppChannel(app, deps) {
    try {
        _channelInstance = new WhatsAppChannel(deps);
        _channelInstance.registerRoutes(app);
        console.log('📱 [WA-CHANNEL] Canal WhatsApp registrado com sucesso');
        return _channelInstance;
    } catch (error) {
        console.error('📱 [WA-CHANNEL] Erro ao registrar canal (não bloqueia servidor):', error.message);
        return null;
    }
}

module.exports = {
    registerWhatsAppChannel,
    WhatsAppChannel,
    getChannelInstance: () => _channelInstance
};
