/**
 * 📞 SISTEMA APRIMORADO DE EXTRAÇÃO DE CONTATOS - Link Mágico V8.0
 * 
 * Módulo extraído da refatoração Fase 5.
 * Extração inteligente de contatos de páginas web:
 * - Telefones brasileiros
 * - WhatsApp
 * - E-mails
 * - Sites
 */

// ===== CLASSE PRINCIPAL =====

class SistemaExtracaoContatosAprimorado {
    constructor() {
        console.log("📞 Sistema Aprimorado de Extração de Contatos Inicializado");
    }

    extrairContatosAprimorado($) {
        const contatos = {
            telefone: [],
            whatsapp: [],
            whatsappLinks: [], // V14.2.1: Preservar URLs originais do WhatsApp
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
                    // V14.2.1: Preservar URL original
                    if (!contatos.whatsappLinks.includes(href)) {
                        contatos.whatsappLinks.push(href);
                    }
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
                whatsappLinks: contatos.whatsappLinks.length,
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

// ===== EXPORTS =====
module.exports = {
    SistemaExtracaoContatosAprimorado,
    sistemaContatosAprimorado
};
