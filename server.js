// server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { URL } = require('url');
const fileUpload = require('express-fileupload');

const app = express();
const PORT = process.env.PORT || 10000;

// URLs de destino
const MAIN_TARGET_URL = 'https://appnebula.co';
const READING_SUBDOMAIN_TARGET = 'https://reading.nebulahoroscope.com';

// Configurações para Modificação de Conteúdo
const USD_TO_BRL_RATE = 5.00;
const CONVERSION_PATTERN = /\$(\d+(\.\d{2})?)/g;

// Variável para armazenar o texto capturado (mantida por retrocompatibilidade, mas a nova abordagem usa localStorage)
let capturedBoldText = ''; // Esta variável será menos relevante agora, mas a manterei.
let lastCaptureTime = 0;
let isCapturing = false;

// Usa express-fileupload para lidar com uploads de arquivos (multipart/form-data)
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    createParentPath: true,
    uriDecodeFileNames: true,
    preserveExtension: true
}));

// Middleware para servir arquivos estáticos da build do React
app.use(express.static(path.join(__dirname, 'dist')));

// API endpoint para obter o texto capturado (se ainda for usada pelo seu app.tsx)
app.get('/api/captured-text', (req, res) => {
    console.log('📡 API /api/captured-text chamada');
    console.log('📝 Texto atual na variável (via backend):', `"${capturedBoldText}"`);
    console.log('🕐 Último tempo de captura:', new Date(lastCaptureTime).toISOString());
    console.log('🔄 Está capturando:', isCapturing);

    res.json({
        capturedText: capturedBoldText,
        lastCaptureTime: lastCaptureTime,
        isCapturing: isCapturing,
        timestamp: Date.now()
    });
});

// Remover a função extractTextFromHTML, pois a captura será no cliente.
// Remover a função captureTextDirectly, pois não precisamos mais tentar raspar o <b> estático.

// Rota específica para a página customizada de trialChoice - AGORA REDIRECIONA SEM CAPTURA DE BACKEND
app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== INTERCEPTANDO TRIALCHOICE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);

    // Redireciona diretamente para o seu app.tsx (rota /onboarding ou outra que você controle)
    // A escolha do quiz será recuperada no app.tsx via localStorage ou query param
    console.log('✅ Redirecionando trialChoice para /pt/witch-power/onboarding para o seu app.tsx.');
    // Se você quiser passar a escolha via URL, você precisaria ter capturado ela ANTES
    // e ter passado essa informação para o backend de alguma forma (ex: de um cookie, ou uma rota intermediária)
    // Por enquanto, a solução mais robusta é ler do localStorage no seu app.tsx
    return res.redirect(302, '/pt/witch-power/onboarding'); // Assumindo que seu app.tsx lida com esta rota
});

