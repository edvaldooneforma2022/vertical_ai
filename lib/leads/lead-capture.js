/**
 * 💼 SISTEMA DE CAPTURA DE LEADS - Link Mágico V8.0
 * 
 * Módulo extraído da refatoração Fase 5.
 * Gerencia leads e agendamentos por tenant com suporte a:
 * - PostgreSQL (primário)
 * - JSON (backup/fallback)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ===== CONFIGURAÇÃO =====
const USE_POSTGRES = process.env.DATABASE_URL && process.env.USE_POSTGRES !== 'false';

// ===== FUNÇÕES AUXILIARES =====

function getTenantLeadsFilePath(apiKey, baseDir = __dirname) {
    // Se baseDir aponta para lib/leads, subir 2 níveis para raiz do projeto
    const projectRoot = baseDir.includes('lib') ? path.resolve(baseDir, '..', '..') : baseDir;
    const dataDir = path.join(projectRoot, "data");
    const tenantDir = path.join(dataDir, "tenants");
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }
    return path.join(tenantDir, `leads-${apiKey}.json`);
}

function getTenantAppointmentsFilePath(apiKey, baseDir = __dirname) {
    const projectRoot = baseDir.includes('lib') ? path.resolve(baseDir, '..', '..') : baseDir;
    const tenantDir = path.join(projectRoot, 'data', 'tenants');
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }
    return path.join(tenantDir, `appointments-${apiKey}.json`);
}

// ===== CLASSE PRINCIPAL =====

class LeadCaptureSystem {
    /**
     * @param {string} apiKey - Chave da API do tenant
     * @param {Object} deps - Dependências injetadas
     * @param {Object} deps.DatabaseHelpers - Helpers do banco de dados
     * @param {string} deps.baseDir - Diretório base para arquivos
     */
    constructor(apiKey, deps = {}) {
        this.apiKey = apiKey;
        this.DatabaseHelpers = deps.DatabaseHelpers || null;
        this.baseDir = deps.baseDir || __dirname;

        this.leadsFilePath = getTenantLeadsFilePath(this.apiKey, this.baseDir);
        this.ensureDataDirectory();
        this.leads = this.loadLeadsSync(); // Carrega JSON primeiro (síncrono)
        this._postgresInitialized = false;

        // Inicializar PostgreSQL assincronamente (se disponível)
        if (USE_POSTGRES && this.DatabaseHelpers) {
            this.initializePostgres();
        }

        console.log(`📊 Sistema de Leads Inicializado: ${this.leads.length} leads carregados`);
        console.log(`💾 Arquivo de leads: ${this.leadsFilePath}`);
        console.log(`🗄️ PostgreSQL: ${USE_POSTGRES && this.DatabaseHelpers ? 'Habilitado' : 'Desabilitado (usando JSON)'}`);
    }

    // Inicializar PostgreSQL e migrar dados JSON se necessário
    async initializePostgres() {
        if (!this.DatabaseHelpers) return;

        try {
            // Buscar leads do PostgreSQL
            const dbLeads = await this.DatabaseHelpers.getLeads(this.apiKey);

            // Se PostgreSQL vazio e JSON tem dados, migrar
            if (dbLeads.length === 0 && this.leads.length > 0) {
                console.log(`🔄 Migrando ${this.leads.length} leads de JSON para PostgreSQL...`);
                for (const lead of this.leads) {
                    await this.DatabaseHelpers.saveLead(this.apiKey, {
                        id: lead.id,
                        nome: lead.nome || lead.name,
                        email: lead.email,
                        telefone: lead.telefone || lead.phone,
                        message: lead.message,
                        url_origem: lead.url_origem || lead.url,
                        source: lead.source || 'widget',
                        status: lead.status || 'ativo',
                        metadata: lead.metadata || {},
                        conversations: lead.conversations || []
                    });
                }
                console.log(`✅ Migração concluída: ${this.leads.length} leads migrados para PostgreSQL`);
            } else if (dbLeads.length > 0) {
                // PostgreSQL tem dados, usar como fonte primária
                this.leads = dbLeads.map(lead => ({
                    id: lead.id,
                    nome: lead.nome,
                    email: lead.email,
                    telefone: lead.telefone,
                    message: lead.message,
                    url_origem: lead.url_origem,
                    source: lead.source,
                    status: lead.status,
                    timestamp: lead.created_at,
                    lastInteraction: lead.updated_at,
                    conversations: lead.conversations || [],
                    journeyStage: lead.metadata?.journeyStage || 'descoberta'
                }));
                console.log(`🗄️ ${dbLeads.length} leads carregados do PostgreSQL`);
            }

            this._postgresInitialized = true;
        } catch (error) {
            console.error('❌ Erro ao inicializar PostgreSQL para leads:', error);
            console.log('🔄 Continuando com JSON como fallback');
        }
    }

    ensureDataDirectory() {
        try {
            const dir = path.dirname(this.leadsFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Diretório criado: ${dir}`);
            }
        } catch (error) {
            console.error("❌ Erro ao criar diretório:", error);
            // Fallback para diretório atual
            const projectRoot = this.baseDir.includes('lib') ? path.resolve(this.baseDir, '..', '..') : this.baseDir;
            this.leadsFilePath = path.join(projectRoot, "leads.json");
            console.log(`🔄 Usando fallback: ${this.leadsFilePath}`);
        }
    }

    // Carregamento síncrono de JSON (para inicialização)
    loadLeadsSync() {
        try {
            if (fs.existsSync(this.leadsFilePath)) {
                const data = fs.readFileSync(this.leadsFilePath, "utf8");
                const leads = JSON.parse(data);
                console.log(`📥 Leads carregados do JSON: ${leads.length} registros`);
                return leads;
            }
        } catch (error) {
            console.error("❌ Erro ao carregar leads do JSON:", error);
        }
        console.log("📝 Inicializando novo arquivo de leads");
        return [];
    }

    // Alias para compatibilidade
    loadLeads() {
        return this.loadLeadsSync();
    }

    // Salvar leads em PostgreSQL (primário) e JSON (backup)
    async saveLeads() {
        try {
            // Salvar em PostgreSQL se disponível
            if (USE_POSTGRES && this.DatabaseHelpers) {
                for (const lead of this.leads) {
                    await this.DatabaseHelpers.saveLead(this.apiKey, {
                        id: lead.id,
                        nome: lead.nome || lead.name,
                        email: lead.email,
                        telefone: lead.telefone || lead.phone,
                        message: lead.message,
                        url_origem: lead.url_origem || lead.url,
                        source: lead.source || 'widget',
                        status: lead.status || 'ativo',
                        metadata: { journeyStage: lead.journeyStage },
                        conversations: lead.conversations || []
                    });
                }
                console.log(`🗄️ Leads salvos no PostgreSQL: ${this.leads.length} registros`);
            }

            // Sempre salvar em JSON como backup local
            fs.writeFileSync(this.leadsFilePath, JSON.stringify(this.leads, null, 2));
            console.log(`💾 Leads salvos no JSON: ${this.leads.length} registros`);
            return true;
        } catch (error) {
            console.error("❌ Erro ao salvar leads:", error);
            // Fallback: salvar apenas em JSON
            try {
                fs.writeFileSync(this.leadsFilePath, JSON.stringify(this.leads, null, 2));
                return true;
            } catch (jsonError) {
                console.error("❌ Erro ao salvar leads em JSON:", jsonError);
                return false;
            }
        }
    }

    addLead(leadData) {
        const lead = {
            id: crypto.randomBytes(8).toString("hex"),
            timestamp: new Date().toISOString(),
            ...leadData,
            conversations: [],
            journeyStage: "descoberta",
            lastInteraction: new Date().toISOString(),
            status: "ativo"
        };

        this.leads.push(lead);
        this.saveLeads();
        console.log(`🎯 NOVO LEAD: ${lead.nome} (${lead.email})`);
        return lead;
    }

    updateLeadConversation(leadId, message, isUser = true) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead) {
            // 🎯 CORREÇÃO: Remover caracteres especiais como <s> [OUT]
            const cleanMessage = this.cleanMessage(message);

            lead.conversations.push({
                timestamp: new Date().toISOString(),
                message: cleanMessage,
                isUser
            });
            lead.lastInteraction = new Date().toISOString();
            this.saveLeads();
        }
    }

    // 🎯 NOVA FUNÇÃO: Limpar mensagem de caracteres especiais
    cleanMessage(message) {
        if (!message) return '';
        return String(message)
            .replace(/<s>\s*\[OUT\]/g, '') // Remove <s> [OUT]
            .replace(/<[^>]*>/g, '') // Remove todas as tags HTML
            .replace(/\[.*?\]/g, '') // Remove colchetes
            .replace(/\s+/g, ' ') // Normaliza espaços
            .trim();
    }

    updateLeadJourneyStage(leadId, stage) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead && ["descoberta", "negociacao", "fidelizacao"].includes(stage)) {
            lead.journeyStage = stage;
            this.saveLeads();
        }
    }

    getLeads() {
        return this.leads.sort((a, b) => new Date(b.lastInteraction) - new Date(a.lastInteraction));
    }

    getLeadById(leadId) {
        return this.leads.find(l => l.id === leadId);
    }

    findLeadByEmail(email) {
        return this.leads.find(l => l.email === email);
    }

    // 🎯 Encontrar lead por conversationId para rastrear mensagens
    findLeadByConversationId(conversationId) {
        return this.leads.find(l => l.conversationId === conversationId);
    }

    // ===== 📅 SISTEMA DE AGENDAMENTOS =====

    initializeAppointments() {
        this.appointmentsFilePath = getTenantAppointmentsFilePath(this.apiKey, this.baseDir);
        this.appointments = this.loadAppointmentsSync();
        console.log(`📅 Sistema de Agendamentos: ${this.appointments.length} agendamentos carregados`);

        // Inicializar PostgreSQL para agendamentos
        if (USE_POSTGRES && this.DatabaseHelpers) {
            this.initializeAppointmentsPostgres();
        }
    }

    // Inicializar agendamentos do PostgreSQL com migração
    async initializeAppointmentsPostgres() {
        if (!this.DatabaseHelpers) return;

        try {
            const dbAppointments = await this.DatabaseHelpers.getAppointments(this.apiKey);

            // Se PostgreSQL vazio e JSON tem dados, migrar
            if (dbAppointments.length === 0 && this.appointments.length > 0) {
                console.log(`🔄 Migrando ${this.appointments.length} agendamentos de JSON para PostgreSQL...`);
                for (const apt of this.appointments) {
                    await this.DatabaseHelpers.saveAppointment(this.apiKey, {
                        id: apt.id,
                        leadId: apt.leadId,
                        datetime: apt.datetime,
                        status: apt.status,
                        notes: apt.notes,
                        metadata: {
                            leadName: apt.leadName,
                            leadEmail: apt.leadEmail,
                            leadPhone: apt.leadPhone,
                            robotName: apt.robotName,
                            urlOrigem: apt.urlOrigem,
                            createdAt: apt.createdAt
                        }
                    });
                }
                console.log(`✅ Migração de agendamentos concluída`);
            } else if (dbAppointments.length > 0) {
                // PostgreSQL tem dados, usar como fonte primária
                this.appointments = dbAppointments.map(apt => ({
                    id: apt.id,
                    leadId: apt.lead_id,
                    datetime: apt.datetime,
                    status: apt.status,
                    notes: apt.notes,
                    createdAt: apt.created_at,
                    ...apt.metadata
                }));
                console.log(`🗄️ ${dbAppointments.length} agendamentos carregados do PostgreSQL`);
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar PostgreSQL para agendamentos:', error);
        }
    }

    // Carregamento síncrono de JSON
    loadAppointmentsSync() {
        try {
            if (!this.appointmentsFilePath) {
                this.appointmentsFilePath = getTenantAppointmentsFilePath(this.apiKey, this.baseDir);
            }
            if (fs.existsSync(this.appointmentsFilePath)) {
                const data = fs.readFileSync(this.appointmentsFilePath, "utf8");
                return JSON.parse(data);
            }
        } catch (error) {
            console.error("❌ Erro ao carregar agendamentos do JSON:", error);
        }
        return [];
    }

    // Alias para compatibilidade
    loadAppointments() {
        return this.loadAppointmentsSync();
    }

    // Salvar agendamentos em PostgreSQL e JSON
    async saveAppointments() {
        try {
            // Salvar em PostgreSQL se disponível
            if (USE_POSTGRES && this.DatabaseHelpers) {
                for (const apt of (this.appointments || [])) {
                    await this.DatabaseHelpers.saveAppointment(this.apiKey, {
                        id: apt.id,
                        leadId: apt.leadId,
                        datetime: apt.datetime,
                        status: apt.status,
                        notes: apt.notes,
                        metadata: {
                            leadName: apt.leadName,
                            leadEmail: apt.leadEmail,
                            leadPhone: apt.leadPhone,
                            robotName: apt.robotName,
                            urlOrigem: apt.urlOrigem,
                            createdAt: apt.createdAt
                        }
                    });
                }
                console.log(`🗄️ Agendamentos salvos no PostgreSQL: ${(this.appointments || []).length} registros`);
            }

            // Sempre salvar em JSON como backup
            if (!this.appointmentsFilePath) {
                this.appointmentsFilePath = getTenantAppointmentsFilePath(this.apiKey, this.baseDir);
            }
            fs.writeFileSync(this.appointmentsFilePath, JSON.stringify(this.appointments || [], null, 2));
            console.log(`💾 Agendamentos salvos no JSON: ${(this.appointments || []).length} registros`);
            return true;
        } catch (error) {
            console.error("❌ Erro ao salvar agendamentos:", error);
            // Fallback JSON
            try {
                fs.writeFileSync(this.appointmentsFilePath, JSON.stringify(this.appointments || [], null, 2));
                return true;
            } catch (jsonError) {
                console.error("❌ Erro ao salvar agendamentos em JSON:", jsonError);
                return false;
            }
        }
    }

    addAppointment(appointmentData) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }

        const appointment = {
            id: crypto.randomBytes(8).toString("hex"),
            createdAt: new Date().toISOString(),
            leadId: appointmentData.leadId || null,
            leadName: appointmentData.leadName || 'Não informado',
            leadEmail: appointmentData.leadEmail || 'Não informado',
            leadPhone: appointmentData.leadPhone || '',
            datetime: appointmentData.datetime,
            status: 'pendente', // pendente, confirmado, cancelado, realizado
            notes: appointmentData.notes || '',
            robotName: appointmentData.robotName || 'Assistente IA',
            urlOrigem: appointmentData.urlOrigem || ''
        };

        this.appointments.push(appointment);
        this.saveAppointments();
        console.log(`📅 NOVO AGENDAMENTO: ${appointment.leadName} - ${appointment.datetime}`);
        return appointment;
    }

    getAppointments() {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        return (this.appointments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getAppointmentById(appointmentId) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        return this.appointments.find(a => a.id === appointmentId);
    }

    updateAppointmentStatus(appointmentId, status) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        const appointment = this.appointments.find(a => a.id === appointmentId);
        if (appointment && ['pendente', 'confirmado', 'cancelado', 'realizado'].includes(status)) {
            appointment.status = status;
            appointment.updatedAt = new Date().toISOString();
            this.saveAppointments();
            console.log(`📅 Agendamento ${appointmentId} atualizado para: ${status}`);
            return appointment;
        }
        return null;
    }

    getAppointmentsByLeadId(leadId) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        return this.appointments.filter(a => a.leadId === leadId);
    }
}

// ===== FACTORY FUNCTIONS =====

function getLeadSystem(apiKey, deps = {}) {
    return new LeadCaptureSystem(apiKey, deps);
}

// ===== EXPORTS =====
module.exports = {
    LeadCaptureSystem,
    getLeadSystem,
    getTenantLeadsFilePath,
    getTenantAppointmentsFilePath
};
