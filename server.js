const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { URL } = require('url');
const fileUpload = require('express-fileupload'); // Para upload de arquivos (ex: foto da palma)
const cors = require('cors'); // Re-adicionado para garantir flexibilidade nas requisições
const https = require('https'); // Para lidar com problemas de certificado SSL (development)

const app = express();
const PORT = process.env.PORT || 10000;

// URLs de destino
const MAIN_TARGET_URL = 'https://appnebula.co';
const READING_SUBDOMAIN_TARGET = 'https://reading.nebulahoroscope.com';

// Configurações para Modificação de Conteúdo
const USD_TO_BRL_RATE = 5.00;
const CONVERSION_PATTERN = /\$(\d+(\.\d{2})?)/g;

// Variável para armazenar o texto capturado (para o TrialChoice)
let capturedBoldText = '';
let lastCaptureTime = 0;
let isCapturing = false;

// Configuração para Axios ignorar SSL para domínios específicos (apenas para desenvolvimento/ambientes problemáticos)
const agent = new https.Agent({
    rejectUnauthorized: false,
});

// Middleware para servir arquivos estáticos da build do React (se existirem na raiz do projeto)
app.use(express.static(path.join(__dirname, 'dist')));

// Usa express-fileupload para lidar com uploads de arquivos (multipart/form-data)
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Limite de 50MB
    createParentPath: true, // Cria diretórios pais se não existirem
    uriDecodeFileNames: true, // Decodifica nomes de arquivo URI
    preserveExtension: true // Mantém a extensão original do arquivo
}));

app.use(express.json()); // Para parsing de JSON no corpo da requisição
app.use(express.urlencoded({ extended: true })); // Para parsing de URL-encoded no corpo da requisição
app.use(cors()); // Permite CORS, útil para desenvolvimento

// --- API endpoint para obter o texto capturado (para o React App) ---
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

// --- Funções para Extração e Captura de Texto (do seu código antigo) ---
function extractTextFromHTML(html) {
    console.log('\n🔍 EXTRAINDO TEXTO DO HTML');

    try {
        const $ = cheerio.load(html);

        // ESTRATÉGIA 1: Procurar pelo padrão específico no texto completo
        const startPhrase = 'Ajudamos milhões de pessoas a ';
        const endPhrase = ', e queremos ajudar você também.';

        const fullText = $('body').text();
        console.log('📄 Tamanho do texto completo:', fullText.length);

        if (fullText.includes(startPhrase) && fullText.includes(endPhrase)) {
            const startIndex = fullText.indexOf(startPhrase) + startPhrase.length;
            const endIndex = fullText.indexOf(endPhrase);

            if (startIndex < endIndex) {
                const extractedContent = fullText.substring(startIndex, endIndex).trim();

                if (extractedContent.length > 5) {
                    console.log('✅ ESTRATÉGIA 1: Texto extraído do HTML completo:', `"${extractedContent}"`);
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
            'b:contains("revelar")'
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
                 text.includes('revelar'))) {
                relevantTexts.push(text);
            }
        });

        console.log('📝 Todos os <b> relevantes encontrados:', relevantTexts);

        if (relevantTexts.length > 0) {
            console.log('✅ ESTRATÉGIA 3: Usando primeiro <b> relevante:', `"${relevantTexts[0]}"`);
            return relevantTexts[0];
        }

        // ESTRATÉGIA 4: Regex para encontrar o padrão no HTML bruto
        const regexPattern = /Ajudamos milhões de pessoas a\s*<b[^>]*>([^<]+)<\/b>\s*,\s*e queremos ajudar você também/gi;
        const match = html.match(regexPattern);

        if (match && match[0]) {
            const boldMatch = match[0].match(/<b[^>]*>([^<]+)<\/b>/i);
            if (boldMatch && boldMatch[1]) {
                const text = boldMatch[1].trim();
                console.log('✅ ESTRATÉGIA 4: Texto extraído via regex:', `"${text}"`);
                return text;
            }
        }

        console.log('❌ Nenhuma estratégia funcionou');
        return null;

    } catch (error) {
        console.log('❌ Erro ao extrair texto do HTML:', error.message);
        return null;
    }
}

