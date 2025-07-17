// server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { URL } = require('url');
const fileUpload = require('express-fileupload');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 10000;

const MAIN_TARGET_URL = 'https://appnebula.co';
const READING_SUBDOMAIN_TARGET = 'https://reading.nebulahoroscope.com';

const USD_TO_BRL_RATE = 5.00;
const CONVERSION_PATTERN = /\$(\d+(\.\d{2})?)/g;

// Variáveis para depuração (mantidas, mas não essenciais para a funcionalidade principal)
let capturedBoldText = '';
let lastCaptureTime = 0;
let isCapturing = false;

app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    createParentPath: true,
    uriDecodeFileNames: true,
    preserveExtension: true
}));

// --- PASSO 1: Rota específica para servir o SEU React App para `/meu-app/trial-choice` ---
// ESSA ROTA DEVE VIR ANTES do `express.static` e do proxy principal.
app.get('/meu-app/trial-choice', (req, res) => {
    console.log('✅ Servindo React App (index.html) para a rota /meu-app/trial-choice');
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Middleware para servir arquivos estáticos da build do React (CSS, JS, etc.)
// Isso deve vir depois de rotas específicas que servem o index.html,
// mas antes do proxy para evitar que assets do seu app sejam proxyados.
app.use(express.static(path.join(__dirname, 'dist')));

// API endpoint para obter o texto capturado (mantido para compatibilidade, mas o app.tsx lê direto do localStorage)
app.get('/api/captured-text', (req, res) => {
    console.log('📡 API /api/captured-text chamada');
    console.log('📝 Texto atual na variável (via backend):', `"${capturedBoldText}"`);
    res.json({
        capturedText: capturedBoldText,
        lastCaptureTime: lastCaptureTime,
        isCapturing: isCapturing,
        timestamp: Date.now()
    });
});

// --- PASSO 2: Interceptar `/pt/witch-power/trialChoice` e redirecionar para SUA rota do React ---
// Essa rota também deve vir antes do middleware de proxy principal.
app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== INTERCEPTANDO TRIALCHOICE DO SITE ORIGINAL ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);
    console.log('✅ Redirecionando trialChoice para a rota do SEU app React: /meu-app/trial-choice');
    // Redireciona para a rota do seu app React que renderiza TrialChoice.tsx
    // A escolha do quiz será recuperada no app.tsx via localStorage.
    return res.redirect(302, '/meu-app/trial-choice');
});


// Middleware Principal do Proxy Reverso
app.use(async (req, res) => {
    let targetDomain = MAIN_TARGET_URL;
    let requestPath = req.url;

    // --- PASSO 3: EXCLUIR as rotas do SEU React App do proxy ---
    // É crucial que requisições para URLs do seu próprio app (ex: `/meu-app/trial-choice`)
    // NÃO sejam proxyadas para o site original. Elas devem ser servidas localmente.
    if (req.url.startsWith('/meu-app/') || req.url === '/') {
        console.log(`⚠️ Ignorando requisição para rota do app React no proxy: ${req.url}`);
        // Se a requisição é para a raiz ou para uma rota do seu app React
        // e não foi tratada pelas regras `app.get` acima, provavelmente é um asset
        // que `express.static` deve ter servido. Se chegou aqui, algo está errado
        // ou é uma rota que não existe no seu app.
        // O `express.static` acima já deve estar tratando os assets.
        return res.status(404).send('Recurso não encontrado no seu aplicativo.');
    }

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
    } else {
        console.log(`[MAIN PROXY] Requisição: ${req.url} -> Proxy para: ${targetDomain}${requestPath}`);
    }

    const targetUrl = `${targetDomain}${requestPath}`;

    try {
        let requestData = req.body;

        if (req.files && Object.keys(req.files).length > 0) {
            const photoFile = req.files.photo;
            if (photoFile) {
                const formData = new FormData();
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

                if (fullRedirectUrl.includes('/pt/witch-power/email')) {
                    console.log('Interceptando redirecionamento do servidor de destino para /email. Redirecionando para /pt/witch-power/onboarding.');
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
                    .replace(/; Path=\//, `; Path=${req.baseUrl || '/'}`);
            });
            res.setHeader('Set-Cookie', modifiedCookies);
        }

        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf8');
            const $ = cheerio.load(html);

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

            const proxyHost = req.protocol + '://' + req.get('host');
            $('head').prepend(`
                <script>
                    (function() {
                        const readingSubdomainTarget = '${READING_SUBDOMAIN_TARGET}';
                        const mainTargetOrigin = '${MAIN_TARGET_URL}';
                        const proxyPrefix = '/reading';
                        const currentProxyHost = '${proxyHost}';

                        const originalFetch = window.fetch;
                        window.fetch = function(input, init) {
                            let url = input;
                            if (typeof input === 'string') {
                                if (input.startsWith(readingSubdomainTarget)) {
                                    url = input.replace(readingSubdomainTarget, proxyPrefix);
                                } else if (input.startsWith(mainTargetOrigin)) {
                                    url = input.replace(mainTargetOrigin, currentProxyHost);
                                }
                            } else if (input instanceof Request) {
                                if (input.url.startsWith(readingSubdomainTarget)) {
                                    url = new Request(input.url.replace(readingSubdomainTarget, proxyPrefix), input);
                                } else if (input.url.startsWith(mainTargetOrigin)) {
                                    url = new Request(input.url.replace(mainTargetOrigin, currentProxyHost), input);
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
                                }
                            }
                            originalXHRopen.call(this, method, modifiedUrl, async, user, password);
                        };
                    })();
                </script>
            `);

            // CLIENT-SIDE REDIRECT PARA /pt/witch-power/email (MANTIDO)
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

            // --- SCRIPT CORRIGIDO PARA CAPTURAR A ESCOLHA DO QUIZ NA PÁGINA wpGoal (FRONT-END) ---
            if (req.url.includes('/pt/witch-power/wpGoal')) {
                console.log('Injetando script de captura de quiz na página wpGoal.');
                $('body').append(`
                    <script>
                        (function() {
                            // Usamos o seletor exato do seu HTML para os botões de resposta.
                            const answerButtons = document.querySelectorAll('li[data-testid="answer-button"]');
                            console.log('Quiz capture script active. Found ' + answerButtons.length + ' answer buttons.');

                            answerButtons.forEach(button => {
                                button.addEventListener('click', function() {
                                    // Selecionamos o span específico que contém o texto da opção
                                    const chosenTextElement = this.querySelector('span.sc-5303d838-10.gdosuv');
                                    
                                    if (chosenTextElement) {
                                        const chosenText = chosenTextElement.textContent.trim();
                                        console.log('Quiz choice captured: ' + chosenText);
                                        localStorage.setItem('nebulaQuizChoice', chosenText); // Salva no localStorage
                                    } else {
                                        console.warn('Could not find the specific text span element inside the clicked button. Check the selector "span.sc-5303d838-10.gdosuv".');
                                    }
                                });
                            });
                        })();
                    </script>
                `);
            }

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
