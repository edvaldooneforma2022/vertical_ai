/**
 * 📅 SCHEDULING MANAGER - Link Mágico V8.0
 * Gerenciamento de disponibilidade e agendamentos com calendário real
 * 100% desacoplado do core de chat/IA — módulo aditivo
 * 
 * SAFE PATCH - SCHED-004
 */

const crypto = require('crypto');
const { db, USE_POSTGRES } = require('./database');

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function ph(n) {
    return USE_POSTGRES ? `$${n}` : '?';
}

// Dias da semana em português
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

class SchedulingManager {
    constructor() {
        this.cache = new Map(); // Cache de disponibilidade por tenant
    }

    /**
     * Resolver tenant_id a partir de apiKey (hash SHA-256)
     */
    async _resolveTenantId(apiKey) {
        if (!apiKey) return null;
        try {
            const keyHash = crypto.createHash('sha256').update(String(apiKey)).digest('hex');
            const q = USE_POSTGRES
                ? `SELECT tenant_id FROM api_keys WHERE key_hash = $1 AND active = true LIMIT 1`
                : `SELECT tenant_id FROM api_keys WHERE key_hash = ? AND active = 1 LIMIT 1`;
            const result = await db.query(q, [keyHash]);
            const row = (result.rows || result)[0];
            return row?.tenant_id || apiKey;
        } catch (e) {
            return apiKey; // fallback
        }
    }

    /**
     * Gerar hash público para API de calendário (não expõe apiKey real)
     */
    generatePublicHash(apiKey) {
        return crypto.createHash('sha256').update(`calendar_${apiKey}`).digest('hex').substring(0, 16);
    }

    /**
     * Resolver apiKey a partir de hash público
     * Busca em api_keys a key cujo calendar hash corresponda
     */
    async resolveApiKeyFromHash(publicHash) {
        try {
            // Buscar todas as api_keys ativas e verificar hash
            const q = USE_POSTGRES
                ? `SELECT key_value FROM api_keys WHERE active = true`
                : `SELECT key_value FROM api_keys WHERE active = 1`;
            const result = await db.query(q, []);
            const rows = result.rows || result;
            
            for (const row of rows) {
                const hash = this.generatePublicHash(row.key_value);
                if (hash === publicHash) {
                    return row.key_value;
                }
            }
            return null;
        } catch (e) {
            console.warn('⚠️ [Scheduling] Erro ao resolver hash público:', e.message);
            return null;
        }
    }

    // ============================================================
    // DISPONIBILIDADE (configuração pelo tenant)
    // ============================================================

    /**
     * Obter disponibilidade do tenant
     */
    async getAvailability(tenantId) {
        try {
            const cached = this.cache.get(`avail_${tenantId}`);
            if (cached && cached.expiresAt > Date.now()) {
                return cached.data;
            }

            const q = `SELECT * FROM tenant_availability 
                        WHERE tenant_id = ${ph(1)} AND active = ${USE_POSTGRES ? 'true' : '1'} 
                        ORDER BY day_of_week ASC, start_time ASC`;
            const result = await db.query(q, [tenantId]);
            const rows = result.rows || result;

            const availability = rows.map(r => ({
                id: r.id,
                dayOfWeek: r.day_of_week,
                dayName: DAY_NAMES[r.day_of_week] || 'N/A',
                startTime: r.start_time,
                endTime: r.end_time,
                slotDuration: r.slot_duration_minutes || 60
            }));

            this.cache.set(`avail_${tenantId}`, {
                data: availability,
                expiresAt: Date.now() + 60000 // 1 min cache
            });

            return availability;
        } catch (error) {
            console.error('❌ [Scheduling] Erro ao obter disponibilidade:', error.message);
            return [];
        }
    }

    /**
     * Salvar disponibilidade do tenant (substituição completa)
     * @param {string} tenantId
     * @param {Array} slots - [{ dayOfWeek, startTime, endTime, slotDuration }]
     */
    async saveAvailability(tenantId, slots) {
        try {
            // Deletar disponibilidade anterior
            await db.query(`DELETE FROM tenant_availability WHERE tenant_id = ${ph(1)}`, [tenantId]);

            // Inserir novos slots
            for (const slot of slots) {
                const id = generateId();
                const q = `INSERT INTO tenant_availability 
                    (id, tenant_id, day_of_week, start_time, end_time, slot_duration_minutes) 
                    VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, ${ph(5)}, ${ph(6)})`;
                await db.query(q, [
                    id, tenantId,
                    slot.dayOfWeek,
                    slot.startTime,
                    slot.endTime,
                    slot.slotDuration || 60
                ]);
            }

            // Invalidar cache
            this.cache.delete(`avail_${tenantId}`);

            console.log(`📅 [Scheduling] Disponibilidade salva para tenant: ${slots.length} slots`);
            return { success: true, slotsCount: slots.length };
        } catch (error) {
            console.error('❌ [Scheduling] Erro ao salvar disponibilidade:', error.message);
            throw error;
        }
    }

    // ============================================================
    // DATAS BLOQUEADAS
    // ============================================================

