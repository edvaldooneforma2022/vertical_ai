/**
 * 🧠 SISTEMA DE SUPERINTELIGÊNCIA EMOCIONAL - Link Mágico V8.0
 * 
 * Módulo extraído da refatoração Fase 5.
 * Sistema de análise emocional e personalidade adaptativa:
 * - Detecção de emoções e urgência
 * - Personalidades adaptativas
 * - Sistema de agendamento inteligente
 */

// ===== DEPENDÊNCIAS V8.0 (OPCIONAL) =====
let featureFlags = null;
let enhancedSentiment = null;

try {
    const ffModule = require('../feature-flags');
    featureFlags = ffModule.featureFlags;
} catch (e) {
    // Feature flags não disponível - funciona sem
}

try {
    const esModule = require('../enhanced-sentiment');
    enhancedSentiment = esModule.enhancedSentiment;
} catch (e) {
    // Enhanced sentiment não disponível - funciona sem
}

// ===== CLASSE PRINCIPAL =====

class SuperInteligenciaEmocional {
    /**
     * @param {Object} deps - Dependências injetadas
     * @param {Object} deps.journeyAnalyzer - Analisador de jornada (opcional)
     */
    constructor(deps = {}) {
        console.log("🧠 Sistema de SuperInteligência Emocional Inicializado");

        // Dependência injetada
        this.journeyAnalyzer = deps.journeyAnalyzer || null;

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
        // ===== V8.0: ENHANCED SENTIMENT COM FEATURE FLAG =====
        if (featureFlags && featureFlags.isEnabled('FEATURE_ENHANCED_SENTIMENT')) {
            try {
                if (enhancedSentiment && enhancedSentiment.enabled) {
                    const enhanced = enhancedSentiment.analyze(mensagem);
                    // Usar resultado aprimorado se confiança > 0.5
                    if (enhanced.confianca > 0.5) {
                        console.log(`🎭 [V8.0] Análise Emocional Aprimorada: ${enhanced.emocao} (confiança: ${enhanced.confianca}) ${enhanced.urgencia ? '🚨 URGENTE' : ''}`);
                        return {
                            emocao: enhanced.emocao,
                            intensidade: enhanced.intensidade,
                            urgencia: enhanced.urgencia,
                            // Dados extras do V8.0
                            intencoes: enhanced.intencoes,
                            scores: enhanced.scores,
                            confianca: enhanced.confianca,
                            v8Enhanced: true
                        };
                    }
                    // Se confiança baixa, continua para análise básica
                    console.log(`🎭 [V8.0] Confiança baixa (${enhanced.confianca}), usando análise básica`);
                }
            } catch (err) {
                console.warn('⚠️ [V8.0] Erro no enhanced sentiment, usando fallback:', err.message);
            }
        }

        // ===== FALLBACK: ANÁLISE V7.0 ORIGINAL =====
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

        // Usar journeyAnalyzer se disponível
        const excitementWord = this.journeyAnalyzer
            ? this.journeyAnalyzer.getRandomSynonym('empolgação')
            : 'incrível';

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

                const horarioSelecionado = this.horariosDisponiveis[i];
                const mensagemConfirmacao = `✅ **AGENDAMENTO CONFIRMADO!**\n\n` +
                    `📅 **Horário:** ${horarioSelecionado}\n` +
                    `🎯 **Próximo passo:** Nossa equipe entrará em contato para confirmar.\n` +
                    `📞 **Contato direto:** Veja nossos canais acima! ⬆️`;

                // Retornar objeto estruturado para persistência
                return {
                    confirmed: true,
                    datetime: horarioSelecionado,
                    message: mensagemConfirmacao
                };
            }
        }

        return null;
    }
}

// Inicializar SuperInteligência
const superInteligencia = new SuperInteligenciaEmocional();

// ===== EXPORTS =====
module.exports = {
    SuperInteligenciaEmocional,
    superInteligencia
};
