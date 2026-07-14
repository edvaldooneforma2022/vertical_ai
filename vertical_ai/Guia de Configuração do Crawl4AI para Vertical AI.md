# Guia de Configuração do Crawl4AI para Vertical AI

Este documento detalha as três opções de configuração para integrar o serviço Crawl4AI ao seu projeto Node.js (`vertical_ai`), conforme a análise da estrutura do projeto e do adaptador `crawl4ai-adapter.js`.

O adaptador foi projetado para operar em três modos, sendo o modo **Docker** o recomendado para ambientes de produção devido à sua robustez e isolamento.

## 1. Configuração de Variáveis de Ambiente

Independentemente do método de deployment, as seguintes variáveis de ambiente devem ser configuradas para que o `crawl4ai-adapter.js` funcione corretamente:

| Variável | Valor Recomendado (Produção) | Valor (Desenvolvimento Local) | Descrição |
| :--- | :--- | :--- | :--- |
| `CRAWL4AI_MODE` | `docker` | `docker` ou `python` | Define como o adaptador irá se comunicar com o Crawl4AI. |
| `CRAWL4AI_DOCKER_URL` | `http://crawl4ai:11235` | `http://localhost:11235` | URL de acesso ao serviço Crawl4AI. O valor para Docker Compose usa o nome do serviço. |

---

## 2. Opção 1: Docker Compose (Recomendado para Produção)

Esta é a forma mais robusta e portátil de rodar sua aplicação Node.js e o serviço Crawl4AI juntos, isolados em uma rede virtual.

### 2.1. Arquivos de Configuração

Dois arquivos foram criados/modificados na raiz do seu projeto:

1.  **`Dockerfile`**: Define como sua aplicação Node.js será construída em uma imagem Docker.
2.  **`docker-compose.crawl4ai.yml`**: Define os serviços `crawl4ai` e `nodejs-app` e como eles se comunicam.

### 2.2. Conteúdo do `docker-compose.crawl4ai.yml`

```yaml
version: '3.8'

services:
  # Serviço Crawl4AI
  crawl4ai:
    image: unclecode/crawl4ai:latest
    container_name: crawl4ai-service
    ports:
      - "11235:11235"
    environment:
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11235/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Seu app Node.js
  nodejs-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: vertical-ai-app
    depends_on:
      - crawl4ai
    environment:
      # Configuração para o adaptador crawl4ai-adapter.js
      - CRAWL4AI_MODE=docker
      # O nome do serviço 'crawl4ai' é usado como hostname dentro da rede Docker Compose
      - CRAWL4AI_DOCKER_URL=http://crawl4ai:11235
      - PORT=3000
    ports:
      - "3000:3000"
    restart: unless-stopped
```

### 2.3. Execução

1.  Certifique-se de ter o Docker e o Docker Compose instalados.
2.  Crie um arquivo `.env` na raiz do projeto com as variáveis de ambiente necessárias (ou use o `.env.example` como base).
3.  Execute o comando para iniciar os serviços:

```bash
docker-compose -f docker-compose.crawl4ai.yml up -d
```

4.  Verifique o status dos containers:

```bash
docker ps
```

---

## 3. Opção 2: Instalação Local (Desenvolvimento)

Para testar o Crawl4AI localmente sem o Docker Compose, você pode rodar o container diretamente e configurar as variáveis de ambiente no seu ambiente de desenvolvimento.

### 3.1. Execução do Container Crawl4AI

```bash
# Pull da imagem oficial
docker pull unclecode/crawl4ai:latest

# Executar container
docker run -d \
  --name crawl4ai \
  -p 11235:11235 \
  unclecode/crawl4ai:latest

# Verificar se está rodando
curl http://localhost:11235/health
```

### 3.2. Configuração do Projeto Node.js

No seu arquivo `.env` local, defina as variáveis:

```ini
CRAWL4AI_MODE=docker
CRAWL4AI_DOCKER_URL=http://localhost:11235
```

Agora, você pode iniciar sua aplicação Node.js normalmente (ex: `npm run dev` ou `npm start`).

---

## 4. Opção 3: Render Free (Produção)

Para o deployment no Render como um **Background Worker**, a configuração é feita diretamente no painel do Render.

### 4.1. Configuração do Background Worker (Crawl4AI)

Crie um novo **Background Worker** no seu Render Dashboard com as seguintes especificações:

| Campo | Valor |
| :--- | :--- |
| **Docker Image** | `unclecode/crawl4ai:latest` |
| **Port** | `11235` |
| **Health Check Path** | `/health` |

### 4.2. Configuração do Serviço Principal (Node.js App)

No seu serviço principal (onde o `vertical_ai` está rodando), você precisará configurar as variáveis de ambiente para que ele se comunique com o Background Worker do Crawl4AI.

**Variáveis de Ambiente no Render:**

| Variável | Valor | Descrição |
| :--- | :--- | :--- |
| `CRAWL4AI_MODE` | `docker` | Define o modo de operação. |
| `CRAWL4AI_DOCKER_URL` | `http://[NOME_DO_WORKER]:11235` | **Importante:** Substitua `[NOME_DO_WORKER]` pelo nome que você deu ao seu Background Worker do Crawl4AI no Render. O Render usa o nome do serviço como hostname interno. |
| `PORT` | `11235` | A porta que o Crawl4AI está escutando. |

**Nota:** O `crawl4ai-adapter.js` já está configurado para usar `process.env.CRAWL4AI_DOCKER_URL`, garantindo que a comunicação interna entre os serviços do Render funcione corretamente.

---

Com estas instruções e os arquivos de configuração (`Dockerfile` e `docker-compose.crawl4ai.yml`) criados, você tem todas as opções de deployment prontas para uso.
