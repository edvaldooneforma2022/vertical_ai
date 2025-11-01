require("dotenv").config();

// ===== SISTEMA DE SEGURANÇA AVANÇADO =====
// TODOS ESTES ARQUIVOS JÁ EXISTEM - APENAS IMPORTE-OS!

const {
    SecuritySystem,
    ThreatDetectionSystem, 
    RateLimitSystem,
    InputValidationSystem,
    ApplicationFirewall,
    SecurityMonitor
} = require('./security-system');

const AuthSystem = require('./auth-system');           // ✅ JÁ EXISTE
const authSystem = new AuthSystem();

const CORSConfig = require('./cors-config');           // ✅ JÁ EXISTE  
const corsConfig = new CORSConfig();

const CSRFProtection = require('./csrf-protection');   // ✅ JÁ EXISTE
const csrfSystem = new CSRFProtection();

const CSPConfig = require('./csp-config');             // ✅ JÁ EXISTE
const cspConfig = new CSPConfig();

// Inicializar sistemas de segurança
const securitySystem = new SecuritySystem();
const threatDetection = new ThreatDetectionSystem();
const rateLimitSystem = new RateLimitSystem();
const inputValidator = new InputValidationSystem();
const firewall = new ApplicationFirewall();
const securityMonitor = new SecurityMonitor();

// ===== NOVOS MÓDULOS =====
const { db, initializeDatabase, DatabaseHelpers, USE_POSTGRES } = require('./database');
const { initializeCache, CacheManager, rateLimitMiddleware, isRedisConnected } = require('./cache');
const { webhookManager, WebhookEvents } = require('./webhooks');
const { billingManager, PLANS } = require('./billing');
const { analyticsManager } = require('./analytics');
const { llmOptimizer } = require('./llm-optimizer');
const { knowledgeBaseManager } = require('./knowledge-base');
const { setupRoutes } = require('./routes');
const { initialize } = require('./init');

console.log('✅ Módulos de melhorias carregados');
// ===== NOVAS INTEGRAÇÕES V3.0 =====
const { gmailManager } = require('./gmail-integration');
const { whatsappManager } = require('./whatsapp-integration');
const { chatgptManager } = require('./chatgpt-integration');
const { crmIntegrations } = require('./crm-integrations');
const { whitelabelManager } = require('./whitelabel');
const { structuredLeadsManager } = require('./structured-leads');
console.log('✅ Módulos V3.0 carregados');

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const winston = require("winston");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const session = require("express-session");

// Optional dependencies with graceful fallback
let puppeteer = null;
try {
    puppeteer = require("puppeteer");
    console.log("✅ Puppeteer loaded - Dynamic rendering available");
} catch (e) {
    console.log("⚠️ Puppeteer not installed - Using basic extraction only");
}

const app = express();

// Configuração de arquivos estáticos para o Render
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages')));
app.use(express.static(path.join(__dirname, 'data')));
app.use(express.static(path.join(__dirname, 'scripts')));
app.use(express.static(path.join(__dirname, 'assets')));





// Declarando conversationHistories no escopo global ou adequado
const conversationHistories = new Map();

// ===== SISTEMA DE SUPERINTELIGÊNCIA CONVERSACIONAL AVANÇADA =====
class SuperInteligenciaConversacional {
    constructor() {
        console.log("SUPERINTELIGÊNCIA CONVERSACIONAL - Inicializando Sistema Avançado");
        
        // Sistema de Memória Conversacional Avançada
        this.memoriaConversacional = new Map();
        this.personalidades = new Map();
        this.historicoEmocional = new Map();
        this.preferenciasUsuarios = new Map();
        this.padroesSucesso = new Map();
        
        // Configurações da Personalidade
        this.configPersonalidade = {
            nome: "Assistente IA",
            nivelEmpatia: 0.8,
            estiloComunicacao: "equilibrado", // formal, informal, tecnico, empatico
            usoHumor: true,
            regionalismos: ["brasil"],
            velocidadeResposta: "natural"
        };

        // Dicionário de Emoções Complexas
        this.emocionesComplexas = {
            nostalgia: ['saudade', 'lembrança', 'antigamente', 'na época', 'quando era'],
            ambivalencia: ['não sei', 'em dúvida', 'meio termo', 'por um lado', 'por outro'],
            frustracao: ['irritado', 'cansado', 'não aguento', 'chega', 'para com isso'],
            ansiedade: ['preocupado', 'nervoso', 'ansioso', 'apreensivo', 'medo'],
            euforia: ['incrível', 'maravilhoso', 'fantástico', 'perfeito', 'sensacional']
        };

        // Sistema de Sarcasmo e Ironia
        this.detectoresSarcasmo = {
            padroes: [
                /claro que (não|sim)/i,
                /maravilhoso/i,
                /perfeito/i,
                /exatamente o que eu queria/i,
                /ótimo momento/i
            ],
            contextoNegativo: ['problema', 'erro', 'falha', 'difícil', 'complicado']
        };

        // Memória de Preferências Conversacionais
        this.preferenciasConversacionais = {
            nivelDetalhe: new Map(), // 'superficial' | 'detalhado' | 'técnico'
            estiloHumor: new Map(), // 'leve' | 'ironico' | 'nenhum'
            formalidade: new Map(), // 'formal' | 'informal' | 'neutro'
            tempoResposta: new Map() // 'rapido' | 'reflexivo'
        };
    }

    // ===== DETECÇÃO AVANÇADA DE EMOÇÕES E INTENÇÕES =====
    analisarEstadoEmocional(mensagem, contexto = {}) {
        const mensagemLower = mensagem.toLowerCase();
        let emocaoPrimaria = "neutro";
        let emocaoSecundaria = null;
        let intensidade = 1;
        let sarcasmoDetectado = false;
        let intencoesMultiplas = [];

        // Detecção de Sarcasmo e Ironia
        sarcasmoDetectado = this.detectarSarcasmo(mensagemLower, contexto);

        // Análise de Emoções Complexas
        for (const [emocao, termos] of Object.entries(this.emocionesComplexas)) {
            const matches = termos.filter(termo => mensagemLower.includes(termo));
            if (matches.length > 0) {
                if (!emocaoPrimaria || emocaoPrimaria === "neutro") {
                    emocaoPrimaria = emocao;
                } else {
                    emocaoSecundaria = emocao;
                }
                intensidade = Math.max(intensidade, matches.length);
            }
        }

        // Detecção de Múltiplas Intenções
        intencoesMultiplas = this.detectarMultiplasIntencoes(mensagemLower);

        // Análise de Urgência e Prioridade
        const urgencia = this.analisarUrgencia(mensagemLower);
        const prioridade = this.analisarPrioridade(mensagemLower, contexto);

        return {
            emocaoPrimaria,
            emocaoSecundaria,
            intensidade: Math.min(3, intensidade),
            sarcasmo: sarcasmoDetectado,
            urgencia,
            prioridade,
            intencoesMultiplas,
            contextoEmocional: this.analisarContextoEmocional(mensagemLower)
        };
    }

    detectarSarcasmo(mensagem, contexto) {
        // Verificação por padrões linguísticos de sarcasmo
        const padraoSarcasmo = this.detectoresSarcasmo.padroes.some(padrao => 
            padrao.test(mensagem)
        );

        // Verificação por incongruência contexto/sentimento
        const contextoNegativo = this.detectoresSarcasmo.contextoNegativo.some(termo => 
            mensagem.includes(termo)
        );
        const sentimentoPositivo = /maravilhoso|perfeito|excelente|ótimo/i.test(mensagem);

        return (padraoSarcasmo || (contextoNegativo && sentimentoPositivo));
    }

    detectarMultiplasIntencoes(mensagem) {
        const intencoes = [];
        
        // Mapeamento de intenções complexas
        const mapeamentoIntencoes = {
            informacao: ['o que é', 'como funciona', 'explica', 'entender'],
            suporte: ['problema', 'erro', 'não funciona', 'ajuda', 'suporte'],
            venda: ['preço', 'valor', 'comprar', 'adquirir', 'contratar'],
            relacionamento: ['obrigado', 'gostei', 'parabéns', 'reclamação'],
            urgente: ['urgente', 'agora', 'imediatamente', 'rápido']
        };

        for (const [intencao, termos] of Object.entries(mapeamentoIntencoes)) {
            if (termos.some(termo => mensagem.includes(termo))) {
                intencoes.push(intencao);
            }
        }

        return intencoes;
    }

    analisarUrgencia(mensagem) {
        const termosUrgencia = ['urgente', 'agora', 'imediatamente', 'rápido', 'importante', 'prioridade'];
        return termosUrgencia.some(termo => mensagem.includes(termo)) ? 2 : 1;
    }

    analisarPrioridade(mensagem, contexto) {
        let prioridade = 1;
        
        // Aumenta prioridade baseado em contexto emocional
        if (contexto.emocional === 'frustracao' || contexto.emocional === 'ansiedade') {
            prioridade += 1;
        }
        
        // Aumenta prioridade para intenções de suporte
        if (mensagem.includes('problema') || mensagem.includes('erro')) {
            prioridade += 1;
        }

        return Math.min(3, prioridade);
    }

    analisarContextoEmocional(mensagem) {
        const contexto = {
            nivelFrustracao: this.contarTermos(mensagem, ['não consigo', 'difícil', 'complicado', 'chato']),
            nivelSatisfacao: this.contarTermos(mensagem, ['obrigado', 'gostei', 'excelente', 'perfeito']),
            nivelConfusao: this.contarTermos(mensagem, ['não entendi', 'como assim', 'explica', 'entender']),
            nivelUrgencia: this.contarTermos(mensagem, ['urgente', 'agora', 'rápido', 'importante'])
        };

        return contexto;
    }

    contarTermos(mensagem, termos) {
        return termos.filter(termo => mensagem.includes(termo)).length;
    }

    // ===== SISTEMA DE MEMÓRIA CONVERSACIONAL AVANÇADA =====
    atualizarMemoriaUsuario(userId, interacao) {
        if (!this.memoriaConversacional.has(userId)) {
            this.memoriaConversacional.set(userId, {
                historico: [],
                preferencias: {},
                estiloComunicacao: 'neutro',
                emocaoPredominante: 'neutro',
                ultimaInteracao: new Date(),
                insideJokes: [],
                referenciasCompartilhadas: []
            });
        }

        const memoria = this.memoriaConversacional.get(userId);
        
        // Atualizar histórico
        memoria.historico.push({
            timestamp: new Date(),
            mensagem: interacao.mensagem,
            emocao: interacao.emocao,
            intencoes: interacao.intencoes
        });

        // Manter apenas últimas 50 interações
        if (memoria.historico.length > 50) {
            memoria.historico = memoria.historico.slice(-50);
        }

        // Atualizar preferências baseado no comportamento
        this.atualizarPreferenciasUsuario(memoria, interacao);
        
        memoria.ultimaInteracao = new Date();
    }

    atualizarPreferenciasUsuario(memoria, interacao) {
        // Detectar preferência por nível de detalhe
        if (interacao.mensagem.includes('mais detalhes') || interacao.mensagem.includes('explica melhor')) {
            memoria.preferencias.nivelDetalhe = 'detalhado';
        } else if (interacao.mensagem.includes('resumido') || interacao.mensagem.includes('resumo')) {
            memoria.preferencias.nivelDetalhe = 'superficial';
        }

        // Detectar preferência por formalidade
        if (interacao.mensagem.includes('por favor') || interacao.mensagem.includes('você poderia')) {
            memoria.preferencias.formalidade = 'formal';
        } else if (interacao.mensagem.includes('beleza') || interacao.mensagem.includes('valeu')) {
            memoria.preferencias.formalidade = 'informal';
        }
    }

    // ===== GERADOR DE RESPOSTAS SUPERINTELIGENTES =====
    gerarRespostaSuperInteligente(mensagemUsuario, estadoEmocional, memoriaUsuario, contextoPagina) {
        const timestamp = new Date();
        
        // Análise profunda da mensagem
        const analiseProfunda = this.analisarMensagemProfundamente(mensagemUsuario);
        
        // Construção da personalidade contextual
        const personalidadeContextual = this.construirPersonalidadeContextual(estadoEmocional, memoriaUsuario);
        
        // Geração da resposta base
        let respostaBase = this.gerarRespostaBase(analiseProfunda, contextoPagina);
        
        // Aplicação de camadas de inteligência emocional
        respostaBase = this.aplicarCamadaEmpatica(respostaBase, estadoEmocional);
        respostaBase = this.aplicarCamadaConversacional(respostaBase, analiseProfunda);
        respostaBase = this.aplicarCamadaPersonalidade(respostaBase, personalidadeContextual);
        respostaBase = this.aplicarCamadaMemoria(respostaBase, memoriaUsuario);
        
        // Finalização e polimento
        const respostaFinal = this.polirResposta(respostaBase, estadoEmocional, memoriaUsuario);
        
        console.log('🧠 [SUPERINTELIGÊNCIA] Resposta gerada:', {
            emocao: estadoEmocional.emocaoPrimaria,
            intencoes: estadoEmocional.intencoesMultiplas,
            personalidade: personalidadeContextual.estilo,
            comprimento: respostaFinal.length
        });

        return respostaFinal;
    }

    analisarMensagemProfundamente(mensagem) {
        return {
            complexidade: this.calcularComplexidade(mensagem),
            ambiguidade: this.detectarAmbiguidade(mensagem),
            tom: this.analisarTom(mensagem),
            estruturas: this.extrairEstruturas(mensagem),
            referencias: this.extrairReferencias(mensagem)
        };
    }

    calcularComplexidade(mensagem) {
        const palavras = mensagem.split(' ').length;
        const frases = mensagem.split(/[.!?]+/).length - 1;
        const complexidadeEstrutural = palavras > 20 ? 'alta' : palavras > 10 ? 'media' : 'baixa';
        
        return {
            estrutural: complexidadeEstrutural,
            palavras: palavras,
            frases: frases,
            score: Math.min(10, palavras * 0.5 + frases * 2)
        };
    }

    detectarAmbiguidade(mensagem) {
        const termosAmbiguos = ['isso', 'aquilo', 'aquele', 'desse jeito', 'assim'];
        const ambiguidades = termosAmbiguos.filter(termo => mensagem.includes(termo));
        
        return {
            possui: ambiguidades.length > 0,
            termos: ambiguidades,
            nivel: ambiguidades.length
        };
    }

    analisarTom(mensagem) {
        const tom = {
            formal: this.contarTermos(mensagem, ['por favor', 'gostaria', 'poderia', 'agradeço']),
            informal: this.contarTermos(mensagem, ['beleza', 'valeu', 'oi', 'e aí']),
            tecnico: this.contarTermos(mensagem, ['funcionamento', 'especificação', 'técnico', 'detalhe']),
            emocional: this.contarTermos(mensagem, ['nervoso', 'feliz', 'preocupado', 'ansioso'])
        };

        const tomPredominante = Object.keys(tom).reduce((a, b) => tom[a] > tom[b] ? a : b);
        return {
            predominante: tomPredominante,
            scores: tom
        };
    }

    extrairEstruturas(mensagem) {
        return {
            perguntas: (mensagem.match(/\?/g) || []).length,
            exclamacoes: (mensagem.match(/\!/g) || []).length,
            reticencias: (mensagem.match(/\.{3,}/g) || []).length,
            maiusculas: (mensagem.match(/[A-ZÀ-Ú]{3,}/g) || []).length
        };
    }

    extrairReferencias(mensagem) {
        const referencias = {
            temporais: this.extrairReferenciasTemporais(mensagem),
            espaciais: this.extrairReferenciasEspaciais(mensagem),
            pessoais: this.extrairReferenciasPessoais(mensagem)
        };
        
        return referencias;
    }

    extrairReferenciasTemporais(mensagem) {
        const padroes = [
            /\b(hoje|amanhã|ontem)\b/gi,
            /\b(agora|já|depois)\b/gi,
            /\b(semana|mês|ano)\b/gi
        ];
        
        return padroes.flatMap(padrao => mensagem.match(padrao) || []);
    }

    extrairReferenciasEspaciais(mensagem) {
        const padroes = [
            /\b(aqui|ali|lá)\b/gi,
            /\b(nesse|naquele)\b/gi,
            /\b(perto|longe)\b/gi
        ];
        
        return padroes.flatMap(padrao => mensagem.match(padrao) || []);
    }

    extrairReferenciasPessoais(mensagem) {
        const padroes = [
            /\b(eu|meu|minha)\b/gi,
            /\b(você|teu|sua)\b/gi,
            /\b(nós|nosso)\b/gi
        ];
        
        return padroes.flatMap(padrao => mensagem.match(padrao) || []);
    }

    construirPersonalidadeContextual(estadoEmocional, memoriaUsuario) {
        let estilo = 'equilibrado';
        let nivelEmpatia = this.configPersonalidade.nivelEmpatia;
        let usoHumor = this.configPersonalidade.usoHumor;

        // Adaptar baseado no estado emocional do usuário
        if (estadoEmocional.emocaoPrimaria === 'frustracao') {
            estilo = 'empatico';
            nivelEmpatia = 0.9;
            usoHumor = false;
        } else if (estadoEmocional.emocaoPrimaria === 'euforia') {
            estilo = 'entusiasmado';
            nivelEmpatia = 0.7;
            usoHumor = true;
        } else if (estadoEmocional.emocaoPrimaria === 'ansiedade') {
            estilo = 'calmo';
            nivelEmpatia = 0.95;
            usoHumor = false;
        }

        // Considerar preferências do usuário
        if (memoriaUsuario && memoriaUsuario.preferencias) {
            if (memoriaUsuario.preferencias.formalidade === 'formal') {
                estilo = 'formal';
            } else if (memoriaUsuario.preferencias.formalidade === 'informal') {
                estilo = 'informal';
            }
        }

        return {
            estilo,
            nivelEmpatia,
            usoHumor,
            velocidade: 'natural',
            registro: this.definirRegistro(estilo)
        };
    }

    definirRegistro(estilo) {
        const registros = {
            formal: {
                saudacao: "Prezado(a)",
                despedida: "Cordialmente",
                tratamento: "você",
                verbos: ["poderia", "gostaria", "deseja"]
            },
            informal: {
                saudacao: "E aí",
                despedida: "Valeu",
                tratamento: "você",
                verbos: ["pode", "quer", "vai"]
            },
            empatico: {
                saudacao: "Olá",
                despedida: "Estou aqui se precisar",
                tratamento: "você",
                verbos: ["gostaria", "precisa", "quer"]
            },
            equilibrado: {
                saudacao: "Olá",
                despedida: "Até mais",
                tratamento: "você",
                verbos: ["pode", "gostaria", "quer"]
            }
        };

        return registros[estilo] || registros.equilibrado;
    }

    gerarRespostaBase(analiseProfunda, contextoPagina) {
        // Resposta base adaptada à complexidade da pergunta
        if (analiseProfunda.complexidade.score > 7) {
            return "Essa é uma questão bastante interessante e complexa. Vamos analisar ponto a ponto...";
        } else if (analiseProfunda.complexidade.score > 4) {
            return "Entendi sua pergunta. Deixe-me explicar de forma clara...";
        } else {
            return "Claro! Sobre isso...";
        }
    }

    aplicarCamadaEmpatica(resposta, estadoEmocional) {
        let prefixoEmpatico = "";

        if (estadoEmocional.emocaoPrimaria === 'frustracao') {
            prefixoEmpatico = "Entendo que isso pode ser frustrante. ";
        } else if (estadoEmocional.emocaoPrimaria === 'ansiedade') {
            prefixoEmpatico = "Compreendo sua preocupação. ";
        } else if (estadoEmocional.emocaoPrimaria === 'euforia') {
            prefixoEmpatico = "Que bom ver seu entusiasmo! ";
        } else if (estadoEmocional.sarcasmo) {
            prefixoEmpatico = "Percebi o tom da sua mensagem. ";
        }

        return prefixoEmpatico + resposta;
    }

