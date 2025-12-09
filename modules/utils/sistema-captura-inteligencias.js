/**
 * Módulo: SistemaCapturaInteligencias
 * Sistema de captura e detecção de intenções do cliente
 * 
 * @module modules/utils/sistema-captura-inteligencias
 */

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

    gerarRespostaContextual(inteligencias, contatos, journeyStage = "descoberta", journeyAnalyzer = null) {
        let resposta = '';
        const excitementWord = journeyAnalyzer ? journeyAnalyzer.getRandomSynonym('empolgação') : 'excelente';

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

module.exports = {
    SistemaCapturaInteligencias
};
