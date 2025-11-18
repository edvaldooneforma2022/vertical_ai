#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Crawl4AI Extractor para Link Mágico
Extrai conteúdo completo de páginas web de forma gratuita
"""

import asyncio
import json
import sys
import re
from typing import Dict, Any, List

# Tentar importar Crawl4AI
try:
    from crawl4ai import AsyncWebCrawler
    from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig
    CRAWL4AI_AVAILABLE = True
except ImportError:
    CRAWL4AI_AVAILABLE = False
    print("⚠️  Crawl4AI não instalado. Instale com: pip install crawl4ai", file=sys.stderr)


class Crawl4AIExtractor:
    """Extrator de páginas web usando Crawl4AI"""
    
    def __init__(self):
        self.timeout = 30000  # 30 segundos
        
    async def extract_page(self, url: str) -> Dict[str, Any]:
        """
        Extrai conteúdo completo de uma página web
        
        Args:
            url: URL da página para extrair
            
        Returns:
            Dicionário com dados extraídos
        """
        if not CRAWL4AI_AVAILABLE:
            return self._fallback_error()
            
        try:
            # Configuração do navegador
            browser_config = BrowserConfig(
                headless=True,
                verbose=False,
                extra_args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-software-rasterizer"
                ]
            )
            
            # Configuração do crawler
            crawler_config = CrawlerRunConfig(
                wait_for="networkidle",
                page_timeout=self.timeout,
                screenshot=False,
                pdf=False
            )
            
            # Executar crawling
            async with AsyncWebCrawler(config=browser_config) as crawler:
                result = await crawler.arun(
                    url=url,
                    config=crawler_config
                )
                
                if not result.success:
                    return self._create_error_response(
                        f"Falha ao extrair: {result.error_message}"
                    )
                
                # Extrair dados estruturados
                extracted_data = self._parse_result(result, url)
                
                return {
                    'success': True,
                    'data': extracted_data,
                    'method': 'crawl4ai',
                    'timestamp': self._get_timestamp()
                }
                
        except Exception as e:
            return self._create_error_response(str(e))
    
    def _parse_result(self, result, url: str) -> Dict[str, Any]:
        """Parseia o resultado do Crawl4AI"""
        
        # Extrair contatos do texto
        markdown_text = result.markdown or ""
        html_text = result.html or ""
        
        contatos = self._extract_contacts(markdown_text + " " + html_text)
        
        return {
            'title': result.metadata.get('title', ''),
            'description': result.metadata.get('description', ''),
            'cleanText': markdown_text,
            'html': html_text,
            'url': url,
            'links': result.links.get('internal', [])[:10],  # Primeiros 10 links
            'images': [
                img.get('src', '') 
                for img in result.media.get('images', [])[:5]  # Primeiras 5 imagens
            ],
            'contatos': contatos,
            'metadata': {
                'keywords': result.metadata.get('keywords', ''),
                'author': result.metadata.get('author', ''),
                'language': result.metadata.get('language', 'pt-BR')
            }
        }
    
    def _extract_contacts(self, text: str) -> Dict[str, List[str]]:
        """Extrai informações de contato do texto"""
        
        contatos = {
            'telefone': [],
            'whatsapp': [],
            'email': [],
            'site': []
        }
        
        # Extrair telefones (padrão brasileiro)
        phone_patterns = [
            r'\+?55\s?\(?0?(\d{2})\)?\s?9?\d{4}[-.\s]?\d{4}',
            r'\((\d{2})\)\s?9?\d{4}[-.\s]?\d{4}',
            r'(\d{2})\s?9?\d{4}[-.\s]?\d{4}'
        ]
        
        for pattern in phone_patterns:
            matches = re.findall(pattern, text)
            contatos['telefone'].extend(matches[:3])  # Primeiros 3
        
        # Detectar WhatsApp por contexto
        if 'whatsapp' in text.lower() or 'zap' in text.lower():
            contatos['whatsapp'] = contatos['telefone'][:2]
            contatos['telefone'] = contatos['telefone'][2:]
        
        # Extrair emails
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        contatos['email'] = list(set(emails))[:3]  # Primeiros 3 únicos
        
        # Extrair URLs
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        urls = re.findall(url_pattern, text)
        contatos['site'] = list(set(urls))[:3]  # Primeiros 3 únicos
        
        return contatos
    
    def _create_error_response(self, error_msg: str) -> Dict[str, Any]:
        """Cria resposta de erro padronizada"""
        return {
            'success': False,
            'error': error_msg,
            'method': 'crawl4ai',
            'timestamp': self._get_timestamp()
        }
    
    def _fallback_error(self) -> Dict[str, Any]:
        """Erro quando Crawl4AI não está disponível"""
        return {
            'success': False,
            'error': 'Crawl4AI não instalado. Execute: pip install crawl4ai',
            'method': 'crawl4ai',
            'timestamp': self._get_timestamp()
        }
    
    @staticmethod
    def _get_timestamp() -> str:
        """Retorna timestamp atual ISO"""
        from datetime import datetime
        return datetime.utcnow().isoformat() + 'Z'


async def main():
    """Função principal - executada pela linha de comando"""
    
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'URL não fornecida. Uso: python crawl4ai_extractor.py <URL>'
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Validar URL
    if not url.startswith(('http://', 'https://')):
        print(json.dumps({
            'success': False,
            'error': f'URL inválida: {url}'
        }))
        sys.exit(1)
    
    # Extrair dados
    extractor = Crawl4AIExtractor()
    result = await extractor.extract_page(url)
    
    # Retornar JSON
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    asyncio.run(main())