    aplicarCamadaConversacional(resposta, analiseProfunda) {
        // Adicionar elementos conversacionais naturais
        if (analiseProfunda.complexidade.score > 5) {
            resposta = "Hmm, " + resposta.toLowerCase();
        }

        if (analiseProfunda.ambiguidade.possui) {
            resposta += " Se eu entendi corretamente...";
        }

        return resposta;
    }

    aplicarCamadaPersonalidade(resposta, personalidade) {
        // Adaptar resposta ao estilo da personalidade
        if (personalidade.estilo === 'informal') {
            resposta = resposta.replace(/Cordialmente/g, "Valeu");
            resposta = resposta.replace(/Prezado\(a\)/g, "E aí");
        } else if (personalidade.estilo === 'empatico') {
            resposta = resposta.replace(/\./g, ". Espero que isso ajude.");
        }

        return resposta;
    }

    aplicarCamadaMemoria(resposta, memoriaUsuario) {
        if (!memoriaUsuario || memoriaUsuario.historico.length < 2) {
            return resposta;
        }

        // Referenciar conversas anteriores se relevante
        const ultimaInteracao = memoriaUsuario.historico[memoriaUsuario.historico.length - 2];
        if (ultimaInteracao && this.saoTopicosRelacionados(ultimaInteracao.mensagem)) {
            resposta = `Continuando nosso papelo anterior, ${resposta.toLowerCase()}`;
        }

        return resposta;
    }

    saoTopicosRelacionados(mensagemAnterior) {
        const topicosComuns = ['preço', 'valor', 'funcionamento', 'como', 'quando'];
        return topicosComuns.some(topico => mensagemAnterior.includes(topico));
    }

    polirResposta(resposta, estadoEmocional, memoriaUsuario) {
        // Adicionar elementos de naturalidade
        if (estadoEmocional.intensidade > 1) {
            resposta = this.adicionarEnfase(resposta, estadoEmocional.intensidade);
        }

        // Adicionar elementos visuais contextuais
        resposta = this.adicionarElementosVisuais(resposta, estadoEmocional);

        // Garantir coerência com histórico
        resposta = this.ajustarCoerencia(resposta, memoriaUsuario);

        return resposta;
    }

    adicionarEnfase(resposta, intensidade) {
        const enfases = {
            1: ["", ""],
            2: ["**", "**"],
            3: ["**🎯 ", "**"]
        };

        const [prefixo, sufixo] = enfases[intensidade] || enfases[1];
        
        // Aplicar ênfase na primeira frase
        const frases = resposta.split('.');
        if (frases.length > 0) {
            frases[0] = prefixo + frases[0] + sufixo;
            return frases.join('.');
        }

        return resposta;
    }

    adicionarElementosVisuais(resposta, estadoEmocional) {
        const elementos = {
            frustracao: "😔",
            ansiedade: "🤗",
            euforia: "🎉",
            nostalgia: "✨",
            neutro: "💭"
        };

        const elemento = elementos[estadoEmocional.emocaoPrimaria] || elementos.neutro;
        return elemento + " " + resposta;
    }

    ajustarCoerencia(resposta, memoriaUsuario) {
        if (!memoriaUsuario) return resposta;

        // Garantir que o estilo seja consistente com preferências
        if (memoriaUsuario.preferencias && memoriaUsuario.preferencias.formalidade === 'formal') {
            resposta = resposta.replace(/e aí/gi, "Olá")
                             .replace(/valeu/gi, "Agradeço");
        }

        return resposta;
    }

    // ===== SISTEMA DE APRENDIZADO CONTÍNUO =====
    aprenderDaInteracao(userId, mensagemUsuario, resposta, feedbackImplicito) {
        if (!this.memoriaConversacional.has(userId)) return;

        const memoria = this.memoriaConversacional.get(userId);
        
        // Analisar feedback implícito (engajamento, continuidade)
        const engajamento = this.analisarEngajamento(mensagemUsuario, resposta);
        
        // Atualizar preferências baseado no engajamento
        if (engajamento.alto) {
            memoria.preferencias.estiloAtual = 'efetivo';
        }
        
        // Aprender padrões de sucesso
        this.registrarPadraoSucesso(userId, mensagemUsuario, resposta, engajamento);
    }

    analisarEngajamento(mensagemUsuario, resposta) {
        const mensagemLower = mensagemUsuario.toLowerCase();
        
        return {
            continuouConversa: !mensagemLower.includes('tchau') && !mensagemLower.includes('obrigado'),
            fezPergunta: mensagemLower.includes('?') || 
                         mensagemLower.includes('como') || 
                         mensagemLower.includes('quando'),
            mostrouSatisfacao: mensagemLower.includes('obrigado') || 
                              mensagemLower.includes('perfeito') ||
                              mensagemLower.includes('ajudou'),
            alto: this.calcularNivelEngajamento(mensagemUsuario)
        };
    }

    calcularNivelEngajamento(mensagem) {
        let score = 0;
        score += (mensagem.split(' ').length > 5) ? 1 : 0;
        score += (mensagem.includes('?')) ? 1 : 0;
        score += (mensagem.includes('obrigado') || mensagem.includes('valeu')) ? 0.5 : 0;
        return score;
    }

    registrarPadraoSucesso(userId, mensagemUsuario, resposta, engajamento) {
        // Registrar padrões que funcionam bem para este usuário
        if (engajamento.alto) {
            const padrao = {
                tipoMensagem: this.classificarMensagem(mensagemUsuario),
                tipoResposta: this.classificarResposta(resposta),
                timestamp: new Date(),
                eficacia: engajamento.alto ? 'alta' : 'media'
            };

            if (!this.padroesSucesso.has(userId)) {
                this.padroesSucesso.set(userId, []);
            }

            this.padroesSucesso.get(userId).push(padrao);
        }
    }

    classificarMensagem(mensagem) {
        if (mensagem.includes('?')) return 'pergunta';
        if (mensagem.includes('obrigado')) return 'agradecimento';
        if (mensagem.includes('problema')) return 'suporte';
        return 'declaracao';
    }

    classificarResposta(resposta) {
        if (resposta.includes('**')) return 'enfatica';
        if (resposta.length > 150) return 'detalhada';
        if (resposta.length < 50) return 'concisa';
        return 'padrao';
    }
}

// Inicializar SuperInteligência Global
const superInteligenciaGlobal = new SuperInteligenciaConversacional();
console.log("🧠 SUPERINTELIGÊNCIA CONVERSACIONAL - Sistema Avançado Carregado");

// ===== SISTEMA DE ARMAZENAMENTO DE LEADS PERSISTENTE =====
function getTenantLeadsFilePath(apiKey) {
    const dataDir = path.join(__dirname, "data");
    const tenantDir = path.join(dataDir, "tenants");
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }
    return path.join(tenantDir, `leads-${apiKey}.json`);
}