    async getBlockedDates(tenantId) {
        try {
            const q = `SELECT * FROM tenant_blocked_dates 
                        WHERE tenant_id = ${ph(1)} 
                        ORDER BY blocked_date ASC`;
            const result = await db.query(q, [tenantId]);
            return (result.rows || result).map(r => ({
                id: r.id,
                date: r.blocked_date,
                reason: r.reason || ''
            }));
        } catch (error) {
            console.error('❌ [Scheduling] Erro ao obter datas bloqueadas:', error.message);
            return [];
        }
    }

    async addBlockedDate(tenantId, date, reason) {
        try {
            const id = generateId();
            const q = `INSERT INTO tenant_blocked_dates (id, tenant_id, blocked_date, reason) 
                        VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)})`;
            await db.query(q, [id, tenantId, date, reason || '']);
            this.cache.delete(`avail_${tenantId}`);
            return { id, date, reason };
        } catch (error) {
            console.error('❌ [Scheduling] Erro ao bloquear data:', error.message);
            throw error;
        }
    }

    async removeBlockedDate(tenantId, blockedDateId) {
        try {
            await db.query(
                `DELETE FROM tenant_blocked_dates WHERE id = ${ph(1)} AND tenant_id = ${ph(2)}`,
                [blockedDateId, tenantId]
            );
            return { deleted: true };
        } catch (error) {
            console.error('❌ [Scheduling] Erro ao remover data bloqueada:', error.message);
            throw error;
        }
    }

    // ============================================================
    // CALENDÁRIO PÚBLICO (para clientes finais)
    // ============================================================

    /**
     * Gerar slots disponíveis para os próximos N dias
     * Usado pelo calendário visual do chatbot
     */
    async getPublicSlots(tenantId, daysAhead = 14) {
        try {
            const availability = await this.getAvailability(tenantId);
            const blockedDates = await this.getBlockedDates(tenantId);
            const blockedSet = new Set(blockedDates.map(b => {
                // Normalizar formato da data
                const d = new Date(b.date);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }));

            // Se tenant não configurou disponibilidade, retornar fallback
            if (!availability || availability.length === 0) {
                return this._getDefaultSlots(daysAhead);
            }

            // Buscar agendamentos existentes para saber quais slots já estão ocupados
            let bookedSlots = new Set();
            try {
                const q = `SELECT datetime FROM appointments 
                           WHERE api_key = ${ph(1)} AND status != 'cancelado'`;
                const result = await db.query(q, [tenantId]);
                const rows = result.rows || result;
                bookedSlots = new Set(rows.map(r => r.datetime));
            } catch (e) {
                // Tabela pode não existir nesse formato — ignorar
            }

            const slots = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let i = 1; i <= daysAhead; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                const dayOfWeek = date.getDay();
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                // Verificar se a data está bloqueada
                if (blockedSet.has(dateStr)) continue;

                // Encontrar slots para esse dia da semana
                const daySlots = availability.filter(a => a.dayOfWeek === dayOfWeek);
                if (daySlots.length === 0) continue;

                const dayResult = {
                    date: dateStr,
                    dayName: DAY_NAMES[dayOfWeek],
                    dayOfWeek,
                    times: []
                };

                for (const slot of daySlots) {
                    const times = this._generateTimeSlots(
                        slot.startTime,
                        slot.endTime,
                        slot.slotDuration
                    );

                    for (const time of times) {
                        const datetimeStr = `${DAY_NAMES[dayOfWeek]} ${time}`;
                        const fullDatetime = `${dateStr} ${time}`;
                        if (!bookedSlots.has(datetimeStr) && !bookedSlots.has(fullDatetime)) {
                            dayResult.times.push(time);
                        }
                    }
                }

                if (dayResult.times.length > 0) {
                    slots.push(dayResult);
                }
            }

            return slots;
        } catch (error) {
            console.error('❌ [Scheduling] Erro ao gerar slots públicos:', error.message);
            return this._getDefaultSlots(daysAhead);
        }
    }

    /**
     * Gerar time slots entre start e end com duração específica
     * @private
     */
    _generateTimeSlots(startTime, endTime, durationMinutes) {
        const times = [];
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        
        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currentMinutes + durationMinutes <= endMinutes) {
            const h = Math.floor(currentMinutes / 60);
            const m = currentMinutes % 60;
            times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            currentMinutes += durationMinutes;
        }

        return times;
    }

    /**
     * Fallback: horários padrão se o tenant não configurou
     * Mantém compatibilidade com o sistema antigo
     * @private
     */
    _getDefaultSlots(daysAhead = 14) {
        const defaults = [
            { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', slotDuration: 60 },
            { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', slotDuration: 60 },
            { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', slotDuration: 60 },
            { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', slotDuration: 60 },
            { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', slotDuration: 60 }
        ];

        const slots = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i <= daysAhead; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dayOfWeek = date.getDay();
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            const dayConfig = defaults.find(d => d.dayOfWeek === dayOfWeek);
            if (!dayConfig) continue;

            const times = this._generateTimeSlots(dayConfig.startTime, dayConfig.endTime, dayConfig.slotDuration);
            if (times.length > 0) {
                slots.push({
                    date: dateStr,
                    dayName: DAY_NAMES[dayOfWeek],
                    dayOfWeek,
                    times
                });
            }
        }

        return slots;
    }
}

// Singleton
const schedulingManager = new SchedulingManager();

module.exports = { schedulingManager, SchedulingManager };
