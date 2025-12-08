==========================================
CRAWL4AI SCRIPT - LinkMágico V7.0
==========================================
Script Python otimizado para extração web
Chamado pelo Node.js via child_process
100% gratuito e compatível com Firecrawl
==========================================
"""

import asyncio
import json
import sys
import os
from typing import Dict, Any, List

# Suprimir warnings desnecessários
import warnings
warnings.filterwarnings('ignore')

try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    from crawl4ai.extraction_strategy import JsonCssExtractionStrategy, LLMExtractionStrategy
except ImportError as e:
    print(json.dumps({
        'success': False,
        'error': f'Crawl4AI não instalado: {str(e)}',
        'hint': 'Execute: pip install crawl4ai && crawl4ai-setup'
    }))
    sys.exit(1)


class Crawl4AIExtractor:
    """Extrator principal usando Crawl4AI"""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.browser_config = BrowserConfig(
            headless=True,
            verbose=verbose,
            # Otimizações
            browser_type="chromium",
            use_managed_browser=True,
            # Recursos desabilitados para performance
            accept_downloads=False,
            # Timeout
            page_timeout=30000
        )
    
    def log(self, message: str):
        """Log apenas se verbose ativado"""
        if self.verbose:
            print(f"[Crawl4AI] {message}", file=sys.stderr)
    
    async def extract(self, url: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extração principal
        
        Args:
            url: URL para extrair
            params: Parâmetros de configuração
        
        Returns:
            Dicionário com dados extraídos
        """
        self.log(f"Iniciando extração: {url}")
        
        # Configuração do crawler
        crawler_config = CrawlerRunConfig(
            # Cache
            cache_mode=CacheMode.BYPASS if params.get('bypassCache', False) else CacheMode.ENABLED,
            
            # Filtros de conteúdo
            word_count_threshold=params.get('wordCountThreshold', 10),
            excluded_tags=params.get('excludeTags', ['nav', 'footer', 'script', 'style']),
            
            # JavaScript execution
            js_code=params.get('jsCode', None),
            wait_for=params.get('waitFor', None),
            
            # Processamento
            process_iframes=params.get('processIframes', False),
            remove_overlay_elements=params.get('removeOverlays', True),
            
            # Simulação de usuário
            simulate_user=params.get('simulateUser', False),
            override_navigator=params.get('overrideNavigator', True),
            
            # Timeout
            page_timeout=params.get('timeout', 30000)
        )
        
        try:
            async with AsyncWebCrawler(config=self.browser_config) as crawler:
                self.log("Crawler inicializado")
                
                # Executar crawl
                result = await crawler.arun(
                    url=url,
                    config=crawler_config
                )
                
                if not result.success:
                    return {
                        'success': False,
                        'error': result.error_message or 'Crawl failed',
                        'status_code': result.status_code
                    }
                
                self.log(f"Extração concluída: {result.status_code}")
                
                # Processar resultado
                return await self._process_result(result, params)
                
        except Exception as e:
            self.log(f"Erro: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
    
    async def _process_result(self, result, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa resultado do crawl
        
        Args:
            result: CrawlResult do Crawl4AI
            params: Parâmetros originais
        
        Returns:
            Dicionário formatado
        """
        # Extrair metadados
        metadata = {
            'title': result.metadata.get('title', ''),
            'description': result.metadata.get('description', ''),
            'language': result.metadata.get('language', 'pt'),
            'keywords': result.metadata.get('keywords', ''),
            'robots': result.metadata.get('robots', ''),
            'canonical': result.metadata.get('canonical', ''),
            # Open Graph
            'ogTitle': result.metadata.get('og:title', ''),
            'ogDescription': result.metadata.get('og:description', ''),
            'ogImage': result.metadata.get('og:image', ''),
            'ogType': result.metadata.get('og:type', ''),
            # Twitter
            'twitterCard': result.metadata.get('twitter:card', ''),
            'twitterTitle': result.metadata.get('twitter:title', ''),
            'twitterDescription': result.metadata.get('twitter:description', ''),
        }
        
        # Extrair links
        links = []
        if hasattr(result, 'links'):
            # Links internos
            for link in result.links.get('internal', [])[:50]:  # Limitar a 50
                links.append({
                    'url': link.get('href', ''),
                    'text': link.get('text', '')[:100],  # Limitar texto
                    'type': 'internal'
                })
            
            # Links externos (primeiros 20)
            for link in result.links.get('external', [])[:20]:
                links.append({
                    'url': link.get('href', ''),
                    'text': link.get('text', '')[:100],
                    'type': 'external'
                })
        
        # Extrair imagens
        images = []
        if hasattr(result, 'media') and result.media:
            for img in result.media.get('images', [])[:30]:  # Limitar a 30
                images.append({
                    'src': img.get('src', ''),
                    'alt': img.get('alt', '')[:200],  # Limitar alt
                    'width': img.get('width'),
                    'height': img.get('height')
                })
        
        # Markdown (conteúdo principal)
        markdown = result.markdown or ''
        
        # Limitar tamanho do markdown para evitar problemas de memória
        MAX_MARKDOWN_SIZE = 50000  # 50KB
        if len(markdown) > MAX_MARKDOWN_SIZE:
            self.log(f"Markdown truncado: {len(markdown)} -> {MAX_MARKDOWN_SIZE} chars")
            markdown = markdown[:MAX_MARKDOWN_SIZE] + '\n\n[...conteúdo truncado...]'
        
        # HTML limpo (opcional)
        cleaned_html = result.cleaned_html or ''
        if len(cleaned_html) > MAX_MARKDOWN_SIZE:
            cleaned_html = cleaned_html[:MAX_MARKDOWN_SIZE]
        
        # Resultado final
        output = {
            'success': True,
            'url': result.url,
            'status_code': result.status_code,
            
            # Conteúdo
            'markdown': markdown,
            'html': result.html[:5000] if result.html else '',  # HTML original limitado
            'cleaned_html': cleaned_html,
            'text': result.fit_markdown or markdown,  # Texto limpo
            
            # Metadados
            'metadata': metadata,
            
            # Links e mídia
            'links': links,
            'images': images,
            
            # Informações adicionais
            'extracted_content': result.extracted_content if hasattr(result, 'extracted_content') else None,
            
            # Timing
            'crawl_time': getattr(result, 'crawl_time', 0),
            'extraction_time': getattr(result, 'extraction_time', 0),
            
            # Screenshot (se disponível e solicitado)
            'screenshot': result.screenshot if params.get('screenshot', False) and hasattr(result, 'screenshot') else None
        }
        
        self.log(f"Processamento concluído: {len(markdown)} chars markdown")
        
        return output


async def main():
    """
    Main function - Interface com Node.js
    
    Args (via sys.argv):
        argv[1]: URL para extrair
        argv[2]: JSON com parâmetros (opcional)
    
    Output:
        JSON no stdout
    """
    # Validar argumentos
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'URL não fornecida',
            'usage': 'python crawl4ai_script.py <url> [params_json]'
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Parâmetros opcionais
    params = {}
    if len(sys.argv) > 2:
        try:
            params = json.loads(sys.argv[2])
        except json.JSONDecodeError:
            params = {}
    
    # Verbose via environment ou params
    verbose = os.getenv('CRAWL4AI_VERBOSE', 'false').lower() == 'true' or params.get('verbose', False)
    
    # Criar extrator
    extractor = Crawl4AIExtractor(verbose=verbose)
    
    # Executar extração
    result = await extractor.extract(url, params)
    
    # Output JSON
    print(json.dumps(result, ensure_ascii=False, indent=None))


if __name__ == "__main__":
    try:
        # Executar assíncrono
        asyncio.run(main())
    except KeyboardInterrupt:
        print(json.dumps({
            'success': False,
            'error': 'Interrompido pelo usuário'
        }))
        sys.exit(130)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }))
        sys.exit(1)