class LeadCaptureSystem {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.leadsFilePath = getTenantLeadsFilePath(this.apiKey);
        this.ensureDataDirectory();
        this.leads = this.loadLeads();
        console.log(`📊 Sistema de Leads Inicializado: ${this.leads.length} leads carregados`);
        console.log(`💾 Arquivo de leads: ${this.leadsFilePath}`);
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
            // Fallback para diretório atual se data/ não funcionar
            this.leadsFilePath = path.join(__dirname, "leads.json");
            console.log(`🔄 Usando fallback: ${this.leadsFilePath}`);
        }
    }

    loadLeads() {
        try {
            if (fs.existsSync(this.leadsFilePath)) {
                const data = fs.readFileSync(this.leadsFilePath, "utf8");
                const leads = JSON.parse(data);
                console.log(`📥 Leads carregados: ${leads.length} registros`);
                return leads;
            }
        } catch (error) {
            console.error("❌ Erro ao carregar leads:", error);
        }
        console.log("📝 Inicializando novo arquivo de leads");
        return [];
    }

    saveLeads() {
        try {
            fs.writeFileSync(this.leadsFilePath, JSON.stringify(this.leads, null, 2));
            console.log(`💾 Leads salvos: ${this.leads.length} registros`);
            return true;
        } catch (error) {
            console.error("❌ Erro ao salvar leads:", error);
            return false;
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
}

// Funções para obter instâncias de sistema de leads e backup por tenant
function getLeadSystem(apiKey) {
    return new LeadCaptureSystem(apiKey);
}

function getBackupSystem(leadSystem, apiKey) {
    return new LeadBackupSystem(leadSystem, apiKey);
}

// ===== SISTEMA DE BACKUP AUTOMÁTICO DE LEADS =====

function getTenantBackupDirPath(apiKey) {
    const dataDir = path.join(__dirname, "data");
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

class LeadBackupSystem {
    constructor(leadSystem, apiKey) {
        this.leadSystem = leadSystem;
        this.apiKey = apiKey;
        this.backupDir = getTenantBackupDirPath(this.apiKey);
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

// ===== SISTEMA DE ANÁLISE DE JORNADA DO CLIENTE =====
class JourneyAnalyzer {
    constructor() {
        this.stageKeywords = {
            descoberta: [
                'o que é', 'como funciona', 'funcionamento', 'o que faz', 'para que serve',
                'quem é', 'como é', 'explica', 'entender', 'conhecer', 'informação',
                'detalhes', 'apresentação', 'novo', 'primeira vez', 'iniciante'
            ],
            negociacao: [
                'preço', 'valor', 'quanto custa', 'custo', 'investimento', 'pagamento',
                'forma de pagamento', 'parcelamento', 'desconto', 'promoção', 'oferta',
                'condições', 'comprar', 'adquirir', 'contratar', 'assinar', 'plano',
                'precificação', 'valores', 'cartão', 'boleto', 'pix'
            ],
            fidelizacao: [
                'suporte', 'atendimento', 'dúvida', 'problema', 'ajuda', 'assistência',
                'reclamação', 'sugestão', 'feedback', 'contato', 'telefone', 'email',
                'whatsapp', 'chamado', 'ticket', 'urgente', 'resolver'
            ]
        };

        this.synonyms = {
            empolgação: [
                'excelente', 'fantástico', 'incrível', 'maravilhoso', 'impressionante',
                'notável', 'extraordinário', 'formidável', 'espetacular', 'sensacional',
                'surpreendente', 'fantástico', 'excepcional', 'notável', 'extraordinário'
            ]
        };
    }

    analyzeJourneyStage(message) {
        const messageLower = message.toLowerCase();
        let scores = {
            descoberta: 0,
            negociacao: 0,
            fidelizacao: 0
        };

        // Analisar palavras-chave
        for (const [stage, keywords] of Object.entries(this.stageKeywords)) {
            for (const keyword of keywords) {
                if (messageLower.includes(keyword)) {
                    scores[stage]++;
                }
            }
        }

        // Determinar estágio com maior pontuação
        const maxScore = Math.max(...Object.values(scores));
        if (maxScore === 0) return "descoberta";

        for (const [stage, score] of Object.entries(scores)) {
            if (score === maxScore) {
                return stage;
            }
        }

        return "descoberta";
    }

    getRandomSynonym(category) {
        const synonyms = this.synonyms[category] || ['excelente'];
        return synonyms[Math.floor(Math.random() * synonyms.length)];
    }

    shouldMentionBonus(stage, message) {
        const messageLower = message.toLowerCase();
        
        // Só mencionar bônus se o cliente perguntar explicitamente
        const bonusKeywords = ['bônus', 'bonus', 'brinde', 'presente', 'extra', 'grátis', 'gratis'];
        const isAskingAboutBonus = bonusKeywords.some(keyword => messageLower.includes(keyword));
        
        // Ou se estiver na fase de negociação
        return isAskingAboutBonus || stage === "negociacao";
    }
}

// Inicializar analisador de jornada
const journeyAnalyzer = new JourneyAnalyzer();

// ===== SISTEMA DE CAPTURA DE INTENÇÕES DO CLIENTE =====
class SistemaCapturaInteligencias {
    constructor() {
        console.log("🎯 Sistema de Captura de Intenções Inicializado");
    }

    capturarInteligencias(mensagem) {
        const inteligencias = {
            contatoDireto: false,
            linkSite: false,
            bonus: false,
            detalhesBonus: false,
            experiencia: false,
            suporte: false
        };

        const mensagemLower = mensagem.toLowerCase();

        // Detectar solicitação de contato direto
        if (mensagemLower.includes('whatsapp') || 
            mensagemLower.includes('número') || 
            mensagemLower.includes('numero') ||
            mensagemLower.includes('falar direto') ||
            mensagemLower.includes('contato direto') ||
            mensagemLower.includes('telefone') ||
            mensagemLower.includes('celular') ||
            mensagemLower.includes('ligar') ||
            mensagemLower.includes('chamar')) {
            inteligencias.contatoDireto = true;
        }

        // Detectar solicitação de link do site
        if (mensagemLower.includes('link') || 
            mensagemLower.includes('site') || 
            mensagemLower.includes('endereço') ||
            mensagemLower.includes('endereco') ||
            mensagemLower.includes('url') ||
            mensagemLower.includes('página') ||
            mensagemLower.includes('pagina') ||
            mensagemLower.includes('web')) {
            inteligencias.linkSite = true;
        }

        // Detectar perguntas sobre bônus
        if (mensagemLower.includes('bônus') || 
            mensagemLower.includes('bonus') ||
            mensagemLower.includes('vantagem') ||
            mensagemLower.includes('extra') ||
            mensagemLower.includes('brinde') ||
            mensagemLower.includes('presente') ||
            mensagemLower.includes('grátis') ||
            mensagemLower.includes('gratis')) {
            inteligencias.bonus = true;
            
            if (mensagemLower.includes('quais') || 
                mensagemLower.includes('quais são') ||
                mensagemLower.includes('detalhes') ||
                mensagemLower.includes('lista') ||
                mensagemLower.includes('inclui')) {
                inteligencias.detalhesBonus = true;
            }
        }

        // Detectar perguntas sobre experiência
        if (mensagemLower.includes('experiência') || 
            mensagemLower.includes('experiencia') ||
            mensagemLower.includes('começar') ||
            mensagemLower.includes('iniciante') ||
            mensagemLower.includes('principiante') ||
            mensagemLower.includes('novato') ||
            mensagemLower.includes('início') ||
            mensagemLower.includes('inicio')) {
            inteligencias.experiencia = true;
        }

        // Detectar solicitação de suporte
        if (mensagemLower.includes('suporte') || 
            mensagemLower.includes('atendimento') ||
            mensagemLower.includes('ajuda') ||
            mensagemLower.includes('problema') ||
            mensagemLower.includes('dúvida') ||
            mensagemLower.includes('duvida') ||
            mensagemLower.includes('assistência') ||
            mensagemLower.includes('assistencia')) {
            inteligencias.suporte = true;
        }

        console.log(`🎯 Intenções detectadas:`, inteligencias);
        return inteligencias;
    }

    gerarRespostaContextual(inteligencias, contatos, journeyStage = "descoberta") {
        let resposta = '';
        const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

        // 🎯 Resposta baseada nas intenções detectadas
        if (inteligencias.contatoDireto) {
            if (contatos.whatsapp && contatos.whatsapp.length > 0) {
                resposta += `📞 **${excitementWord.toUpperCase()}!** Você pode falar diretamente conosco:\n\n`;
                resposta += `💬 **WhatsApp:** ${contatos.whatsapp.slice(0, 2).join(' ou ')}\n`;
                
                if (contatos.telefone && contatos.telefone.length > 0) {
                    resposta += `📞 **Telefone:** ${contatos.telefone.slice(0, 2).join(' ou ')}\n`;
                }
                resposta += `\nEstamos disponíveis para tirar todas suas dúvidas!\n\n`;
            } else if (contatos.telefone && contatos.telefone.length > 0) {
                resposta += `📞 **${excitementWord.toUpperCase()}!** Nosso telefone para contato: ${contatos.telefone.slice(0, 2).join(' ou ')}\n\n`;
            }
        }

        if (inteligencias.linkSite) {
            if (contatos.site && contatos.site.length > 0) {
                resposta += `🌐 **Site oficial:** ${contatos.site[0]}\n\n`;
            }
        }

        if (inteligencias.detalhesBonus) {
            resposta += `🎁 **BÔNUS EXCLUSIVOS INCLUÍDOS:**\n\n`;
            resposta += `• 🚀 Automatização completa do atendimento\n`;
            resposta += `• 📝 Templates de mensagens profissionais\n`;
            resposta += `• 🛠️ Suporte técnico especializado\n`;
            resposta += `• 🔄 Atualizações gratuitas por 1 ano\n`;
            resposta += `• 📚 Materiais complementares exclusivos\n\n`;
            resposta += `Tudo isso para você ter os melhores resultados! 🎯\n\n`;
        } else if (inteligencias.bonus) {
            resposta += `🎁 **SIM!** Temos bônus incríveis incluídos. `;
            resposta += `Gostaria que eu detalhe cada um dos bônus disponíveis?\n\n`;
        }

        if (inteligencias.experiencia) {
            resposta += `🌟 **PERFEITO PARA INICIANTES!**\n\n`;
            resposta += `Não é necessário nenhuma experiência prévia! `;
            resposta += `Nossa plataforma foi desenvolvida para ser intuitiva e fácil de usar, `;
            resposta += `com tutoriais passo a passo e suporte completo.\n\n`;
        }

        if (inteligencias.suporte) {
            resposta += `🛟 **SUPORTE ESPECIALIZADO**\n\n`;
            resposta += `Nossa equipe de suporte está pronta para ajudar você! `;
            
            if (contatos.email && contatos.email.length > 0) {
                resposta += `\n📧 **Email:** ${contatos.email.slice(0, 2).join(' ou ')}`;
            }
            
            if (contatos.whatsapp && contatos.whatsapp.length > 0) {
                resposta += `\n💬 **WhatsApp:** ${contatos.whatsapp.slice(0, 2).join(' ou ')}`;
            }
            
            resposta += `\n\nRespondemos rapidamente para resolver qualquer dúvida ou problema!\n\n`;
        }

        // Se nenhuma intenção específica foi detectada, usar resposta padrão baseada na jornada
        if (!resposta) {
            switch (journeyStage) {
                case "negociacao":
                    resposta = "💰 Interessado em conhecer nossos valores e condições de pagamento? Posso ajudar com todas as informações!";
                    break;
                case "fidelizacao":
                    resposta = "🛟 Precisa de suporte ou tem alguma dúvida específica? Estou aqui para ajudar!";
                    break;
                default:
                    resposta = "🎯 Obrigado pelo seu interesse! Como posso ajudar você hoje?";
            }
        }

        return resposta || "🎯 Obrigado pelo seu interesse! Como posso ajudar você hoje?";
    }
}

// Inicializar sistema de captura de intenções
const sistemaInteligencias = new SistemaCapturaInteligencias();

// ===== SISTEMA APRIMORADO DE EXTRAÇÃO DE CONTATOS =====
class SistemaExtracaoContatosAprimorado {
    constructor() {
        console.log("📞 Sistema Aprimorado de Extração de Contatos Inicializado");
    }

    extrairContatosAprimorado($) {
        const contatos = {
            telefone: [],
            whatsapp: [],
            email: [],
            site: [],
            endereco: []
        };

        try {
            // Obter todo o texto da página
            const textoPagina = $('body').text();
            
            // 🎯 PADRÕES BRASILEIROS OTIMIZADOS PARA TELEFONES
            const padroesTelefone = [
                /(\+55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g,
                /(\+55\s?)?(\(?\d{2}\)?\s?)?\d{5}[-.\s]?\d{4}/g,
                /(\(\d{2}\)\s?\d{4,5}-\d{4})/g,
                /(\d{2})\s?\d{4,5}-\d{4}/g
            ];

            // 🎯 DETECÇÃO INTELIGENTE DE WHATSAPP vs TELEFONE COMUM
            const whatsappKeywords = ['whatsapp', 'wa.me', 'wa.me', 'whats-app', 'whatsapp', 'zap', 'direct whatsapp'];
            
            // Procurar números na página
            padroesTelefone.forEach(padrao => {
                const matches = textoPagina.match(padrao);
                if (matches) {
                    matches.forEach(match => {
                        const numeroLimpo = match.replace(/\D/g, '');
                        
                        // Validar se é um número brasileiro válido
                        if (numeroLimpo.length >= 10 && numeroLimpo.length <= 13) {
                            const contexto = textoPagina.substring(
                                Math.max(0, textoPagina.indexOf(match) - 50),
                                Math.min(textoPagina.length, textoPagina.indexOf(match) + 50)
                            ).toLowerCase();

                            const isWhatsApp = whatsappKeywords.some(keyword => 
                                contexto.includes(keyword)
                            );

                            const numeroFormatado = this.formatarNumeroBrasileiro(numeroLimpo);
                            
                            if (isWhatsApp) {
                                if (!contatos.whatsapp.includes(numeroFormatado)) {
                                    contatos.whatsapp.push(numeroFormatado);
                                    console.log(`📞 WhatsApp detectado: ${numeroFormatado}`);
                                }
                            } else {
                                if (!contatos.telefone.includes(numeroFormatado)) {
                                    contatos.telefone.push(numeroFormatado);
                                    console.log(`📞 Telefone detectado: ${numeroFormatado}`);
                                }
                            }
                        }
                    });
                }
            });

            // 🎯 EXTRAÇÃO DE EMAILS DE MÚLTIPLAS FONTES
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
            const emails = textoPagina.match(emailRegex);
            if (emails) {
                contatos.email = [...new Set(emails)]; // Remove duplicatas
                console.log(`📧 Emails detectados: ${contatos.email.length}`);
            }

            // 🎯 EXTRAÇÃO DE SITES
            const siteRegex = /(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
            const sites = textoPagina.match(siteRegex);
            if (sites) {
                contatos.site = [...new Set(sites.slice(0, 3))]; // Limita a 3 sites únicos
                console.log(`🌐 Sites detectados: ${contatos.site.length}`);
            }

            // 🎯 BUSCA EM ELEMENTOS ESPECÍFICOS PARA CONTATOS
            const seletoresContato = [
                '[class*="contact"]',
                '[class*="contato"]',
                '[class*="phone"]',
                '[class*="telefone"]',
                '[class*="email"]',
                '[class*="whatsapp"]',
                '[class*="endereço"]',
                '[class*="endereco"]',
                '.footer',
                'footer',
                '.contato',
                '.contact',
                '.telefone',
                '.email'
            ];

            seletoresContato.forEach(seletor => {
                $(seletor).each((i, elem) => {
                    const texto = $(elem).text();
                    this.processarTextoContato(texto, contatos);
                });
            });

            // 🎯 BUSCA EM LINKS
            $('a[href]').each((i, elem) => {
                const href = $(elem).attr('href') || '';
                const texto = $(elem).text();
                
                // Detectar links de WhatsApp
                if (href.includes('wa.me') || href.includes('whatsapp') || href.includes('api.whatsapp')) {
                    const numeroMatch = href.match(/\d{10,13}/);
                    if (numeroMatch) {
                        const numeroFormatado = this.formatarNumeroBrasileiro(numeroMatch[0]);
                        if (!contatos.whatsapp.includes(numeroFormatado)) {
                            contatos.whatsapp.push(numeroFormatado);
                        }
                    }
                }
                
                // Detectar links de telefone
                if (href.startsWith('tel:')) {
                    const numero = href.replace('tel:', '').replace(/\D/g, '');
                    if (numero.length >= 10) {
                        const numeroFormatado = this.formatarNumeroBrasileiro(numero);
                        if (!contatos.telefone.includes(numeroFormatado)) {
                            contatos.telefone.push(numeroFormatado);
                        }
                    }
                }
                
                // Detectar links de email
                if (href.startsWith('mailto:')) {
                    const email = href.replace('mailto:', '');
                    if (email && !contatos.email.includes(email)) {
                        contatos.email.push(email);
                    }
                }
            });

            console.log(`📊 Resumo de contatos extraídos:`, {
                telefones: contatos.telefone.length,
                whatsapp: contatos.whatsapp.length,
                emails: contatos.email.length,
                sites: contatos.site.length
            });

        } catch (error) {
            console.error('❌ Erro na extração aprimorada de contatos:', error);
        }

        return contatos;
    }

    processarTextoContato(texto, contatos) {
        if (!texto) return;

        // Telefones
        const telefoneRegex = /(\+55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g;
        const telefones = texto.match(telefoneRegex);
        if (telefones) {
            telefones.forEach(tel => {
                const numeroLimpo = tel.replace(/\D/g, '');
                if (numeroLimpo.length >= 10) {
                    const numeroFormatado = this.formatarNumeroBrasileiro(numeroLimpo);
                    
                    // Detectar WhatsApp pelo contexto
                    if (texto.toLowerCase().includes('whatsapp') && !contatos.whatsapp.includes(numeroFormatado)) {
                        contatos.whatsapp.push(numeroFormatado);
                    } else if (!contatos.telefone.includes(numeroFormatado)) {
                        contatos.telefone.push(numeroFormatado);
                    }
                }
            });
        }

        // Emails
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = texto.match(emailRegex);
        if (emails) {
            emails.forEach(email => {
                if (!contatos.email.includes(email)) {
                    contatos.email.push(email);
                }
            });
        }
    }

    formatarNumeroBrasileiro(numero) {
        // Remove tudo que não é dígito
        const apenasDigitos = numero.replace(/\D/g, '');
        
        // Se começar com 55 (código do Brasil), mantém
        if (apenasDigitos.startsWith('55')) {
            if (apenasDigitos.length === 13) { // +55 11 99999-9999
                return `+${apenasDigitos}`;
            } else if (apenasDigitos.length === 12) { // 55 11 99999-9999
                return `+${apenasDigitos}`;
            } else if (apenasDigitos.length === 11) { // 11 99999-9999
                return `+55${apenasDigitos}`;
            }
        }
        
        // Para números sem código do país
        if (apenasDigitos.length === 11) { // 11 99999-9999
            return `+55${apenasDigitos}`;
        } else if (apenasDigitos.length === 10) { // 11 9999-9999
            return `+55${apenasDigitos}`;
        }
        
        // Retorna o número original se não conseguir formatar
        return numero;
    }
}

// Inicializar sistema aprimorado de extração de contatos
const sistemaContatosAprimorado = new SistemaExtracaoContatosAprimorado();

// ===== SISTEMA DE SUPERINTELIGÊNCIA EMOCIONAL =====
class SuperInteligenciaEmocional {
    constructor() {
        console.log("🧠 Sistema de SuperInteligência Emocional Inicializado");
        
        // Mapeamento de emoções e sentimentos
        this.emociones = {
            positivas: [
                'feliz', 'alegre', 'contente', 'satisfeito', 'entusiasmado', 'animado',
                'gratidão', 'grato', 'obrigado', 'agradecido', 'satisfeito', 'perfeito',
                'excelente', 'ótimo', 'maravilhoso', 'incrível', 'fantástico', 'show'
            ],
            negativas: [
                'triste', 'chateado', 'frustrado', 'irritado', 'nervoso', 'ansioso',
                'preocupado', 'desapontado', 'decepcionado', 'bravo', 'raiva', 'ódio',
                'péssimo', 'horrível', 'terrível', 'lento', 'difícil', 'complicado'
            ],
            urgentes: [
                'urgente', 'urgência', 'imediatamente', 'agora', 'rápido', 'pressa',
                'importante', 'crucial', 'emergência', 'prioridade', 'hoje', 'já'
            ],
            duvidas: [
                'dúvida', 'duvida', 'pergunta', 'perguntar', 'como funciona', 'o que é',
                'explicar', 'entender', 'compreender', 'não sei', 'não entendi'
            ]
        };

        // Personalidades adaptativas
        this.personalidades = {
            consultivo: {
                tom: "profissional e acolhedor",
                empatia: "moderada", 
                estilo: "focado em soluções",
                saudacao: "Como posso ajudá-lo hoje?",
                despedida: "Estou aqui para o que precisar!"
            },
            empatico: {
                tom: "acolhedor e compreensivo", 
                empatia: "alta",
                estilo: "focado em emocional",
                saudacao: "Oi! Como você está?",
                despedida: "Fico feliz em poder ajudar!"
            },
            tecnico: {
                tom: "detalhista e preciso",
                empatia: "baixa",
                estilo: "focado em informações", 
                saudacao: "Vamos analisar sua situação",
                despedida: "Precisa de mais detalhes?"
            },
            motivacional: {
                tom: "entusiasmado e energético",
                empatia: "alta",
                estilo: "focado em resultados",
                saudacao: "Vamos juntos nessa!",
                despedida: "Você consegue! 💪"
            }
        };

        // Sistema de agendamento
        this.horariosDisponiveis = [
            "Segunda 09:00", "Segunda 14:00", "Segunda 16:00",
            "Terça 10:00", "Terça 15:00", "Terça 17:00", 
            "Quarta 09:30", "Quarta 14:30", "Quarta 16:30",
            "Quinta 11:00", "Quinta 15:30", "Quinta 17:30",
            "Sexta 10:30", "Sexta 14:00", "Sexta 16:00"
        ];
    }

    analisarEmocao(mensagem) {
        const mensagemLower = mensagem.toLowerCase();
        let emocao = "neutro";
        let intensidade = 1;
        let urgencia = false;

        // Análise de emoções positivas
        const positivas = this.emociones.positivas.filter(palavra => 
            mensagemLower.includes(palavra)
        ).length;

        // Análise de emoções negativas  
        const negativas = this.emociones.negativas.filter(palavra =>
            mensagemLower.includes(palavra)
        ).length;

        // Detecção de urgência
        urgencia = this.emociones.urgentes.some(palavra =>
            mensagemLower.includes(palavra)
        );

        // Determinar emoção predominante
        if (positivas > negativas && positivas > 0) {
            emocao = "positivo";
            intensidade = Math.min(3, positivas);
        } else if (negativas > positivas && negativas > 0) {
            emocao = "negativo"; 
            intensidade = Math.min(3, negativas);
        }

        // Ajustar intensidade baseado em urgência
        if (urgencia) {
            intensidade += 1;
        }

        console.log(`🎭 Análise Emocional: ${emocao} (intensidade: ${intensidade}) ${urgencia ? '🚨 URGENTE' : ''}`);

        return { emocao, intensidade, urgencia };
    }

    selecionarPersonalidade(emocao, intensidade, jornada) {
        let personalidade = "consultivo";

        if (emocao === "negativo" && intensidade >= 2) {
            personalidade = "empatico";
        } else if (jornada === "negociacao" && emocao === "positivo") {
            personalidade = "motivacional"; 
        } else if (jornada === "descoberta" && emocao === "neutro") {
            personalidade = "tecnico";
        } else if (emocao === "positivo" && intensidade >= 2) {
            personalidade = "motivacional";
        }

        console.log(`🎨 Personalidade selecionada: ${personalidade}`);
        return this.personalidades[personalidade];
    }

    gerarRespostaEmpatica(mensagem, emocao, personalidade, contatos) {
        let respostaBase = "";
        const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

        // Respostas baseadas na emoção detectada
        switch (emocao.emocao) {
            case "positivo":
                if (emocao.intensidade >= 2) {
                    respostaBase = `🎉 **Que ${excitementWord} ver seu entusiasmo!** `;
                } else {
                    respostaBase = `😊 **Fico feliz em saber!** `;
                }
                break;
            case "negativo":
                if (emocao.intensidade >= 2) {
                    respostaBase = `🤗 **Entendo sua frustração e estou aqui para ajudar.** `;
                } else {
                    respostaBase = `👂 **Compreendo sua preocupação.** `;
                }
                break;
            default:
                respostaBase = `💭 **Ótima pergunta!** `;
        }

        // Adicionar urgencia se detectada
        if (emocao.urgencia) {
            respostaBase = `🚨 **Prioridade máxima!** ` + respostaBase;
        }

        // Adaptar tom baseado na personalidade
        switch (personalidade.tom) {
            case "acolhedor e compreensivo":
                respostaBase += "Vamos resolver isso juntos, passo a passo. ";
                break;
            case "entusiasmado e energético":
                respostaBase += "Você está no caminho certo! ";
                break;
            case "detalhista e preciso":
                respostaBase += "Deixe-me explicar detalhadamente. ";
                break;
            default:
                respostaBase += "Aqui estão as informações que você precisa: ";
        }

        return respostaBase;
    }

    // ===== SISTEMA DE AGENDAMENTO INTELIGENTE =====
    detectarAgendamento(mensagem) {
        const mensagemLower = mensagem.toLowerCase();
        const palavrasAgendamento = [
            'agendar', 'marcar', 'reunião', 'reuniao', 'encontro', 'consulta',
            'horário', 'horario', 'data', 'hora', 'telefone', 'call', 'vídeo',
            'video', 'encontro', 'conversar', 'falar', 'ligar', 'whatsapp'
        ];

        const isAgendamento = palavrasAgendamento.some(palavra => 
            mensagemLower.includes(palavra)
        );

        if (isAgendamento) {
            console.log("📅 Solicitação de agendamento detectada");
            return this.gerarOpcoesAgendamento();
        }

        return null;
    }

    gerarOpcoesAgendamento() {
        const horarios = this.horariosDisponiveis.slice(0, 3); // 3 primeiros horários
        let resposta = `**📅 AGENDAMENTO DISPONÍVEL**\n\n`;
        resposta += `Encontrei estes horários para nossa conversa:\n\n`;
        
        horarios.forEach((horario, index) => {
            resposta += `${index + 1}. ${horario}\n`;
        });
        
        resposta += `\n💬 **Qual horário prefere?**\n`;
        resposta += `📞 Ou se preferir, posso passar nossos contatos diretos!`;
        
        return resposta;
    }

    processarAgendamento(mensagem) {
        const mensagemLower = mensagem.toLowerCase();
        
        // Detectar seleção de horário
        for (let i = 0; i < this.horariosDisponiveis.length; i++) {
            if (mensagemLower.includes((i + 1).toString()) || 
                mensagemLower.includes(this.horariosDisponiveis[i].toLowerCase())) {
                
                return `✅ **AGENDAMENTO CONFIRMADO!**\n\n` +
                       `📅 **Horário:** ${this.horariosDisponiveis[i]}\n` +
                       `🎯 **Próximo passo:** Nossa equipe entrará em contato para confirmar.\n` +
                       `📞 **Contato direto:** Veja nossos canais acima! ⬆️`;
            }
        }

        return null;
    }
}

// Inicializar SuperInteligência
const superInteligencia = new SuperInteligenciaEmocional();

// ===== SISTEMA DE BOTÕES FIXOS NO TOPO =====
function gerarBotoesFixos(contatos, robotName) {
    let botoesHTML = `
    <div class="lm-botoes-fixos" style="
        position: sticky; 
        top: 0; 
        background: white; 
        padding: 15px; 
        border-bottom: 2px solid #3b82f6;
        z-index: 1000;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    ">
        <div style="font-weight: bold; color: #1e40af; width: 100%; text-align: center; margin-bottom: 10px;">
            📞 Fale com ${robotName}
        </div>
    `;

    // Botão de WhatsApp
    if (contatos.whatsapp && contatos.whatsapp.length > 0) {
        const whatsappNum = contatos.whatsapp[0].replace(/\D/g, '');
        botoesHTML += `
        <a href="https://wa.me/${whatsappNum}" target="_blank" style="
            background: #25D366; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 25px; 
            text-decoration: none; 
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(37, 211, 102, 0.4)';" 
           onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(37, 211, 102, 0.3)';">
            <i class="fab fa-whatsapp"></i> WhatsApp
        </a>`;
    }

    // Botão de Telefone
    if (contatos.telefone && contatos.telefone.length > 0) {
        const telefoneNum = contatos.telefone[0].replace(/\D/g, '');
        botoesHTML += `
        <a href="tel:${telefoneNum}" style="
            background: #3b82f6; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 25px; 
            text-decoration: none; 
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.4)';" 
           onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(59, 130, 246, 0.3)';">
            <i class="fas fa-phone"></i> Ligar
        </a>`;
    }

    // Botão de Agendamento
    botoesHTML += `
    <button onclick="iniciarAgendamento()" style="
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); 
        color: white; 
        padding: 12px 20px; 
        border-radius: 25px; 
        border: none;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
    " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(139, 92, 246, 0.4)';" 
       onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(139, 92, 246, 0.3)';">
        <i class="fas fa-calendar-check"></i> Agendar
    </button>`;

    // Botão de Site
    if (contatos.site && contatos.site.length > 0) {
        botoesHTML += `
        <a href="${contatos.site[0]}" target="_blank" style="
            background: #10B981; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 25px; 
            text-decoration: none; 
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)';" 
           onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.3)';">
            <i class="fas fa-globe"></i> Site
        </a>`;
    }

    botoesHTML += `</div>`;

    return botoesHTML;
}

// ===== Enhanced Logger =====
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// ===== SISTEMA APRIMORADO DE DETECÇÃO DE BÔNUS =====
class SistemaExtracaoApurado {
    constructor() {
        this.termosBonus = [
            'bônus', 'bonus', 'brinde', 'presente', 'extra', 'grátis', 'gratis',
            'incluído', 'incluido', 'adicional', 'oferta', 'promocional',
            'regalo', 'complemento', 'vantagem', 'benefício', 'beneficio',
            'exclusivo', 'limitado', 'especial', 'oferta especial'
        ];
    }

    async extrairDadosCompletos(url) {
        try {
            console.log('🌐 [EXTRACAO APRIMORADA] Conectando à:', url);
            const { data } = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            const $ = cheerio.load(data);
            const dadosExtraidos = {
                titulo: this.limparTexto($('title').text()),
                descricao: this.limparTexto($('meta[name="description"]').attr('content')),
                textos: this.extrairTextosRelevantes($),
                bonus: this.buscarInformacoesBonus($),
                preco: this.extrairPrecos($),
                garantia: this.extrairGarantia($),
                secoesEspeciais: this.extrairSecoesEspeciais($),
                metadados: this.extrairMetadados($),
                // 🎯 MELHORIA: Usar sistema aprimorado de extração de contatos
                contatos: sistemaContatosAprimorado.extrairContatosAprimorado($)
            };

            console.log(`✅ [EXTRACAO] Concluída: ${dadosExtraidos.bonus.length} bônus encontrados`);
            return dadosExtraidos;
        } catch (error) {
            console.error('❌ [EXTRACAO] Erro:', error.message);
            return { erro: 'Falha na extração: ' + error.message };
        }
    }

    // 🎯 FUNÇÃO MANTIDA PARA COMPATIBILIDADE
    extrairContatos($) {
        return sistemaContatosAprimorado.extrairContatosAprimorado($);
    }

    extrairTextosRelevantes($) {
        const textos = [];
        const seletores = [
            'h1, h2, h3, h4',
            '.card, .benefit, .feature',
            '[class*="bonus"], [class*="bônus"]',
            '[class*="offer"], [class*="oferta"]',
            '.pricing, .price, .valor',
            '.guarantee, .garantia',
            'section, .section, .container',
            'p, span, div'
        ].join(', ');

        $(seletores).each((i, elem) => {
            const texto = this.limparTexto($(elem).text());
            if (texto && texto.length > 5 && texto.length < 500) {
                textos.push(texto);
            }
        });

        return [...new Set(textos)];
    }

    buscarInformacoesBonus($) {
        const bonusEncontrados = [];
        const elementosAlvo = [
            '[class*="bonus"]', '[class*="bônus"]', '[class*="gift"]',
            '[class*="presente"]', '[class*="extra"]', '.offer, .oferta',
            '.special, .especial', '.bonus-item', '.bonus-section'
        ];

        elementosAlvo.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const texto = this.limparTexto($(elem).text());
                if (texto && this.contemTermoBonus(texto)) {
                    bonusEncontrados.push({
                        elemento: seletor,
                        conteudo: texto,
                        contexto: this.obterContexto($, elem),
                        tipo: 'busca_especifica'
                    });
                }
            });
        });

        // Busca geral como fallback
        $('body *').each((i, elem) => {
            const texto = this.limparTexto($(elem).text());
            if (texto && this.contemTermoBonus(texto) && texto.length < 500) {
                const jaExiste = bonusEncontrados.some(b => b.conteudo === texto);
                if (!jaExiste) {
                    bonusEncontrados.push({
                        elemento: elem.name || 'elemento',
                        conteudo: texto,
                        contexto: { tipo: 'busca_geral' },
                        tipo: 'busca_geral'
                    });
                }
            }
        });

        return bonusEncontrados;
    }

    contemTermoBonus(texto) {
        if (!texto) return false;
        const textoLower = texto.toLowerCase();
        return this.termosBonus.some(termo => textoLower.includes(termo));
    }

    obterContexto($, elemento) {
        const $elemento = $(elemento);
        const pai = $elemento.parent();
        return {
            elementoPai: pai.prop('tagName') || 'div',
            classePai: pai.attr('class') || '',
            irmaos: pai.children().length
        };
    }

    extrairPrecos($) {
        const precos = [];
        const seletoresPreco = [
            '[class*="price"]', '[class*="preco"]', '[class*="valor"]',
            '.pricing, .cost, .money', '.currency'
        ];

        seletoresPreco.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const texto = this.limparTexto($(elem).text());
                if (texto && /R\$\s?\d+[.,]\d+|\d+[.,]\d+\s?reais/i.test(texto)) {
                    precos.push(texto);
                }
            });
        });

        return precos;
    }

    extrairGarantia($) {
        const garantias = [];
        const seletoresGarantia = [
            '[class*="garantia"]', '[class*="guarantee"]', '[class*="warranty"]',
            '.safe, .security, .refund'
        ];

        seletoresGarantia.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const texto = this.limparTexto($(elem).text());
                if (texto && /garantia|devolução|reembolso|segurança/i.test(texto)) {
                    garantias.push(texto);
                }
            });
        });

        return garantias;
    }

    extrairSecoesEspeciais($) {
        const secoes = [];
        const secoesAlvo = [
            'section', 'div[class*="section"]', 'div[class*="container"]',
            '.offer-section', '.bonus-area', '.special-offer'
        ];

        secoesAlvo.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const $elem = $(elem);
                const texto = this.limparTexto($elem.text());
                
                if (texto.length > 50 && texto.length < 1000) {
                    const termosRelevantes = this.termosBonus.concat([
                        'oferta', 'promoção', 'limitado', 'exclusivo', 'especial'
                    ]);
                    
                    const ehRelevante = termosRelevantes.some(termo => 
                        texto.toLowerCase().includes(termo)
                    );

                    if (ehRelevante) {
                        secoes.push({
                            tipo: seletor,
                            conteudo: texto.substring(0, 300),
                            tamanho: texto.length
                        });
                    }
                }
            });
        });

        return secoes;
    }

    extrairMetadados($) {
        return {
            ogTitle: this.limparTexto($('meta[property="og:title"]').attr('content')),
            ogDescription: this.limparTexto($('meta[property="og:description"]').attr('content')),
            keywords: this.limparTexto($('meta[name="keywords"]').attr('content')),
            canonical: this.limparTexto($('link[rel="canonical"]').attr('href'))
        };
    }

    limparTexto(texto) {
        if (!texto) return '';
        return texto
            .replace(/\s+/g, ' ')
            .replace(/\n/g, ' ')
            .trim();
    }
}

