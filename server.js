// server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
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

// Função melhorada para capturar texto com Puppeteer
async function captureTextWithPuppeteer() {
    if (isCapturing) {
        console.log('⏳ Captura já em andamento, aguardando...');
        return capturedBoldText;
    }
    
    isCapturing = true;
    let browser;
    
    try {
        console.log('\n=== INICIANDO CAPTURA AVANÇADA COM PUPPETEER ===');
        console.log('Timestamp início:', new Date().toISOString());
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        const page = await browser.newPage();
        
        // Configurações avançadas da página
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Interceptar console.log da página para debug
        page.on('console', msg => {
            console.log('🌐 BROWSER LOG:', msg.text());
        });
        
        console.log('🌐 Navegando para:', `${MAIN_TARGET_URL}/pt/witch-power/trialChoice`);
        
        // Navegar para a página
        await page.goto(`${MAIN_TARGET_URL}/pt/witch-power/trialChoice`, {
            waitUntil: 'networkidle0',
            timeout: 45000
        });
        
        console.log('✅ Página carregada, iniciando processo de captura...');
        
        // Aguardar renderização inicial
        await page.waitForTimeout(8000);
        
        // Injetar script para monitorar mudanças no DOM
        await page.evaluate(() => {
            console.log('🔍 Script de monitoramento DOM injetado');
            window.domChangeCount = 0;
            
            const observer = new MutationObserver((mutations) => {
                window.domChangeCount++;
                if (window.domChangeCount % 10 === 0) {
                    console.log(`DOM mudou ${window.domChangeCount} vezes`);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
        
        // Aguardar mais tempo para mudanças no DOM
        await page.waitForTimeout(5000);
        
        // ESTRATÉGIA 1: Procurar pelo seletor específico
        console.log('\n--- ESTRATÉGIA 1: Seletor específico ---');
        let boldText = await page.evaluate(() => {
            const paragraph = document.querySelector('p.sc-edafe909-6.pLaXn');
            console.log('Parágrafo encontrado:', paragraph);
            if (paragraph) {
                console.log('Conteúdo do parágrafo:', paragraph.innerHTML);
                const boldElement = paragraph.querySelector('b');
                console.log('Elemento bold encontrado:', boldElement);
                if (boldElement) {
                    const text = boldElement.textContent.trim();
                    console.log('Texto do bold:', text);
                    return text;
                }
            }
            return null;
        });
        
        if (boldText && boldText.length > 3) {
            console.log('✅ ESTRATÉGIA 1 SUCESSO:', `"${boldText}"`);
            capturedBoldText = boldText;
        } else {
            console.log('❌ ESTRATÉGIA 1 falhou, tentando estratégia 2...');
            
            // ESTRATÉGIA 2: Procurar por classe parcial
            console.log('\n--- ESTRATÉGIA 2: Classe parcial ---');
            boldText = await page.evaluate(() => {
                const elements = document.querySelectorAll('[class*="sc-edafe909-6"]');
                console.log('Elementos com classe parcial encontrados:', elements.length);
                
                for (const element of elements) {
                    console.log('Elemento:', element, 'Conteúdo:', element.textContent);
                    if (element.textContent.includes('Ajudamos milhões')) {
                        const boldElement = element.querySelector('b');
                        if (boldElement) {
                            const text = boldElement.textContent.trim();
                            console.log('Texto encontrado na estratégia 2:', text);
                            return text;
                        }
                    }
                }
                return null;
            });
            
            if (boldText && boldText.length > 3) {
                console.log('✅ ESTRATÉGIA 2 SUCESSO:', `"${boldText}"`);
                capturedBoldText = boldText;
            } else {
                console.log('❌ ESTRATÉGIA 2 falhou, tentando estratégia 3...');
                
                // ESTRATÉGIA 3: Procurar por texto "Ajudamos milhões"
                console.log('\n--- ESTRATÉGIA 3: Busca por texto ---');
                boldText = await page.evaluate(() => {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    
                    let node;
                    while (node = walker.nextNode()) {
                        if (node.textContent.includes('Ajudamos milhões')) {
                            console.log('Nó com texto encontrado:', node.textContent);
                            const parent = node.parentElement;
                            if (parent) {
                                console.log('Elemento pai:', parent);
                                const boldElement = parent.querySelector('b');
                                if (boldElement) {
                                    const text = boldElement.textContent.trim();
                                    console.log('Texto do bold na estratégia 3:', text);
                                    return text;
                                }
                            }
                        }
                    }
                    return null;
                });
                
                if (boldText && boldText.length > 3) {
                    console.log('✅ ESTRATÉGIA 3 SUCESSO:', `"${boldText}"`);
                    capturedBoldText = boldText;
                } else {
                    console.log('❌ ESTRATÉGIA 3 falhou, tentando estratégia 4...');
                    
                    // ESTRATÉGIA 4: Buscar qualquer <b> relevante
                    console.log('\n--- ESTRATÉGIA 4: Busca geral ---');
                    const allBoldTexts = await page.evaluate(() => {
                        const boldElements = document.querySelectorAll('b, strong');
                        const texts = [];
                        
                        boldElements.forEach(element => {
                            const text = element.textContent.trim();
                            console.log('Bold/Strong encontrado:', text);
                            
                            if (text.length > 5 && 
                                !text.includes('$') && 
                                !text.includes('€') && 
                                !text.includes('R$') &&
                                !text.includes('©') &&
                                !text.includes('Menu') &&
                                !text.includes('Button') &&
                                !text.toLowerCase().includes('política')) {
                                texts.push(text);
                            }
                        });
                        
                        console.log('Todos os textos bold relevantes:', texts);
                        return texts;
                    });
                    
                    if (allBoldTexts.length > 0) {
                        // Priorizar textos que parecem ser sobre bruxaria/poderes
                        const relevantTexts = allBoldTexts.filter(text => 
                            text.toLowerCase().includes('bruxa') ||
                            text.toLowerCase().includes('poder') ||
                            text.toLowerCase().includes('arquétipo') ||
                            text.toLowerCase().includes('identificar') ||
                            text.toLowerCase().includes('descobrir') ||
                            text.toLowerCase().includes('encontrar')
                        );
                        
                        if (relevantTexts.length > 0) {
                            capturedBoldText = relevantTexts[0];
                            console.log('✅ ESTRATÉGIA 4 SUCESSO (relevante):', `"${capturedBoldText}"`);
                        } else {
                            capturedBoldText = allBoldTexts[0];
                            console.log('✅ ESTRATÉGIA 4 SUCESSO (geral):', `"${capturedBoldText}"`);
                        }
                    } else {
                        console.log('❌ ESTRATÉGIA 4 falhou, usando fallback');
                        capturedBoldText = 'descobrir seus poderes ocultos';
                    }
                }
            }
        }
        
        // Aguardar mais um pouco para garantir
        await page.waitForTimeout(2000);
        
        console.log('\n=== RESULTADO FINAL DA CAPTURA ===');
        console.log('Texto capturado:', `"${capturedBoldText}"`);
        console.log('Comprimento:', capturedBoldText.length);
        console.log('Timestamp final:', new Date().toISOString());
        
        lastCaptureTime = Date.now();
        
        return capturedBoldText;
        
    } catch (error) {
        console.error('\n❌ ERRO GRAVE no Puppeteer:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Fallback em caso de erro
        capturedBoldText = 'descobrir seus poderes ocultos';
        lastCaptureTime = Date.now();
        
        return capturedBoldText;
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Erro ao fechar browser:', closeError.message);
            }
        }
        isCapturing = false;
    }
}

// Rota específica para a página customizada de trialChoice
app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== INTERCEPTANDO TRIALCHOICE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);
    
    try {
        // Capturar texto com a função melhorada
        const capturedText = await captureTextWithPuppeteer();
        
        console.log('✅ Texto capturado com sucesso:', `"${capturedText}"`);
        
        // Aguardar um pouco antes de servir a página
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Servindo página React customizada...\n');
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        
    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO:', error.message);
        
        // Mesmo com erro, serve a página React com fallback
        capturedBoldText = 'descobrir seus poderes ocultos';
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
