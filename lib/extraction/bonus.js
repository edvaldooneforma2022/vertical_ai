/**
 * 🎁 SISTEMA APRIMORADO DE DETECÇÃO DE BÔNUS - Link Mágico V8.0
 * 
 * Módulo extraído da refatoração Fase 5.
 * Extração inteligente de dados de páginas web:
 * - Bônus e ofertas
 * - Preços
 * - Garantias
 * - Metadados
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { sistemaContatosAprimorado } = require('./contatos');

// ===== CLASSE PRINCIPAL =====

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

// Inicializar sistema de extração
const sistemaExtracaoApurado = new SistemaExtracaoApurado();

// ===== EXPORTS =====
module.exports = {
    SistemaExtracaoApurado,
    sistemaExtracaoApurado
};