class ValidacaoCruzada {
    constructor() {
        this.termosBonus = [
            'bônus', 'bonus', 'brinde', 'presente', 'extra', 'grátis', 'gratis',
            'incluído', 'incluido', 'adicional', 'oferta', 'promocional'
        ];
    }

    validarDadosCompletos(dadosExtraidos) {
        console.log('🔍 [VALIDAÇÃO] Iniciando validação cruzada...');
        
        const validacoes = {
            bonus: this.validarBonusCruzado(dadosExtraidos),
            preco: this.validarPrecos(dadosExtraidos),
            garantia: this.validarGarantia(dadosExtraidos),
            consistencia: this.validarConsistencia(dadosExtraidos)
        };

        const dadosValidados = this.aplicarCorrecoes(dadosExtraidos, validacoes);
        const pontuacaoConfianca = this.calcularPontuacaoConfianca(validacoes);

        console.log(`✅ [VALIDAÇÃO] Concluída: ${pontuacaoConfianca * 100}% de confiança`);

        return {
            dadosValidados,
            pontuacaoConfianca,
            problemasCriticos: this.identificarProblemasCriticos(validacoes)
        };
    }

    validarBonusCruzado(dados) {
        const fontes = {
            bonusDireto: dados.bonus || [],
            secoesEspeciais: this.buscarBonusEmSecoes(dados.secoesEspeciais || []),
            textosRelevantes: this.buscarBonusEmTextos(dados.textos || [])
        };

        const todosBonus = [
            ...fontes.bonusDireto,
            ...fontes.secoesEspeciais,
            ...fontes.textosRelevantes
        ];

        const bonusUnicos = this.removerDuplicatas(todosBonus);

        return {
            fontes,
            bonusUnificados: bonusUnicos,
            totalEncontrado: bonusUnicos.length,
            confiabilidade: this.calcularConfiabilidadeBonus(fontes, bonusUnicos)
        };
    }

    buscarBonusEmSecoes(secoes) {
        const bonusEncontrados = [];
        
        secoes.forEach(secao => {
            const texto = secao.conteudo.toLowerCase();
            const termosEncontrados = this.termosBonus.filter(termo => 
                texto.includes(termo)
            );

            if (termosEncontrados.length > 0) {
                bonusEncontrados.push({
                    elemento: `secao_${secao.tipo}`,
                    conteudo: secao.conteudo.substring(0, 200),
                    contexto: { tipo: 'secao_especial', termos: termosEncontrados }
                });
            }
        });

        return bonusEncontrados;
    }

    buscarBonusEmTextos(textos) {
        const bonusEncontrados = [];
        
        textos.forEach(texto => {
            if (this.contemTermoBonus(texto)) {
                bonusEncontrados.push({
                    elemento: 'texto_geral',
                    conteudo: texto,
                    contexto: { tipo: 'texto_relevante' }
                });
            }
        });

        return bonusEncontrados;
    }

    contemTermoBonus(texto) {
        if (!texto) return false;
        return this.termosBonus.some(termo => 
            texto.toLowerCase().includes(termo.toLowerCase())
        );
    }

    removerDuplicatas(bonusArray) {
        const seen = new Set();
        return bonusArray.filter(item => {
            const key = item.conteudo.toLowerCase().trim();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    validarPrecos(dados) {
        const precosEncontrados = [...(dados.preco || [])];
        return {
            precos: precosEncontrados,
            total: precosEncontrados.length
        };
    }

    validarGarantia(dados) {
        const garantias = [...(dados.garantia || [])];
        return {
            garantias: garantias,
            total: garantias.length
        };
    }

    validarConsistencia(dados) {
        const inconsistencias = [];
        
        if (dados.bonus && dados.bonus.length > 0 && 
            (!dados.preco || dados.preco.length === 0)) {
            inconsistencias.push('Bônus encontrados mas preços não identificados');
        }

        return {
            consistente: inconsistencias.length === 0,
            inconsistencias,
            score: Math.max(0, 10 - inconsistencias.length) / 10
        };
    }

    calcularConfiabilidadeBonus(fontes, bonusUnicos) {
        const pesos = {
            bonusDireto: 1.0,
            secoesEspeciais: 0.8,
            textosRelevantes: 0.6
        };

        let score = 0;
        let totalPeso = 0;

        Object.keys(fontes).forEach(fonte => {
            if (fontes[fonte].length > 0) {
                score += pesos[fonte] * fontes[fonte].length;
                totalPeso += pesos[fonte];
            }
        });

        return totalPeso > 0 ? (score / totalPeso) / Math.max(1, bonusUnicos.length) : 0;
    }

    calcularPontuacaoConfianca(validacoes) {
        const pesos = {
            bonus: 0.4,
            preco: 0.2,
            garantia: 0.2,
            consistencia: 0.2
        };

        let pontuacao = 0;
        pontuacao += validacoes.bonus.confiabilidade * pesos.bonus;
        pontuacao += (validacoes.preco.total > 0 ? 1 : 0.5) * pesos.preco;
        pontuacao += (validacoes.garantia.total > 0 ? 1 : 0.3) * pesos.garantia;
        pontuacao += validacoes.consistencia.score * pesos.consistencia;

        return Math.min(1, pontuacao);
    }

    identificarProblemasCriticos(validacoes) {
        const problemas = [];
        if (validacoes.bonus.totalEncontrado === 0) {
            problemas.push('NENHUM bônus identificado após validação cruzada');
        }
        if (validacoes.preco.total === 0) {
            problemas.push('NENHUM preço identificado');
        }
        if (validacoes.consistencia.inconsistencias.length > 0) {
            problemas.push(...validacoes.consistencia.inconsistencias);
        }
        return problemas;
    }

    aplicarCorrecoes(dados, validacoes) {
        const dadosCorrigidos = { ...dados };
        if (validacoes.bonus.bonusUnificados.length > 0) {
            dadosCorrigidos.bonus = validacoes.bonus.bonusUnificados;
        }
        return dadosCorrigidos;
    }
}

// Instâncias globais dos sistemas
const sistemaExtracao = new SistemaExtracaoApurado();
const sistemaValidacao = new ValidacaoCruzada();

// ===== FIM DO SISTEMA APRIMORADO =====

// Trust proxy for accurate IP addresses
app.set("trust proxy", true);

// ===== Session Configuration =====
let sessionConfig = {
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

// Usa Redis se disponível, caso contrário mostra aviso
if (process.env.REDIS_URL) {
    const RedisStore = require("connect-redis").default;
    const redis = require("redis");
    
    const redisClient = redis.createClient({
        url: process.env.REDIS_URL
    });
    
    redisClient.connect().catch(console.error);
    
    sessionConfig.store = new RedisStore({
        client: redisClient,
        prefix: "linkmagico:"
    });
    
    console.log("✅ Redis configurado para sessões");
} else {
    console.warn("⚠️  Redis não configurado - usando MemoryStore (não recomendado para produção)");
}

app.use(session(sessionConfig));

// 🛡️ APLICAR CSRF PROTECTION GLOBALMENTE (NOVO MIDDLEWARE)
app.use(csrfSystem.getMiddleware());

// ===== Middleware =====
app.use(helmet({
    contentSecurityPolicy: false, // 🛡️ DESABILITAR HELMET CSP PARA USAR NOSSO PRÓPRIO
    crossOriginEmbedderPolicy: false
}));

// ===== CONFIGURAÇÃO CORS SEGURA =====
// Aplicar CORS seguro
app.use(corsConfig.getMiddleware());

// Logging de CORS
app.use(corsConfig.corsLogger);

// 🛡️ CONFIGURAÇÃO CSP - APLICAR BASEADO NO AMBIENTE
if (process.env.NODE_ENV === 'production') {
    app.use(cspConfig.getMiddleware());
    console.log('🔒 CSP aplicado em modo produção');
} else {
    app.use(cspConfig.getDevMiddleware());
    console.log('🔧 Modo desenvolvimento: CSP em report-only');
}

// 🛡️ HEADERS DE SEGURANÇA ADICIONAIS
app.use((req, res, next) => {
    // Headers customizados de segurança
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(bodyParser.json({ limit: "10mb" }));

app.use(morgan("combined"));

// ===== API Key Validation Functions =====
function loadApiKeys() {
    try {
        if (process.env.API_KEYS_JSON) {
            logger.info("Loading API keys from environment variable");
            return JSON.parse(process.env.API_KEYS_JSON);
        }
        
        const dataFile = path.join(__dirname, "data", "api_keys.json");
        if (fs.existsSync(dataFile)) {
            logger.info("Loading API keys from file");
            const raw = fs.readFileSync(dataFile, "utf8");
            return JSON.parse(raw);
        }
        
        logger.warn("No API keys found - neither in environment variable nor in file");
    } catch (error) {
        logger.error("Error loading API keys:", error.message);
    }
    return {};
}

function validateApiKey(apiKey) {
    const apiKeys = loadApiKeys();
    const keyData = apiKeys[apiKey];
    
    if (keyData && keyData.active !== false) {
        return {
            success: true,
            client: {
                nome: keyData.nome || "API Client",
                plano: keyData.plano || "basic",
                apiKey: apiKey
            }
        };
    }
    
    return { success: false };
}

// ===== API Key Middleware =====
function requireApiKey(req, res, next) {
    logger.info(`[requireApiKey] Path: ${req.path}, Session Validated: ${!!(req.session && req.session.validatedApiKey)}`);

    // Permitir acesso a rotas públicas sem API Key
    if (req.path === "/" || req.path === "/validate-api-key" || req.path.startsWith("/public/") || req.path === "/chat.html" || req.path === "/chatbot") {
        return next();
    }

    let apiKey = req.query.apiKey || req.body.apiKey || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    if (apiKey) {
        const validation = validateApiKey(apiKey);
        if (validation.success) {
            req.session.validatedApiKey = apiKey;
            req.session.clientData = validation.client;
            req.cliente = validation.client;
            return next();
        }
    }

    if (req.session && req.session.validatedApiKey) {
        req.cliente = req.session.clientData;
        return next();
    }

    // Se a API Key não for encontrada ou for inválida, e não houver sessão validada, redirecionar para a página inicial
    return res.redirect("/");
}

app.use(requireApiKey);

// ===== MIDDLEWARE: Validação JWT para Widget =====
function requireWidgetAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token de acesso necessário'
        });
    }

    try {
        const decoded = authSystem.verifyWidgetToken(token);
        req.widgetClient = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'Token inválido ou expirado'
        });
    }
}

// ===== Static Files with API Key Protection =====
app.get("/", (req, res) => {
    logger.info(`[GET /] Session Validated: ${!!(req.session && req.session.validatedApiKey)}`);
    if (req.session && req.session.validatedApiKey) {
        return res.redirect("/app");
    }
    res.sendFile(path.join(__dirname, "public", "api_key_validation.html"));
});

app.post("/validate-api-key", (req, res) => {
    const { apiKey } = req.body;
    
    if (!apiKey) {
        return res.status(400).json({ 
            success: false, 
            error: "API Key é obrigatória" 
        });
    }

    const validation = validateApiKey(apiKey);
    if (!validation.success) {
        return res.status(401).json({ 
            success: false, 
            error: "API Key inválida" 
        });
    }

    req.session.validatedApiKey = apiKey;
    req.session.clientData = validation.client;
    req.cliente = validation.client; // Ensure req.cliente is set immediately after validation
    
    res.json({ 
        success: true, 
        message: "API Key validada com sucesso" 
    });
});

// 🛡️ ENDPOINT PARA OBTER TOKEN CSRF (NOVA ROTA)
app.get('/api/csrf-token', (req, res) => {
    csrfSystem.getCSRFToken(req, res);
});

app.get("/app", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index_app.html"));
});

app.get("/privacy.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "privacy.html"));
});

app.get("/excluir-dados", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "excluir-dados.html"));
});

// ===== ROTAS DE ADMINISTRAÇÃO DE LEADS =====
app.get("/admin/leads", 
    csrfSystem.verifyCSRF,  // NOVA PROTEÇÃO
    requireApiKey, 
    (req, res) => {
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    const leads = leadSystem.getLeads();
    console.log(`📊 Retornando ${leads.length} leads para admin`);
    res.json({
        success: true,
        leads: leads,
        total: leads.length
    });
});

app.get("/admin/leads/:id", requireApiKey, (req, res) => {
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    const lead = leadSystem.getLeadById(req.params.id);
    if (lead) {
        res.json({ success: true, lead });
    } else {
        res.status(404).json({ success: false, error: "Lead não encontrado" });
    }
});

// ===== ROTAS DE BACKUP DE LEADS =====
app.post("/admin/leads/backup/create", 
    csrfSystem.verifyCSRF,  // NOVA PROTEÇÃO
    requireApiKey, 
    (req, res) => {
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    const backupSystem = getBackupSystem(leadSystem, req.cliente.apiKey);
    const result = backupSystem.createBackup("manual");
    res.json(result);
});

app.get("/admin/leads/backup/list", requireApiKey, (req, res) => {
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    const backupSystem = getBackupSystem(leadSystem, req.cliente.apiKey);
    const backups = backupSystem.listBackups();
    res.json({
        success: true,
        backups: backups,
        total: backups.length
    });
});

app.post("/admin/leads/backup/restore", requireApiKey, (req, res) => {
    const { filename } = req.body;
    
    if (!filename) {
        return res.status(400).json({
            success: false,
            error: "Nome do arquivo de backup é obrigatório"
        });
    }
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    const backupSystem = getBackupSystem(leadSystem, req.cliente.apiKey);
    const result = backupSystem.restoreBackup(filename);
    res.json(result);
});

// ===== DOCUMENTAÇÃO DA API =====
app.get("/api/docs", (req, res) => {
    const docs = {
        name: "LinkMágico API v7.0",
        version: "7.0.0",
        description: "API SuperInteligente para Chatbots e Captura de Leads",
        endpoints: {
            // Administração de Leads
            "GET /admin/leads": {
                description: "Listar todos os leads",
                authentication: "API Key obrigatória",
                parameters: "Nenhum",
                response: {
                    success: "boolean",
                    leads: "array",
                    total: "number"
                }
            },
            "GET /admin/leads/:id": {
                description: "Obter lead específico",
                authentication: "API Key obrigatória",
                parameters: "id (path parameter)",
                response: {
                    success: "boolean",
                    lead: "object"
                }
            },
            // Backup de Leads
            "POST /admin/leads/backup/create": {
                description: "Criar backup manual dos leads",
                authentication: "API Key obrigatória",
                parameters: "Nenhum",
                response: {
                    success: "boolean",
                    filename: "string",
                    path: "string"
                }
            },
            "GET /admin/leads/backup/list": {
                description: "Listar backups disponíveis",
                authentication: "API Key obrigatória",
                parameters: "Nenhum",
                response: {
                    success: "boolean",
                    backups: "array",
                    total: "number"
                }
            },
            "POST /admin/leads/backup/restore": {
                description: "Restaurar backup",
                authentication: "API Key obrigatória",
                parameters: {
                    filename: "string (obrigatório)"
                },
                response: {
                    success: "boolean",
                    leadsCount: "number",
                    timestamp: "string"
                }
            },
            // Chat e Processamento
            "POST /api/process-chat-inteligente": {
                description: "Processamento superinteligente de chat",
                authentication: "API Key obrigatória",
                parameters: {
                    message: "string (obrigatório)",
                    pageData: "object (opcional)",
                    robotName: "string (opcional)",
                    instructions: "string (opcional)",
                    leadId: "string (opcional)"
                },
                response: {
                    success: "boolean",
                    response: "string",
                    inteligenciasDetectadas: "object",
                    analiseEmocional: "object"
                }
            },
            "POST /api/chat-universal": {
                description: "Chat universal com captura de leads",
                authentication: "API Key obrigatória",
                parameters: {
                    message: "string (obrigatório)",
                    url: "string (opcional)",
                    instructions: "string (opcional)",
                    leadId: "string (opcional)"
                }
            },
            // Extração de Dados
            "POST /api/extract-enhanced": {
                description: "Extração aprimorada de dados de página",
                authentication: "Nenhuma",
                parameters: {
                    url: "string (obrigatório)"
                },
                response: {
                    success: "boolean",
                    data: "object",
                    validacao: "object"
                }
            }
        },
        examples: {
            "Capturar Lead": {
                url: "/api/capture-lead",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": "sua_api_key_aqui"
                },
                body: {
                    nome: "João Silva",
                    email: "joao@email.com",
                    telefone: "+5511999999999",
                    url_origem: "https://exemplo.com",
                    robotName: "Meu Assistente"
                }
            },
            "Processar Chat Inteligente": {
                url: "/api/process-chat-inteligente",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": "sua_api_key_aqui"
                },
                body: {
                    message: "Quero saber mais sobre seus produtos",
                    robotName: "Meu Assistente",
                    leadId: "lead_123456"
                }
            },
            "Criar Backup": {
                url: "/admin/leads/backup/create",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": "sua_api_key_aqui"
                }
            }
        },
        authentication: {
            type: "API Key",
            locations: ["header (X-API-Key)", "query parameter (apiKey)", "body (apiKey)"],
            note: "Obtenha sua API Key no painel administrativo"
        }
    };
    
    res.json(docs);
});

