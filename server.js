// server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { URL } = require('url');
const fileUpload = require('express-fileupload');
const FormData = require('form-data'); // Importar form-data

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
let isCapturing = false; // Indica se uma captura está em andamento

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

// Função para extrair texto do HTML
// Esta função precisa ser robusta para HTML não renderizado por browser
function extractTextFromHTML(html) {
    console.log('\n🔍 EXTRAINDO TEXTO DO HTML');
    
    try {
        const $ = cheerio.load(html);
        
        // ESTRATÉGIA 1: Procurar pelo padrão específico no texto completo
        // Se a classe "sc-edafe909-6 pLaXn" é estável, é uma boa aposta.
        const targetParagraph = $('p.sc-edafe909-6.pLaXn');
        if (targetParagraph.length > 0) {
            const boldText = targetParagraph.find('b').text().trim();
            if (boldText.length > 5 && 
                !boldText.includes('$') && 
                !boldText.includes('€') && 
                !boldText.includes('R$') &&
                !boldText.includes('SATISFAÇÃO') &&
                !boldText.includes('ECONOMIA')) {
                console.log('✅ ESTRATÉGIA 1.1: Texto extraído da classe específica:', `"${boldText}"`);
                return boldText;
            }
        }

        const startPhrase = 'Ajudamos milhões de pessoas a ';
        const endPhrase = ', e queremos ajudar você também.';
        
        const fullText = $('body').text();
        console.log('📄 Tamanho do texto completo do body:', fullText.length);
        
        if (fullText.includes(startPhrase) && fullText.includes(endPhrase)) {
            const startIndex = fullText.indexOf(startPhrase) + startPhrase.length;
            const endIndex = fullText.indexOf(endPhrase);
            
            if (startIndex < endIndex) {
                const extractedContent = fullText.substring(startIndex, endIndex).trim();
                
                if (extractedContent.length > 5 && 
                    !extractedContent.includes('$') && 
                    !extractedContent.includes('€') && 
                    !extractedContent.includes('R$') &&
                    !extractedContent.includes('SATISFAÇÃO') &&
                    !extractedContent.includes('ECONOMIA')) {
                    console.log('✅ ESTRATÉGIA 1.2: Texto extraído do HTML completo por frase:', `"${extractedContent}"`);
                    return extractedContent;
                }
            }
        }
        
        // ESTRATÉGIA 2: Procurar em elementos específicos
        const patterns = [
            'p:contains("Ajudamos milhões") b',
            'b:contains("identificar")',
            'b:contains("arquétipo")',
            'b:contains("bruxa")',
            'b:contains("explorar")',
            'b:contains("desvendar")',
            'b:contains("descobrir")',
            'b:contains("revelar")',
            'b:contains("poderes ocultos")' // Adicionado
        ];
        
        for (const pattern of patterns) {
            const element = $(pattern).first();
            if (element.length > 0) {
                const text = element.text().trim();
                if (text.length > 10 && 
                    !text.includes('$') && 
                    !text.includes('SATISFAÇÃO') && 
                    !text.includes('ECONOMIA')) {
                    console.log(`✅ ESTRATÉGIA 2: Texto encontrado com padrão "${pattern}":`, `"${text}"`);
                    return text;
                }
            }
        }
        
        // ESTRATÉGIA 3: Buscar todos os <b> relevantes
        const boldElements = $('b');
        const relevantTexts = [];
        
        boldElements.each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 10 && 
                !text.includes('$') && 
                !text.includes('€') && 
                !text.includes('R$') &&
                !text.includes('SATISFAÇÃO') &&
                !text.includes('ECONOMIA') &&
                (text.includes('identificar') || 
                 text.includes('arquétipo') || 
                 text.includes('bruxa') || 
                 text.includes('explorar') || 
                 text.includes('desvendar') || 
                 text.includes('descobrir') || 
                 text.includes('revelar') ||
                 text.includes('poderes ocultos'))) { // Adicionado
                relevantTexts.push(text);
            }
        });
        
        console.log('📝 Todos os <b> relevantes encontrados:', relevantTexts);
        
        if (relevantTexts.length > 0) {
            // Priorizar o que parece mais com o que buscamos
            const preferredTexts = relevantTexts.filter(t => 
                t.includes('explorar origens de vidas passadas') || 
                t.includes('descobrir seus poderes ocultos') || 
                t.includes('desvendar seu destino e propósito')
            );
            if (preferredTexts.length > 0) {
                console.log('✅ ESTRATÉGIA 3: Usando primeiro <b> relevante preferencial:', `"${preferredTexts[0]}"`);
                return preferredTexts[0];
            }
            console.log('✅ ESTRATÉGIA 3: Usando primeiro <b> relevante geral:', `"${relevantTexts[0]}"`);
            return relevantTexts[0];
        }
        
        // ESTRATÉGIA 4: Regex para encontrar o padrão no HTML bruto
        // Esta regex tenta ser mais flexível com tags internas e espaços
        const regexPattern = /Ajudamos milhões de pessoas a\s*(?:<[^>]*>)*\s*<b>([^<]+)<\/b>\s*(?:<[^>]*>)*\s*,\s*e queremos ajudar você também/i;
        const match = html.match(regexPattern);
        
        if (match && match[1]) {
            const text = match[1].trim();
            console.log('✅ ESTRATÉGIA 4: Texto extraído via regex:', `"${text}"`);
            return text;
        }
        
        console.log('❌ Nenhuma estratégia funcionou');
        return null;
        
    } catch (error) {
        console.log('❌ Erro ao extrair texto do HTML:', error.message);
        return null;
    }
}