async function captureTextDirectly() {
    if (isCapturing) {
        console.log('⏳ Captura já em andamento...');
        return capturedBoldText;
    }

    isCapturing = true;

    try {
        console.log('\n🎯 FAZENDO REQUISIÇÃO DIRETA PARA CAPTURAR TEXTO');
        console.log('🌐 URL:', `${MAIN_TARGET_URL}/pt/witch-power/trialChoice`);

        const response = await axios.get(`${MAIN_TARGET_URL}/pt/witch-power/trialChoice`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br', // Remover se causar problemas com arraybuffer
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 30000,
            httpsAgent: agent, // Usar o agente para ignorar SSL se necessário
        });

        console.log('✅ Resposta recebida! Status:', response.status);
        console.log('📊 Tamanho do HTML:', response.data.length);

        // Verificar se contém o padrão esperado
        if (response.data.includes('Ajudamos milhões de pessoas a')) {
            console.log('🎉 HTML contém o padrão "Ajudamos milhões de pessoas a"!');

            const extractedText = extractTextFromHTML(response.data);

            if (extractedText && extractedText.length > 5) {
                capturedBoldText = extractedText;
                lastCaptureTime = Date.now();
                console.log('🎉 SUCESSO! Texto capturado:', `"${capturedBoldText}"`);
                return capturedBoldText;
            } else {
                console.log('⚠️ Padrão encontrado mas não conseguiu extrair texto');
            }
        } else {
            console.log('⚠️ HTML não contém o padrão esperado');
            console.log('📝 Primeiros 500 caracteres do HTML:');
            console.log(response.data.substring(0, 500));
        }

        // Se chegou até aqui, não conseguiu capturar
        console.log('❌ Não foi possível capturar o texto');

        // Tentar com diferentes textos conhecidos no HTML
        const knownTexts = [
            'identificar seu arquétipo de bruxa',
            'explorar origens de vidas passadas',
            'desvendar seu destino e propósito',
            'descobrir seus poderes ocultos',
            'encontrar marcas e símbolos que as guiam',
            'revelar seus dons espirituais'
        ];

        const htmlLower = response.data.toLowerCase();
        for (const text of knownTexts) {
            if (htmlLower.includes(text.toLowerCase())) {
                capturedBoldText = text;
                lastCaptureTime = Date.now();
                console.log('✅ Texto encontrado no HTML:', `"${capturedBoldText}"`);
                return capturedBoldText;
            }
        }

        // Fallback final
        capturedBoldText = 'identificar seu arquétipo de bruxa';
        lastCaptureTime = Date.now();
        console.log('⚠️ Usando fallback:', `"${capturedBoldText}"`);

        return capturedBoldText;

    } catch (error) {
        console.error('❌ ERRO na requisição direta:', error.message);

        // Fallback em caso de erro
        capturedBoldText = 'identificar seu arquétipo de bruxa';
        lastCaptureTime = Date.now();
        console.log('⚠️ Usando fallback de erro:', `"${capturedBoldText}"`);

        return capturedBoldText;
    } finally {
        isCapturing = false;
        console.log('🏁 Captura finalizada\n');
    }
}

// --- Rota específica para a página customizada de trialChoice (Seu React App) ---
app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== INTERCEPTANDO TRIALCHOICE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);

    try {
        // Fazer requisição direta para capturar o texto ANTES de servir a página React
        console.log('🚀 Iniciando captura direta...');
        const capturedText = await captureTextDirectly();

        console.log('✅ Texto capturado com sucesso:', `"${capturedText}"`);
        console.log('✅ Servindo página React customizada...\n');

        // Envia o index.html do seu build React
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO ao servir trialChoice:', error.message);

        // Mesmo com erro, serve a página React com fallback
        capturedBoldText = 'identificar seu arquétipo de bruxa';
        lastCaptureTime = Date.now();

        console.log('Usando texto fallback de erro:', `"${capturedBoldText}"`);
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
});