// ===== STATUS DO SISTEMA DE BACKUP =====
app.get("/admin/backup/status", requireApiKey, (req, res) => {
    try {
        const leadSystem = getLeadSystem(req.cliente.apiKey);
        const backupSystem = getBackupSystem(leadSystem, req.cliente.apiKey);
        
        const backups = backupSystem.listBackups();
        const backupDir = getTenantBackupDirPath(req.cliente.apiKey);
        
        const status = {
            sistema: "Sistema de Backup de Leads",
            leadsAtivos: leadSystem.leads.length,
            totalBackups: backups.length,
            ultimoBackup: backups.length > 0 ? backups[0] : null,
            diretorioBackup: backupDir,
            agendamentoAtivo: true,
            intervalo: "24 horas",
            maxBackups: 7,
            tamanhoTotal: backups.reduce((total, backup) => total + (backup.size || 0), 0),
            status: "OPERACIONAL"
        };
        
        res.json({
            success: true,
            status: status,
            backups: backups.slice(0, 5) // Últimos 5 backups
        });
        
    } catch (error) {
        console.error("❌ Erro ao verificar status do backup:", error);
        res.status(500).json({
            success: false,
            error: "Erro ao verificar status do backup",
            details: error.message
        });
    }
});

// ===== TESTE DO SISTEMA DE BACKUP =====
app.post("/admin/backup/test", requireApiKey, (req, res) => {
    try {
        const leadSystem = getLeadSystem(req.cliente.apiKey);
        const backupSystem = getBackupSystem(leadSystem, req.cliente.apiKey);
        
        // Criar backup de teste
        const resultado = backupSystem.createBackup("teste");
        
        // Listar backups após teste
        const backups = backupSystem.listBackups();
        
        res.json({
            success: true,
            mensagem: "Sistema de backup testado com sucesso",
            teste: {
                backupCriado: resultado.success,
                arquivo: resultado.filename,
                leadsIncluidos: leadSystem.leads.length,
                totalBackupsAposTeste: backups.length
            },
            status: "SISTEMA OPERACIONAL"
        });
        
    } catch (error) {
        console.error("❌ Erro no teste de backup:", error);
        res.status(500).json({
            success: false,
            error: "Falha no teste do sistema de backup",
            details: error.message
        });
    }
});

// ROTA CHAT.HTML
app.get("/chat.html", (req, res) => {
    const robotName = req.query.name || "Assistente IA";
    const url = req.query.url || "";
    const instructions = req.query.instructions || "";
    
    const chatbotHTML = generateChatbotHTML({ robotName, url, instructions });
    res.send(chatbotHTML);
});

// ROTA CHATBOT COMPLETA
app.get("/chatbot", async (req, res) => {
    try {
        const robotName = req.query.name || "Assistente IA";
        const url = req.query.url || "";
        const instructions = req.query.instructions || "";
        
        let pageData = {};
        if (url) {
            try {
                pageData = await extractPageData(url);
            } catch (extractError) {
                console.warn('Failed to extract page data:', extractError.message || extractError);
            }
        }
        
        const html = generateFullChatbotHTML(pageData, robotName, instructions);
        res.set('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        logger.error('Chatbot route error:', error.message || error);
        res.status(500).send('Erro interno ao gerar chatbot');
    }
});

app.use("/public", express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    etag: true,
    lastModified: true
}));

// 🛡️ ENDPOINT PARA RELATAR VIOLAÇÕES CSP
app.post('/api/security/csp-violation', 
    express.json({ type: 'application/csp-report' }),
    (req, res) => {
        cspConfig.handleCSPViolation(req, res);
    }
);

// ===== ENDPOINT PARA VERIFICAR CONFIGURAÇÕES CORS =====
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/cors-config', (req, res) => {
        res.json({
            allowedOrigins: corsConfig.allowedOrigins,
            currentOrigin: req.get('Origin'),
            isAllowed: corsConfig.allowedOrigins.includes(req.get('Origin')),
            environment: process.env.NODE_ENV || 'development'
        });
    });
}

app.use(express.static("public", {
    maxAge: "1d",
    etag: true,
    lastModified: true
}));

// ===== Analytics & Cache =====
const analytics = {
    totalRequests: 0,
    chatRequests: 0,
    extractRequests: 0,
    errors: 0,
    activeChats: new Set(),
    startTime: Date.now(),
    responseTimeHistory: [],
    successfulExtractions: 0,
    failedExtractions: 0,
    leadsCaptured: 0
};

app.use((req, res, next) => {
    const start = Date.now();
    analytics.totalRequests++;

    res.on("finish", () => {
        const responseTime = Date.now() - start;
        analytics.responseTimeHistory.push(responseTime);
        if (analytics.responseTimeHistory.length > 100) analytics.responseTimeHistory.shift();
        if (res.statusCode >= 400) analytics.errors++;
    });

    next();
});

const dataCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function setCacheData(key, data) {
    dataCache.set(key, { data, timestamp: Date.now() });
}

function getCacheData(key) {
    const cached = dataCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    dataCache.delete(key);
    return null;
}

// ===== Utility functions =====
function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
}

function uniqueLines(text) {
    if (!text) return "";
    const seen = new Set();
    return text.split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => {
            if (seen.has(line)) return false;
            seen.add(line);
            return true;
        })
        .join("\n");
}

function clampSentences(text, maxSentences = 2) {
    if (!text) return "";
    const sentences = normalizeText(text).split(/(?<=[.!?])\s+/);
    return sentences.slice(0, maxSentences).join(" ");
}

function extractBonuses(text) {
    if (!text) return [];
    const bonusKeywords = /(bônus|bonus|brinde|extra|grátis|template|planilha|checklist|e-book|ebook)/gi;
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const bonuses = [];

    for (const line of lines) {
        if (bonusKeywords.test(line) && line.length > 10 && line.length < 200) {
            bonuses.push(line);
            if (bonuses.length >= 5) break;
        }
    }
    return Array.from(new Set(bonuses));
}

// ===== Content extraction =====
function extractCleanTextFromHTML(html) {
    try {
        const $ = cheerio.load(html || "");
        $("script, style, noscript, iframe, nav, footer, aside").remove();

        const textBlocks = [];
        const selectors = ["h1", "h2", "h3", "p", "li", "span", "div"];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const text = normalizeText($(element).text() || "");
                if (text && text.length > 15 && text.length < 1000) {
                    textBlocks.push(text);
                }
            });
        }

        const metaDesc = $("meta[name=\"description\"]").attr("content") ||
            $("meta[property=\"og:description\"]").attr("content") || "";
        if (metaDesc && metaDesc.trim().length > 20) {
            textBlocks.unshift(normalizeText(metaDesc.trim()));
        }

        const uniqueBlocks = [...new Set(textBlocks.map(b => b.trim()).filter(Boolean))];
        return uniqueBlocks.join("\n");
    } catch (error) {
        logger.warn("extractCleanTextFromHTML error:", error.message || error);
        return "";
    }
}

// ===== Page extraction =====
async function extractPageDataWithRetry(url, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`Tentativa ${attempt}/${maxRetries} de extrair: ${url}`);
            
            // Timeout progressivo: 30s, 45s, 60s
            const timeout = 30000 + (attempt - 1) * 15000;
            
            const result = await Promise.race([
                extractPageData(url),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Timeout após ${timeout/1000}s`)), timeout)
                )
            ]);
            
            // Verificar se a extração foi bem-sucedida
            if (result && (result.cleanText || result.title || result.description)) {
                logger.info(`✅ Extração bem-sucedida na tentativa ${attempt}`);
                return result;
            }
            
            throw new Error('Extração retornou dados vazios');
            
        } catch (error) {
            lastError = error;
            logger.warn(`❌ Tentativa ${attempt} falhou: ${error.message}`);
            
            if (attempt < maxRetries) {
                const waitTime = 2000 * attempt; // 2s, 4s, 6s
                logger.info(`⏳ Aguardando ${waitTime/1000}s antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    // Se todas as tentativas falharam, retornar fallback
    logger.error(`❌ Todas as ${maxRetries} tentativas falharam para: ${url}`);
    return {
        title: "Chatbot Inteligente",
        description: "Assistente virtual pronto para ajudar",
        benefits: [],
        testimonials: [],
        cta: "",
        summary: "Este é um assistente inteligente que pode responder suas perguntas. A extração automática do conteúdo não foi possível, mas você ainda pode fazer perguntas!",
        cleanText: `Informações sobre: ${url}\n\nEste é um assistente virtual inteligente pronto para responder suas dúvidas.\n\nPor favor, faça sua pergunta e farei o melhor para ajudá-lo!`,
        imagesText: [],
        url: url,
        extractionTime: 0,
        method: "fallback",
        error: lastError ? lastError.message : "Extração falhou após múltiplas tentativas",
        bonuses_detected: [],
        price_detected: [],
        contatos: {
            telefone: [],
            whatsapp: [],
            email: [],
            site: [url],
            endereco: []
        }
    };
}

async function extractPageData(url) {
    const startTime = Date.now();
    try {
        if (!url) throw new Error("URL is required");

        const cacheKey = url;
        const cached = getCacheData(cacheKey);
        if (cached) {
            logger.info(`Cache hit for ${url}`);
            return cached;
        }
        
        logger.info(`Starting extraction for: ${url}`);

        const extractedData = {
            title: "",
            description: "",
            benefits: [],
            testimonials: [],
            cta: "",
            summary: "",
            cleanText: "",
            imagesText: [],
            url: url,
            extractionTime: 0,
            method: "unknown",
            bonuses_detected: [],
            price_detected: [],
            // 🎯 NOVO: Contatos extraídos
            contatos: {
                telefone: [],
                whatsapp: [],
                email: [],
                site: [url],
                endereco: []
            }
        };

        let html = "";
        try {
            logger.info("Attempting Axios + Cheerio extraction...");
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; LinkMagico-Bot/6.0; +https://linkmagico-comercial.onrender.com)",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
                },
                timeout: 30000,
                maxRedirects: 5,
                validateStatus: status => status >= 200 && status < 400
            });
            html = response.data || "";
            const finalUrl = response.request?.res?.responseUrl || url;
            if (finalUrl && finalUrl !== url) extractedData.url = finalUrl;
            extractedData.method = "axios-cheerio";
            logger.info(`Axios extraction successful, HTML length: ${String(html).length}`);
        } catch (axiosError) {
            logger.warn(`Axios extraction failed for ${url}: ${axiosError.message || axiosError}`);
        }

        if (html && html.length > 100) {
            try {
                const $ = cheerio.load(html);
                $("script, style, noscript, iframe").remove();

                // Title
                const titleSelectors = ["h1", "meta[property=\"og:title\"]", "meta[name=\"twitter:title\"]", "title"];
                for (const selector of titleSelectors) {
                    const el = $(selector).first();
                    const title = (el.attr && (el.attr("content") || el.text) ? (el.attr("content") || el.text()) : el.text ? el.text() : "").toString().trim();
                    if (title && title.length > 5 && title.length < 200) {
                        extractedData.title = title;
                        break;
                    }
                }

                // Description
                const descSelectors = ["meta[name=\"description\"]", "meta[property=\"og:description\"]", ".description", "article p", "main p"];
                for (const selector of descSelectors) {
                    const el = $(selector).first();
                    const desc = (el.attr && (el.attr("content") || el.text) ? (el.attr("content") || el.text()) : el.text ? el.text() : "").toString().trim();
                    if (desc && desc.length > 50 && desc.length < 1000) {
                        extractedData.description = desc;
                        break;
                    }
                }

                extractedData.cleanText = extractCleanTextFromHTML(html);

                const bodyText = $("body").text() || "";
                const summaryText = bodyText.replace(/\s+/g, " ").trim();
                const sentences = summaryText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
                extractedData.summary = sentences.slice(0, 3).join(". ").substring(0, 400) + (sentences.length > 3 ? "..." : "");

                extractedData.bonuses_detected = extractBonuses(bodyText);

                // 🎯 EXTRAIR CONTATOS
                extractedData.contatos = sistemaContatosAprimorado.extrairContatosAprimorado($);

                logger.info(`Cheerio extraction completed for ${url}`);
                analytics.successfulExtractions++;
            } catch (cheerioError) {
                logger.warn(`Cheerio parsing failed: ${cheerioError.message || cheerioError}`);
                analytics.failedExtractions++;
            }
        }

        // Puppeteer fallback
        const minAcceptableLength = 200;
        if ((!extractedData.cleanText || extractedData.cleanText.length < minAcceptableLength) && puppeteer) {
            logger.info("Trying Puppeteer for dynamic rendering...");
            let browser = null;
            try {
                browser = await puppeteer.launch({
                    headless: true,
                    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                    defaultViewport: { width: 1200, height: 800 },
                    timeout: 40000
                });
                const page = await browser.newPage();
                await page.setUserAgent("Mozilla/5.0 (compatible; LinkMagico-Bot/6.0)");
                await page.setRequestInterception(true);
                page.on("request", (req) => {
                    const rt = req.resourceType();
                    if (["stylesheet", "font", "image", "media"].includes(rt)) req.abort();
                    else req.continue();
                });

                try {
                    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
                } catch (gotoErr) {
                    logger.warn("Puppeteer goto failed:", gotoErr.message || gotoErr);
                }

                try {
                    await page.evaluate(async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            const distance = 100;
                            const timer = setInterval(() => {
                                const scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;

                                if (totalHeight >= scrollHeight || totalHeight > 3000) {
                                    clearInterval(timer);
                                    resolve();
                                }
                            }, 100);
                        });
                    });
                } catch (scrollErr) {
                    logger.warn("Puppeteer scroll failed:", scrollErr.message || scrollErr);
                }

                const content = await page.content();
                const puppeteerData = await page.evaluate(() => {
                    const metaDescription = document.querySelector("meta[name=\"description\"]")?.content ||
                                            document.querySelector("meta[property=\"og:description\"]")?.content || "";
                    const title = document.querySelector("title")?.textContent ||
                                  document.querySelector("h1")?.textContent || "";
                    return { metaDescription, title };
                });

                const finalText = extractCleanTextFromHTML(content);

                if (finalText && finalText.length > extractedData.cleanText.length) {
                    extractedData.cleanText = finalText;
                    extractedData.method = "puppeteer";
                    if (!extractedData.title && puppeteerData.title) extractedData.title = puppeteerData.title.slice(0, 200);
                    if (!extractedData.description && puppeteerData.metaDescription) extractedData.description = puppeteerData.metaDescription.slice(0, 500);
                    const sents = finalText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
                    if (!extractedData.summary && sents.length) extractedData.summary = sents.slice(0, 3).join(". ").substring(0, 400) + (sents.length > 3 ? "..." : "");
                    extractedData.bonuses_detected = extractBonuses(finalText);
                    analytics.successfulExtractions++;
                }

            } catch (puppeteerErr) {
                logger.warn("Puppeteer extraction failed:", puppeteerErr.message || puppeteerErr);
                analytics.failedExtractions++;
            } finally {
                try { if (browser) await browser.close(); } catch (e) {}
            }
        }

        // Final processing
        try {
            if (extractedData.cleanText) extractedData.cleanText = uniqueLines(extractedData.cleanText);
            if (!extractedData.title && extractedData.cleanText) {
                const firstLine = extractedData.cleanText.split("\n").find(l => l && l.length > 10 && l.length < 150);
                if (firstLine) extractedData.title = firstLine.slice(0, 150);
            }
            if (!extractedData.summary && extractedData.cleanText) {
                const sents = extractedData.cleanText.split(/(?<=[.!?])\s+/).filter(Boolean);
                extractedData.summary = sents.slice(0, 3).join(". ").slice(0, 400) + (sents.length > 3 ? "..." : "");
            }
        } catch (procErr) {
            logger.warn("Final processing failed:", procErr.message || procErr);
        }

        extractedData.extractionTime = Date.now() - startTime;
        
        setCacheData(cacheKey, extractedData);
        logger.info(`Extraction completed for ${url} in ${extractedData.extractionTime}ms using ${extractedData.method}`);
        return extractedData;

    } catch (error) {
        analytics.failedExtractions++;
        logger.error(`Page extraction failed for ${url}:`, error.message || error);
        return {
            title: "",
            description: "",
            benefits: [],
            testimonials: [],
            cta: "",
            summary: "Erro ao extrair dados da página. Verifique se a URL está acessível.",
            cleanText: "",
            imagesText: [],
            url: url || "",
            extractionTime: Date.now() - startTime,
            method: "failed",
            error: error.message || String(error),
            bonuses_detected: [],
            price_detected: [],
            contatos: {
                telefone: [],
                whatsapp: [],
                email: [],
                site: [url],
                endereco: []
            }
        };
    }
}

// ===== LLM Integration =====
async function callGroq(messages, temperature = 0.4, maxTokens = 300) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");

    const payload = {
        model: process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
        messages,
        temperature,
        max_tokens: maxTokens
    };

    const url = process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1/chat/completions";
    const headers = { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error("Groq API call failed:", error.response ? error.response.data : error.message);
        throw new Error("Failed to get response from Groq API");
    }
}

async function callOpenRouter(messages, temperature = 0.4, maxTokens = 300) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");

    const payload = {
        model: process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct",
        messages,
        temperature,
        max_tokens: maxTokens
    };

    const url = process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1/chat/completions";
    const headers = { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error("OpenRouter API call failed:", error.response ? error.response.data : error.message);
        throw new Error("Failed to get response from OpenRouter API");
    }
}

async function callOpenAI(messages, temperature = 0.4, maxTokens = 300) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

    const payload = {
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages,
        temperature,
        max_tokens: maxTokens
    };

    const url = process.env.OPENAI_API_BASE || "https://api.openai.com/v1/chat/completions";
    const headers = { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error("OpenAI API call failed:", error.response ? error.response.data : error.message);
        throw new Error("Failed to get response from OpenAI API");
    }
}

// ===== AI Response Generation =====
const NOT_FOUND_MSG = "Desculpe, não encontrei informações específicas sobre isso. Posso ajudar com outras dúvidas?";

function shouldActivateSalesMode(instructions) {
    if (!instructions) return false;
    const salesKeywords = /(venda|vendas|compra|comprar|adquirir|produto|oferta|promoção|desconto)/i;
    return salesKeywords.test(instructions);
}

