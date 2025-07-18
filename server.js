const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;

const MAIN_TARGET_URL = 'https://appnebula.co';
const READING_SUBDOMAIN_TARGET = 'https://reading.appnebula.co';

const agent = new https.Agent({
    rejectUnauthorized: false, // APENAS PARA DESENVOLVIMENTO. Em produção, use um certificado SSL válido.
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --- ROTAS DO PROXY ---

// Proxy para o subdomínio 'reading.appnebula.co'
app.use('/reading', async (req, res) => {
    const targetUrl = `${READING_SUBDOMAIN_TARGET}${req.url.replace('/reading', '')}`;
    console.log(`[READING PROXY] Requisição: ${req.url} -> Proxy para: ${targetUrl}`);

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: requestHeaders,
            data: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
            responseType: 'arraybuffer',
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            httpsAgent: agent,
        });

        Object.keys(response.headers).forEach(header => {
            if (!['transfer-encoding', 'content-encoding', 'content-length', 'set-cookie', 'host', 'connection'].includes(header.toLowerCase())) {
                res.setHeader(header, response.headers[header]);
            }
        });

        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            const modifiedCookies = cookies.map(cookie => {
                return cookie
                    .replace(/Domain=[^;]+/, '')
                    .replace(/; Secure/, '');
            });
            res.setHeader('Set-Cookie', modifiedCookies);
        }

        res.status(response.status).send(response.data);

    } catch (error) {
        console.error(`[READING PROXY] Erro na requisição para ${targetUrl}:`, error.message);
        if (error.response) {
            console.error('[READING PROXY] Status do erro:', error.response.status);
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).send('Erro ao proxy a requisição do subdomínio de leitura.');
        }
    }
});

// Proxy para a API principal
app.use('/api-proxy', async (req, res) => {
    const apiTargetUrl = `https://api.appnebula.co${req.url.replace('/api-proxy', '')}`;
    console.log(`[API PROXY] Requisição: ${req.url} -> Proxy para: ${apiTargetUrl}`);

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];

    try {
        const response = await axios({
            method: req.method,
            url: apiTargetUrl,
            headers: requestHeaders,
            data: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
            responseType: 'arraybuffer',
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            httpsAgent: agent,
        });

        Object.keys(response.headers).forEach(header => {
            if (!['transfer-encoding', 'content-encoding', 'content-length', 'set-cookie', 'host', 'connection'].includes(header.toLowerCase())) {
                res.setHeader(header, response.headers[header]);
            }
        });

        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            const modifiedCookies = cookies.map(cookie => {
                return cookie
                    .replace(/Domain=[^;]+/, '')
                    .replace(/; Secure/, '')
                    .replace(/; Path=\//, `; Path=/api-proxy${req.baseUrl || '/'}`);
            });
            res.setHeader('Set-Cookie', modifiedCookies);
        }

        res.status(response.status).send(response.data);

    } catch (error) {
        console.error('[API PROXY] Erro na requisição da API:', error.message);
        if (error.response) {
                console.error('[API PROXY] Status da API:', error.response.status);
                res.status(error.response.status).send(error.response.data);
            } else {
                res.status(500).send('Erro ao proxy a API.');
            }
    }
});

