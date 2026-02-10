/**
 * 🎭 ANÁLISE DE SENTIMENTO AVANÇADA - Link Mágico V8.0
 * 
 * Melhora a análise emocional com:
 * - Detecção de negações ("não estou feliz" → negativo)
 * - Intensificadores ("muito", "extremamente")
 * - Contexto de frases anteriores
 * - Score de confiança
 * 
 * SEGURANÇA:
 * - Feature flag controlável
 * - Fallback para análise básica (V7.0)
 * - Não altera comportamento existente se desabilitado
 * 
 * @version 1.0.0
 */

class EnhancedSentimentAnalyzer {
    constructor() {
        this.enabled = false;

        // Vocabulário emocional expandido
        this.vocabulary = {
            // Emoções positivas com peso
            positivas: {
                // Alta intensidade (peso 3)
                'extraordinário': 3, 'incrível': 3, 'fantástico': 3, 'maravilhoso': 3,
                'excelente': 3, 'perfeito': 3, 'espetacular': 3, 'sensacional': 3,
                'adorei': 3, 'amei': 3, 'apaixonado': 3,

                // Média intensidade (peso 2)
                'ótimo': 2, 'muito bom': 2, 'gostei': 2, 'satisfeito': 2,
                'feliz': 2, 'contente': 2, 'animado': 2, 'empolgado': 2,
                'legal': 2, 'bacana': 2, 'top': 2, 'show': 2,

                // Baixa intensidade (peso 1)
                'bom': 1, 'ok': 1, 'tranquilo': 1, 'interessante': 1,
                'obrigado': 1, 'agradeço': 1, 'valeu': 1
            },

            // Emoções negativas com peso
            negativas: {
                // Alta intensidade (peso 3)
                'péssimo': 3, 'horrível': 3, 'terrível': 3, 'detestei': 3,
                'odiei': 3, 'raiva': 3, 'furioso': 3, 'indignado': 3,
                'desastre': 3, 'absurdo': 3, 'vergonha': 3,

                // Média intensidade (peso 2)
                'ruim': 2, 'chateado': 2, 'frustrado': 2, 'irritado': 2,
                'decepcionado': 2, 'insatisfeito': 2, 'nervoso': 2,
                'triste': 2, 'preocupado': 2, 'ansioso': 2,

                // Baixa intensidade (peso 1)
                'não gostei': 1, 'difícil': 1, 'complicado': 1, 'confuso': 1,
                'lento': 1, 'demorado': 1, 'problema': 1
            },

            // Urgência
            urgencia: {
                'urgente': 3, 'urgência': 3, 'emergência': 3, 'imediato': 3,
                'agora': 2, 'rápido': 2, 'hoje': 2, 'já': 2,
                'importante': 1, 'prioridade': 1, 'preciso': 1
            },

            // Intenções
            intencoes: {
                compra: ['comprar', 'adquirir', 'contratar', 'assinar', 'pagar', 'preço', 'valor', 'custo', 'investir'],
                duvida: ['como', 'qual', 'quanto', 'onde', 'quando', 'por que', 'porque', 'não entendi', 'dúvida', 'explicar'],
                reclamacao: ['reclamar', 'problema', 'erro', 'bug', 'não funciona', 'quebrado', 'devolver', 'reembolso'],
                elogio: ['parabéns', 'excelente', 'obrigado', 'agradeço', 'recomendo', 'nota 10'],
                ajuda: ['ajuda', 'ajudar', 'socorro', 'preciso', 'suporte', 'atendimento']
            }
        };

        // Negadores
        this.negadores = ['não', 'nao', 'nem', 'nunca', 'jamais', 'nenhum', 'nada', 'zero'];

        // Intensificadores
        this.intensificadores = {
            aumentadores: {
                'muito': 1.5, 'demais': 1.5, 'extremamente': 2, 'super': 1.5,
                'totalmente': 1.5, 'completamente': 1.5, 'absolutamente': 1.8,
                'realmente': 1.3, 'verdadeiramente': 1.3
            },
            diminuidores: {
                'pouco': 0.5, 'um pouco': 0.5, 'levemente': 0.6, 'ligeiramente': 0.6,
                'meio': 0.7, 'quase': 0.7, 'mais ou menos': 0.5
            }
        };

        console.log('🎭 Análise de Sentimento Avançada inicializando...');
    }