// ===== FUNÇÃO APRIMORADA DE RESPOSTA DA IA COM SUPERINTELIGÊNCIA =====
async function generateAIResponse(userMessage, pageData = {}, conversationHistory = [], instructions = "", leadId = null) {
    const startTime = Date.now();
    try {
        if (!userMessage || !String(userMessage).trim()) {
            return NOT_FOUND_MSG;
        }

        // 🎯 CORREÇÃO: Limpar mensagem de caracteres especiais
        const cleanUserMessage = String(userMessage).replace(/<s>\s*\[OUT\]/g, '').replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '').trim();
        if (!cleanUserMessage) {
            return "Desculpe, não entendi sua mensagem. Poderia reformular?";
        }

        // 🎯 SUPERINTELIGÊNCIA: Análise Avançada
        const userId = leadId || `user_${Date.now()}`;
        const estadoEmocional = superInteligenciaGlobal.analisarEstadoEmocional(cleanUserMessage);
        
        // 🎯 ATUALIZAR MEMÓRIA DO USUÁRIO
        superInteligenciaGlobal.atualizarMemoriaUsuario(userId, {
            mensagem: cleanUserMessage,
            emocao: estadoEmocional.emocaoPrimaria,
            intencoes: estadoEmocional.intencoesMultiplas
        });

        // 🎯 OBTER MEMÓRIA DO USUÁRIO
        const memoriaUsuario = superInteligenciaGlobal.memoriaConversacional.get(userId);

        // 🎯 ANÁLISE DA JORNADA DO CLIENTE
        const journeyStage = journeyAnalyzer.analyzeJourneyStage(cleanUserMessage);
        const shouldMentionBonus = journeyAnalyzer.shouldMentionBonus(journeyStage, cleanUserMessage);
        const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

        // Atualizar estágio do lead se existir
        if (leadId) {
            const leadSystem = getLeadSystem(process.env.API_KEYS_JSON ? JSON.parse(process.env.API_KEYS_JSON)[0] : "default");
            leadSystem.updateLeadJourneyStage(leadId, journeyStage);
        }

        // 🎯 DETECÇÃO APRIMORADA DE BÔNUS
        let bonusInfo = "";
        if (pageData && pageData.bonuses_detected && pageData.bonuses_detected.length > 0 && shouldMentionBonus) {
            bonusInfo = `BÔNUS DETECTADOS: ${pageData.bonuses_detected.join(', ')}. `;
        }

        // 🎯 INFORMAÇÕES DE CONTATO
        let contactInfo = "";
        if (pageData && pageData.contatos) {
            const contatos = pageData.contatos;
            contactInfo = `INFORMAÇÕES DE CONTATO: `;
            
            if (contatos.telefone.length > 0) {
                contactInfo += `Telefones: ${contatos.telefone.slice(0, 2).join(', ')}. `;
            }
            if (contatos.whatsapp.length > 0) {
                contactInfo += `WhatsApp: ${contatos.whatsapp.slice(0, 2).join(', ')}. `;
            }
            if (contatos.email.length > 0) {
                contactInfo += `Emails: ${contatos.email.slice(0, 2).join(', ')}. `;
            }
            if (contatos.site.length > 0) {
                contactInfo += `Site: ${contatos.site[0]}. `;
            }
        }

        // 🎯 PROMPT SUPERINTELIGENTE
        const systemPrompt = `Você é um assistente de vendas SUPERINTELIGENTE com capacidades humanas avançadas.

🧠 CAPACIDADES COGNITIVAS AVANÇADAS:
- Detecção de sarcasmo, ironia e nuances emocionais
- Compreensão de múltiplas intenções em uma única mensagem  
- Memória conversacional de longo prazo
- Adaptação de personalidade conforme contexto
- Respostas empáticas e contextualizadas

🎭 ESTADO EMOCIONAL DETECTADO: ${estadoEmocional.emocaoPrimaria.toUpperCase()} 
${estadoEmocional.emocaoSecundaria ? `+ ${estadoEmocional.emocaoSecundaria.toUpperCase()}` : ''}
${estadoEmocional.sarcasmo ? '🎭 SARCASMO DETECTADO' : ''}
${estadoEmocional.urgencia ? '🚨 URGÊNCIA IDENTIFICADA' : ''}

🎯 JORNADA DO CLIENTE: ${journeyStage.toUpperCase()}

DESCOBERTA: Cliente buscando informações básicas

NEGOCIAÇÃO: Cliente interessado em preços e condições

FIDELIZAÇÃO: Cliente com dúvidas sobre suporte e uso

📊 CONTEXTO DA PÁGINA:

Título: ${pageData.title || 'Não disponível'}

Descrição: ${pageData.description || 'Não disponível'}

${bonusInfo}

${contactInfo}

URL: ${pageData.url || 'Não disponível'}

🧩 INTENÇÕES IDENTIFICADAS: ${estadoEmocional.intencoesMultiplas.join(', ') || 'Nenhuma específica'}

🎨 DIRETRIZES DE RESPOSTA SUPERINTELIGENTE:

Adapte sua personalidade ao estado emocional (${estadoEmocional.emocaoPrimaria})

Responda às ${estadoEmocional.intencoesMultiplas.length} intenções detectadas

Use linguagem natural com elementos conversacionais ("hmm", "veja bem", "então")

Seja genuíno e humano - admita limitações quando necessário

Mantenha coerência com histórico conversacional

Use humor contextual quando apropriado (${estadoEmocional.sarcasmo ? 'especial cuidado com sarcasmo' : 'discreto'})

${estadoEmocional.urgencia ? 'PRIORIDADE MÁXIMA - resposta rápida e direta' : 'Ritmo natural de conversa'}

Instruções personalizadas: ${instructions}

🧠 RESPONDA em português como um humano superinteligente, mostrando:

Empatia contextualizada

Personalidade consistente

Memória de interações

Naturalidade conversacional

Inteligência emocional

NUNCA inclua tags HTML como <s> [OUT] ou qualquer marcação`;

        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            ...conversationHistory,
            { role: "user", content: cleanUserMessage }
        ];

        let response = "";
        let usedProvider = "none";

        // Try Groq first
        if (process.env.GROQ_API_KEY) {
            try {
                response = await callGroq(messages, 0.4, 300);
                usedProvider = "groq";
                logger.info("Groq API call successful");
            } catch (groqError) {
                logger.warn(`Groq failed: ${groqError.message || groqError}`);
            }
        }

        // Try OpenRouter if Groq failed
        if (!response && process.env.OPENROUTER_API_KEY) {
            try {
                response = await callOpenRouter(messages, 0.3, 250);
                usedProvider = "openrouter";
                logger.info("OpenRouter API call successful");
            } catch (openrouterError) {
                logger.warn(`OpenRouter failed: ${openrouterError.message || openrouterError}`);
            }
        }

        // Try OpenAI if others failed
        if (!response && process.env.OPENAI_API_KEY) {
            try {
                response = await callOpenAI(messages, 0.2, 250);
                usedProvider = "openai";
                logger.info("OpenAI API call successful");
            } catch (openaiError) {
                logger.warn(`OpenAI failed: ${openaiError.message || openaiError}`);
            }
        }

        // 🎯 SUPERINTELIGÊNCIA: Aplicar processamento avançado se resposta da IA disponível
        if (response && String(response).trim()) {
            const respostaSuperInteligente = superInteligenciaGlobal.gerarRespostaSuperInteligente(
                cleanUserMessage, 
                estadoEmocional, 
                memoriaUsuario, 
                pageData
            );
            
            // Combinar resposta da IA com superinteligência
            response = combinarRespostas(response, respostaSuperInteligente, estadoEmocional);
        }

        if (!response || !String(response).trim()) {
            response = generateLocalResponse(cleanUserMessage, pageData, instructions, journeyStage);
            usedProvider = "local";
        }

        // 🎯 APRENDIZADO CONTÍNUO
        superInteligenciaGlobal.aprenderDaInteracao(userId, cleanUserMessage, response, {
            engajamento: analisarEngajamento(cleanUserMessage, response)
        });

        // 🎯 CORREÇÃO FINAL: Limpar resposta de qualquer caractere especial
        const finalResponse = String(response).replace(/<s>\s*\[OUT\]/g, '').replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '').trim();
        const responseTime = Date.now() - startTime;
        
        console.log(`🧠 [SUPERINTELIGÊNCIA] Resposta Gerada:`);
        console.log(`   Emoção: ${estadoEmocional.emocaoPrimaria} | Intenções: ${estadoEmocional.intencoesMultiplas.length}`);
        console.log(`   Jornada: ${journeyStage} | Sarcasmo: ${estadoEmocional.sarcasmo}`);
        console.log(`   Usuário: "${cleanUserMessage.substring(0, 50)}..."`);
        console.log(`   Resposta: "${finalResponse.substring(0, 50)}..."`);
        console.log(`   Provedor: ${usedProvider}, Tempo: ${responseTime}ms`);
        
        logger.info(`AI response generated in ${responseTime}ms using ${usedProvider}`);
        return finalResponse;

    } catch (error) {
        logger.error("AI response generation failed:", error.message || error);
        return NOT_FOUND_MSG;
    }
}

// 🎯 NOVA FUNÇÃO: Combinar respostas da IA com superinteligência
function combinarRespostas(respostaIA, respostaSuperInteligente, estadoEmocional) {
    // Se a resposta da IA já é boa, manter com melhorias da superinteligência
    if (respostaIA.length > 50 && !respostaIA.includes('Desculpe')) {
        // Adicionar elementos de naturalidade da superinteligência
        if (estadoEmocional.emocaoPrimaria === 'frustracao') {
            return `Entendo que isso pode ser frustrante. ${respostaIA}`;
        } else if (estadoEmocional.sarcasmo) {
            return `Percebi o tom da sua mensagem 😄 ${respostaIA}`;
        } else if (estadoEmocional.urgencia) {
            return `😊 ${respostaIA}`;
        }
    }

    // Usar resposta superinteligente se a IA falhou
    return respostaSuperInteligente || respostaIA;
}

// 🎯 NOVA FUNÇÃO: Analisar engajamento para aprendizado
function analisarEngajamento(mensagemUsuario, resposta) {
    const mensagemLower = mensagemUsuario.toLowerCase();

    return {
        continuouConversa: !mensagemLower.includes('tchau') && !mensagemLower.includes('obrigado'),
        fezPergunta: mensagemLower.includes('?') || 
                     mensagemLower.includes('como') || 
                     mensagemLower.includes('quando'),
        mostrouSatisfacao: mensagemLower.includes('obrigado') || 
                          mensagemLower.includes('perfeito') ||
                          mensagemLower.includes('ajudou'),
        nivel: calcularNivelEngajamento(mensagemUsuario)
    };
}

function calcularNivelEngajamento(mensagem) {
    let score = 0;
    score += (mensagem.split(' ').length > 5) ? 1 : 0;
    score += (mensagem.includes('?')) ? 1 : 0;
    score += (mensagem.includes('obrigado') || mensagem.includes('valeu')) ? 0.5 : 0;
    return score;
}

function generateLocalResponse(userMessage, pageData = {}, instructions = "", journeyStage = "descoberta") {
    const question = (userMessage || "").toLowerCase();
    const salesMode = shouldActivateSalesMode(instructions);
    const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

    // 🎯 RESPOSTA INTELIGENTE BASEADA NA JORNADA
    if (/bônus|bonus|brinde|presente|extra|grátis/.test(question)) {
        if (pageData.bonuses_detected && pageData.bonuses_detected.length > 0) {
            const bonuses = pageData.bonuses_detected.slice(0, 3).join(", ");
            return `🎁 **${excitementWord.toUpperCase()}!** Encontrei estes bônus para você:\n\n${bonuses}\n\nSão por tempo limitado!`;
        } else {
            return "🔍 Analisei a página cuidadosamente e não identifiquei bônus específicos no momento. Mas você ainda tem acesso a todos os benefícios do produto!";
        }
    }

    if (/preço|valor|quanto custa|investimento/.test(question)) {
        return "💰 Para informações detalhadas sobre preços e condições de pagamento, consulte diretamente a página do produto onde você encontrará todas as opções disponíveis.";
    }

    if (/contato|telefone|whatsapp|email|falar|ligar|ligação/.test(question)) {
        let contactResponse = "📞 **Opções de contato disponíveis:**\n\n";
        
        if (pageData.contatos) {
            const contatos = pageData.contatos;
            
            if (contatos.telefone.length > 0) {
                contactResponse += `📞 **Telefone:** ${contatos.telefone.slice(0, 2).join(' ou ')}\n`;
            }
            if (contatos.whatsapp.length > 0) {
                contactResponse += `💬 **WhatsApp:** ${contatos.whatsapp.slice(0, 2).join(' ou ')}\n`;
            }
            if (contatos.email.length > 0) {
                contactResponse += `📧 **Email:** ${contatos.email.slice(0, 2).join(' ou ')}\n`;
            }
            if (contatos.site.length > 0) {
                contactResponse += `🌐 **Site:** ${contatos.site[0]}\n`;
            }
        } else {
            contactResponse += `🌐 **Site oficial:** ${pageData.url || 'Não disponível'}\n`;
        }
        
        contactResponse += "\nFique à vontade para entrar em contato por qualquer um desses canais!";
        return contactResponse;
    }

    if (/como funciona|funcionamento|o que é/.test(question)) {
        const summary = pageData.summary || pageData.description;
        if (summary) {
            const shortSummary = clampSentences(summary, 2);
            return `${shortSummary} Posso esclarecer mais algum aspecto específico para você?`;
        }
    }

    if (/suporte|atendimento|dúvida|problema|ajuda/.test(question)) {
        return "🛟 Para suporte técnico ou dúvidas específicas sobre o uso, recomendo entrar em contato diretamente com nossa equipe de atendimento que terá prazer em ajudar!";
    }

    if (pageData.summary) {
        const summary = clampSentences(pageData.summary, 2);
        return journeyStage === "negociacao" 
            ? `${summary} Gostaria de saber mais sobre valores e condições?` 
            : summary;
    }

    return NOT_FOUND_MSG;
}

// ===== API Routes =====
app.get("/health", (req, res) => {
    const uptime = process.uptime();
    const avgResponseTime = analytics.responseTimeHistory.length > 0 ?
    Math.round(analytics.responseTimeHistory.reduce((a, b) => a + b, 0) / analytics.responseTimeHistory.length) : 0;

    res.json({
        status: "healthy",
        uptime: Math.floor(uptime),
        timestamp: new Date().toISOString(),
        version: "7.0.0",
        analytics: {
            totalRequests: analytics.totalRequests,
            chatRequests: analytics.chatRequests,
            extractRequests: analytics.extractRequests,
            errors: analytics.errors,
            activeChats: analytics.activeChats.size,
            avgResponseTime,
            successfulExtractions: analytics.successfulExtractions,
            failedExtractions: analytics.failedExtractions,
            cacheSize: dataCache.size,
            leadsCaptured: analytics.leadsCaptured
        },
        services: {
            groq: !!process.env.GROQ_API_KEY,
            openai: !!process.env.OPENAI_API_KEY,
            openrouter: !!process.env.OPENROUTER_API_KEY,
            puppeteer: !!puppeteer,
            superinteligencia: true
        }
    });
});

// ===== ENDPOINT: Captura de Lead =====
// 🛡️ ATUALIZAR: Adicionar proteção CSRF  
app.post("/api/capture-lead", 
    csrfSystem.verifyCSRF,  // NOVA PROTEÇÃO
    requireApiKey, 
    async (req, res) => {
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    try {
        const { nome, email, telefone, url_origem, robotName } = req.body || {};

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: "Email é obrigatório" 
            });
        }

        // Verificar se lead já existe
        const existingLead = leadSystem.findLeadByEmail(email);
        if (existingLead) {
            return res.json({ 
                success: true, 
                lead: existingLead,
                message: "Lead atualizado com sucesso" 
            });
        }

        // Criar novo lead
        const newLead = leadSystem.addLead({
            nome: nome || "Não informado",
            email,
            telefone: telefone || "Não informado",
            url_origem: url_origem || "",
            robotName: robotName || "Assistente IA"
        });

        analytics.leadsCaptured++;
        
        console.log(`🎯 NOVO LEAD CAPTURADO: ${newLead.nome} (${newLead.email})`);

        res.json({ 
            success: true, 
            lead: newLead,
            message: "Lead capturado com sucesso" 
        });

    } catch (error) {
        console.error("❌ Erro ao capturar lead:", error);
        res.status(500).json({ 
            success: false, 
            error: "Erro interno ao capturar lead" 
        });
    }
});

