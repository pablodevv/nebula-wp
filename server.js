const express = require('express');
const fetch = require('node-fetch'); // Ou use axios, o que preferir para requisições no backend
const cheerio = require('cheerio'); // Para manipular HTML
const app = express();
const PORT = process.env.PORT || 3000;

// URL base do AppNebula original
const TARGET_ORIGIN = 'https://appnebula.co';
const API_ORIGIN = 'https://api.appnebula.co';
const LOGS_ORIGIN = 'https://logs.asknebula.com';

// Função para reescrever URLs no HTML/CSS/JS antes de servir
function rewriteUrls(content, req) {
    if (!content || typeof content !== 'string') {
        return content;
    }

    // Replace absolute URLs pointing to TARGET_ORIGIN with relative URLs or your proxy base URL
    let rewrittenContent = content.replace(new RegExp(TARGET_ORIGIN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');

    // *** PARTE CRÍTICA: Reescrever chamadas para a API e Logs ***
    // Isso é mais complicado porque pode estar dentro de strings em JS
    // Vamos tentar substituir as URLs base das APIs.
    rewrittenContent = rewrittenContent.replace(new RegExp(API_ORIGIN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), req.protocol + '://' + req.get('host') + '/api-proxy');
    rewrittenContent = rewrittenContent.replace(new RegExp(LOGS_ORIGIN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), req.protocol + '://' + req.get('host') + '/logs-proxy');

    return rewrittenContent;
}

// Middleware para processar todas as requisições
app.use('*', async (req, res) => {
    try {
        const targetPath = req.originalUrl;
        const targetUrl = `${TARGET_ORIGIN}${targetPath}`;

        console.log(`[MAIN PROXY] Requisição: ${targetPath} -> Proxy para: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: req.headers, // Repassar headers da requisição original
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined, // Repassar body para POST/PUT
        });

        // Repassar todos os cabeçalhos da resposta original
        response.headers.forEach((value, name) => {
            // Evitar problemas com CORS se o TARGET_ORIGIN não permitir a sua origem
            if (name.toLowerCase() === 'access-control-allow-origin') {
                res.setHeader(name, req.protocol + '://' + req.get('host')); // Substituir pelo seu domínio
            } else if (name.toLowerCase() === 'content-security-policy') {
                // Muito importante: CSP pode bloquear scripts e imagens de outras origens
                // Tente relaxar o CSP para permitir o seu próprio domínio
                let csp = value;
                csp = csp.replace(/connect-src [^;]+;/g, `connect-src ${req.protocol + '://' + req.get('host')} ${API_ORIGIN} ${LOGS_ORIGIN} ;`);
                csp = csp.replace(/img-src [^;]+;/g, `img-src ${req.protocol + '://' + req.get('host')} ${TARGET_ORIGIN} data:;`);
                csp = csp.replace(/script-src [^;]+;/g, `script-src 'unsafe-eval' 'unsafe-inline' ${req.protocol + '://' + req.get('host')} ${TARGET_ORIGIN} ;`);
                res.setHeader(name, csp);
            } else {
                res.setHeader(name, value);
            }
        });

        // Tentar obter o tipo de conteúdo para reescrever apenas HTML/CSS/JS
        const contentType = response.headers.get('content-type');
        let data = await response.buffer(); // Obter como buffer para manipular texto ou binário

        if (contentType && (contentType.includes('text/html') || contentType.includes('application/javascript') || contentType.includes('text/css'))) {
            const textContent = data.toString('utf8'); // Converter para texto
            const rewrittenContent = rewriteUrls(textContent, req);
            res.send(rewrittenContent);
        } else {
            // Para outros tipos (imagens, etc.), apenas repasse o buffer diretamente
            res.send(data);
        }

    } catch (error) {
        console.error(`[MAIN PROXY ERROR] Falha ao fazer proxy para ${req.originalUrl}:`, error);
        res.status(500).send('Erro no proxy');
    }
});

// *** NOVOS PROXIES PARA AS APIS ***
// Proxy para a API principal (api.appnebula.co)
app.use('/api-proxy/*', async (req, res) => {
    const apiPath = req.originalUrl.replace('/api-proxy', ''); // Remove o prefixo
    const targetApiUrl = `${API_ORIGIN}${apiPath}`;
    console.log(`[API PROXY] Requisição: ${req.originalUrl} -> Proxy para: ${targetApiUrl}`);

    try {
        const response = await fetch(targetApiUrl, {
            method: req.method,
            headers: req.headers,
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
        });

        // Repassar todos os headers da resposta da API
        response.headers.forEach((value, name) => {
            // Muito importante: Permitir sua origem no CORS
            if (name.toLowerCase() === 'access-control-allow-origin') {
                res.setHeader(name, req.protocol + '://' + req.get('host'));
            } else if (name.toLowerCase() === 'content-security-policy') {
                // Relaxar CSP se a API tiver um
                res.setHeader(name, value); // Ou ajustar se necessário
            } else {
                res.setHeader(name, value);
            }
        });

        res.status(response.status).send(await response.buffer());

    } catch (error) {
        console.error(`[API PROXY ERROR] Falha ao fazer proxy para API ${targetApiUrl}:`, error);
        res.status(500).send('Erro no proxy da API');
    }
});

// Proxy para a API de Logs (logs.asknebula.com)
app.use('/logs-proxy/*', async (req, res) => {
    const logsPath = req.originalUrl.replace('/logs-proxy', ''); // Remove o prefixo
    const targetLogsUrl = `${LOGS_ORIGIN}${logsPath}`;
    console.log(`[LOGS PROXY] Requisição: ${req.originalUrl} -> Proxy para: ${targetLogsUrl}`);

    try {
        const response = await fetch(targetLogsUrl, {
            method: req.method,
            headers: req.headers,
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
        });

        // Repassar todos os headers da resposta da API
        response.headers.forEach((value, name) => {
            // Muito importante: Permitir sua origem no CORS
            if (name.toLowerCase() === 'access-control-allow-origin') {
                res.setHeader(name, req.protocol + '://' + req.get('host'));
            } else if (name.toLowerCase() === 'content-security-policy') {
                // Relaxar CSP se a API de logs tiver um
                res.setHeader(name, value); // Ou ajustar se necessário
            } else {
                res.setHeader(name, value);
            }
        });

        res.status(response.status).send(await response.buffer());

    } catch (error) {
        console.error(`[LOGS PROXY ERROR] Falha ao fazer proxy para Logs ${targetLogsUrl}:`, error);
        res.status(500).send('Erro no proxy de Logs');
    }
});


app.listen(PORT, () => {
    console.log(`Servidor de proxy rodando em http://localhost:${PORT}`);
});