// Proxy principal para o site da Nebula
app.use(async (req, res) => {
    const targetUrl = `${MAIN_TARGET_URL}${req.url}`;
    const proxyHost = req.protocol + '://' + req.get('host');

    console.log(`[MAIN PROXY] Requisição: ${req.url} -> Proxy para: ${targetUrl}`);

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: { ...req.headers, host: new URL(MAIN_TARGET_URL).hostname },
            data: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
            responseType: 'arraybuffer',
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            httpsAgent: agent,
        });

        const contentType = response.headers['content-type'];

        Object.keys(response.headers).forEach(header => {
            if (!['transfer-encoding', 'content-encoding', 'content-length', 'set-cookie', 'host', 'connection'].includes(header.toLowerCase())) {
                res.setHeader(header, response.headers[header]);
            }
        });

        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            const modifiedCookies = cookies.map(cookie => {
                return cookie.replace(/Domain=[^;]+/, '').replace(/; Secure/, '');
            });
            res.setHeader('Set-Cookie', modifiedCookies);
        }

        if (contentType && contentType.includes('text/html')) {
            const html = response.data.toString('utf8');
            const $ = cheerio.load(html);

            // Reescrever URLs de assets, links e formulários
            $('link[href], script[src], img[src], a[href], form[action]').each((i, elem) => {
                let attr = '';
                if ($(elem).is('link, script, img')) {
                    attr = 'src';
                } else if ($(elem).is('a')) {
                    attr = 'href';
                } else if ($(elem).is('form')) {
                    attr = 'action';
                }

                let url = $(elem).attr(attr);
                if (url) {
                    if (url.startsWith('/')) {
                        // URLs relativas ao root já serão tratadas pelo proxy sem modificação aqui.
                    } else if (url.startsWith(MAIN_TARGET_URL)) {
                        $(elem).attr(attr, url.replace(MAIN_TARGET_URL, proxyHost));
                    } else if (url.startsWith(READING_SUBDOMAIN_TARGET)) {
                        $(elem).attr(attr, url.replace(READING_SUBDOMAIN_TARGET, `/reading`));
                    }
                }
            });

            // --- INJEÇÃO DE SCRIPTS CLIENT-SIDE E MANIPULAÇÃO DE DOM PARA CORS/postMessage ---
            $('head').prepend(`
                <script>
                    (function() {
                        const readingSubdomainTarget = '${READING_SUBDOMAIN_TARGET}';
                        const mainTargetOrigin = '${MAIN_TARGET_URL}';
                        const proxyPrefix = '/reading';
                        const currentProxyHost = '${proxyHost}';

                        // Funções de interceptação de Fetch, XHR e PostMessage
                        // Mantidas para garantir a funcionalidade geral do proxy para a Nebula
                        const originalFetch = window.fetch;
                        window.fetch = function(input, init) {
                            let url = input;
                            if (typeof input === 'string') {
                                if (input.startsWith(readingSubdomainTarget)) {
                                    url = input.replace(readingSubdomainTarget, proxyPrefix);
                                } else if (input.startsWith(mainTargetOrigin)) {
                                    url = input.replace(mainTargetOrigin, currentProxyHost);
                                } else if (input.startsWith('https://api.appnebula.co')) {
                                    url = input.replace('https://api.appnebula.co', currentProxyHost + '/api-proxy');
                                }
                            } else if (input instanceof Request) {
                                if (input.url.startsWith(readingSubdomainTarget)) {
                                    url = new Request(input.url.replace(readingSubdomainTarget, proxyPrefix), input);
                                } else if (input.url.startsWith(mainTargetOrigin)) {
                                    url = new Request(input.url.replace(mainTargetOrigin, currentProxyHost), input);
                                } else if (input.url.startsWith('https://api.appnebula.co')) {
                                    url = new Request(input.url.replace('https://api.appnebula.co', currentProxyHost + '/api-proxy'), input);
                                }
                            }
                            return originalFetch.call(this, url, init);
                        };

                        const originalXHRopen = XMLHttpRequest.prototype.open;
                        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
                            let modifiedUrl = url;
                            if (typeof url === 'string') {
                                if (url.startsWith(readingSubdomainTarget)) {
                                    modifiedUrl = url.replace(readingSubdomainTarget, proxyPrefix);
                                } else if (url.startsWith(mainTargetOrigin)) {
                                    modifiedUrl = url.replace(mainTargetOrigin, currentProxyHost);
                                } else if (url.startsWith('https://api.appnebula.co')) {
                                    modifiedUrl = url.replace('https://api.appnebula.co', currentProxyHost + '/api-proxy');
                                }
                            }
                            originalXHRopen.call(this, method, modifiedUrl, async, user, password);
                        };

                        const originalPostMessage = window.postMessage;
                        window.postMessage = function(message, targetOrigin, transfer) {
                            let modifiedTargetOrigin = targetOrigin;
                            if (typeof targetOrigin === 'string' && targetOrigin.startsWith(mainTargetOrigin)) {
                                modifiedTargetOrigin = currentProxyHost;
                            }
                            originalPostMessage.call(this, message, modifiedTargetOrigin, transfer);
                        };

                        // --- Script de Verificação de Injeção e DOM (Botão de Teste) ---
                        // Envolver a manipulação do DOM em DOMContentLoaded
                        document.addEventListener('DOMContentLoaded', function() {
                            console.log('****** SCRIPT DE TESTE INJETADO COM SUCESSO! ******');

                            const testDiv = document.createElement('div');
                            testDiv.id = 'gemini-injection-test';
                            testDiv.style.position = 'fixed';
                            testDiv.style.top = '0';
                            testDiv.style.left = '0';
                            testDiv.style.width = '100%';
                            testDiv.style.padding = '10px';
                            testDiv.style.backgroundColor = 'red';
                            testDiv.style.color = 'yellow';
                            testDiv.style.textAlign = 'center';
                            testDiv.style.zIndex = '9999999';
                            testDiv.textContent = 'INJEÇÃO DE TESTE GEMINI FUNCIONOU!';
                            document.body.appendChild(testDiv);
                        });
                        // --- Fim do Novo Script ---

                    })();
                </script>
            `);

            res.setHeader('Content-Type', 'text/html');
            res.status(response.status).send($.html());
        } else {
            res.status(response.status).send(response.data);
        }

    } catch (error) {
        console.error('[MAIN PROXY] Erro no proxy principal:', error.message);
        if (error.response) {
            console.error('[MAIN PROXY] Status do erro:', error.response.status);
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).send('Erro ao proxy a requisição.');
        }
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