// ===== ENDPOINT: Obter Token JWT para Widget =====
app.post('/api/auth/widget-token', async (req, res) => {
    try {
        const { apiKey, domain } = req.body;

        // Validações básicas
        if (!apiKey || !domain) {
            return res.status(400).json({
                success: false,
                error: 'API Key e domínio são obrigatórios'
            });
        }

        // Validar API Key (usando sistema existente)
        const validation = validateApiKey(apiKey);
        if (!validation.success) {
            return res.status(401).json({
                success: false,
                error: 'API Key inválida'
            });
        }

        // Validar domínio (opcional - para segurança extra)
        const allowedDomains = [
            'localhost', 
            'seusite.com', 
            'linkmagico-comercial.onrender.com',
            'link-m-gico-v6-0-hmpl.onrender.com'
        ];
        const isValidDomain = allowedDomains.some(allowed => domain.includes(allowed));
        
        if (!isValidDomain) {
            return res.status(403).json({
                success: false,
                error: 'Domínio não autorizado'
            });
        }

        // Gerar token JWT
        const token = authSystem.generateWidgetToken(apiKey, domain);

        res.json({
            success: true,
            token: token,
            expiresIn: '15 minutes',
            tokenType: 'Bearer'
        });

    } catch (error) {
        console.error('❌ Erro ao gerar token:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// ===== ENDPOINT CHAT COM CAPTURA DE LEAD =====
// 🛡️ ATUALIZAR: Adicionar proteção CSRF
app.post("/api/chat-universal", 
    csrfSystem.verifyCSRF,  // NOVA PROTEÇÃO
    requireApiKey, 
    async (req, res) => {
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    analytics.chatRequests++;
    try {
        const { message, pageData, url, conversationId, instructions = "", robotName, leadId } = req.body || {};

        if (!message) {
            return res.status(400).json({ 
                success: false, 
                error: "Mensagem é obrigatória" 
            });
        }

        if (conversationId) {
            analytics.activeChats.add(conversationId);
            setTimeout(() => analytics.activeChats.delete(conversationId), 30 * 60 * 1000);
        }

        let processedPageData = pageData;
        if (!processedPageData && url) {
            processedPageData = await extractPageData(url);
        }

        // 🎯 ATUALIZAR CONVERSA DO LEAD SE EXISTIR
        if (leadId) {
            leadSystem.updateLeadConversation(leadId, message, true);
        }

        const aiResponse = await generateAIResponse(message, processedPageData || {}, [], instructions, leadId);

        // 🎯 ATUALIZAR RESPOSTA NO LEAD SE EXISTIR
        if (leadId) {
            leadSystem.updateLeadConversation(leadId, aiResponse, false);
        }

        let finalResponse = aiResponse;

        return res.json({
            success: true,
            response: finalResponse,
            bonuses_detected: processedPageData?.bonuses_detected || [],
            contatos: processedPageData?.contatos || {},
            metadata: {
                hasPageData: !!processedPageData,
                contentLength: processedPageData?.cleanText?.length || 0,
                method: processedPageData?.method || "none"
            }
        });

    } catch (error) {
        analytics.errors++;
        logger.error("Chat endpoint error:", error.message || error);
        return res.status(500).json({ 
            success: false, 
            error: "Erro interno ao gerar resposta: " + (error.message || "Erro desconhecido"),
            details: error.message
        });
    }
});

// ===== 🎯 ENDPOINT SUPERINTELIGENTE - /api/process-chat-inteligente =====
// 🛡️ ATUALIZAR: Adicionar proteção CSRF
app.post("/api/process-chat-inteligente", 
    csrfSystem.verifyCSRF,  // NOVA PROTEÇÃO
    requireApiKey, 
    async (req, res) => {
    const leadSystem = getLeadSystem(req.cliente.apiKey);
    analytics.chatRequests++;
    try {
        const { message, pageData, url, conversationId, instructions = "", robotName, leadId } = req.body || {};

        if (!message) {
            return res.status(400).json({ 
                success: false, 
                error: "Mensagem é obrigatória" 
            });
        }

        console.log('🧠 [SUPER-INTELIGENCIA] Processando mensagem:', { 
            messageLength: message.length,
            url: url || 'none',
            leadId: leadId || 'none'
        });

        if (conversationId) {
            analytics.activeChats.add(conversationId);
            setTimeout(() => analytics.activeChats.delete(conversationId), 30 * 60 * 1000);
        }

        let processedPageData = pageData;
        if (!processedPageData && url) {
            processedPageData = await extractPageData(url);
        }

        // 🎯 SUPERINTELIGÊNCIA: Análise Emocional Avançada
        const analiseEmocional = superInteligencia.analisarEmocao(message);
        
        // 🎯 CAPTURA DE INTENÇÕES DO CLIENTE
        const inteligencias = sistemaInteligencias.capturarInteligencias(message);
        
        // 🎯 ANÁLISE DE JORNADA
        const journeyStage = journeyAnalyzer.analyzeJourneyStage(message);
        
        // 🎯 SELEÇÃO DE PERSONALIDADE ADAPTATIVA
        const personalidade = superInteligencia.selecionarPersonalidade(
            analiseEmocional.emocao, 
            analiseEmocional.intensidade, 
            journeyStage
        );

        // 🎯 ATUALIZAR CONVERSA DO LEAD SE EXISTIR
        if (leadId) {
            leadSystem.updateLeadConversation(leadId, message, true);
            leadSystem.updateLeadJourneyStage(leadId, journeyStage);
        }

        let finalResponse = "";

        // 🎯 DETECTAR AGENDAMENTO
        const respostaAgendamento = superInteligencia.detectarAgendamento(message);
        if (respostaAgendamento) {
            finalResponse = respostaAgendamento;
            console.log("📅 Resposta de agendamento gerada");
        }
        // 🎯 PROCESSAR CONFIRMAÇÃO DE AGENDAMENTO
        else if (superInteligencia.processarAgendamento(message)) {
            finalResponse = superInteligencia.processarAgendamento(message);
            console.log("✅ Confirmação de agendamento processada");
        }
        // 🎯 USAR SISTEMA INTELIGENTE SE INTENÇÕES FORAM DETECTADAS
        else if (Object.values(inteligencias).some(val => val === true)) {
            const contatos = processedPageData?.contatos || {};
            
            // Gerar resposta base com empatia
            const respostaEmpatica = superInteligencia.gerarRespostaEmpatica(
                message, 
                analiseEmocional, 
                personalidade, 
                contatos
            );
            
            // Combinar com resposta contextual
            const respostaContextual = sistemaInteligencias.gerarRespostaContextual(
                inteligencias, 
                contatos, 
                journeyStage
            );
            
            finalResponse = respostaEmpatica + respostaContextual;
            console.log(`🎭 Resposta emocional inteligente gerada`);
        } else {
            // 🎯 USAR SISTEMA ORIGINAL COM MELHORIAS EMOCIONAIS
            const respostaIA = await generateAIResponse(message, processedPageData || {}, [], instructions, leadId);
            
            // Aplicar melhorias emocionais na resposta
            if (analiseEmocional.emocao === "negativo" && analiseEmocional.intensidade >= 2) {
                finalResponse = `🤗 **Entendo que isso é importante para você.** ` + respostaIA;
            } else if (analiseEmocional.urgencia) {
                finalResponse = `🚨 **Priorizando sua solicitação!** ` + respostaIA;
            } else {
                finalResponse = respostaIA;
            }
            
            console.log(`🤖 Resposta IA com melhorias emocionais`);
        }

        // 🎯 ATUALIZAR RESPOSTA NO LEAD SE EXISTIR
        if (leadId) {
            leadSystem.updateLeadConversation(leadId, finalResponse, false);
        }

        return res.json({
            success: true,
            response: finalResponse,
            inteligenciasDetectadas: inteligencias,
            analiseEmocional: analiseEmocional,
            personalidadeSelecionada: personalidade,
            journeyStage: journeyStage,
            bonuses_detected: processedPageData?.bonuses_detected || [],
            contatos: processedPageData?.contatos || {},
            metadata: {
                hasPageData: !!processedPageData,
                contentLength: processedPageData?.cleanText?.length || 0,
                method: processedPageData?.method || "none",
                sistema: "super-inteligencia-v1"
            }
        });

    } catch (error) {
        analytics.errors++;
        logger.error("Super inteligencia endpoint error:", error.message || error);
        return res.status(500).json({ 
            success: false, 
            error: "Erro interno ao gerar resposta inteligente: " + (error.message || "Erro desconhecido"),
            details: error.message
        });
    }
});

// ===== ENDPOINT APRIMORADO DE EXTRAÇÃO =====
app.post("/api/extract-enhanced", 
    csrfSystem.verifyCSRF,  // NOVA PROTEÇÃO
    async (req, res) => {
    analytics.extractRequests++;
    try {
        const { url } = req.body || {};

        console.log("📥 [EXTRACAO APRIMORADA] Recebendo requisição para:", url);
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: "URL é obrigatório" 
            });
        }

        try { 
            new URL(url); 
        } catch (urlErr) { 
            return res.status(400).json({ 
                success: false, 
                error: "URL inválido" 
            }); 
        }

        const extractedData = await sistemaExtracao.extrairDadosCompletos(url);
        
        if (extractedData.erro) {
            return res.status(500).json({ 
                success: false, 
                error: extractedData.erro 
            });
        }

        const validacao = sistemaValidacao.validarDadosCompletos(extractedData);
        
        console.log("✅ [EXTRACAO APRIMORADA] Concluída com sucesso");
        console.log(`🎯 Bônus encontrados: ${validacao.dadosValidados.bonus.length}`);
        console.log(`📞 Contatos encontrados: ${validacao.dadosValidados.contatos ? Object.keys(validacao.dadosValidados.contatos).length : 0}`);
        console.log(`📊 Confiança: ${(validacao.pontuacaoConfianca * 100).toFixed(1)}%`);
        
        return res.json({ 
            success: true, 
            data: validacao.dadosValidados,
            validacao: {
                pontuacaoConfianca: validacao.pontuacaoConfianca,
                problemas: validacao.problemasCriticos,
                totalBonus: validacao.dadosValidados.bonus.length
            }
        });

    } catch (error) {
        analytics.errors++;
        console.error("❌ Erro no endpoint /api/extract-enhanced:", error);
        logger.error("Extract-enhanced endpoint error:", error.message || error);
        
        return res.status(500).json({ 
            success: false, 
            error: "Erro interno ao extrair página: " + (error.message || "Erro desconhecido")
        });
    }
});

// /api/extract endpoint (ORIGINAL - mantido para compatibilidade)
app.post("/api/extract",
    csrfSystem.verifyCSRF,  // NOVA PROTEÇÃO
    async (req, res) => {
    analytics.extractRequests++;
    try {
        const { url, instructions, robotName } = req.body || {};

        console.log("📥 Recebendo requisição para extrair:", url);
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: "URL é obrigatório" 
            });
        }

        try { 
            new URL(url); 
        } catch (urlErr) { 
            return res.status(400).json({ 
                success: false, 
                error: "URL inválido" 
            }); 
        }

        logger.info(`Starting extraction for URL: ${url}`);
        
        const extractedData = await extractPageData(url);
        
        if (instructions) extractedData.custom_instructions = instructions;
        if (robotName) extractedData.robot_name = robotName;

        console.log("✅ Extração concluída com sucesso");
        
        return res.json({ 
            success: true, 
            data: extractedData 
        });

    } catch (error) {
        analytics.errors++;
        console.error("❌ Erro no endpoint /api/extract:", error);
        logger.error("Extract endpoint error:", error.message || error);
        
        return res.status(500).json({ 
            success: false, 
            error: "Erro interno ao extrair página: " + (error.message || "Erro desconhecido"),
            details: error.message
        });
    }
});

