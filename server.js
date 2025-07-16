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

// Variável para armazenar o texto capturado
let capturedBoldText = '';
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

// API endpoint para obter o texto capturado
app.get('/api/captured-text', (req, res) => {
    console.log('📡 API /api/captured-text chamada');
    console.log('📝 Texto atual na variável:', `"${capturedBoldText}"`);
    console.log('🕐 Último tempo de captura:', new Date(lastCaptureTime).toISOString());
    console.log('🔄 Está capturando:', isCapturing);
    
    res.json({ 
        capturedText: capturedBoldText,
        lastCaptureTime: lastCaptureTime,
        isCapturing: isCapturing,
        timestamp: Date.now()
    });
});

// Função para capturar texto com múltiplas estratégias
async function captureTextAdvanced() {
    if (isCapturing) {
        console.log('⏳ Captura já em andamento, aguardando...');
        return capturedBoldText;
    }
    
    isCapturing = true;
    
    try {
        console.log('\n=== INICIANDO CAPTURA AVANÇADA MULTI-ESTRATÉGIA ===');
        console.log('Timestamp início:', new Date().toISOString());
        
        // ESTRATÉGIA 1: Tentar com Playwright (melhor para produção)
        try {
            console.log('\n--- ESTRATÉGIA 1: PLAYWRIGHT ---');
            const { chromium } = require('playwright');
            
            const browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });

            const page = await browser.newPage();
            await page.setViewportSize({ width: 1920, height: 1080 });
            
            console.log('🌐 Navegando para:', `${MAIN_TARGET_URL}/pt/witch-power/trialChoice`);
            
            await page.goto(`${MAIN_TARGET_URL}/pt/witch-power/trialChoice`, {
                waitUntil: 'networkidle',
                timeout: 45000
            });
            
            console.log('✅ Página carregada, aguardando renderização...');
            await page.waitForTimeout(10000);
            
            // Tentar múltiplos seletores
            const selectors = [
                'p.sc-edafe909-6.pLaXn b',
                'p[class*="sc-edafe909-6"] b',
                'p:has-text("Ajudamos milhões") b',
                'b:has-text("desvendar")',
                'b:has-text("descobrir")',
                'b:has-text("identificar")'
            ];
            
            let boldText = null;
            for (const selector of selectors) {
                try {
                    const element = await page.locator(selector).first();
                    if (await element.count() > 0) {
                        boldText = await element.textContent();
                        if (boldText && boldText.trim().length > 5) {
                            console.log(`✅ PLAYWRIGHT: Texto encontrado com seletor "${selector}":`, `"${boldText.trim()}"`);
                            boldText = boldText.trim();
                            break;
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Seletor "${selector}" falhou:`, e.message);
                }
            }
            
            await browser.close();
            
            if (boldText && boldText.length > 5) {
                capturedBoldText = boldText;
                lastCaptureTime = Date.now();
                console.log('✅ ESTRATÉGIA 1 (PLAYWRIGHT) SUCESSO:', `"${capturedBoldText}"`);
                return capturedBoldText;
            }
            
        } catch (playwrightError) {
            console.log('❌ ESTRATÉGIA 1 (PLAYWRIGHT) falhou:', playwrightError.message);
        }
        
        // ESTRATÉGIA 2: Axios + Cheerio com múltiplas tentativas
        console.log('\n--- ESTRATÉGIA 2: AXIOS + CHEERIO ---');
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`Tentativa ${attempt}/3 com Axios...`);
                
                const response = await axios.get(`${MAIN_TARGET_URL}/pt/witch-power/trialChoice`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    },
                    timeout: 30000
                });
                
                const $ = cheerio.load(response.data);
                
                // Procurar por diferentes padrões
                const patterns = [
                    'p.sc-edafe909-6.pLaXn b',
                    'p[class*="sc-edafe909-6"] b',
                    'p:contains("Ajudamos milhões") b',
                    'b:contains("desvendar")',
                    'b:contains("descobrir")',
                    'b:contains("identificar")'
                ];
                
                let foundText = null;
                for (const pattern of patterns) {
                    const element = $(pattern).first();
                    if (element.length > 0) {
                        const text = element.text().trim();
                        if (text.length > 5) {
                            console.log(`✅ AXIOS: Texto encontrado com padrão "${pattern}":`, `"${text}"`);
                            foundText = text;
                            break;
                        }
                    }
                }
                
                if (foundText) {
                    capturedBoldText = foundText;
                    lastCaptureTime = Date.now();
                    console.log('✅ ESTRATÉGIA 2 (AXIOS) SUCESSO:', `"${capturedBoldText}"`);
                    return capturedBoldText;
                }
                
                // Se não encontrou, aguardar antes da próxima tentativa
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (axiosError) {
                console.log(`❌ Tentativa ${attempt} com Axios falhou:`, axiosError.message);
            }
        }
        
        // ESTRATÉGIA 3: Busca por texto específico conhecido
        console.log('\n--- ESTRATÉGIA 3: TEXTOS CONHECIDOS ---');
        const knownTexts = [
            'desvendar seu destino e propósito',
            'identificar seu arquétipo de bruxa',
            'descobrir seus poderes ocultos',
            'encontrar marcas e símbolos que as guiam',
            'revelar seus dons espirituais'
        ];
        
        // Tentar uma última requisição para pegar qualquer conteúdo
        try {
            const response = await axios.get(`${MAIN_TARGET_URL}/pt/witch-power/trialChoice`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; TextCapture/1.0)'
                }
            });
            
            const pageContent = response.data.toLowerCase();
            
            for (const text of knownTexts) {
                if (pageContent.includes(text.toLowerCase())) {
                    capturedBoldText = text;
                    lastCaptureTime = Date.now();
                    console.log('✅ ESTRATÉGIA 3 (TEXTO CONHECIDO) SUCESSO:', `"${capturedBoldText}"`);
                    return capturedBoldText;
                }
            }
        } catch (e) {
            console.log('❌ ESTRATÉGIA 3 falhou:', e.message);
        }
        
        // FALLBACK FINAL
        console.log('\n--- USANDO FALLBACK INTELIGENTE ---');
        capturedBoldText = 'desvendar seu destino e propósito';
        lastCaptureTime = Date.now();
        console.log('⚠️ Usando fallback inteligente:', `"${capturedBoldText}"`);
        
        return capturedBoldText;
        
    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO na captura:', error.message);
        capturedBoldText = 'desvendar seu destino e propósito';
        lastCaptureTime = Date.now();
        return capturedBoldText;
    } finally {
        isCapturing = false;
        console.log('\n=== CAPTURA FINALIZADA ===');
        console.log('Texto final:', `"${capturedBoldText}"`);
        console.log('Timestamp final:', new Date().toISOString());
    }
}

// Rota específica para a página customizada de trialChoice
app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== INTERCEPTANDO TRIALCHOICE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);
    
    try {
        // Capturar texto com a função melhorada
        const capturedText = await captureTextAdvanced();
        
        console.log('✅ Texto capturado com sucesso:', `"${capturedText}"`);
        
        // Aguardar um pouco antes de servir a página
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Servindo página React customizada...\n');
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        
    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO:', error.message);
        
        // Mesmo com erro, serve a página React com fallback
        capturedBoldText = 'desvendar seu destino e propósito';
        lastCaptureTime = Date.now();
        
        console.log('Usando texto fallback de erro:', `"${capturedBoldText}"`);
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
});

// Middleware Principal do Proxy Reverso
app.use(async (req, res) => {
    // Declarar targetDomain no início para evitar erro
    let targetDomain = MAIN_TARGET_URL;
    let requestPath = req.url;

    // Remove headers que podem causar problemas em proxies ou loops
    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];
    delete requestHeaders['accept-encoding'];

    // Lógica para Proxeamento do Subdomínio de Leitura (Mão)
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

                    let redirectCheckInterval;

                    function handleEmailRedirect() {
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/pt/witch-power/email')) {
                            console.log('CLIENT-SIDE REDIRECT: URL /pt/witch-power/email detectada. Forçando redirecionamento para /pt/witch-power/onboarding');
                            if (redirectCheckInterval) {
                                clearInterval(redirectCheckInterval);
                            }
                            window.location.replace('/pt/witch-power/onboarding');
                        }
                    }

                    document.addEventListener('DOMContentLoaded', handleEmailRedirect);
                    window.addEventListener('popstate', handleEmailRedirect);
                    redirectCheckInterval = setInterval(handleEmailRedirect, 100);

                    window.addEventListener('beforeunload', () => {
                        if (redirectCheckInterval) {
                            clearInterval(redirectCheckInterval);
                        }
                    });

                    handleEmailRedirect();
                </script>
            `);

            // REDIRECIONAMENTO CLIENT-SIDE PARA /pt/witch-power/trialChoice
            $('head').append(`
                <script>
                    console.log('CLIENT-SIDE TRIALCHOICE REDIRECT SCRIPT: Initializing.');

                    let trialChoiceRedirectInterval;

                    function handleTrialChoiceRedirect() {
                        const currentPath = window.location.pathname;
                        if (currentPath === '/pt/witch-power/trialChoice') {
                            console.log('CLIENT-SIDE REDIRECT: URL /pt/witch-power/trialChoice detectada. Forçando reload para interceptação do servidor.');
                            if (trialChoiceRedirectInterval) {
                                clearInterval(trialChoiceRedirectInterval);
                            }
                            window.location.reload();
                        }
                    }

                    document.addEventListener('DOMContentLoaded', handleTrialChoiceRedirect);
                    window.addEventListener('popstate', handleTrialChoiceRedirect);
                    trialChoiceRedirectInterval = setInterval(handleTrialChoiceRedirect, 200);

                    if (window.MutationObserver) {
                        const observer = new MutationObserver(function(mutations) {
                            mutations.forEach(function(mutation) {
                                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                    setTimeout(handleTrialChoiceRedirect, 50);
                                }
                            });
                        });
                        
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                    }

                    window.addEventListener('beforeunload', () => {
                        if (trialChoiceRedirectInterval) {
                            clearInterval(trialChoiceRedirectInterval);
                        }
                    });

                    handleTrialChoiceRedirect();
                </script>
            `);

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
