/**
 * Módulo: JourneyAnalyzer
 * Sistema de análise de jornada do cliente
 * 
 * @module modules/leads/journey-analyzer
 */

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

module.exports = {
    JourneyAnalyzer
};