// Middleware Principal do Proxy Reverso
app.use(async (req, res) => {
    let targetDomain = MAIN_TARGET_URL;
    let requestPath = req.url;

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];
    delete requestHeaders['accept-encoding'];

    if (req.url.startsWith('/reading/')) {
        targetDomain = READING_SUBDOMAIN_TARGET;
        requestPath = req.url.substring('/reading'.length);
        if (requestPath === '') requestPath = '/';
        console.log(`[READING PROXY] Requisição: ${req.url} -> Proxy para: ${targetDomain}${requestPath}`);
        console.log(`[READING PROXY] Método: ${req.method}`);

        if (req.files && Object.keys(req.files).length > 0) {
            console.log(`[READING PROXY] Arquivos recebidos: ${JSON.stringify(Object.keys(req.files))}`);
            const photoFile = req.files.photo;
            if (photoFile) {
                console.log(`[READING PROXY] Arquivo 'photo': name=${photoFile.name}, size=${photoFile.size}, mimetype=${photoFile.mimetype}`);
            }
        } else {
            console.log(`[READING PROXY] Corpo recebido (tipo): ${typeof req.body}`);
        }
    } else {
        console.log(`[MAIN PROXY] Requisição: ${req.url} -> Proxy para: ${targetDomain}${requestPath}`);
    }

    const targetUrl = `${targetDomain}${requestPath}`;

    try {
        let requestData = req.body;

        if (req.files && Object.keys(req.files).length > 0) {
            const photoFile = req.files.photo;

            if (photoFile) {
                const formData = new (require('form-data'))();
                formData.append('photo', photoFile.data, {
                    filename: photoFile.name,
                    contentType: photoFile.mimetype,
                });
                requestData = formData;
                delete requestHeaders['content-type'];
                delete requestHeaders['content-length'];
                Object.assign(requestHeaders, formData.getHeaders());
            }
        }

        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: requestHeaders,
            data: requestData,
            responseType: 'arraybuffer',
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
        });

        // Lógica de Interceptação de Redirecionamento (Status 3xx)
        if (response.status >= 300 && response.status < 400) {
            const redirectLocation = response.headers.location;
            if (redirectLocation) {
                let fullRedirectUrl;
                try {
                    fullRedirectUrl = new URL(redirectLocation, targetDomain).href;
                } catch (e) {
                    console.error("Erro ao parsear URL de redirecionamento:", redirectLocation, e.message);
                    fullRedirectUrl = redirectLocation;
                }

                // Esta regra AINDA captura redirecionamentos do SERVIDOR DE DESTINO para /email
                if (fullRedirectUrl.includes('/pt/witch-power/email')) {
                    console.log('Interceptando redirecionamento do servidor de destino para /email. Redirecionando para /onboarding.');
                    return res.redirect(302, '/pt/witch-power/onboarding');
                }

                let proxiedRedirectPath = fullRedirectUrl;
                if (proxiedRedirectPath.startsWith(MAIN_TARGET_URL)) {
                    proxiedRedirectPath = proxiedRedirectPath.replace(MAIN_TARGET_URL, '');
                } else if (proxiedRedirectPath.startsWith(READING_SUBDOMAIN_TARGET)) {
                    proxiedRedirectPath = proxiedRedirectPath.replace(READING_SUBDOMAIN_TARGET, '/reading');
                }
                if (proxiedRedirectPath === '') proxiedRedirectPath = '/';

                console.log(`Redirecionamento do destino: ${fullRedirectUrl} -> Reescrevendo para: ${proxiedRedirectPath}`);
                return res.redirect(response.status, proxiedRedirectPath);
            }
        }

        // Repassa Cabeçalhos da Resposta do Destino para o Cliente
        Object.keys(response.headers).forEach(header => {
            if (!['transfer-encoding', 'content-encoding', 'content-length', 'set-cookie', 'host', 'connection'].includes(header.toLowerCase())) {
                res.setHeader(header, response.headers[header]);
            }
        });

        // Lida com o cabeçalho 'Set-Cookie': reescreve o domínio do cookie para o seu domínio
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            const modifiedCookies = cookies.map(cookie => {
                return cookie
                    .replace(/Domain=[^;]+/, '')
                    .replace(/; Secure/, '')
                    .replace(/; Path=\//, `; Path=${req.baseUrl || '/'}`);
            });
            res.setHeader('Set-Cookie', modifiedCookies);
        }

        // Lógica de Modificação de Conteúdo (Apenas para HTML)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf8');
            const $ = cheerio.load(html);

            // Reescrever todas as URLs relativas e absolutas
            $('[href], [src], [action]').each((i, el) => {
                const element = $(el);
                let attrName = '';
                if (element.is('link') || element.is('a') || element.is('area')) {
                    attrName = 'href';
                } else if (element.is('script') || element.is('img') || element.is('source') || element.is('iframe')) {
                    attrName = 'src';
                } else if (element.is('form')) {
                    attrName = 'action';
                }

                if (attrName) {
                    let originalUrl = element.attr(attrName);
                    if (originalUrl) {
                        if (originalUrl.startsWith('/') && !originalUrl.startsWith('/reading/')) {
                            // URLs relativas para o domínio principal
                        } else if (originalUrl.startsWith('/reading/')) {
                            // URLs para o subdomínio de leitura, já estão corretas
                        } else if (originalUrl.startsWith(MAIN_TARGET_URL)) {
                            element.attr(attrName, originalUrl.replace(MAIN_TARGET_URL, ''));
                        } else if (originalUrl.startsWith(READING_SUBDOMAIN_TARGET)) {
                            element.attr(attrName, originalUrl.replace(READING_SUBDOMAIN_TARGET, '/reading'));
                        }
                    }
                }
            });

            // Script para reescrever URLs de API dinâmicas no JavaScript
            $('head').prepend(`
                <script>
                    (function() {
                        const readingSubdomainTarget = '${READING_SUBDOMAIN_TARGET}';
                        const proxyPrefix = '/reading';

                        const originalFetch = window.fetch;
                        window.fetch = function(input, init) {
                            let url = input;
                            if (typeof input === 'string' && input.startsWith(readingSubdomainTarget)) {
                                url = input.replace(readingSubdomainTarget, proxyPrefix);
                                console.log('PROXY SHIM: REWRITE FETCH URL:', input, '->', url);
                            } else if (input instanceof Request && input.url.startsWith(readingSubdomainTarget)) {
                                url = new Request(input.url.replace(readingSubdomainTarget, proxyPrefix), {
                                    method: input.method,
                                    headers: input.headers,
                                    body: input.body,
                                    mode: input.mode,
                                    credentials: input.credentials,
                                    cache: input.cache,
                                    redirect: input.redirect,
                                    referrer: input.referrer,
                                    integrity: input.integrity,
                                    keepalive: input.keepalive
                                });
                                console.log('PROXY SHIM: REWRITE FETCH Request Object URL:', input.url, '->', url.url);
                            }
                            return originalFetch.call(this, url, init);
                        };

                        const originalXHRopen = XMLHttpRequest.prototype.open;
                        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
                            let modifiedUrl = url;
                            if (typeof url === 'string' && url.startsWith(readingSubdomainTarget)) {
                                modifiedUrl = url.replace(readingSubdomainTarget, proxyPrefix);
                                console.log('PROXY SHIM: REWRITE XHR URL:', url, '->', modifiedUrl);
                            }
                            originalXHRopen.call(this, method, modifiedUrl, async, user, password);
                        };
                    })();
                </script>
            `);

            // REDIRECIONAMENTO CLIENT-SIDE MAIS AGRESSIVO PARA /pt/witch-power/email
            $('head').append(`
                <script>
                    console.log('CLIENT-SIDE REDIRECT SCRIPT: Initializing.');

                    let emailRedirectCheckInterval;

                    function handleEmailRedirect() {
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/pt/witch-power/email')) {
                            console.log('CLIENT-SIDE REDIRECT: URL /pt/witch-power/email detectada. Forçando redirecionamento para /pt/witch-power/onboarding');
                            if (emailRedirectCheckInterval) {
                                clearInterval(emailRedirectCheckInterval);
                            }
                            window.location.replace('/pt/witch-power/onboarding');
                        }
                    }

                    document.addEventListener('DOMContentLoaded', handleEmailRedirect);
                    window.addEventListener('popstate', handleEmailRedirect);
                    emailRedirectCheckInterval = setInterval(handleEmailRedirect, 100);

                    window.addEventListener('beforeunload', () => {
                        if (emailRedirectCheckInterval) {
                            clearInterval(emailRedirectCheckInterval);
                        }
                    });

                    handleEmailRedirect();
                </script>
            `);

            // REMOVEMOS AQUI O REDIRECIONAMENTO CLIENT-SIDE PARA /pt/witch-power/trialChoice
            // POIS AGORA O SERVER.JS JÁ REDIRECIONA DIRETAMENTE.
            // VOCÊ NÃO QUER UM RELOAD, QUER UM REDIRECIONAMENTO LIMPO.

            // 🎯 NOVO SCRIPT PARA CAPTURAR A ESCOLHA DO QUIZ NA PÁGINA wpGoal (FRONT-END)
            if (req.url.includes('/pt/witch-power/wpGoal')) {
                console.log('Injetando script de captura de quiz na página wpGoal.');
                $('body').append(`
                    <script>
                        (function() {
                            const answerButtons = document.querySelectorAll('li[data-testid="answer-button"]');
                            console.log('Quiz capture script active. Found ' + answerButtons.length + ' answer buttons.');

                            answerButtons.forEach(button => {
                                button.addEventListener('click', function() {
                                    const chosenTextElement = this.querySelector('.sc-5303d838-10.gdosuv');
                                    if (chosenTextElement) {
                                        const chosenText = chosenTextElement.textContent.trim();
                                        console.log('Quiz choice captured: ' + chosenText);
                                        localStorage.setItem('nebulaQuizChoice', chosenText); // Salva no localStorage
                                    } else {
                                        console.warn('Could not find choice text element inside clicked button.');
                                    }
                                });
                            });
                        })();
                    </script>
                `);
            }

            // MODIFICAÇÕES ESPECÍFICAS PARA /pt/witch-power/trialPaymentancestral
            if (req.url.includes('/pt/witch-power/trialPaymentancestral')) {
                console.log('Modificando conteúdo para /trialPaymentancestral (preços e links de botões).');
                $('body').html(function(i, originalHtml) {
                    return originalHtml.replace(CONVERSION_PATTERN, (match, p1) => {
                        const usdValue = parseFloat(p1);
                        const brlValue = (usdValue * USD_TO_BRL_RATE).toFixed(2).replace('.', ',');
                        return `R$ ${brlValue}`;
                    });
                });
                $('#buyButtonAncestral').attr('href', 'https://seusite.com/link-de-compra-ancestral-em-reais');
                $('.cta-button-trial').attr('href', 'https://seusite.com/novo-link-de-compra-geral');
                $('a:contains("Comprar Agora")').attr('href', 'https://seusite.com/meu-novo-link-de-compra-agora');
                $('h1:contains("Trial Payment Ancestral")').text('Pagamento da Prova Ancestral (Preços e Links Atualizados)');
            }

            res.status(response.status).send($.html());
        } else {
            res.status(response.status).send(response.data);
        }

    } catch (error) {
        console.error('Erro no proxy:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            if (error.response.status === 508) {
                res.status(508).send('Erro ao carregar o conteúdo do site externo: Loop Detectado. Por favor, verifique a configuração do proxy ou redirecionamentos.');
            } else {
                res.status(error.response.status).send(`Erro ao carregar o conteúdo do site externo: ${error.response.statusText || 'Erro desconhecido'}`);
            }
        } else {
            res.status(500).send('Erro interno do servidor proxy.');
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor proxy rodando em http://localhost:${PORT}`);
    console.log(`Acesse o site "clonado" em http://localhost:${PORT}/pt/witch-power/prelanding`);
});