// --- Proxy para a API principal (Mantido da versão anterior, se for usado) ---
app.use('/api-proxy', async (req, res) => {
    const apiTargetUrl = `https://api.appnebula.co${req.url.replace('/api-proxy', '')}`;
    console.log(`[API PROXY] Requisição: ${req.url} -> Proxy para: ${apiTargetUrl}`);

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];
    delete requestHeaders['accept-encoding']; // Evitar problemas de encoding

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
            httpsAgent: agent, // Usar o agente para ignorar SSL se necessário
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


// --- Middleware Principal do Proxy Reverso ---
app.use(async (req, res) => {
    let targetDomain = MAIN_TARGET_URL;
    let requestPath = req.url;
    const currentProxyHost = req.protocol + '://' + req.get('host'); // Seu domínio no Render

    // Remove headers que podem causar problemas em proxies ou loops
    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];
    delete requestHeaders['accept-encoding']; // Re-adicionado para evitar problemas de encoding

    // Lógica para Proxeamento do Subdomínio de Leitura (Mão)
    if (req.url.startsWith('/reading/')) {
        targetDomain = READING_SUBDOMAIN_TARGET;
        requestPath = req.url.substring('/reading'.length);
        if (requestPath === '') requestPath = '/';
        console.log(`[READING PROXY] Requisição: ${req.url} -> Proxy para: ${targetDomain}${requestPath}`);
        console.log(`[READING PROXY] Método: ${req.method}`);

        if (req.files && Object.keys(req.files).length > 0) {
            console.log(`[READING PROXY] Arquivos recebidos: ${JSON.stringify(Object.keys(req.files))}`);
            const photoFile = req.files.photo; // Assuming 'photo' is the field name for the file
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
                // Remove content-type/content-length para que o form-data defina o boundary
                delete requestHeaders['content-type'];
                delete requestHeaders['content-length'];
                // Adiciona os headers corretos do form-data
                Object.assign(requestHeaders, formData.getHeaders());
            }
        }

        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: requestHeaders,
            data: requestData,
            responseType: 'arraybuffer',
            maxRedirects: 0, // Importante para interceptar redirecionamentos
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Valida 2xx e 3xx
            },
            httpsAgent: agent, // Usar o agente para ignorar SSL se necessário
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
                // Se o redirecionamento é para a URL do quiz (que é a home do seu React app)
                if (fullRedirectUrl.includes('/pt/witch-power/wpGoal')) {
                    console.log('Interceptando redirecionamento para /wpGoal. Redirecionando para /pt/witch-power/trialChoice.');
                    return res.redirect(302, '/pt/witch-power/trialChoice');
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
                    .replace(/Domain=[^;]+/, '') // Remove o domínio original do cookie
                    .replace(/; Secure/, '') // Remove a flag Secure (se você não usar HTTPS no Render localmente)
                    // Reescreve o Path do cookie para corresponder à sua rota de proxy
                    .replace(/; Path=\//, `; Path=${req.baseUrl || '/'}`);
            });
            res.setHeader('Set-Cookie', modifiedCookies);
        }

        // Lógica de Modificação de Conteúdo (Apenas para HTML)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf8');

            // 🎯 INTERCEPTAÇÃO ADICIONAL: Se este HTML contém o padrão, capturar também
            if (html.includes('Ajudamos milhões de pessoas a') && !isCapturing) {
                console.log('\n🎯 INTERCEPTANDO HTML NO MIDDLEWARE!');
                console.log('URL:', req.url);

                const extractedText = extractTextFromHTML(html);

                if (extractedText && extractedText.length > 5) {
                    capturedBoldText = extractedText;
                    lastCaptureTime = Date.now();
                    console.log('🎉 SUCESSO! Texto capturado via middleware:', `"${capturedBoldText}"`);
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
                        if (originalUrl.startsWith('/') && !originalUrl.startsWith('/reading/')) {
                            // URLs relativas ao root já serão tratadas pelo proxy sem modificação aqui.
                            // Deixe como está, elas serão resolvidas pelo navegador contra o seu proxy.
                        } else if (originalUrl.startsWith('/reading/')) {
                            // URLs para o subdomínio de leitura, já estão corretas
                        } else if (originalUrl.startsWith(MAIN_TARGET_URL)) {
                            // Reescreve URLs absolutas para o MAIN_TARGET_URL para relativas
                            element.attr(attrName, originalUrl.replace(MAIN_TARGET_URL, ''));
                        } else if (originalUrl.startsWith(READING_SUBDOMAIN_TARGET)) {
                            // Reescreve URLs absolutas para o READING_SUBDOMAIN_TARGET para o prefixo /reading
                            element.attr(attrName, originalUrl.replace(READING_SUBDOMAIN_TARGET, '/reading'));
                        }
                    }
                }
            });

            // --- INJEÇÃO DE SCRIPTS CLIENT-SIDE (CUIDADO REDOBRADO COM ASPAS/CRASES) ---
            $('head').prepend(
                '<script>' +
                    '(function() {' +
                    'const readingSubdomainTarget = \'' + READING_SUBDOMAIN_TARGET + '\';' +
                    'const mainTargetOrigin = \'' + MAIN_TARGET_URL + '\';' +
                    'const proxyReadingPrefix = \'/reading\';' +
                    'const proxyApiPrefix = \'' + currentProxyHost + '/api-proxy\';' + // Garante que a API do Nebula usa seu proxy
                    'const currentProxyHost = \'' + currentProxyHost + '\';' +
                    'const targetPagePath = \'/pt/witch-power/wpGoal\';' +

                    // Interceptação de Fetch
                    'const originalFetch = window.fetch;' +
                    'window.fetch = function(input, init) {' +
                    'let url = input;' +
                    'if (typeof input === \'string\') {' +
                    'if (input.startsWith(readingSubdomainTarget)) {' +
                    'url = input.replace(readingSubdomainTarget, proxyReadingPrefix);' +
                    'console.log(\'PROXY SHIM: REWRITE FETCH URL (Reading): \', input, \'->\', url);' +
                    '} else if (input.startsWith(\'https://api.appnebula.co\')) {' + // Adicionado para API principal
                    'url = input.replace(\'https://api.appnebula.co\', proxyApiPrefix);' +
                    'console.log(\'PROXY SHIM: REWRITE FETCH URL (API): \', input, \'->\', url);' +
                    '} else if (input.startsWith(mainTargetOrigin)) {' + // URLs do mainTarget
                    'url = input.replace(mainTargetOrigin, currentProxyHost);' +
                    'console.log(\'PROXY SHIM: REWRITE FETCH URL (Main): \', input, \'->\', url);' +
                    '}' +
                    '} else if (input instanceof Request) {' +
                    'if (input.url.startsWith(readingSubdomainTarget)) {' +
                    'url = new Request(input.url.replace(readingSubdomainTarget, proxyReadingPrefix), input);' +
                    'console.log(\'PROXY SHIM: REWRITE FETCH Request Object URL (Reading): \', input.url, \'->\', url.url);' +
                    '} else if (input.url.startsWith(\'https://api.appnebula.co\')) {' + // Adicionado para API principal
                    'url = new Request(input.url.replace(\'https://api.appnebula.co\', proxyApiPrefix), input);' +
                    'console.log(\'PROXY SHIM: REWRITE FETCH Request Object URL (API): \', input.url, \'->\', url.url);' +
                    '} else if (input.url.startsWith(mainTargetOrigin)) {' + // URLs do mainTarget
                    'url = new Request(input.url.replace(mainTargetOrigin, currentProxyHost), input);' +
                    'console.log(\'PROXY SHIM: REWRITE FETCH Request Object URL (Main): \', input.url, \'->\', url.url);' +
                    '}' +
                    '}' +
                    'return originalFetch.call(this, url, init);' +
                    '};' +

                    // Interceptação de XHR
                    'const originalXHRopen = XMLHttpRequest.prototype.open;' +
                    'XMLHttpRequest.prototype.open = function(method, url, async, user, password) {' +
                    'let modifiedUrl = url;' +
                    'if (typeof url === \'string\') {' +
                    'if (url.startsWith(readingSubdomainTarget)) {' +
                    'modifiedUrl = url.replace(readingSubdomainTarget, proxyReadingPrefix);' +
                    'console.log(\'PROXY SHIM: REWRITE XHR URL (Reading): \', url, \'->\', modifiedUrl);' +
                    '} else if (url.startsWith(\'https://api.appnebula.co\')) {' + // Adicionado para API principal
                    'modifiedUrl = url.replace(\'https://api.appnebula.co\', proxyApiPrefix);' +
                    'console.log(\'PROXY SHIM: REWRITE XHR URL (API): \', url, \'->\', modifiedUrl);' +
                    '} else if (url.startsWith(mainTargetOrigin)) {' + // URLs do mainTarget
                    'modifiedUrl = url.replace(mainTargetOrigin, currentProxyHost);' +
                    'console.log(\'PROXY SHIM: REWRITE XHR URL (Main): \', url, \'->\', modifiedUrl);' +
                    '}' +
                    '}' +
                    'originalXHRopen.call(this, method, modifiedUrl, async, user, password);' +
                    '};' +

                    // Interceptação de PostMessage
                    'const originalPostMessage = window.postMessage;' +
                    'window.postMessage = function(message, targetOrigin, transfer) {' +
                    'let modifiedTargetOrigin = targetOrigin;' +
                    'if (typeof targetOrigin === \'string\' && targetOrigin.startsWith(mainTargetOrigin)) {' +
                    'modifiedTargetOrigin = currentProxyHost;' +
                    'console.log(\'PROXY SHIM: REWRITE PostMessage TargetOrigin: \', targetOrigin, \'->\', modifiedTargetOrigin);' +
                    '}' +
                    'originalPostMessage.call(this, message, modifiedTargetOrigin, transfer);' +
                    '};' +

                    // --- Lógica de Botões Invisíveis ---
                    'let buttonsInjected = false;' +
                    'const invisibleButtonsConfig = [' +
                    '{ id: \'btn-choice-1\', top: \'206px\', left: \'40px\', width: \'330px\', height: \'66px\', text: \'Entender meu mapa astral\' },' +
                    '{ id: \'btn-choice-2\', top: \'292px\', left: \'40px\', width: \'330px\', height: \'66px\', text: \'Identificar meu arquétipo de bruxa\' },' +
                    '{ id: \'btn-choice-3\', top: \'377px\', left: \'40px\', width: \'330px\', height: \'66px\', text: \'Explorar minhas vidas passadas\' },' +
                    '{ id: \'btn-choice-4\', top: \'460px\', left: \'40px\', width: \'330px\', height: \'66px\', text: \'Revelar minha aura de bruxa\' },' +
                    '{ id: \'btn-choice-5\', top: \'543px\', left: \'40px\', width: \'330px\', height: \'66px\', text: \'Desvendar meu destino e propósito\' },' +
                    '{ id: \'btn-choice-6\', top: \'628px\', left: \'40px\', width: \'330px\', height: \'66px\', text: \'Descobrir meus poderes ocultos\' }' +
                    '];' +

                    'function injectInvisibleButtons() {' +
                    'if (buttonsInjected) return;' +
                    'console.log(\'Página wpGoal detectada! Injetando botões invisíveis...\');' +
                    'invisibleButtonsConfig.forEach(config => {' +
                    'const button = document.createElement(\'button\');' +
                    'button.id = config.id;' +
                    'button.style.cssText = `' +
                    'position: absolute;' +
                    'top: ${config.top};' +
                    'left: ${config.left};' +
                    'width: ${config.width};' +
                    'height: ${config.height};' +
                    'background: transparent;' +
                    'border: 2px solid red;' + // Apenas para visualização durante o desenvolvimento, REMOVER em produção
                    'cursor: pointer;' +
                    'z-index: 9999;' +
                    '`;' +
                    // **AQUI ESTÁ A MUDANÇA PRINCIPAL:** Adicionando o event listener para salvar a escolha
                    'button.addEventListener(\'click\', () => {' +
                    'console.log(`✅ Botão invisível \'${config.id}\' clicado! Valor: \'${config.text}\'`);' +
                    'localStorage.setItem(\'selectedChoiceText\', config.text);' + // Salva o texto no localStorage
                    '});' +
                    'document.body.appendChild(button);' +
                    'console.log(`✅ Botão invisível \'${config.id}\' injetado na página wpGoal!`);' +
                    '});' +
                    'buttonsInjected = true;' +
                    '}' +

                    'function removeInvisibleButtons() {' +
                    'if (!buttonsInjected) return;' +
                    'console.log(\'Saindo da página wpGoal. Removendo botões invisíveis...\');' +
                    'invisibleButtonsConfig.forEach(config => {' +
                    'const button = document.getElementById(config.id);' +
                    'if (button) {' +
                    'button.remove();' +
                    'console.log(`🗑️ Botão invisível \'${config.id}\' removido.`);' +
                    '}' +
                    '});' +
                    'buttonsInjected = false;' +
                    '}' +

                    'function monitorUrlChanges() {' +
                    'const currentUrl = window.location.pathname;' +
                    'const isTargetPage = currentUrl === targetPagePath;' +
                    'console.log(`[Monitor] URL atual: ${currentUrl}. Página alvo: ${targetPagePath}. É a página alvo? ${isTargetPage}`);' +

                    'if (isTargetPage) {' +
                    'injectInvisibleButtons();' +
                    '} else {' +
                    'removeInvisibleButtons();' +
                    '}' +
                    '}' +

                    '// Executa a função ao carregar a página e monitora mudanças na URL' +
                    'document.addEventListener(\'DOMContentLoaded\', monitorUrlChanges);' +
                    'window.addEventListener(\'popstate\', monitorUrlChanges);' + // Para navegação via histórico
                    '// Para SPAs que mudam a URL sem recarregar (ex: pushState)' +
                    'const originalPushState = history.pushState;' +
                    'history.pushState = function() {' +
                    'originalPushState.apply(this, arguments);' +
                    'monitorUrlChanges();' +
                    '};' +
                    'const originalReplaceState = history.replaceState;' +
                    'history.replaceState = function() {' +
                    'originalReplaceState.apply(this, arguments);' +
                    'monitorUrlChanges();' +
                    '};' +
                    '})();' +
                '</script>'
            );

            // --- FIM DA INJEÇÃO DE SCRIPTS CLIENT-SIDE ---

            // Converte preços USD para BRL (se aplicável, mantenho sua lógica)
            html = html.replace(CONVERSION_PATTERN, (match, p1) => {
                const usdValue = parseFloat(p1);
                const brlValue = (usdValue * USD_TO_BRL_RATE).toFixed(2);
                return `R$${brlValue.replace('.', ',')}`;
            });

            res.status(response.status).send(html);
        } else {
            // Se não for HTML, envia os dados como estão
            res.status(response.status).send(response.data);
        }

    } catch (error) {
        console.error(`❌ ERRO no proxy para ${targetUrl}:`, error.message);
        if (error.response) {
            console.error('Status do destino:', error.response.status);
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).send('Erro ao processar a requisição de proxy.');
        }
    }
});

// --- Iniciar o Servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor proxy rodando na porta ${PORT}`);
    console.log(`Acessível em: http://localhost:${PORT}`);
});
