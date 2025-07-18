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

            // --- INJEÇÃO DE SCRIPTS CLIENT-SIDE E MANIPULAÇÃO DE DOM ---
            // Usando concatenação de strings para as variáveis para evitar o erro de sintaxe
            // no servidor ao interpretar template literals aninhados.
            const clientScript = `
                <script>
                    (function() {
                        const readingSubdomainTarget = '${READING_SUBDOMAIN_TARGET}';
                        const mainTargetOrigin = '${MAIN_TARGET_URL}';
                        const proxyPrefix = '/reading';
                        // Injetando proxyHost e targetPagePath como strings literais
                        const currentProxyHost = '${proxyHost}'; 
                        const targetPagePath = '/pt/witch-power/wpGoal'; 

                        // Funções de interceptação de Fetch, XHR e PostMessage
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

                        // --- FUNÇÃO PARA GERENCIAR BOTÕES INVISÍVEIS ---
                        let buttonsInjected = false; // Flag para controlar injeção

                        // Definição dos botões com suas coordenadas, dimensões e texto a ser salvo
                        const invisibleButtonsConfig = [
                            { 
                                id: 'btn-choice-1', 
                                top: '440px', 
                                left: '50px', 
                                width: '270px', 
                                height: '55px', 
                                text: 'texto da escolha 1' 
                            },
                            { 
                                id: 'btn-choice-2', 
                                top: '500px', 
                                left: '50px', 
                                width: '270px', 
                                height: '55px', 
                                text: 'texto da escolha 2' 
                            },
                            { 
                                id: 'btn-choice-3', 
                                top: '560px', 
                                left: '50px', 
                                width: '270px', 
                                height: '55px', 
                                text: 'texto da escolha 3' 
                            },
                            { 
                                id: 'btn-choice-4', 
                                top: '620px', 
                                left: '50px', 
                                width: '270px', 
                                height: '55px', 
                                text: 'texto da escolha 4' 
                            }
                            // Adicione mais botões aqui se precisar
                        ];

                        function manageInvisibleButtons() {
                            const currentPagePath = window.location.pathname;
                            const isTargetPage = currentPagePath === targetPagePath;

                            // Mensagem de log para cada verificação
                            console.log(\`[Monitor] URL atual: \${currentPagePath}. Página alvo: \${targetPagePath}. É a página alvo? \${isTargetPage}\`);

                            if (isTargetPage && !buttonsInjected) {
                                // INJETAR BOTÕES
                                console.log('Página wpGoal detectada! Injetando botões invisíveis...');
                                
                                invisibleButtonsConfig.forEach(config => {
                                    const button = document.createElement('div');
                                    button.id = config.id;
                                    button.style.position = 'absolute';
                                    button.style.top = config.top;
                                    button.style.left = config.left;
                                    button.style.width = config.width;
                                    button.style.height = config.height;
                                    button.style.zIndex = '9999999'; // Acima de tudo
                                    button.style.cursor = 'pointer'; // Para indicar que é clicável
                                    
                                    // Torna o botão invisível para o usuário final
                                    button.style.opacity = '0'; 
                                    button.style.pointerEvents = 'auto'; // Garante que seja clicável mesmo invisível

                                    document.body.appendChild(button);
                                    console.log(\`✅ Botão invisível '\${config.id}' injetado na página wpGoal!\`);

                                    button.addEventListener('click', (event) => {
                                        console.log(\`🎉 Botão invisível '\${config.id}' clicado na wpGoal!\`);
                                        
                                        // 1. Simular clique na posição do botão invisível
                                        // Isso vai avançar o quiz na página original
                                        const rect = button.getBoundingClientRect();
                                        const x = rect.left + rect.width / 2;
                                        const y = rect.top + rect.height / 2;
                                        
                                        const clickEvent = new MouseEvent('click', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: x,
                                            clientY: y
                                        });
                                        // Tenta disparar o evento no elemento que está na posição
                                        const targetElement = document.elementFromPoint(x, y);
                                        if (targetElement) {
                                            targetElement.dispatchEvent(clickEvent);
                                            console.log(\`Simulou clique em:\`, targetElement);
                                        } else {
                                            console.warn('Nenhum elemento encontrado para simular clique nas coordenadas.');
                                        }

                                        // 2. Enviar dados para o front-end React (trialChoice.tsx)
                                        // Enviamos uma mensagem para o window, que o seu app React pode ouvir.
                                        window.postMessage({
                                            type: 'QUIZ_CHOICE_SELECTED',
                                            text: config.text
                                        }, window.location.origin); // O targetOrigin deve ser o seu próprio host (Render URL)
                                        console.log(\`Dados enviados para o React: '\${config.text}'\`);
                                    });
                                });

                                buttonsInjected = true; // Define a flag para evitar reinjeção
                                
                            } else if (!isTargetPage && buttonsInjected) {
                                // REMOVER BOTÕES se não estiver mais na página alvo
                                console.log('Saindo da página wpGoal. Removendo botões invisíveis...');
                                invisibleButtonsConfig.forEach(config => {
                                    const buttonElement = document.getElementById(config.id);
                                    if (buttonElement) {
                                        buttonElement.remove();
                                        console.log(\`🗑️ Botão invisível '\${config.id}' removido.\`);
                                    }
                                });
                                buttonsInjected = false; // Reseta a flag
                            }
                        }

                        // --- Lógica de Inicialização e Monitoramento ---
                        document.addEventListener('DOMContentLoaded', function() {
                            console.log('Script de injeção de proxy carregado no cliente.');

                            // Chama a função de gerenciamento de botões na carga inicial
                            manageInvisibleButtons();

                            // Monitora a URL a cada 500ms (0.5 segundos)
                            // Isso é crucial para SPAs como a Nebula.
                            setInterval(manageInvisibleButtons, 500); 
                        });

                    })();
                </script>
            `;
            
            // Agora sim, injetamos a string construída
            $('head').prepend(clientScript);

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