    /**
     * Inicializa o analisador
     */
    async initialize() {
        try {
            let featureFlags;
            try {
                featureFlags = require('./feature-flags').featureFlags;
                this.enabled = featureFlags.isEnabled('FEATURE_ENHANCED_SENTIMENT');
            } catch (e) {
                this.enabled = process.env.FEATURE_ENHANCED_SENTIMENT === 'true';
            }

            if (!this.enabled) {
                console.log('🎭 Análise de Sentimento Avançada desabilitada');
                return;
            }

            console.log('✅ Análise de Sentimento Avançada habilitada');

        } catch (error) {
            console.error('⚠️ Erro ao inicializar Análise de Sentimento:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Analisa sentimento de uma mensagem
     * 
     * @param {string} mensagem - Texto a analisar
     * @param {Object} [contexto] - Contexto adicional (histórico, etc)
     * @returns {Object} Resultado da análise
     */
    analyze(mensagem, contexto = {}) {
        if (!mensagem || typeof mensagem !== 'string') {
            return this._createEmptyResult();
        }

        const texto = mensagem.toLowerCase().trim();
        const palavras = texto.split(/\s+/);

        // Análise básica
        let scorePositivo = 0;
        let scoreNegativo = 0;
        let scoreUrgencia = 0;
        let intensidadeGlobal = 1;
        let negacaoAtiva = false;

        // Detectar intensificadores globais
        for (const [intensificador, multiplicador] of Object.entries(this.intensificadores.aumentadores)) {
            if (texto.includes(intensificador)) {
                intensidadeGlobal = Math.max(intensidadeGlobal, multiplicador);
            }
        }
        for (const [diminuidor, multiplicador] of Object.entries(this.intensificadores.diminuidores)) {
            if (texto.includes(diminuidor)) {
                intensidadeGlobal = Math.min(intensidadeGlobal, multiplicador);
            }
        }

        // Analisar palavra por palavra com contexto de negação
        for (let i = 0; i < palavras.length; i++) {
            const palavra = palavras[i];
            const palavraAnterior = i > 0 ? palavras[i - 1] : '';

            // Detectar negação
            if (this.negadores.includes(palavra)) {
                negacaoAtiva = true;
                continue;
            }

            // Verificar se palavra anterior era negação
            const temNegacao = negacaoAtiva || this.negadores.includes(palavraAnterior);

            // Verificar emoções positivas
            for (const [termo, peso] of Object.entries(this.vocabulary.positivas)) {
                if (texto.includes(termo)) {
                    if (temNegacao) {
                        // "NÃO estou feliz" = negativo
                        scoreNegativo += peso;
                    } else {
                        scorePositivo += peso;
                    }
                }
            }

            // Verificar emoções negativas
            for (const [termo, peso] of Object.entries(this.vocabulary.negativas)) {
                if (texto.includes(termo)) {
                    if (temNegacao) {
                        // "NÃO estou triste" = menos negativo (mas não positivo)
                        scoreNegativo += peso * 0.3;
                    } else {
                        scoreNegativo += peso;
                    }
                }
            }

            // Verificar urgência
            for (const [termo, peso] of Object.entries(this.vocabulary.urgencia)) {
                if (texto.includes(termo)) {
                    scoreUrgencia += peso;
                }
            }

            // Resetar negação após processar palavra emocional
            negacaoAtiva = false;
        }

        // Aplicar intensidade global
        scorePositivo *= intensidadeGlobal;
        scoreNegativo *= intensidadeGlobal;

        // Detectar intenções
        const intencoes = this._detectarIntencoes(texto);

        // Calcular resultado final
        const scoreFinal = scorePositivo - scoreNegativo;
        const intensidadeFinal = Math.min(3, Math.round((scorePositivo + scoreNegativo) / 2));

        let emocao = 'neutro';
        if (scoreFinal > 1) emocao = 'positivo';
        else if (scoreFinal < -1) emocao = 'negativo';

        // Calcular confiança
        const totalScore = scorePositivo + scoreNegativo;
        const confianca = Math.min(1, totalScore / 5);

        return {
            emocao,
            emocaoPrimaria: emocao,
            intensidade: intensidadeFinal,
            urgencia: scoreUrgencia > 0,
            nivelUrgencia: Math.min(3, scoreUrgencia),
            scores: {
                positivo: Math.round(scorePositivo * 100) / 100,
                negativo: Math.round(scoreNegativo * 100) / 100,
                urgencia: scoreUrgencia,
                final: Math.round(scoreFinal * 100) / 100
            },
            intencoes,
            intencoesMultiplas: intencoes,
            confianca: Math.round(confianca * 100) / 100,
            detalhes: {
                temNegacao: texto.split(' ').some(p => this.negadores.includes(p)),
                intensificadorDetectado: intensidadeGlobal !== 1,
                multiplicadorIntensidade: intensidadeGlobal
            }
        };
    }

    /**
     * Detecta intenções na mensagem
     */
    _detectarIntencoes(texto) {
        const intencoesDetectadas = [];

        for (const [tipo, termos] of Object.entries(this.vocabulary.intencoes)) {
            for (const termo of termos) {
                if (texto.includes(termo)) {
                    if (!intencoesDetectadas.includes(tipo)) {
                        intencoesDetectadas.push(tipo);
                    }
                    break;
                }
            }
        }

        return intencoesDetectadas;
    }

    /**
     * Cria resultado vazio
     */
    _createEmptyResult() {
        return {
            emocao: 'neutro',
            emocaoPrimaria: 'neutro',
            intensidade: 0,
            urgencia: false,
            nivelUrgencia: 0,
            scores: { positivo: 0, negativo: 0, urgencia: 0, final: 0 },
            intencoes: [],
            intencoesMultiplas: [],
            confianca: 0,
            detalhes: {}
        };
    }

    /**
     * Analisa com contexto de conversa anterior
     * 
     * @param {string} mensagem - Mensagem atual
     * @param {Array} historico - Histórico de mensagens anteriores
     * @returns {Object} Resultado com contexto
     */
    analyzeWithContext(mensagem, historico = []) {
        // Análise da mensagem atual
        const resultadoAtual = this.analyze(mensagem);

        // Se não há histórico, retorna resultado simples
        if (!historico || historico.length === 0) {
            return resultadoAtual;
        }

        // Analisar tendência do histórico
        let somaScores = 0;
        let pesoTotal = 0;

        for (let i = 0; i < Math.min(historico.length, 5); i++) {
            const msg = historico[historico.length - 1 - i];
            const peso = 1 / (i + 1); // Mensagens mais recentes têm mais peso

            if (msg.score !== undefined) {
                somaScores += msg.score * peso;
                pesoTotal += peso;
            } else if (msg.mensagem) {
                const analise = this.analyze(msg.mensagem);
                somaScores += analise.scores.final * peso;
                pesoTotal += peso;
            }
        }

        const tendenciaHistorico = pesoTotal > 0 ? somaScores / pesoTotal : 0;

        // Detectar mudança de sentimento
        const mudancaDeSentimento = Math.abs(resultadoAtual.scores.final - tendenciaHistorico) > 2;

        return {
            ...resultadoAtual,
            contexto: {
                tendenciaHistorico: Math.round(tendenciaHistorico * 100) / 100,
                mudancaDeSentimento,
                direcaoMudanca: resultadoAtual.scores.final > tendenciaHistorico ? 'positiva' : 'negativa',
                mensagensAnalisadas: Math.min(historico.length, 5)
            }
        };
    }

    /**
     * Detecta se deve escalonar para humano
     * 
     * @param {Object} analise - Resultado da análise
     * @returns {Object} Recomendação de escalonamento
     */
    shouldEscalate(analise) {
        const razoes = [];
        let prioridade = 'baixa';

        // Emoção muito negativa
        if (analise.emocao === 'negativo' && analise.intensidade >= 2) {
            razoes.push('Cliente muito insatisfeito');
            prioridade = 'alta';
        }

        // Urgência alta
        if (analise.nivelUrgencia >= 2) {
            razoes.push('Solicitação urgente');
            prioridade = prioridade === 'alta' ? 'crítica' : 'alta';
        }

        // Intenção de reclamação
        if (analise.intencoes.includes('reclamacao')) {
            razoes.push('Potencial reclamação');
            prioridade = prioridade === 'baixa' ? 'média' : prioridade;
        }

        // Mudança brusca de sentimento (se contexto disponível)
        if (analise.contexto?.mudancaDeSentimento && analise.contexto.direcaoMudanca === 'negativa') {
            razoes.push('Piora significativa no sentimento');
            prioridade = prioridade === 'baixa' ? 'média' : prioridade;
        }

        return {
            deve: razoes.length > 0,
            prioridade,
            razoes,
            confianca: analise.confianca
        };
    }
}

// Singleton instance
const enhancedSentiment = new EnhancedSentimentAnalyzer();

// Inicializar
enhancedSentiment.initialize().catch(err => {
    console.error('❌ Falha ao inicializar Enhanced Sentiment:', err);
});

module.exports = {
    enhancedSentiment,
    EnhancedSentimentAnalyzer
};
