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
            $('head').prepend(`
                <script>
                    (function() {
                        const readingSubdomainTarget = '${READING_SUBDOMAIN_TARGET}';
                        const mainTargetOrigin = '${MAIN_TARGET_URL}';
                        const proxyPrefix = '/reading';
                        const currentProxyHost = '${proxyHost}';
                        const targetPagePath = '/pt/witch-power/wpGoal'; // A página onde você quer os botões invisíveis

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

                        // --- FUNÇÃO PARA INJETAR/REMOVER BOTÕES INVISÍVEIS ---
                        let buttonsInjected = false; // Flag para controlar injeção

                        function manageInvisibleButtons() {
                            const currentPagePath = window.location.pathname;
                            const isTargetPage = currentPagePath === targetPagePath;
                            const testButtonElement = document.getElementById('gemini-test-button'); // Pegar o botão de teste roxo
                            const invisibleButton1Element = document.getElementById('invisible-button-1'); // Pegar o botão invisível de exemplo

                            // Mensagem de log para cada verificação
                            console.log(\`[Monitor] URL atual: \${currentPagePath}. Página alvo: \${targetPagePath}. É a página alvo? \${isTargetPage}\`);

                            if (isTargetPage && !buttonsInjected) {
                                // INJETAR BOTÕES
                                console.log('Página wpGoal detectada! Injetando botões invisíveis...');
                                
                                // --- COMEÇO DA ÁREA PARA SEUS BOTÕES INVISÍVEIS ---
                                // Você pode copiar e colar a lógica para cada botão aqui.
                                // Exemplo de um botão invisível nas coordenadas.
                                // Lembre-se de ajustar 'top', 'left', 'width', 'height' e a 'ação' do clique.

                                const invisibleButton1 = document.createElement('div');
                                invisibleButton1.id = 'invisible-button-1';
                                invisibleButton1.style.position = 'absolute'; // Use 'absolute' para coordenadas relativas ao scroll ou 'fixed' para fixar na tela.
                                invisibleButton1.style.top = '100px'; // EX: 100px do topo da página
                                invisibleButton1.style.left = '50px'; // EX: 50px da esquerda da página
                                invisibleButton1.style.width = '100px'; // EX: 100px de largura
                                invisibleButton1.style.height = '50px'; // EX: 50px de altura
                                invisibleButton1.style.backgroundColor = 'rgba(0, 255, 0, 0.3)'; // Verde transparente para visualização durante o desenvolvimento
                                invisibleButton1.style.zIndex = '9999999'; // Acima de tudo
                                invisibleButton1.style.cursor = 'pointer'; // Para indicar que é clicável

                                // Para torná-lo realmente invisível ao usuário final, use:
                                // invisibleButton1.style.opacity = '0';
                                // invisibleButton1.style.pointerEvents = 'auto'; // Garante que seja clicável mesmo invisível

                                document.body.appendChild(invisibleButton1);
                                console.log('✅ Botão invisível 1 injetado na página wpGoal!');

                                invisibleButton1.addEventListener('click', () => {
                                    console.log('🎉 Botão invisível 1 clicado na wpGoal!');
                                    // Adicione a lógica do que deve acontecer quando este botão for clicado
                                    // Por exemplo, simular um clique em um elemento da página original:
                                    // document.elementFromPoint(coordenadaX, coordenadaY).click();
                                });

                                // Exemplo de outro botão:
                                /*
                                const invisibleButton2 = document.createElement('div');
                                invisibleButton2.id = 'invisible-button-2';
                                invisibleButton2.style.position = 'absolute';
                                invisibleButton2.style.top = '250px';
                                invisibleButton2.style.left = '150px';
                                invisibleButton2.style.width = '80px';
                                invisibleButton2.style.height = '40px';
                                invisibleButton2.style.backgroundColor = 'rgba(0, 0, 255, 0.3)'; // Azul transparente
                                invisibleButton2.style.zIndex = '9999999';
                                invisibleButton2.style.cursor = 'pointer';
                                // Para invisibilidade real:
                                // invisibleButton2.style.opacity = '0';
                                // invisibleButton2.style.pointerEvents = 'auto';

                                document.body.appendChild(invisibleButton2);
                                console.log('✅ Botão invisível 2 injetado na página wpGoal!');

                                invisibleButton2.addEventListener('click', () => {
                                    console.log('🎉 Botão invisível 2 clicado na wpGoal!');
                                    // Lógica para o segundo botão
                                });
                                */
                                // --- FIM DA ÁREA PARA SEUS BOTÕES INVISÍVEIS ---
                                buttonsInjected = true; // Define a flag para evitar reinjeção
                                
                                // Ocultar o banner vermelho de teste se estiver na página alvo
                                if (testButtonElement) {
                                    testButtonElement.style.display = 'none'; 
                                }

                            } else if (!isTargetPage && buttonsInjected) {
                                // REMOVER BOTÕES se não estiver mais na página alvo
                                console.log('Saindo da página wpGoal. Removendo botões invisíveis...');
                                if (invisibleButton1Element) {
                                    invisibleButton1Element.remove();
                                }
                                // Remova outros botões invisíveis aqui se existirem
                                // if (invisibleButton2Element) { invisibleButton2Element.remove(); }

                                buttonsInjected = false; // Reseta a flag
                                
                                // Mostrar o banner vermelho de teste novamente
                                if (testButtonElement) {
                                    testButtonElement.style.display = 'block'; 
                                }
                            }
                        }

                        // --- Lógica de Injeção e Monitoramento ---
                        document.addEventListener('DOMContentLoaded', function() {
                            console.log('****** SCRIPT DE TESTE INJETADO COM SUCESSO! ******');

                            // Injeta o banner vermelho de teste que aparece em todas as páginas com HTML
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
                            
                            // Chama a função de gerenciamento de botões na carga inicial
                            manageInvisibleButtons();

                            // Monitora a URL a cada 500ms (0.5 segundos)
                            // Ajuste este intervalo se precisar de mais ou menos reatividade
                            setInterval(manageInvisibleButtons, 500); 
                        });

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
