const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_ORIGIN = 'https://appnebula.co';
const API_ORIGIN = 'https://api.appnebula.co';
const LOGS_ORIGIN = 'https://logs.asknebula.com';

function rewriteUrls(content, req) {
    if (!content || typeof content !== 'string') {
        return content;
    }
    let rewrittenContent = content.replace(new RegExp(TARGET_ORIGIN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
    rewrittenContent = rewrittenContent.replace(new RegExp(API_ORIGIN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), req.protocol + '://' + req.get('host') + '/api-proxy');
    rewrittenContent = rewrittenContent.replace(new RegExp(LOGS_ORIGIN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), req.protocol + '://' + req.get('host') + '/logs-proxy');
    return rewrittenContent;
}

app.use('*', async (req, res) => {
    try {
        const targetPath = req.originalUrl;
        const targetUrl = `${TARGET_ORIGIN}${targetPath}`;

        console.log(`[MAIN PROXY] Requisição: ${targetPath} -> Proxy para: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: { ...req.headers, host: new URL(TARGET_ORIGIN).host }, // Important: forward host for correct routing
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
        });

        // Get content type from original response
        const originalContentType = response.headers.get('content-type');
        let data = await response.buffer();
        let isHtml = false;

        // Force Content-Type to text/html for known HTML paths or if it's detected as HTML
        if (req.path.includes('/prelanding') || originalContentType?.includes('text/html')) {
            res.setHeader('Content-Type', 'text/html');
            isHtml = true;
        } else if (originalContentType) {
            res.setHeader('Content-Type', originalContentType);
        }

        // Repassar outros cabeçalhos da resposta original
        response.headers.forEach((value, name) => {
            const lowerCaseName = name.toLowerCase();
            if (lowerCaseName === 'access-control-allow-origin') {
                res.setHeader(name, req.protocol + '://' + req.get('host'));
            } else if (lowerCaseName === 'content-security-policy') {
                let csp = value;
                csp = csp.replace(/connect-src [^;]+;/g, `connect-src ${req.protocol + '://' + req.get('host')} ${API_ORIGIN} ${LOGS_ORIGIN} ;`);
                csp = csp.replace(/img-src [^;]+;/g, `img-src 'self' ${req.protocol + '://' + req.get('host')} ${TARGET_ORIGIN} data: appnebula-media.appnebula.co *.appnebula.co ;`); // Add specific image domains
                csp = csp.replace(/script-src [^;]+;/g, `script-src 'unsafe-eval' 'unsafe-inline' ${req.protocol + '://' + req.get('host')} ${TARGET_ORIGIN} ;`);
                csp = csp.replace(/style-src [^;]+;/g, `style-src 'unsafe-inline' ${req.protocol + '://' + req.get('host')} ${TARGET_ORIGIN} ;`); // Added style-src
                res.setHeader(name, csp);
            } else if (lowerCaseName === 'location' && value.startsWith(TARGET_ORIGIN)) {
                // Rewrite redirects to point to your proxy
                res.setHeader(name, value.replace(TARGET_ORIGIN, req.protocol + '://' + req.get('host')));
            } else if (lowerCaseName !== 'content-type') { // Avoid overwriting content-type set above
                res.setHeader(name, value);
            }
        });

        if (isHtml || originalContentType?.includes('application/javascript') || originalContentType?.includes('text/css')) {
            const textContent = data.toString('utf8');
            const rewrittenContent = rewriteUrls(textContent, req);
            res.send(rewrittenContent);
        } else {
            res.send(data);
        }

    } catch (error) {
        console.error(`[MAIN PROXY ERROR] Falha ao fazer proxy para ${req.originalUrl}:`, error.message);
        res.status(500).send(`Erro no proxy: ${error.message}`);
    }
});

app.use('/api-proxy/*', async (req, res) => {
    const apiPath = req.originalUrl.replace('/api-proxy', '');
    const targetApiUrl = `${API_ORIGIN}${apiPath}`;
    console.log(`[API PROXY] Requisição: ${req.originalUrl} -> Proxy para: ${targetApiUrl}`);

    try {
        const response = await fetch(targetApiUrl, {
            method: req.method,
            headers: { ...req.headers, host: new URL(API_ORIGIN).host },
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
        });

        response.headers.forEach((value, name) => {
            const lowerCaseName = name.toLowerCase();
            if (lowerCaseName === 'access-control-allow-origin') {
                res.setHeader(name, req.protocol + '://' + req.get('host'));
            } else if (lowerCaseName === 'content-security-policy') {
                res.setHeader(name, value);
            } else if (lowerCaseName !== 'content-type') { // Let the API determine its content-type
                res.setHeader(name, value);
            }
        });
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json'); // Fallback content-type
        res.status(response.status).send(await response.buffer());

    } catch (error) {
        console.error(`[API PROXY ERROR] Falha ao fazer proxy para API ${targetApiUrl}:`, error.message);
        res.status(500).send(`Erro no proxy da API: ${error.message}`);
    }
});

app.use('/logs-proxy/*', async (req, res) => {
    const logsPath = req.originalUrl.replace('/logs-proxy', '');
    const targetLogsUrl = `${LOGS_ORIGIN}${logsPath}`;
    console.log(`[LOGS PROXY] Requisição: ${req.originalUrl} -> Proxy para: ${targetLogsUrl}`);

    try {
        const response = await fetch(targetLogsUrl, {
            method: req.method,
            headers: { ...req.headers, host: new URL(LOGS_ORIGIN).host },
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
        });

        response.headers.forEach((value, name) => {
            const lowerCaseName = name.toLowerCase();
            if (lowerCaseName === 'access-control-allow-origin') {
                res.setHeader(name, req.protocol + '://' + req.get('host'));
            } else if (lowerCaseName === 'content-security-policy') {
                res.setHeader(name, value);
            } else if (lowerCaseName !== 'content-type') { // Let the API determine its content-type
                res.setHeader(name, value);
            }
        });
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json'); // Fallback content-type
        res.status(response.status).send(await response.buffer());

    } catch (error) {
        console.error(`[LOGS PROXY ERROR] Falha ao fazer proxy para Logs ${targetLogsUrl}:`, error.message);
        res.status(500).send(`Erro no proxy de Logs: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de proxy rodando em http://localhost:${PORT}`);
});
