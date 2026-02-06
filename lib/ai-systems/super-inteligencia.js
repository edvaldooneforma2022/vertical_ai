/**
 * 🧠 SUPERINTELIGÊNCIA CONVERSACIONAL - Link Mágico V8.0
 * 
 * Módulo extraído da refatoração Fase 5.
 * Sistema avançado de IA conversacional com:
 * - Detecção de emoções complexas
 * - Memória conversacional
 * - Personalidades adaptativas
 * - Aprendizado contínuo
 */

// ===== DEPENDÊNCIAS V8.0 (OPCIONAL) =====
let featureFlags = null;
let persistentMemory = null;

try {
    const ffModule = require('../feature-flags');
    featureFlags = ffModule.featureFlags;
} catch (e) {
    // Feature flags não disponível - funciona sem
}

try {
    const pmModule = require('../persistent-memory');
    persistentMemory = pmModule.persistentMemory;
} catch (e) {
    // Persistent memory não disponível - funciona sem
}

// ===== SISTEMA DE SUPERINTELIGÊNCIA CONVERSACIONAL AVANÇADA =====
class SuperInteligenciaConversacional {
    constructor() {
        console.log("🧠 SUPERINTELIGÊNCIA CONVERSACIONAL - Inicializando Sistema Avançado");

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
    atualizarMemoriaUsuario(userId, interacao, tenantId = null) {
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

        // ===== V8.0: PERSISTÊNCIA NO BANCO COM FEATURE FLAG =====
        if (featureFlags && featureFlags.isEnabled('FEATURE_PERSISTENT_MEMORY')) {
            try {
                if (persistentMemory) {
                    // Fire-and-forget para não bloquear
                    persistentMemory.update(userId, {
                        mensagem: interacao.mensagem,
                        emocao: interacao.emocao,
                        intencoes: interacao.intencoes,
                        preferencias: memoria.preferencias,
                        topicos: interacao.topicos || []
                    }, tenantId).catch(err => {
                        console.warn('⚠️ [V8.0] Erro ao persistir memória:', err.message);
                    });
                    console.log(`🧠 [V8.0] Memória persistida para usuário ${userId.substring(0, 8)}...`);
                }
            } catch (err) {
                console.warn('⚠️ [V8.0] Erro ao salvar memória persistente:', err.message);
                // Não propaga erro - Map local já tem os dados
            }
        }
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

// ===== EXPORTS =====
module.exports = {
    SuperInteligenciaConversacional,
    superInteligenciaGlobal
};
