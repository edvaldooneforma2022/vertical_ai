/**
 * Configuração Swagger/OpenAPI
 * Configura a documentação interativa da API
 * 
 * @module swagger-config
 */

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const fs = require('fs');

/**
 * Configura o Swagger UI no app Express
 * @param {Express} app - Instância do Express
 */
function setupSwagger(app) {
    try {
        const openApiPath = path.join(__dirname, 'docs', 'openapi.yaml');

        // Verificar se o arquivo existe
        if (!fs.existsSync(openApiPath)) {
            console.warn('⚠️ Arquivo openapi.yaml não encontrado. Swagger UI não será configurado.');
            return;
        }

        const swaggerDocument = YAML.load(openApiPath);

        // Configurações customizadas do Swagger UI
        const swaggerOptions = {
            customCss: `
                .swagger-ui .topbar { display: none }
                .swagger-ui .info .title { color: #1e40af; }
                .swagger-ui .info .description { font-size: 14px; }
            `,
            customSiteTitle: "LinkMágico API Docs",
            customfavIcon: "/public/favicon.ico",
            swaggerOptions: {
                persistAuthorization: true,
                displayRequestDuration: true,
                filter: true,
                tryItOutEnabled: true
            }
        };

        // Rota para o Swagger UI
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

        // Rota para o JSON da especificação
        app.get('/api-docs.json', (req, res) => {
            res.json(swaggerDocument);
        });

        console.log('📚 Swagger UI disponível em: /api-docs');
        console.log('📄 Especificação OpenAPI em: /api-docs.json');

    } catch (error) {
        console.error('❌ Erro ao configurar Swagger:', error.message);
        console.warn('⚠️ Swagger UI não será disponibilizado. Instale as dependências: npm install swagger-ui-express yamljs');
    }
}

module.exports = { setupSwagger };