// Rota específica para a página customizada de trialChoice
// Esta rota APENAS serve o React. A captura de texto ocorre no middleware principal.
app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== SERVINDO TRIALCHOICE REACT ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);
    console.log('✅ Servindo página React customizada...\n');
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


// Middleware Principal do Proxy Reverso
app.use(async (req, res) => {
    let targetDomain = MAIN_TARGET_URL;
    let requestPath = req.url;

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];
    delete requestHeaders['accept-encoding']; // Important for uncompressed data

    // Lógica para Proxeamento do Subdomínio de Leitura (Mão)
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
        let headersToSend = { ...requestHeaders };

        if (req.files && Object.keys(req.files).length > 0) {
            const photoFile = req.files.photo;

            if (photoFile) {
                const formData = new FormData();
                formData.append('photo', photoFile.data, {
                    filename: photoFile.name,
                    contentType: photoFile.mimetype,
                });
                requestData = formData;
                // Merge FormData headers, which includes content-type with boundary
                Object.assign(headersToSend, formData.getHeaders());
                // Ensure content-length is correctly set by form-data
                delete headersToSend['content-type']; // Let form-data set it
                delete headersToSend['content-length']; // Let form-data set it
            }
        }

        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: headersToSend,
            data: requestData,
            responseType: 'arraybuffer', // Crucial to handle all content types
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
            
            // 🎯 INTERCEPTAÇÃO E CAPTURA NO MIDDLEWARE:
            // Só tenta capturar se a URL de origem for a de interesse para o texto
            // E se ainda não estiver capturando ou se a captura anterior for muito antiga
            if (req.url.includes('/pt/witch-power/trialChoice') || req.url.includes('/pt/witch-power/prelanding')) {
                const now = Date.now();
                const MIN_CAPTURE_INTERVAL = 5 * 1000; // 5 segundos
                if (!isCapturing && (now - lastCaptureTime > MIN_CAPTURE_INTERVAL)) {
                    isCapturing = true; // Sinaliza que a captura está em andamento
                    console.log('\n🎯 INTERCEPTANDO HTML NO MIDDLEWARE PARA CAPTURA!');
                    console.log('URL da Requisição:', req.url);
                    
                    const extractedText = extractTextFromHTML(html);
                    
                    if (extractedText && extractedText.length > 5) {
                        capturedBoldText = extractedText;
                        lastCaptureTime = Date.now();
                        console.log('🎉 SUCESSO! Texto capturado via middleware:', `"${capturedBoldText}"`);
                    } else {
                        console.log('⚠️ Middleware: Não foi possível extrair o texto específico.');
                    }
                    isCapturing = false; // Libera a captura
                } else {
                    console.log('⏳ Middleware: Captura ignorada (já em andamento ou muito recente).');
                }
            }
            
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
                        // URLs relativas para o domínio principal (mantém como estão)
                        if (originalUrl.startsWith('/') && !originalUrl.startsWith('/reading/')) {
                            // No change needed for root-relative paths like /_next/static/...
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
                            } else if (typeof input === 'string' && input.startsWith('${MAIN_TARGET_URL}')) {
                                url = input.replace('${MAIN_TARGET_URL}', '');
                                console.log('PROXY SHIM: REWRITE MAIN URL:', input, '->', url);
                            }
                            return originalFetch.call(this, url, init);
                        };

                        const originalXHRopen = XMLHttpRequest.prototype.open;
                        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
                            let modifiedUrl = url;
                            if (typeof url === 'string' && url.startsWith(readingSubdomainTarget)) {
                                modifiedUrl = url.replace(readingSubdomainTarget, proxyPrefix);
                                console.log('PROXY SHIM: REWRITE XHR URL:', url, '->', modifiedUrl);
                            } else if (typeof url === 'string' && url.startsWith('${MAIN_TARGET_URL}')) {
                                modifiedUrl = url.replace('${MAIN_TARGET_URL}', '');
                                console.log('PROXY SHIM: REWRITE XHR MAIN URL:', url, '->', modifiedUrl);
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
            // Removido o window.location.reload() pois queremos que a página React seja servida
            // e o texto seja atualizado via API.
            // A MutationObserver estava causando erro em alguns ambientes, vamos simplificar.
            $('head').append(`
                <script>
                    console.log('CLIENT-SIDE TRIALCHOICE REDIRECT SCRIPT: Initializing.');

                    // Não precisamos forçar reload aqui, a página React já foi servida.
                    // O React se encarrega de buscar o texto via API.
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
            // Para outros tipos de conteúdo (CSS, JS, imagens, JSON, etc.), apenas repassa.
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
