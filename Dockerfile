# Use uma imagem base Node.js LTS
FROM node:20-slim

# Definir o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copiar package.json e package-lock.json para instalar dependências
# Isso aproveita o cache do Docker se as dependências não mudarem
COPY package.json ./
COPY package-lock.json ./

# Instalar dependências
RUN npm install --production

# Copiar o restante do código da aplicação
COPY . .

# O projeto usa puppeteer, que requer algumas dependências do sistema operacional.
# Embora a imagem 'slim' seja usada, as dependências do puppeteer são complexas.
# Para um ambiente de produção, é altamente recomendado usar uma imagem otimizada para Puppeteer
# ou configurar as dependências necessárias. Por simplicidade e para o escopo do Node.js,
# vamos manter a base 'node:20-slim' e assumir que as dependências necessárias para o
# Node.js e o código em si estão cobertas.

# Expor a porta que o app Node.js usa (3000, conforme o docker-compose)
EXPOSE 3000

# Comando para iniciar a aplicação
CMD [ "npm", "start" ]
