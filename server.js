const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors'); // Para habilitar CORS no seu proxy, se necessário para outras requisições
const https = require('https'); // Necessário para ignorar certificados em desenvolvimento

const app = express();
const PORT = process.env.PORT || 10000;

// Configurações dos domínios alvo
const MAIN_TARGET_URL = 'https://appnebula.co';
const READING_SUBDOMAIN_TARGET = 'https://reading.appnebula.co';

// Configuração para ignorar certificados SSL (APENAS PARA DESENVOLVIMENTO)
// Em produção, use um certificado SSL válido.
const agent = new https.Agent({
    rejectUnauthorized: false,
});

// Middleware para parsear corpos de requisição JSON
// Isso é crucial para que o proxy possa retransmitir requisições POST/PUT com JSON para as APIs
app.use(express.json());
// Middleware para parsear corpos de requisição URL-encoded (se necessário)
app.use(express.urlencoded({ extended: true }));
// Habilitar CORS para o seu servidor proxy (se você tiver clientes fazendo requisições para o seu proxy)
app.use(cors());

// --- ROTAS DO PROXY ---

// Proxy para o subdomínio 'reading.appnebula.co'
app.use('/reading', async (req, res) => {
    const targetUrl = `${READING_SUBDOMAIN_TARGET}${req.url.replace('/reading', '')}`;
    console.log(`[READING PROXY] Requisição: ${req.url} -> Proxy para: ${targetUrl}`);

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host']; // Importante: remover o host do proxy
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: requestHeaders,
            data: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
            responseType: 'arraybuffer', // Receber como buffer para lidar com todos os tipos de conteúdo
            maxRedirects: 0, // Não seguir redirecionamentos automaticamente
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Aceitar 2xx e 3xx como sucesso
            },
            httpsAgent: agent, // Usar o agente para ignorar SSL em desenvolvimento
        });

        // Repassar todos os cabeçalhos da resposta
        Object.keys(response.headers).forEach(header => {
            if (!['transfer-encoding', 'content-encoding', 'content-length', 'set-cookie', 'host', 'connection'].includes(header.toLowerCase())) {
                res.setHeader(header, response.headers[header]);
            }
        });

        // Manipular cookies para remover domínio e 'Secure'
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            const modifiedCookies = cookies.map(cookie => {
                return cookie
                    .replace(/Domain=[^;]+/, '')
                    .replace(/; Secure/, ''); // Remover 'Secure' se o proxy não for HTTPS
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

// Proxy para a API principal (separa das requisições de assets/HTML)
app.use('/api-proxy', async (req, res) => {
    const apiTargetUrl = `https://api.appnebula.co${req.url.replace('/api-proxy', '')}`; // Remove o prefixo
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
            httpsAgent: agent, // Usar o agente para ignorar SSL em desenvolvimento
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
            httpsAgent: agent, // Usar o agente para ignorar SSL em desenvolvimento
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
                        // URLs relativas ao root (e.g., /_next/static)
                        // já serão tratadas pelo proxy sem modificação aqui.
                        // Mas para garantir, podemos prefixar se necessário para rotas específicas
                        // For example: if (url.startsWith('/_next')) $(elem).attr(attr, url);
                    } else if (url.startsWith(MAIN_TARGET_URL)) {
                        $(elem).attr(attr, url.replace(MAIN_TARGET_URL, proxyHost));
                    } else if (url.startsWith(READING_SUBDOMAIN_TARGET)) {
                        $(elem).attr(attr, url.replace(READING_SUBDOMAIN_TARGET, `/reading`));
                    }
                    // Adicionar lógica para outros CDNs ou subdomínios se houver
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

                        // 1. Reescrever Fetch API
                        const originalFetch = window.fetch;
                        window.fetch = function(input, init) {
                            let url = input;
                            if (typeof input === 'string') {
                                if (input.startsWith(readingSubdomainTarget)) {
                                    url = input.replace(readingSubdomainTarget, proxyPrefix);
                                    // console.log('Proxying fetch (reading): ' + input + ' -> ' + url); // Comentado para evitar poluição
                                } else if (input.startsWith(mainTargetOrigin)) {
                                    url = input.replace(mainTargetOrigin, currentProxyHost);
                                    // console.log('Proxying fetch (main): ' + input + ' -> ' + url); // Comentado para evitar poluição
                                } else if (input.startsWith('https://api.appnebula.co')) {
                                    url = input.replace('https://api.appnebula.co', currentProxyHost + '/api-proxy');
                                    // console.log('Proxying fetch (API): ' + input + ' -> ' + url); // Comentado para evitar poluição
                                }
                            } else if (input instanceof Request) {
                                if (input.url.startsWith(readingSubdomainTarget)) {
                                    url = new Request(input.url.replace(readingSubdomainTarget, proxyPrefix), input);
                                    // console.log('Proxying fetch (Request, reading): ' + input.url + ' -> ' + url.url); // Comentado para evitar poluição
                                } else if (input.url.startsWith(mainTargetOrigin)) {
                                    url = new Request(input.url.replace(mainTargetOrigin, currentProxyHost), input);
                                    // console.log('Proxying fetch (Request, main): ' + input.url + ' -> ' + url.url); // Comentado para evitar poluição
                                } else if (input.url.startsWith('https://api.appnebula.co')) {
                                    url = new Request(input.url.replace('https://api.appnebula.co', currentProxyHost + '/api-proxy'), input);
                                    // console.log('Proxying fetch (Request, API): ' + input.url + ' -> ' + url.url); // Comentado para evitar poluição
                                }
                            }
                            return originalFetch.call(this, url, init);
                        };

                        // 2. Reescrever XMLHttpRequest (XHR)
                        const originalXHRopen = XMLHttpRequest.prototype.open;
                        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
                            let modifiedUrl = url;
                            if (typeof url === 'string') {
                                if (url.startsWith(readingSubdomainTarget)) {
                                    modifiedUrl = url.replace(readingSubdomainTarget, proxyPrefix);
                                    // console.log('Proxying XHR (reading): ' + url + ' -> ' + modifiedUrl); // Comentado para evitar poluição
                                } else if (url.startsWith(mainTargetOrigin)) {
                                    modifiedUrl = url.replace(mainTargetOrigin, currentProxyHost);
                                    // console.log('Proxying XHR (main): ' + url + ' -> ' + modifiedUrl); // Comentado para evitar poluição
                                } else if (url.startsWith('https://api.appnebula.co')) {
                                    modifiedUrl = url.replace('https://api.appnebula.co', currentProxyHost + '/api-proxy');
                                    // console.log('Proxying XHR (API): ' + url + ' -> ' + modifiedUrl); // Comentado para evitar poluição
                                }
                            }
                            originalXHRopen.call(this, method, modifiedUrl, async, user, password);
                        };

                        // 3. Interceptar window.postMessage
                        const originalPostMessage = window.postMessage;
                        window.postMessage = function(message, targetOrigin, transfer) {
                            let modifiedTargetOrigin = targetOrigin;
                            if (typeof targetOrigin === 'string' && targetOrigin.startsWith(mainTargetOrigin)) {
                                modifiedTargetOrigin = currentProxyHost;
                                // console.log('Proxying postMessage targetOrigin: ' + targetOrigin + ' -> ' + modifiedTargetOrigin); // Comentado para evitar poluição
                            }
                            originalPostMessage.call(this, message, modifiedTargetOrigin, transfer);
                        };

                        // --- Script de Verificação de Injeção e DOM (Botão de Teste) ---
                        // ESTE É O SCRIPT QUE MOSTRARÁ QUE A INJEÇÃO ESTÁ FUNCIONANDO
                        console.log('✅ Script de verificação de injeção e DOM executado!');

                        const testButton = document.createElement('button');
                        testButton.id = 'gemini-test-button';
                        testButton.style.position = 'fixed';
                        testButton.style.bottom = '20px';
                        testButton.style.right = '20px';
                        testButton.style.backgroundColor = 'purple';
                        testButton.style.color = 'white';
                        testButton.style.padding = '10px 20px';
                        testButton.style.border = 'none';
                        testButton.style.borderRadius = '5px';
                        testButton.style.zIndex = '999999'; // Garante que fique por cima
                        testButton.textContent = 'Botão Teste Gemini';

                        document.body.appendChild(testButton);
                        console.log('🚀 Botão de teste Gemini injetado no DOM!');

                        testButton.addEventListener('click', () => {
                            alert('Botão de Teste Gemini clicado!');
                            console.log('🎉 Botão de Teste Gemini clicado!');
                        });

                        // --- Adicione SEUS BOTÕES INVISÍVEIS AQUI ---
                        // Exemplo:
                        /*
                        const invisibleButton = document.createElement('div');
                        invisibleButton.id = 'meu-botao-invisivel';
                        invisibleButton.style.position = 'absolute'; // Ou 'fixed'
                        invisibleButton.style.top = '100px'; // Ajuste a posição
                        invisibleButton.style.left = '50px'; // Ajuste a posição
                        invisibleButton.style.width = '50px'; // Ajuste o tamanho
                        invisibleButton.style.height = '50px'; // Ajuste o tamanho
                        invisibleButton.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'; // Vermelho transparente para depuração
                        invisibleButton.style.zIndex = '999999'; // Garante que fique por cima
                        invisibleButton.style.cursor = 'pointer'; // Indica que é clicável
                        // Se for realmente invisível para o usuário final, defina:
                        // invisibleButton.style.opacity = '0';
                        // invisibleButton.style.pointerEvents = 'auto'; // Garante que seja clicável mesmo invisível

                        document.body.appendChild(invisibleButton);
                        console.log('Botão invisível personalizado injetado!');

                        invisibleButton.addEventListener('click', () => {
                            console.log('Botão invisível personalizado clicado!');
                            // Adicione sua lógica aqui, por exemplo, simular um clique
                            // document.elementFromPoint(123, 456).click();
                        });
                        */
                        // --- Fim da área para seus botões ---

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

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