// ===== FUNÇÃO: Geração Completa do HTML do Chatbot =====
function generateFullChatbotHTML(pageData = {}, robotName = 'Assistente IA', customInstructions = '') {
    const escapedPageData = JSON.stringify(pageData || {});
    const safeRobotName = String(robotName || 'Assistente IA').replace(/"/g, '&quot;');
    const safeInstructions = String(customInstructions || '').replace(/"/g, '&quot;');

    // Gerar botões fixos com contatos
    const contatos = pageData.contatos || {
        telefone: [],
        whatsapp: [], 
        email: [],
        site: [pageData.url || ''],
        endereco: []
    };

    const botoesFixos = gerarBotoesFixos(contatos, safeRobotName);

    return `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>LinkMágico Chatbot - ${safeRobotName}</title>
    <meta name="description" content="Chatbot IA - ${safeRobotName}"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .chat-container{width:100%;max-width:800px;height:90vh;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15);display:flex;flex-direction:column;overflow:hidden}
        .chat-header{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;padding:20px;text-align:center;position:relative}
        .chat-header h1{font-size:1.5rem;font-weight:600}
        .chat-header .subtitle{font-size:0.9rem;opacity:0.9;margin-top:5px}
        .chat-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:15px;background:#f8fafc}
        .chat-message{max-width:70%;padding:15px;border-radius:15px;font-size:0.95rem;line-height:1.4}
        .chat-message.user{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;align-self:flex-end;border-bottom-right-radius:5px}
        .chat-message.bot{background:#f1f5f9;color:#334155;align-self:flex-start;border-bottom-left-radius:5px}
        .chat-input-container{padding:20px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:10px}
        .chat-input{flex:1;border:1px solid #e2e8f0;border-radius:25px;padding:12px 20px;font-size:0.95rem;outline:none;transition:all 0.3s}
        .chat-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
        .send-button{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);border:none;border-radius:50%;width:50px;height:50px;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.3s}
        .send-button:hover{transform:scale(1.05);box-shadow:0 5px 15px rgba(59,130,246,0.4)}
        .send-button:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .typing-indicator{display:none;align-items:center;gap:5px;color:#64748b;font-size:0.9rem;margin-top:10px}
        .typing-dot{width:8px;height:8px;background:#64748b;border-radius:50%;animation:typing 1.4s infinite}
        .typing-dot:nth-child(2){animation-delay:0.2s}
        .typing-dot:nth-child(3){animation-delay:0.4s}
        @keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        .lead-form{background:white;padding:25px;margin:20px;border-radius:15px;box-shadow:0 8px 25px rgba(0,0,0,0.1);text-align:center}
        .lead-form h3{color:#1e40af;margin-bottom:10px}
        .lead-form p{color:#64748b;margin-bottom:20px}
        .lead-form input{width:100%;padding:15px;margin-bottom:15px;border:2px solid #e2e8f0;border-radius:10px;font-size:1rem;transition:all 0.3s}
        .lead-form input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
        .lead-form button{width:100%;background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;border:none;padding:15px;border-radius:10px;cursor:pointer;font-size:1.1rem;font-weight:600;transition:all 0.3s}
        .lead-form button:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(59,130,246,0.3)}
        .contact-buttons{display:flex;gap:10px;margin-top:15px;flex-wrap:wrap}
        .contact-button{flex:1;min-width:120px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;cursor:pointer;transition:all 0.3s;text-decoration:none;color:#334155;font-size:0.9rem;display:flex;align-items:center;justify-content:center;gap:5px}
        .contact-button:hover{background:#3b82f6;color:white;transform:translateY(-2px)}
        .lm-botoes-fixos a, .lm-botoes-fixos button { font-size: 0.85rem; }
        @media (max-width:768px){.chat-container{height:100vh;border-radius:0}.chat-message{max-width:85%}.lead-form{margin:10px;padding:20px}.contact-button{min-width:100px;font-size:0.8rem}.lm-botoes-fixos{padding:10px !important}.lm-botoes-fixos a, .lm-botoes-fixos button{padding:10px 15px !important;font-size:0.8rem !important}}
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <h1>${safeRobotName}</h1>
            <div class="subtitle">Estou aqui para tirar todas as suas dúvidas</div>
        </div>
        ${botoesFixos}
        <div class="lead-form" id="leadForm">
            <h3>🎯 Vamos começar!</h3>
            <p>Deixe seus dados para uma experiência personalizada</p>
            <input type="text" id="leadName" placeholder="Seu nome completo">
            <input type="email" id="leadEmail" placeholder="Seu melhor email" required>
            <input type="tel" id="leadPhone" placeholder="Seu WhatsApp (opcional)">
            <button id="startChat"><i class="fas fa-comments" style="margin-right:8px"></i> Iniciar Conversa</button>
        </div>
        <div class="chat-messages" id="chatMessages" style="display:none">
            <div class="chat-message bot">Olá! Sou ${safeRobotName}, estou aqui para tirar todas as suas dúvidas. Como posso ajudar você hoje?</div>
        </div>
        <div class="chat-input-container" id="chatInputContainer" style="display:none">
            <input type="text" class="chat-input" id="messageInput" placeholder="Digite sua mensagem..." autocomplete="off">
            <button class="send-button" id="sendButton"><i class="fas fa-paper-plane"></i></button>
        </div>
        <div class="typing-indicator" id="typingIndicator">
            <span>Digitando</span>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    </div>
    <script>
        const pageData = ${escapedPageData};
        const robotName = "${safeRobotName}";
        const customInstructions = "${safeInstructions}";
        const chatMessages = document.getElementById('chatMessages');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const typingIndicator = document.getElementById('typingIndicator');
        const leadForm = document.getElementById('leadForm');
        const chatInputContainer = document.getElementById('chatInputContainer');
        const startChatBtn = document.getElementById('startChat');
        let leadId = null;
        let agendamentoAtivo = false;

        // Função para iniciar agendamento
        function iniciarAgendamento() {
            const mensagem = "Gostaria de agendar uma reunião";
            messageInput.value = mensagem;
            sendMessage();
        }

        // Capturar lead
        startChatBtn.addEventListener('click', async function() {
            const name = document.getElementById('leadName').value.trim();
            const email = document.getElementById('leadEmail').value.trim();
            const phone = document.getElementById('leadPhone').value.trim();
            if (!email) {
                alert('Por favor, informe seu email');
                return;
            }
            try {
                const response = await fetch('/api/capture-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: name || 'Não informado',
                        email: email,
                        telefone: phone || 'Não informado',
                        url_origem: window.location.href,
                        robotName: robotName
                    })
                });
                const data = await response.json();
                if (data.success) {
                    leadId = data.lead.id;
                    leadForm.style.display = 'none';
                    chatMessages.style.display = 'flex';
                    chatInputContainer.style.display = 'flex';
                    addMessage(\`Olá \${name || 'amigo'}! É um prazer ter você aqui. Como posso ajudar você hoje?\`, false);
                    messageInput.focus();
                }
            } catch (error) {
                console.error('Erro ao capturar lead:', error);
                alert('Erro ao processar. Tente novamente.');
            }
        });

        function addMessage(text, isUser = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`chat-message \${isUser ? 'user' : 'bot'}\`;
            messageDiv.textContent = text;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;
            addMessage(message, true);
            messageInput.value = '';
            sendButton.disabled = true;
            typingIndicator.style.display = 'flex';
            try {
                const response = await fetch('/api/process-chat-inteligente', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        pageData: pageData,
                        robotName: robotName,
                        instructions: customInstructions,
                        conversationId: 'chatbot_' + Date.now(),
                        leadId: leadId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    addMessage(data.response, false);
                } else {
                    addMessage('Desculpe, ocorreu um erro. Tente novamente.', false);
                }
            } catch (error) {
                addMessage('Erro de conexão. Verifique sua internet.', false);
            } finally {
                typingIndicator.style.display = 'none';
                sendButton.disabled = false;
                messageInput.focus();
            }
        }

        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Auto-focus no primeiro campo do formulário
        document.getElementById('leadName').focus();
    </script>
</body>
</html>`;
}

function generateChatbotHTML({ robotName, url, instructions }) {
    const escapedRobotName = String(robotName).replace(/"/g, "&quot;");
    const escapedUrl = String(url).replace(/"/g, "&quot;");
    const escapedInstructions = String(instructions).replace(/"/g, "&quot;");

    return `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>LinkMágico Chatbot - ${escapedRobotName}</title>
    <meta name="description" content="Chatbot IA - ${escapedRobotName}"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .chat-container{width:100%;max-width:800px;height:90vh;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15);display:flex;flex-direction:column;overflow:hidden}
        .chat-header{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;padding:20px;text-align:center;position:relative}
        .chat-header h1{font-size:1.5rem;font-weight:600}
        .chat-header .subtitle{font-size:0.9rem;opacity:0.9;margin-top:5px}
        .chat-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:15px;background:#f8fafc}
        .chat-message{max-width:70%;padding:15px;border-radius:15px;font-size:0.95rem;line-height:1.4}
        .chat-message.user{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;align-self:flex-end;border-bottom-right-radius:5px}
        .chat-message.bot{background:#f1f5f9;color:#334155;align-self:flex-start;border-bottom-left-radius:5px}
        .chat-input-container{padding:20px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:10px}
        .chat-input{flex:1;border:1px solid #e2e8f0;border-radius:25px;padding:12px 20px;font-size:0.95rem;outline:none;transition:all 0.3s}
        .chat-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
        .send-button{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);border:none;border-radius:50%;width:50px;height:50px;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.3s}
        .send-button:hover{transform:scale(1.05);box-shadow:0 5px 15px rgba(59,130,246,0.4)}
        .send-button:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .typing-indicator{display:none;align-items:center;gap:5px;color:#64748b;font-size:0.9rem;margin-top:10px}
        .typing-dot{width:8px;height:8px;background:#64748b;border-radius:50%;animation:typing 1.4s infinite}
        .typing-dot:nth-child(2){animation-delay:0.2s}
        .typing-dot:nth-child(3){animation-delay:0.4s}
        @keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
        .status-online{position:absolute;top:15px;right:15px;background:rgba(16,185,129,0.2);color:#10b981;padding:5px 10px;border-radius:15px;font-size:0.75rem;font-weight:600}
        .lead-form{background:white;padding:20px;border-radius:10px;margin:20px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        .lead-form h3{margin-bottom:15px;color:#1e40af}
        .lead-form input{width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.95rem}
        .lead-form button{width:100%;background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600}
        .contact-buttons{display:flex;gap:10px;margin-top:15px;flex-wrap:wrap}
        .contact-button{flex:1;min-width:120px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.3s;text-decoration:none;color:#334155;font-size:0.85rem}
        .contact-button:hover{background:#3b82f6;color:white;transform:translateY(-2px)}
        .contact-button i{margin-right:5px}
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <h1>${escapedRobotName}</h1>
            <div class="subtitle">Estou aqui para tirar todas as suas dúvidas</div>
            <div class="status-online">Online</div>
        </div>
        <div class="lead-form" id="leadForm">
            <h3>🎯 Vamos começar!</h3>
            <p style="margin-bottom:15px;color:#64748b">Deixe seus dados para uma experiência personalizada</p>
            <input type="text" id="leadName" placeholder="Seu nome completo">
            <input type="email" id="leadEmail" placeholder="Seu melhor email" required>
            <input type="tel" id="leadPhone" placeholder="Seu WhatsApp (opcional)">
            <button id="startChat">Iniciar Conversa →</button>
        </div>
        <div class="chat-messages" id="chatMessages" style="display:none">
            <div class="chat-message bot">
                Olá! Sou ${escapedRobotName}, estou aqui para tirar todas as suas dúvidas. Como posso ajudar você hoje?
            </div>
        </div>
        <div class="typing-indicator" id="typingIndicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span>Digitando...</span>
        </div>
        <div class="chat-input-container" id="chatInputContainer" style="display:none">
            <input type="text" class="chat-input" id="chatInput" placeholder="Digite sua pergunta..." maxlength="500">
            <button class="send-button" id="sendButton">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    </div>
    <script>
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const typingIndicator = document.getElementById('typingIndicator');
        const leadForm = document.getElementById('leadForm');
        const chatInputContainer = document.getElementById('chatInputContainer');
        const startChatBtn = document.getElementById('startChat');
        const config = {
            robotName: "${escapedRobotName}",
            url: "${escapedUrl}",
            instructions: "${escapedInstructions}",
            conversationId: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };
        let isTyping = false;
        let leadId = null;

        // Capturar lead
        startChatBtn.addEventListener('click', async function() {
            const name = document.getElementById('leadName').value.trim();
            const email = document.getElementById('leadEmail').value.trim();
            const phone = document.getElementById('leadPhone').value.trim();
            if (!email) {
                alert('Por favor, informe seu email');
                return;
            }
            try {
                const response = await fetch('/api/capture-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: name || 'Não informado',
                        email: email,
                        telefone: phone || 'Não informado',
                        url_origem: window.location.href,
                        robotName: config.robotName
                    })
                });
                const data = await response.json();
                if (data.success) {
                    leadId = data.lead.id;
                    leadForm.style.display = 'none';
                    chatMessages.style.display = 'flex';
                    chatInputContainer.style.display = 'flex';
                    addMessage(\`Olá \${name || 'amigo'}! É um prazer ter você aqui. Como posso ajudar você hoje?\`, false);
                }
            } catch (error) {
                console.error('Erro ao capturar lead:', error);
                alert('Erro ao processar. Tente novamente.');
            }
        });

        function addMessage(content, isUser = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message ' + (isUser ? 'user' : 'bot');
            messageDiv.textContent = content;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function showTyping() {
            isTyping = true;
            typingIndicator.style.display = 'flex';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function hideTyping() {
            isTyping = false;
            typingIndicator.style.display = 'none';
        }

        async function sendMessage() {
            const message = chatInput.value.trim();
            if (!message || isTyping) return;
            addMessage(message, true);
            chatInput.value = '';
            sendButton.disabled = true;
            showTyping();
            try {
                const response = await fetch('/api/chat-universal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        url: config.url,
                        instructions: config.instructions,
                        robotName: config.robotName,
                        conversationId: config.conversationId,
                        leadId: leadId
                    })
                });
                const data = await response.json();
                hideTyping();
                if (data.success) {
                    addMessage(data.response);
                } else {
                    addMessage('Desculpe, ocorreu um erro. Tente novamente em alguns minutos.');
                }
            } catch (error) {
                hideTyping();
                addMessage('Erro de conexão. Verifique sua internet e tente novamente.');
            } finally {
                sendButton.disabled = false;
                chatInput.focus();
            }
        }

        sendButton.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-focus no primeiro campo do formulário
        document.getElementById('leadName').focus();
    </script>
</body>
</html>`;
}

// Widget JS v7.1 - Com Sistema de Autenticação JWT
(function() {
    'use strict';
    if (window.LinkMagicoWidget) return;
    
    var LinkMagicoWidget = {
        config: {
            position: 'bottom-right',
            primaryColor: '#3b82f6',
            robotName: 'Assistente IA',
            salesUrl: '',
            instructions: '',
            apiBase: window.location.origin,
            captureLeads: true,
            apiKey: '', // Nova: API Key para autenticação
            domain: ''  // Nova: Domínio atual
        },
        
        // 🎯 NOVO: Sistema de Autenticação JWT
        auth: {
            token: null,
            tokenExpiry: null,
            
            // Obter token JWT do servidor
            getToken: async function() {
                // Verificar se temos um token válido
                if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                    return this.token;
                }
                
                try {
                    const response = await fetch(this.config.apiBase + '/api/auth/widget-token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            apiKey: this.config.apiKey,
                            domain: this.config.domain
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        this.token = data.token;
                        // Definir expiração (15 minutos - 900 segundos)
                        this.tokenExpiry = Date.now() + (14 * 60 * 1000); // 14 minutos para segurança
                        return this.token;
                    } else {
                        console.error('Erro ao obter token:', data.error);
                        throw new Error(data.error || 'Falha na autenticação');
                    }
                } catch (error) {
                    console.error('Erro de autenticação:', error);
                    throw error;
                }
            },
            
            // Fazer requisição autenticada
            authenticatedRequest: async function(url, options = {}) {
                try {
                    const token = await this.getToken();
                    
                    const authOptions = {
                        ...options,
                        headers: {
                            ...options.headers,
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        }
                    };
                    
                    const response = await fetch(url, authOptions);
                    
                    // Se token expirou, tentar renovar uma vez
                    if (response.status === 403) {
                        this.token = null; // Forçar renovação do token
                        const newToken = await this.getToken();
                        
                        authOptions.headers['Authorization'] = 'Bearer ' + newToken;
                        return await fetch(url, authOptions);
                    }
                    
                    return response;
                } catch (error) {
                    console.error('Erro na requisição autenticada:', error);
                    throw error;
                }
            }
        },

        getApiKeyFromQuery: function(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        },

        getStoredApiKey: function() {
            return localStorage.getItem("lm_api_key");
        },

        storeApiKey: function(apiKey) {
            localStorage.setItem("lm_api_key", apiKey);
        },

        init: function(userConfig) {
            this.config = Object.assign(this.config, userConfig || {});
            
            // 🎯 NOVO: Configurar domínio automaticamente
            this.config.domain = window.location.hostname;
            
            // 🎯 NOVO: Tentar obter API Key de várias fontes
            if (!this.config.apiKey) {
                this.config.apiKey = this.getApiKeyFromQuery('apiKey') || 
                                   this.getStoredApiKey() || 
                                   this.getApiKeyFromQuery('lm_api_key');
            }
            
            if (!this.config.apiKey) {
                console.warn('⚠️ LinkMágico Widget: API Key não encontrada. Configure a apiKey no init() ou via parâmetro URL ?apiKey=SUA_CHAVE');
                return;
            }
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', this.createWidget.bind(this));
            } else {
                this.createWidget();
            }
        },
        
        createWidget: function() {
            var container = document.createElement('div');
            container.id = 'linkmagico-widget';
            container.innerHTML = this.getHTML();
            this.addStyles();
            document.body.appendChild(container);
            this.bindEvents();
            
            this.leadId = this.getStoredLeadId();
            
            // 🎯 NOVO: Testar autenticação ao inicializar
            this.testAuthentication();
        },
        
        // 🎯 NOVA FUNÇÃO: Testar autenticação
        testAuthentication: async function() {
            try {
                await this.auth.getToken();
                console.log('✅ LinkMágico Widget: Autenticado com sucesso');
            } catch (error) {
                console.error('❌ LinkMágico Widget: Falha na autenticação', error);
                // Opcional: Mostrar erro para o usuário
                this.showAuthError();
            }
        },
        
        // 🎯 NOVA FUNÇÃO: Mostrar erro de autenticação
        showAuthError: function() {
            const widget = document.getElementById('linkmagico-widget');
            if (widget) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#ef4444; color:white; padding:10px; border-radius:5px; z-index:1000000; font-size:12px; max-width:300px;';
                errorDiv.innerHTML = '⚠️ Erro de autenticação. Verifique sua API Key.';
                document.body.appendChild(errorDiv);
                
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.parentNode.removeChild(errorDiv);
                    }
                }, 5000);
            }
        },
        
        getHTML: function() {
            return '<div class="lm-button" id="lm-button"><i class="fas fa-comments"></i></div>' +
            '<div class="lm-chat" id="lm-chat" style="display:none;">' +
            '<div class="lm-header"><span>' + this.config.robotName + '</span><button id="lm-close">×</button></div>' +
            '<div class="lm-messages" id="lm-messages">' +
            '<div class="lm-msg lm-bot">Olá! Sou ' + this.config.robotName + ', estou aqui para tirar todas as suas dúvidas. Como posso ajudar você hoje?</div></div>' +
            '<div class="lm-lead-form" id="lm-lead-form" style="display:none;">' +
            '<div class="lm-form-title">Antes de começarmos...</div>' +
            '<input type="text" id="lm-lead-name" placeholder="Seu nome" class="lm-form-input">' +
            '<input type="email" id="lm-lead-email" placeholder="Seu melhor email" class="lm-form-input" required>' +
            '<input type="tel" id="lm-lead-phone" placeholder="Seu WhatsApp" class="lm-form-input">' +
            '<button id="lm-lead-submit" class="lm-form-submit">Começar Conversa</button>' +
            '</div>' +
            '<div class="lm-input"><input id="lm-input" placeholder="Digite..."><button id="lm-send">➤</button></div></div>';
        },
        
        addStyles: function() {
            if (document.getElementById('lm-styles')) return;
            var css = '#linkmagico-widget{position:fixed;right:20px;bottom:20px;z-index:999999;font-family:sans-serif}' +
            '.lm-button{width:60px;height:60px;background:' + this.config.primaryColor + ';border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:1.8em;cursor:pointer;box-shadow:0 4px 8px rgba(0,0,0,0.2);transition:all 0.3s ease}' +
            '.lm-button:hover{transform:scale(1.1)}' +
            '.lm-chat{position:fixed;right:20px;bottom:90px;width:350px;height:500px;background:white;border-radius:10px;box-shadow:0 8px 16px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden}' +
            '.lm-header{background:' + this.config.primaryColor + ';color:white;padding:10px;display:flex;justify-content:space-between;align-items:center;font-weight:bold}' +
            '.lm-header button{background:none;border:none;color:white;font-size:1.2em;cursor:pointer}' +
            '.lm-messages{flex:1;padding:10px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}' +
            '.lm-msg{padding:8px 12px;border-radius:15px;max-width:80%}' +
            '.lm-bot{background:#e0e0e0;align-self:flex-start}' +
            '.lm-user{background:' + this.config.primaryColor + ';color:white;align-self:flex-end}' +
            '.lm-input{display:flex;padding:10px;border-top:1px solid #eee}' +
            '.lm-input input{flex:1;border:1px solid #ddd;border-radius:20px;padding:8px 12px;outline:none}' +
            '.lm-input button{background:' + this.config.primaryColor + ';border:none;color:white;border-radius:50%;width:35px;height:35px;margin-left:10px;cursor:pointer}' +
            '.lm-lead-form{padding:15px;border-bottom:1px solid #eee}' +
            '.lm-form-title{font-weight:bold;margin-bottom:10px;color:#333}' +
            '.lm-form-input{width:100%;padding:8px;margin-bottom:8px;border:1px solid #ddd;border-radius:5px;font-size:0.9em}' +
            '.lm-form-submit{width:100%;background:' + this.config.primaryColor + ';color:white;border:none;padding:10px;border-radius:5px;cursor:pointer}' +
            '@media (max-width: 480px){.lm-chat{width:90%;height:80%;right:5%;bottom:5%}}';
            var styleSheet = document.createElement('style');
            styleSheet.id = 'lm-styles';
            styleSheet.type = 'text/css';
            styleSheet.innerText = css;
            document.head.appendChild(styleSheet);
        },
        
        bindEvents: function() {
            var button = document.getElementById('lm-button');
            var chat = document.getElementById('lm-chat');
            var close = document.getElementById('lm-close');
            var send = document.getElementById('lm-send');
            var input = document.getElementById('lm-input');
            var messages = document.getElementById('lm-messages');
            var leadForm = document.getElementById('lm-lead-form');
            var leadSubmit = document.getElementById('lm-lead-submit');

            button.addEventListener('click', function() {
                chat.style.display = chat.style.display === 'none' ? 'flex' : 'none';
                if (this.config.captureLeads && !this.leadId) {
                    leadForm.style.display = 'block';
                    input.style.display = 'none';
                    send.style.display = 'none';
                }
            }.bind(this));

            close.addEventListener('click', function() {
                chat.style.display = 'none';
            });

            leadSubmit.addEventListener('click', this.captureLead.bind(this));

            send.addEventListener('click', this.sendMessage.bind(this));
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            }.bind(this));
        },

        captureLead: async function() {
            var name = document.getElementById('lm-lead-name').value.trim();
            var email = document.getElementById('lm-lead-email').value.trim();
            var phone = document.getElementById('lm-lead-phone').value.trim();

            if (!email) {
                alert('Por favor, informe seu email');
                return;
            }

            try {
                // 🎯 ATUALIZADO: Usar requisição autenticada
                const response = await this.auth.authenticatedRequest(
                    this.config.apiBase + '/api/capture-lead',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            nome: name || 'Não informado',
                            email: email,
                            telefone: phone || 'Não informado',
                            url_origem: window.location.href,
                            robotName: this.config.robotName
                        })
                    }
                );

                const data = await response.json();

                if (data.success) {
                    this.leadId = data.lead.id;
                    this.storeLeadId(this.leadId);
                    
                    document.getElementById('lm-lead-form').style.display = 'none';
                    document.getElementById('lm-input').style.display = 'block';
                    document.getElementById('lm-send').style.display = 'block';
                    
                    var welcomeMsg = document.createElement('div');
                    welcomeMsg.className = 'lm-msg lm-bot';
                    welcomeMsg.textContent = 'Obrigado, ' + (name || 'amigo') + '! Como posso ajudar você hoje?';
                    document.getElementById('lm-messages').appendChild(welcomeMsg);
                }
            } catch (error) {
                console.error('Erro ao capturar lead:', error);
                alert('Erro ao processar. Tente novamente.');
            }
        },

        getStoredLeadId: function() {
            return localStorage.getItem('lm_lead_id');
        },

        storeLeadId: function(leadId) {
            localStorage.setItem('lm_lead_id', leadId);
        },

        sendMessage: async function() {
            var input = document.getElementById('lm-input');
            var messages = document.getElementById('lm-messages');
            var message = input.value.trim();
            if (!message) return;

            var userMsg = document.createElement('div');
            userMsg.className = 'lm-msg lm-user';
            userMsg.textContent = message;
            messages.appendChild(userMsg);
            input.value = '';
            messages.scrollTop = messages.scrollHeight;

            try {
                // 🎯 ATUALIZADO: Usar requisição autenticada
                const response = await this.auth.authenticatedRequest(
                    this.config.apiBase + '/api/chat-universal',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            message: message,
                            url: this.config.salesUrl,
                            instructions: this.config.instructions,
                            robotName: this.config.robotName,
                            conversationId: this.config.conversationId,
                            leadId: this.leadId
                        })
                    }
                );
                
                const data = await response.json();

                var botMsg = document.createElement('div');
                botMsg.className = 'lm-msg lm-bot';
                botMsg.textContent = data.response || 'Desculpe, ocorreu um erro.';
                messages.appendChild(botMsg);
                messages.scrollTop = messages.scrollHeight;

            } catch (error) {
                console.error('Widget chat error:', error);
                var errorMsg = document.createElement('div');
                errorMsg.className = 'lm-msg lm-bot';
                errorMsg.textContent = 'Erro de conexão. Tente novamente.';
                messages.appendChild(errorMsg);
                messages.scrollTop = messages.scrollHeight;
            }
        }
    };

    window.LinkMagicoWidget = LinkMagicoWidget;
    if (window.LinkMagicoWidgetConfig) {
        window.LinkMagicoWidget.init(window.LinkMagicoWidgetConfig);
    }
})();`);

// ===== CONFIGURAR NOVAS ROTAS =====
setupRoutes(app);

// ===== INICIALIZAR SISTEMAS =====
(async () => {
    await initialize();

    // Iniciar servidor
    const PORT = process.env.PORT || 3000; // Render usa a variável de ambiente PORT

    // ===== ROTAS DAS NOVAS INTEGRAÇÕES V3.0 =====

    // Gmail Integration
    app.post('/api/gmail/send', async (req, res) => {
        try {
            const { to, subject, html, text } = req.body;
            const result = await gmailManager.sendEmail({ to, subject, html, text });
            res.json({ success: true, result });
        } catch (error) {
            logger.error('Erro ao enviar email:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/gmail/status', (req, res) => {
        const status = gmailManager.getStatus();
        res.json(status);
    });

    // WhatsApp Integration
    app.post('/api/whatsapp/send', async (req, res) => {
        try {
            const { to, message } = req.body;
            const result = await whatsappManager.sendMessage(to, message);
            res.json({ success: true, result });
        } catch (error) {
            logger.error('Erro ao enviar WhatsApp:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/whatsapp/status', (req, res) => {
        const status = whatsappManager.getStatus();
        res.json(status);
    });

    // ChatGPT Integration
    app.post('/api/chatgpt/generate', async (req, res) => {
        try {
            const { prompt, model, pageContent } = req.body;
            const result = await chatgptManager.generateResponse(prompt, pageContent, model);
            res.json({ success: true, result });
        } catch (error) {
            logger.error('Erro ao gerar resposta ChatGPT:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/chatgpt/status', (req, res) => {
        const status = chatgptManager.getStatus();
        res.json(status);
    });

    app.get('/api/chatgpt/models', (req, res) => {
        const models = chatgptManager.getAvailableModels();
        res.json(models);
    });

    // Whitelabel System
    app.post('/api/whitelabel/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const config = req.body;
            await whitelabelManager.saveConfig(chatbotId, config);
            res.json({ success: true, config });
        } catch (error) {
            logger.error('Erro ao salvar config whitelabel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/whitelabel/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const config = await whitelabelManager.getConfig(chatbotId);
            res.json({ success: true, config });
        } catch (error) {
            logger.error('Erro ao buscar config whitelabel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Structured Leads
    app.post('/api/leads/structured', async (req, res) => {
        try {
            const { chatbotId, leadData, metadata } = req.body;
            const lead = await structuredLeadsManager.saveLead(chatbotId, leadData, metadata);

            // Enviar notificações
            if (process.env.GMAIL_USER) {
                await gmailManager.sendLeadNotification(lead);
            }
            if (process.env.WHATSAPP_PROVIDER) {
                await whatsappManager.sendLeadNotification(lead);
            }
            
            res.json({ success: true, lead });
        } catch (error) {
            logger.error('Erro ao salvar lead estruturado:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/leads/structured/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { status, limit, offset } = req.query;
            const leads = await structuredLeadsManager.getLeads(chatbotId, { status, limit, offset });
            res.json({ success: true, leads });
        } catch (error) {
            logger.error('Erro ao buscar leads:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/leads/export/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const csv = await structuredLeadsManager.exportToCSV(chatbotId);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="leads-' + chatbotId + '.csv"');
            res.send(csv);
        } catch (error) {
            logger.error('Erro ao exportar leads:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/leads/stats/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const stats = await structuredLeadsManager.getStats(chatbotId);
            res.json({ success: true, stats });
        } catch (error) {
            logger.error('Erro ao buscar estatísticas:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // CRM Integrations (documentação)
    app.get('/api/crm/templates', (req, res) => {
        const templates = crmIntegrations.getAllTemplates();
        res.json({ success: true, templates });
    });

    app.get('/api/crm/templates/:crm', (req, res) => {
        const { crm } = req.params;
        const template = crmIntegrations.getTemplate(crm);
        if (template) {
            res.json({ success: true, template });
        } else {
            res.status(404).json({ success: false, error: 'CRM não encontrado' });
        }
    });

 console.log('✅ Rotas V3.0 configuradas');

app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server running on port ' + PORT);

    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`Dashboard: http://0.0.0.0:${PORT}/api/system/status`);
    console.log(`LinkMágico v7.0 SUPERINTELIGENTE running on http://0.0.0.0:${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`Chatbot disponível em: http://0.0.0.0:${PORT}/chatbot`);
    console.log(`Widget JS disponível em: http://0.0.0.0:${PORT}/public/widget.js`);
    console.log('Sistema de captura de leads PERSISTENTE ATIVADO');
    console.log(`Painel de leads: http://0.0.0.0:${PORT}/admin/leads`);
    console.log('Extração de contatos: ATIVADA');
    console.log('SUPERINTELIGÊNCIA CONVERSACIONAL: ATIVADA');
    console.log('Detecção de sarcasmo e ironia: IMPLEMENTADA');
    console.log('Análise de múltiplas intenções: FUNCIONANDO');
    console.log('Memória conversacional avançada: OPERACIONAL');
    console.log('Personalidades adaptativas: CONSULTIVO, EMPÁTICO, TÉCNICO, MOTIVACIONAL');
    console.log('Detecção de urgência: ATIVADA');
    console.log('Sistema de agendamento: IMPLEMENTADO');
    console.log('Botões fixos no topo: FUNCIONANDO');
    console.log('Jornada do cliente: Análise inteligente ATIVADA');
    console.log('Endpoint superinteligente: /api/process-chat-inteligente');
    console.log('SISTEMA SUPERINTELIGENTE IMPLANTADO COM SUCESSO!');
});
