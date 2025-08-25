const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const { URL } = require('url');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const https = require('https');
const FormData = require('form-data');
const zlib = require('zlib');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 10000;

const MAIN_TARGET_URL = 'https://appnebula.co';
const READING_SUBDOMAIN_TARGET = 'https://reading.nebulahoroscope.com';

const USD_TO_BRL_RATE = 5.00;
const CONVERSION_PATTERN = /\$(\d+(\.\d{2})?)/g;

function isMobileDevice(userAgent) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent || '');
}

function isAndroid(userAgent) {
    return /Android/i.test(userAgent || '');
}

const staticCache = new Map();
const apiCache = new Map();
const htmlCache = new Map();
const imageCache = new Map();

const CACHE_LIMITS = {
    STATIC: 30,
    API: 10,
    HTML: 5,
    IMAGES: 20
};

const CACHE_SETTINGS = {
    STATIC: 15 * 60 * 1000,
    API: 30 * 1000,
    HTML: 30 * 1000,
    IMAGES: 30 * 60 * 1000,
    CRITICAL: 0
};

const SOURCE_MAP_BLACKLIST = new Set([
    '/_next/static/chunks/webpack-9ea6f8e4303b980f.js.map',
    '/_next/static/chunks/webpack-882ffb4e25098804.js.map',
    '/_next/static/chunks/framework-539e802e8ad6dc46.js.map',
    '/_next/static/chunks/main-26483a53561eea0f.js.map',
    '/_next/static/chunks/pages/_app-b172266ab9529c0b.js.map',
    '/_next/static/chunks/pages/_app-39bd9aa8bd2fe9bc.js.map',
    '/_next/static/chunks/441.afceb13c3457e915.js.map',
    '/_next/static/chunks/3877-e3989dc0aafc7891.js.map',
    '/_next/static/chunks/1213-6a006800accf3eb8.js.map',
    '/_next/static/chunks/952.cb8a9c3196ee1ba5.js.map',
    '/_next/static/chunks/9273-e74aebc5d0f6de5f.js.map',
    '/_next/static/chunks/7006-afe77ea44f8e386b.js.map',
    '/_next/static/chunks/580-edb42352b0e48dc0.js.map',
    '/_next/static/chunks/580-2aab11418a359b90.js.map',
    '/_next/static/chunks/8093-0f207c0f0a66eb24.js.map',
    '/_next/static/chunks/pages/%5Bfunnel%5D/[id]-88d4813e39fb3e44.js.map',
    '/_next/static/chunks/1192.f192ca309350aaec.js.map',
    '/_next/static/chunks/1042-eb59b799cf1f0a44.js.map',
    '/_next/static/chunks/8388.68ca0ef4e73fbb0b.js.map',
    '/_next/static/chunks/e7b68a54.18796a59da6d408d.js.map',
    '/_next/static/chunks/5238.92789ea0e4e4659b.js.map',
    '/_next/static/chunks/2650.ddc083ba35803bee.js.map'
]);

const CRITICAL_ROUTES = new Set([
    '/api/captured-text',
    '/api/set-selected-choice',
    '/pt/witch-power/trialChoice',
    '/pt/witch-power/date',
    '/pt/witch-power/wpGoal',
    '/reading/'
]);

let requestCount = 0;
let startTime = Date.now();
let errorCount = 0;
let cacheHits = 0;

let capturedBoldText = 'descobrir seus poderes ocultos';
let lastCaptureTime = Date.now();
let isCapturing = false;

function cleanCache(cache, limit, name) {
    if (cache.size <= limit) return 0;

    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toDelete = entries.slice(0, cache.size - limit);
    toDelete.forEach(([key]) => cache.delete(key));

    return toDelete.length;
}

const agent = new https.Agent({
    rejectUnauthorized: false,
});


app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    createParentPath: true,
    uriDecodeFileNames: true,
    preserveExtension: true
}));

app.use((req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const isAndroidDevice = isAndroid(userAgent);
    const isMobile = isMobileDevice(userAgent);

    if (isAndroidDevice) {
        console.log('🤖 ANDROID detectado - SEM compressão');
        return next();
    }

    compression({
        level: isMobile ? 3 : 6,
        threshold: 2048,
        memLevel: 6,
        windowBits: 13,
        strategy: zlib.constants.Z_DEFAULT_STRATEGY,
        filter: (req, res) => {
            if (req.headers['x-no-compression']) return false;
            return compression.filter(req, res);
        }
    })(req, res, next);
});

app.use((req, res, next) => {
    if (SOURCE_MAP_BLACKLIST.has(req.url) || req.url.endsWith('.js.map') || req.url.endsWith('.css.map')) {
        console.log(`Source map bloqueado: ${req.url}`);
        return res.status(404).end();
    }
    next();
});

app.use(express.static(path.join(__dirname, 'dist')));

app.use(cors());

app.use((req, res, next) => {
    requestCount++;
    const userAgent = req.headers['user-agent'] || '';
    const isAndroidDevice = isAndroid(userAgent);
    const isMobile = isMobileDevice(userAgent);

    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$/)) {
        const maxAge = isAndroidDevice ? 900 : (isMobile ? 1800 : 3600);
        res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

app.use((req, res, next) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        express.json()(req, res, () => {
            express.urlencoded({ extended: true })(req, res, next);
        });
    } else {
        next();
    }
});

app.get('/api/captured-text', async (req, res) => {
    console.log('📡 API /api/captured-text chamada');

    if (!capturedBoldText || capturedBoldText === 'identificar seu arquétipo de bruxa' || (Date.now() - lastCaptureTime > 3600000 && !isCapturing)) {
        console.log('🔄 Texto capturado ausente/antigo. Tentando recapturar do site original...');
        await captureTextDirectly();
    }

    console.log('📝 Texto atual na variável:', `"${capturedBoldText}"`);
    console.log('🕐 Último tempo de captura:', new Date(lastCaptureTime).toISOString());
    console.log('🔄 Está capturando:', isCapturing);

    const responseData = {
        capturedText: capturedBoldText,
        lastCaptureTime: lastCaptureTime,
        isCapturing: isCapturing,
        timestamp: Date.now()
    };

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(responseData);
});

app.post('/api/set-selected-choice', (req, res) => {
    const { selectedText } = req.body;
    if (selectedText) {
        capturedBoldText = selectedText;
        lastCaptureTime = Date.now();
        console.log(`✅ Texto selecionado pelo usuário recebido e atualizado: "${capturedBoldText}"`);
        res.status(200).json({ message: 'Texto atualizado com sucesso.', capturedText: capturedBoldText });
    } else {
        res.status(400).json({ message: 'Nenhum texto fornecido.' });
    }
});

function extractTextFromHTML(html) {
    console.log('\n🔍 EXTRAINDO TEXTO DO HTML');

    try {
        const $ = cheerio.load(html);

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
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            responseType: 'arraybuffer',
            timeout: 30000,
            httpsAgent: agent,
        });

        console.log('✅ Resposta recebida! Status:', response.status);

        let responseData = response.data;
        const contentEncoding = response.headers['content-encoding'];
        if (contentEncoding === 'gzip') {
            console.log('📦 Descomprimindo resposta gzip...');
            responseData = zlib.gunzipSync(responseData);
        } else if (contentEncoding === 'deflate') {
            console.log('📦 Descomprimindo resposta deflate...');
            responseData = zlib.inflateSync(responseData);
        } else if (contentEncoding === 'br') {
            console.log('📦 Descomprimindo resposta brotli...');
            responseData = zlib.brotliDecompressSync(responseData);
        }

        const html = responseData.toString('utf8');
        console.log('📊 Tamanho do HTML (após descompressão):', html.length);

        if (html.includes('Ajudamos milhões de pessoas a')) {
            console.log('🎉 HTML contém o padrão "Ajudamos milhões de pessoas a"!');

            const extractedText = extractTextFromHTML(html);

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
            console.log(html.substring(0, 500));
        }

        console.log('❌ Não foi possível capturar o texto');

        const knownTexts = [
            'identificar seu arquétipo de bruxa',
            'explorar origens de vidas passadas',
            'desvendar seu destino e propósito',
            'descobrir seus poderes ocultos',
            'encontrar marcas e símbolos que as guiam',
            'revelar seus dons espirituais'
        ];

        const htmlLower = html.toLowerCase();
        for (const text of knownTexts) {
            if (htmlLower.includes(text.toLowerCase())) {
                capturedBoldText = text;
                lastCaptureTime = Date.now();
                console.log('✅ Texto encontrado no HTML:', `"${capturedBoldText}"`);
                return capturedBoldText;
            }
        }

        capturedBoldText = 'identificar seu arquétipo de bruxa';
        lastCaptureTime = Date.now();
        console.log('⚠️ Usando fallback:', `"${capturedBoldText}"`);

        return capturedBoldText;

    } catch (error) {
        console.error('❌ ERRO na requisição direta:', error.message);

        capturedBoldText = 'identificar seu arquétipo de bruxa';
        lastCaptureTime = Date.now();
        console.log('⚠️ Usando fallback de erro:', `"${capturedBoldText}"`);

        return capturedBoldText;
    } finally {
        isCapturing = false;
        console.log('🏁 Captura finalizada\n');
    }
}


app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== INTERCEPTANDO TRIALCHOICE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);
    console.log('Query parameters (UTMs):', req.query);

    try {
        console.log('✅ Servindo página React customizada (TrialChoice) COM UTMs MANTIDAS...\n');
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO ao servir trialChoice:', error.message);
        res.status(500).send('Erro ao carregar a página de escolha.');
    }
});

app.get('/pt/witch-power/date', async (req, res) => {
    console.log('\n=== INTERCEPTANDO DATE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);

    try {
        console.log('✅ Servindo página React customizada (Date)...\n');
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO ao servir date:', error.message);
        res.status(500).send('Erro ao carregar a página de data.');
    }
});

app.get('/pt/witch-power/email', async (req, res) => {
    console.log('\n=== INTERCEPTANDO EMAIL - REDIRECIONANDO PARA ONBOARDING ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);

    try {
        console.log('🔄 Redirecionando /email para /onboarding...\n');
        res.redirect(302, '/pt/witch-power/onboarding');

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO ao redirecionar email:', error.message);
        res.status(500).send('Erro ao redirecionar email.');
    }
});

app.get('/quiz/:filename.svg', async (req, res) => {
    const svgUrl = `https://media.appnebula.co/quiz/${req.params.filename}.svg`;
    try {
        const response = await axios.get(svgUrl, { responseType: 'stream' });
        res.setHeader('Content-Type', 'image/svg+xml');
        response.data.pipe(res);
    } catch (error) {
        console.error('Erro ao buscar SVG:', svgUrl, error.message);
        res.status(404).send('SVG não encontrado');
    }
});

app.get('/_next/image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).send('URL da imagem não fornecida');
        }

        const decodedUrl = decodeURIComponent(imageUrl);
        console.log('🖼️ Proxy Next.js Image:', decodedUrl);
        
        let targetUrl;
        
        if (decodedUrl.includes('palmistry-media.appnebula.co')) {
            targetUrl = decodedUrl;
            console.log('🖐️ Imagem da palma detectada:', targetUrl);
        }
        else if (decodedUrl.startsWith('https://media.appnebula.co')) {
            targetUrl = decodedUrl;
        } else if (decodedUrl.startsWith('/_next/static/')) {
            targetUrl = `https://appnebula.co${decodedUrl}`;
        } else if (decodedUrl.startsWith('https://')) {
            targetUrl = decodedUrl;
        } else {
            targetUrl = `https://appnebula.co${decodedUrl}`;
        }
        
        const response = await axios.get(targetUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
                'Accept': 'image/*,*/*;q=0.8'
            },
            timeout: 15000
        });
        
        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(response.data);
        
    } catch (error) {
        console.error('Erro ao buscar imagem Next.js:', error.message);
        res.status(404).send('Imagem não encontrada');
    }
});

app.get('/_next/static/*', async (req, res) => {
    try {
        const targetUrl = `https://appnebula.co${req.originalUrl}`;
        console.log('📁 Proxy Next.js Static:', targetUrl);

        const response = await axios.get(targetUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0'
            }
        });
        
        let contentType = response.headers['content-type'];
        if (!contentType) {
            if (req.originalUrl.endsWith('.png')) contentType = 'image/png';
            else if (req.originalUrl.endsWith('.jpg') || req.originalUrl.endsWith('.jpeg')) contentType = 'image/jpeg';
            else if (req.originalUrl.endsWith('.svg')) contentType = 'image/svg+xml';
            else if (req.originalUrl.endsWith('.js')) contentType = 'application/javascript';
            else if (req.originalUrl.endsWith('.css')) contentType = 'text/css';
            else contentType = 'application/octet-stream';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(response.data);
        
    } catch (error) {
        console.error('Erro ao buscar asset Next.js:', error.message);
        res.status(404).send('Asset não encontrado');
    }
});

app.get('/media-proxy/*', async (req, res) => {
    const targetUrl = 'https://media.appnebula.co' + req.originalUrl.replace('/media-proxy', '');
    try {
        const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        res.set('Content-Type', contentType);
        res.send(response.data);
    } catch (err) {
        console.error('Erro ao servir imagem do media.appnebula.co:', err.message);
        res.status(500).send('Erro ao carregar mídia.');
    }
});

app.get('/palmistry-proxy/*', async (req, res) => {
    const targetUrl = 'https://palmistry-media.appnebula.co' + req.originalUrl.replace('/palmistry-proxy', '');
    try {
        const response = await axios.get(targetUrl, { responseType: 'arraybuffer' });
        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.send(response.data);
    } catch (err) {
        console.error('Erro ao servir imagem da palma:', err.message);
        res.status(500).send('Erro ao carregar imagem da palma.');
    }
});

app.use('/api-proxy', async (req, res) => {
    const cacheKey = `api-${req.method}-${req.url}`;

    if (req.method === 'GET') {
        const cached = apiCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_SETTINGS.API)) {
            cacheHits++;
            console.log(`✅ API Cache HIT: ${req.url}`);
            return res.status(cached.status).set(cached.headers).send(cached.data);
        }
    }

    const apiTargetUrl = `https://api.appnebula.co${req.url.replace('/api-proxy', '')}`;
    console.log(`[API PROXY] Requisição: ${req.url} -> Proxy para: ${apiTargetUrl}`);

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];
    delete requestHeaders['accept-encoding'];

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

        const responseHeaders = {};
        Object.keys(response.headers).forEach(header => {
            if (!['transfer-encoding', 'content-encoding', 'content-length', 'set-cookie', 'host', 'connection'].includes(header.toLowerCase())) {
                responseHeaders[header] = response.headers[header];
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

        if (req.method === 'GET') {
            cleanCache(apiCache, CACHE_LIMITS.API, 'API');
            
            apiCache.set(cacheKey, {
                status: response.status,
                headers: responseHeaders,
                data: response.data,
                timestamp: Date.now()
            });
        }

        res.status(response.status).send(response.data);

    } catch (error) {
        console.error('[API PROXY] Erro na requisição da API:', error.message);
        errorCount++;
        if (error.response) {
            console.error('[API PROXY] Status da API:', error.response.status);
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).send('Erro ao proxy a API.');
        }
    }
});

const UTM_PERSISTENCE_SCRIPT = `
<script>
(function() {
    if (window.utmPersistenceLoaded) return;
    window.utmPersistenceLoaded = true;
    console.log('🎯 UTM ANTI-CORRUPTION Script carregado - VERSÃO DEFINITIVA + TRIALCHOICE RELOAD FIX');
    
    let utmData = null;
    let lastUrl = '';
    let urlCheckInterval = null;
    let paramCheckInterval = null;
    
    const originalUtmValues = {};
    
    function saveUtmsBeforeTrialChoiceReload() {
        const currentParams = getCleanUrlParams();
        const hasUtms = Object.keys(currentParams).some(key => 
            key.startsWith('utm_') || key === 'fbclid' || key === 'gclid' || key === 'fbc' || key === 'fbp'
        );
        
        if (hasUtms) {
            console.log('🚨 TRIALCHOICE: Salvando UTMs ANTES do reload:', currentParams);
            saveCleanUtmsToStorage(currentParams);
            
            sessionStorage.setItem('utm_backup_trialchoice', JSON.stringify(currentParams));
            sessionStorage.setItem('utm_backup_timestamp', Date.now().toString());
        }
    }
    
    function restoreUtmsAfterTrialChoiceReload() {
        const currentPath = window.location.pathname;
        
        if (currentPath === '/pt/witch-power/trialChoice') {
            console.log('🔄 TRIALCHOICE: Página detectada após possível reload - verificando UTMs...');
            
            const currentParams = getCleanUrlParams();
            const hasUtmsInUrl = Object.keys(currentParams).length > 0;
            
            if (!hasUtmsInUrl) {
                console.log('⚠️ TRIALCHOICE: UTMs não encontradas na URL - tentando restaurar...');
                
                const backupUtms = sessionStorage.getItem('utm_backup_trialchoice');
                const backupTimestamp = sessionStorage.getItem('utm_backup_timestamp');
                
                if (backupUtms && backupTimestamp) {
                    const timestamp = parseInt(backupTimestamp);
                    const now = Date.now();
                    
                    if ((now - timestamp) < (5 * 60 * 1000)) {
                        try {
                            const utmsToRestore = JSON.parse(backupUtms);
                            console.log('🎯 TRIALCHOICE: Restaurando UTMs do sessionStorage:', utmsToRestore);
                            
                            const newParams = new URLSearchParams();
                            Object.keys(utmsToRestore).forEach(key => {
                                newParams.set(key, utmsToRestore[key]);
                                originalUtmValues[key] = utmsToRestore[key];
                            });
                            
                            const newUrl = window.location.pathname + '?' + newParams.toString();
                            window.history.replaceState({}, '', newUrl);
                            
                            saveCleanUtmsToStorage(utmsToRestore);
                            utmData = utmsToRestore;
                            
                            console.log('✅ TRIALCHOICE: UTMs restauradas na URL:', newUrl);
                            return true;
                        } catch (error) {
                            console.error('❌ TRIALCHOICE: Erro ao restaurar UTMs do sessionStorage:', error);
                        }
                    }
                }
                
                const storedUtms = getCleanUtmsFromStorage();
                if (storedUtms) {
                    console.log('🔄 TRIALCHOICE: Restaurando UTMs do localStorage:', storedUtms);
                    forceCleanUtmsInUrl();
                    return true;
                }
                
                console.log('❌ TRIALCHOICE: Nenhum backup de UTMs encontrado');
            } else {
                console.log('✅ TRIALCHOICE: UTMs já presentes na URL:', currentParams);
                saveCleanUtmsToStorage(currentParams);
            }
        }
        
        return false;
    }
    
    function getCleanUrlParams() {
        const params = {};
        const searchParams = new URLSearchParams(window.location.search);
        
        for (const [key, value] of searchParams.entries()) {
            if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid' || key === 'fbc' || key === 'fbp') {
                let cleanValue = decodeURIComponent(value);
                
                if (key === 'utm_source' && cleanValue.startsWith('FB') && cleanValue.length > 2) {
                    if (cleanValue !== 'FB' && /^FB[a-zA-Z0-9]+$/.test(cleanValue)) {
                        console.log('🧹 LIMPANDO utm_source corrompido:', cleanValue, '→ FB');
                        cleanValue = 'FB';
                    }
                }
                
                if (cleanValue.length > 100) {
                    console.log('🧹 VALOR UTM MUITO LONGO - cortando:', key, cleanValue.substring(0, 50) + '...');
                    cleanValue = cleanValue.substring(0, 100);
                }
                
                cleanValue = cleanValue.replace(/[^\x20-\x7E]/g, '');
                
                params[key] = cleanValue;
                console.log('✅ Parâmetro LIMPO:', key, '=', cleanValue);
            }
        }
        
        return params;
    }
    
    function saveCleanUtmsToStorage(params) {
        try {
            const utmKeys = Object.keys(params).filter(key => 
                key.startsWith('utm_') || key === 'fbclid' || key === 'gclid' || key === 'fbc' || key === 'fbp'
            );
            
            if (utmKeys.length > 0) {
                const utmObj = {};
                utmKeys.forEach(key => {
                    utmObj[key] = params[key];
                    
                    if (!originalUtmValues[key]) {
                        originalUtmValues[key] = params[key];
                        console.log('🔒 VALOR ORIGINAL PROTEGIDO:', key, '=', originalUtmValues[key]);
                    }
                });
                
                localStorage.setItem('utm_data_clean', JSON.stringify(utmObj));
                localStorage.setItem('utm_originals', JSON.stringify(originalUtmValues));
                localStorage.setItem('utm_timestamp', Date.now().toString());
                
                console.log('💾 UTMs LIMPOS salvos no localStorage:', utmObj);
                return utmObj;
            }
        } catch (error) {
            console.error('❌ Erro ao salvar UTMs limpos:', error);
        }
        return null;
    }
    
    function getCleanUtmsFromStorage() {
        try {
            const storedUtm = localStorage.getItem('utm_data_clean');
            const storedOriginals = localStorage.getItem('utm_originals');
            const timestamp = localStorage.getItem('utm_timestamp');
            
            if (storedUtm && timestamp) {
                const now = Date.now();
                const stored = parseInt(timestamp);
                const dayInMs = 24 * 60 * 60 * 1000;
                
                if ((now - stored) < dayInMs) {
                    const utmObj = JSON.parse(storedUtm);
                    
                    if (storedOriginals) {
                        const originals = JSON.parse(storedOriginals);
                        Object.keys(originals).forEach(key => {
                            if (!originalUtmValues[key]) {
                                originalUtmValues[key] = originals[key];
                            }
                        });
                    }
                    
                    console.log('📁 UTMs LIMPOS recuperados do localStorage:', utmObj);
                    console.log('🔒 Valores originais protegidos:', originalUtmValues);
                    return utmObj;
                }
            }
        } catch (error) {
            console.error('❌ Erro ao recuperar UTMs limpos:', error);
        }
        return null;
    }
    
    function forceCleanUtmsInUrl() {
        if (!utmData) return;
        
        const currentParams = getCleanUrlParams();
        let needsUpdate = false;
        const newParams = new URLSearchParams(window.location.search);
        
        Object.keys(utmData).forEach(key => {
            const originalValue = originalUtmValues[key] || utmData[key];
            const currentValue = currentParams[key];
            
            if (!currentValue || currentValue !== originalValue) {
                console.log('🔧 RESTAURANDO UTM:', key, currentValue, '→', originalValue);
                newParams.set(key, originalValue);
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            const newUrl = window.location.pathname + '?' + newParams.toString();
            console.log('🔄 FORÇANDO UTMs LIMPOS na URL:', newUrl);
            
            try {
                window.history.replaceState({}, '', newUrl);
                console.log('✅ URL restaurada com UTMs originais');
            } catch (error) {
                console.error('❌ Erro ao restaurar URL:', error);
            }
        }
    }
    
    function manageCleanUtms() {
        const currentParams = getCleanUrlParams();
        
        const hasUtmInUrl = Object.keys(currentParams).some(key => 
            key.startsWith('utm_') || key === 'fbclid' || key === 'gclid'
        );
        
        if (hasUtmInUrl) {
            utmData = saveCleanUtmsToStorage(currentParams);
        } else {
            utmData = getCleanUtmsFromStorage();
            
            if (utmData) {
                forceCleanUtmsInUrl();
            }
        }
        
        if (utmData) {
            const cleanUtmData = {};
            Object.keys(utmData).forEach(key => {
                cleanUtmData[key] = originalUtmValues[key] || utmData[key];
            });
            
            window.utmData = cleanUtmData;
            window.dispatchEvent(new CustomEvent('utmDataReady', { detail: cleanUtmData }));
            console.log('🌐 UTMs LIMPOS disponibilizados globalmente:', cleanUtmData);
        }
        
        return utmData;
    }
    
    function interceptFacebookPixelClean() {
        if (typeof window.fbq !== 'undefined' && utmData) {
            const originalFbq = window.fbq;
            
            window.fbq = function() {
                const args = Array.from(arguments);
                
                if (args[0] === 'track' || args[0] === 'trackCustom') {
                    if (!args[2]) args[2] = {};
                    
                    Object.keys(utmData).forEach(key => {
                        const cleanValue = originalUtmValues[key] || utmData[key];
                        args[2][key] = cleanValue;
                    });
                    
                    console.log('📊 UTMs LIMPOS injetados no Facebook Pixel:', args[1], args[2]);
                }
                
                return originalFbq.apply(this, args);
            };
            
            Object.keys(originalFbq).forEach(key => {
                window.fbq[key] = originalFbq[key];
            });
        }
    }
    
    function startCleanMonitoring() {
        urlCheckInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                console.log('🔄 URL MUDOU - re-executando UTM LIMPO management:', currentUrl);
                
                const currentPath = window.location.pathname;
                if (currentPath === '/pt/witch-power/trialChoice') {
                    const restored = restoreUtmsAfterTrialChoiceReload();
                    if (!restored) {
                        manageCleanUtms();
                    }
                } else {
                    manageCleanUtms();
                }
                
                setTimeout(() => {
                    interceptFacebookPixelClean();
                }, 100);
            }
        }, 500);
        
        paramCheckInterval = setInterval(() => {
            if (utmData && window.location.search.length === 0) {
                console.log('⚠️ UTMs SUMIRAM - RESTAURANDO originais limpos!');
                forceCleanUtmsInUrl();
            } else if (utmData && window.location.search.length > 0) {
                const currentParams = getCleanUrlParams();
                let hasCorruption = false;
                
                Object.keys(utmData).forEach(key => {
                    const originalValue = originalUtmValues[key] || utmData[key];
                    const currentValue = currentParams[key];
                    
                    if (currentValue && currentValue !== originalValue) {
                        console.log('🚨 CORRUPÇÃO DETECTADA:', key, currentValue, '≠', originalValue);
                        hasCorruption = true;
                    }
                });
                
                if (hasCorruption) {
                    console.log('🧹 LIMPANDO CORRUPÇÃO - restaurando valores originais');
                    forceCleanUtmsInUrl();
                }
            }
        }, 1000);
    }
    
    function interceptNavigationClean() {
        const originalPushState = history.pushState;
        history.pushState = function() {
            const newPath = arguments[2];
            if (typeof newPath === 'string' && newPath.includes('/pt/witch-power/trialChoice')) {
                saveUtmsBeforeTrialChoiceReload();
            }
            
            originalPushState.apply(this, arguments);
            setTimeout(() => {
                manageCleanUtms();
                interceptFacebookPixelClean();
            }, 50);
        };
        
        const originalReplaceState = history.replaceState;
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            setTimeout(() => {
                manageCleanUtms();
                interceptFacebookPixelClean();
            }, 50);
        };
        
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                manageCleanUtms();
                interceptFacebookPixelClean();
            }, 50);
        });
        
        window.addEventListener('beforeunload', () => {
            const currentPath = window.location.pathname;
            if (currentPath === '/pt/witch-power/trialChoice') {
                saveUtmsBeforeTrialChoiceReload();
            }
        });
    }
    
    console.log('🚀 Iniciando UTM ANTI-CORRUPTION + TRIALCHOICE RELOAD FIX...');
    
    const initialPath = window.location.pathname;
    if (initialPath === '/pt/witch-power/trialChoice') {
        const restored = restoreUtmsAfterTrialChoiceReload();
        if (!restored) {
            manageCleanUtms();
        }
    } else {
        manageCleanUtms();
    }
    
    interceptFacebookPixelClean();
    startCleanMonitoring();
    interceptNavigationClean();
    
    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.pathname === '/pt/witch-power/trialChoice') {
            restoreUtmsAfterTrialChoiceReload();
        }
        manageCleanUtms();
        interceptFacebookPixelClean();
    });
    
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.location.pathname === '/pt/witch-power/trialChoice') {
                restoreUtmsAfterTrialChoiceReload();
            }
            manageCleanUtms();
            interceptFacebookPixelClean();
        }, 1000);
    });
    
    window.addEventListener('beforeunload', () => {
        if (urlCheckInterval) clearInterval(urlCheckInterval);
        if (paramCheckInterval) clearInterval(paramCheckInterval);
    });
    
    console.log('✅ UTM ANTI-CORRUPTION + TRIALCHOICE RELOAD FIX ativo - UTMs protegidas contra reload!');
})();
</script>
`;

app.use(async (req, res) => {
    let targetDomain = MAIN_TARGET_URL;
    let requestPath = req.url;
    const currentProxyHost = req.protocol + '://' + req.get('host');
    const userAgent = req.headers['user-agent'] || '';
    const isAndroidDevice = isAndroid(userAgent);
    const isMobile = isMobileDevice(userAgent);

    console.log(`🌐 [${isAndroidDevice ? 'ANDROID' : (isMobile ? 'MOBILE' : 'DESKTOP')}] ${req.method} ${req.url}`);

    if (req.method === 'GET' && req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$/)) {
        const cached = staticCache.get(req.url);
        if (cached && (Date.now() - cached.timestamp < CACHE_SETTINGS.STATIC)) {
            cacheHits++;
            console.log(`✅ Static Cache HIT: ${req.url}`);
            return res.status(cached.status).set(cached.headers).send(cached.data);
        }
    }

    const requestHeaders = { ...req.headers };
    delete requestHeaders['host'];
    delete requestHeaders['connection'];
    delete requestHeaders['x-forwarded-for'];

    if (!req.files || Object.keys(req.files).length === 0) {
        delete requestHeaders['accept-encoding'];
    }

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
                console.log('[UPLOAD] Processando upload de arquivo:', photoFile.name);
                const formData = new FormData();
                formData.append('photo', photoFile.data, {
                    filename: photoFile.name,
                    contentType: photoFile.mimetype,
                });
                requestData = formData;
                delete requestHeaders['content-type'];
                delete requestHeaders['content-length'];
                Object.assign(requestHeaders, formData.getHeaders());
                console.log('[UPLOAD] FormData configurado com headers:', formData.getHeaders());
            }
        }

        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: requestHeaders,
            data: requestData,
            responseType: 'arraybuffer',
            timeout: 30000, 
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            httpsAgent: agent,
        });

        if (req.method === 'GET' && req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$/)) {
            cleanCache(staticCache, CACHE_LIMITS.STATIC, 'Static');
            
            const responseHeaders = {};
            Object.keys(response.headers).forEach(header => {
                responseHeaders[header] = response.headers[header];
            });
            
            staticCache.set(req.url, {
                status: response.status,
                headers: responseHeaders,
                data: response.data,
                timestamp: Date.now()
            });
        }

        let responseData = response.data;
        const contentEncoding = response.headers['content-encoding'];
        let htmlContent = null;

        if (contentEncoding === 'gzip') {
            console.log('SERVER: Descomprimindo resposta gzip do destino...');
            responseData = zlib.gunzipSync(responseData);
        } else if (contentEncoding === 'deflate') {
            console.log('SERVER: Descomprimindo resposta deflate do destino...');
            responseData = zlib.inflateSync(responseData);
        } else if (contentEncoding === 'br') {
            console.log('SERVER: Descomprimindo resposta brotli do destino...');
            responseData = zlib.brotliDecompressSync(responseData);
        }

        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            htmlContent = responseData.toString('utf8');
            console.log(`SERVER: Conteúdo HTML recebido do destino. Tamanho: ${htmlContent.length}`);
        } else {
            console.log(`SERVER: Conteúdo não é HTML. Tipo: ${contentType}`);
        }

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
                    console.log('SERVER: Interceptando redirecionamento do servidor de destino para /email. Redirecionando para /onboarding.');
                    return res.redirect(302, '/pt/witch-power/onboarding');
                }
                if (fullRedirectUrl.includes('/pt/witch-power/wpGoal')) {
                    console.log('SERVER: Interceptando redirecionamento para /wpGoal. Redirecionando para /pt/witch-power/trialChoice.');
                    return res.redirect(302, '/pt/witch-power/trialChoice');
                }
                if (fullRedirectUrl.includes('/pt/witch-power/date')) {
                    console.log('SERVER: Interceptando redirecionamento para /date. Redirecionando para /pt/witch-power/date.');
                    return res.redirect(302, '/pt/witch-power/date');
                }

                let proxiedRedirectPath = fullRedirectUrl;
                if (proxiedRedirectPath.startsWith(MAIN_TARGET_URL)) {
                    proxiedRedirectPath = proxiedRedirectPath.replace(MAIN_TARGET_URL, '');
                } else if (proxiedRedirectPath.startsWith(READING_SUBDOMAIN_TARGET)) {
                    proxiedRedirectPath = proxiedRedirectPath.replace(READING_SUBDOMAIN_TARGET, '/reading');
                }
                if (proxiedRedirectPath === '') proxiedRedirectPath = '/';

                console.log(`SERVER: Redirecionamento do destino: ${fullRedirectUrl} -> Reescrevendo para: ${proxiedRedirectPath}`);
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

        if (htmlContent) {
            let html = htmlContent;

            if (html.includes('Ajudamos milhões de pessoas a') && !isCapturing && !capturedBoldText) {
                console.log('SERVER: INTERCEPTANDO HTML NO MIDDLEWARE para pré-popular capturedBoldText!');
                const extractedText = extractTextFromHTML(html);
                if (extractedText && extractedText.length > 5) {
                    capturedBoldText = extractedText;
                    lastCaptureTime = Date.now();
                    console.log('SERVER: SUCESSO! Texto capturado via middleware:', `"${capturedBoldText}"`);
                }
            }

            if (isAndroidDevice) {
                console.log('🤖 ANDROID: Processamento completo com funcionalidades essenciais - BASEADO NO CÓDIGO ANTIGO');
                
                html = html.replace(CONVERSION_PATTERN, (match, p1) => {
                    const usdValue = parseFloat(p1);
                    const brlValue = (usdValue * USD_TO_BRL_RATE).toFixed(2);
                    return `R$${brlValue.replace('.', ',')}`;
                });

                const pixelsCompletos = `
                    <!-- Meta Pixel Code -->
                    <script>
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '1162364828302806');
                    fbq('track', 'PageView');
                    </script>
                    <!-- End Meta Pixel Code -->

                    <!-- Meta Pixel Code -->
                    <script>
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '1770667103479094');
                    fbq('track', 'PageView');
                    </script>
                    <!-- End Meta Pixel Code -->

                    <script>
                    window.pixelId = "67f4b913c96cba3bbf63bc84";
                    var a = document.createElement("script");
                    a.setAttribute("async", "");
                    a.setAttribute("defer", "");
                    a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
                    document.head.appendChild(a);
                    </script>

                    <script
                    src="https://cdn.utmify.com.br/scripts/utms/latest.js"
                    data-utmify-prevent-xcod-sck
                    data-utmify-prevent-subids
                    async
                    defer
                    ></script>

                    <script src="https://curtinaz.github.io/keep-params/keep-params.js"></script>
                `;

                const scriptsEssenciais = `
                    <script>
                    (function() {
                        if (window.proxyScriptLoaded) return;
                        window.proxyScriptLoaded = true;
                        console.log('🤖 ANDROID: Scripts essenciais carregados - COM RELOAD + UTMs PRESERVADAS');
                        
                        const readingSubdomainTarget = '${READING_SUBDOMAIN_TARGET}';
                        const mainTargetOrigin = '${MAIN_TARGET_URL}';
                        const proxyReadingPrefix = '/reading';
                        const proxyApiPrefix = '${currentProxyHost}/api-proxy';
                        const currentProxyHost = '${currentProxyHost}';
                        const targetPagePath = '/pt/witch-power/wpGoal';

                        function saveUtmsBeforeReload() {
                            const currentParams = new URLSearchParams(window.location.search);
                            const utmParams = {};
                            
                            for (const [key, value] of currentParams.entries()) {
                                if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid' || key === 'fbc' || key === 'fbp') {
                                    utmParams[key] = value;
                                }
                            }
                            
                            if (Object.keys(utmParams).length > 0) {
                                sessionStorage.setItem('utm_backup_trialchoice', JSON.stringify(utmParams));
                                sessionStorage.setItem('utm_backup_timestamp', Date.now().toString());
                                console.log('🤖💾 ANDROID: UTMs salvas antes do reload:', utmParams);
                            }
                        }

                        function restoreUtmsAfterReload() {
                            const path = window.location.pathname;
                            if (path === '/pt/witch-power/trialChoice') {
                                const currentParams = new URLSearchParams(window.location.search);
                                const hasUtms = Array.from(currentParams.keys()).some(key => 
                                    key.startsWith('utm_') || key === 'fbclid' || key === 'gclid'
                                );
                                
                                if (!hasUtms) {
                                    const backup = sessionStorage.getItem('utm_backup_trialchoice');
                                    const timestamp = sessionStorage.getItem('utm_backup_timestamp');
                                    
                                    if (backup && timestamp) {
                                        const now = Date.now();
                                        const stored = parseInt(timestamp);
                                        
                                        if ((now - stored) < (5 * 60 * 1000)) { // 5 minutos
                                            try {
                                                const utmParams = JSON.parse(backup);
                                                const newParams = new URLSearchParams();
                                                
                                                Object.keys(utmParams).forEach(key => {
                                                    newParams.set(key, utmParams[key]);
                                                });
                                                
                                                const newUrl = window.location.pathname + '?' + newParams.toString();
                                                window.history.replaceState({}, '', newUrl);
                                                console.log('🤖✅ ANDROID: UTMs restauradas após reload:', newUrl);
                                            } catch (error) {
                                                console.error('🤖❌ ANDROID: Erro ao restaurar UTMs:', error);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        const originalFetch = window.fetch;
                        window.fetch = function(input, init) {
                            let url = input;
                            if (typeof input === 'string') {
                                if (input.startsWith(readingSubdomainTarget)) { 
                                    url = input.replace(readingSubdomainTarget, proxyReadingPrefix);
                                    console.log('CLIENT: PROXY SHIM: REWRITE FETCH URL (Reading): ', input, '->', url);
                                }
                                else if (input.startsWith('https://api.appnebula.co')) { 
                                    url = input.replace('https://api.appnebula.co', proxyApiPrefix);
                                    console.log('CLIENT: PROXY SHIM: REWRITE FETCH URL (API): ', input, '->', url);
                                }
                                else if (input.startsWith(mainTargetOrigin)) { 
                                    url = input.replace(mainTargetOrigin, currentProxyHost);
                                    console.log('CLIENT: PROXY SHIM: REWRITE FETCH URL (Main): ', input, '->', url);
                                }
                            } else if (input instanceof Request) {
                                if (input.url.startsWith(readingSubdomainTarget)) { 
                                    url = new Request(input.url.replace(readingSubdomainTarget, proxyReadingPrefix), input);
                                    console.log('CLIENT: PROXY SHIM: REWRITE FETCH Request Object URL (Reading): ', input.url, '->', url.url);
                                }
                                else if (input.url.startsWith('https://api.appnebula.co')) { 
                                    url = new Request(input.url.replace('https://api.appnebula.co', proxyApiPrefix), input);
                                    console.log('CLIENT: PROXY SHIM: REWRITE FETCH Request Object URL (API): ', input.url, '->', url.url);
                                }
                                else if (input.url.startsWith(mainTargetOrigin)) { 
                                    url = new Request(input.url.replace(mainTargetOrigin, currentProxyHost), input);
                                    console.log('CLIENT: PROXY SHIM: REWRITE FETCH Request Object URL (Main): ', input.url, '->', url.url);
                                }
                            }
                            return originalFetch.call(this, url, init);
                        };

                        const originalXHRopen = XMLHttpRequest.prototype.open;
                        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
                            let modifiedUrl = url;
                            if (typeof url === 'string') {
                                if (url.startsWith(readingSubdomainTarget)) { 
                                    modifiedUrl = url.replace(readingSubdomainTarget, proxyReadingPrefix);
                                    console.log('CLIENT: PROXY SHIM: REWRITE XHR URL (Reading): ', url, '->', modifiedUrl);
                                }
                                else if (url.startsWith('https://api.appnebula.co')) { 
                                    modifiedUrl = url.replace('https://api.appnebula.co', proxyApiPrefix);
                                    console.log('CLIENT: PROXY SHIM: REWRITE XHR URL (API): ', url, '->', modifiedUrl);
                                }
                                else if (url.startsWith(mainTargetOrigin)) { 
                                    modifiedUrl = url.replace(mainTargetOrigin, currentProxyHost);
                                    console.log('CLIENT: PROXY SHIM: REWRITE XHR URL (Main): ', url, '->', modifiedUrl);
                                }
                            }
                            originalXHRopen.call(this, method, modifiedUrl, async, user, password);
                        };

                        const originalPostMessage = window.postMessage;
                        window.postMessage = function(message, targetOrigin, transfer) {
                            let modifiedTargetOrigin = targetOrigin;
                            if (typeof targetOrigin === 'string' && targetOrigin.startsWith(mainTargetOrigin)) { 
                                modifiedTargetOrigin = currentProxyHost;
                                console.log('CLIENT: PROXY SHIM: REWRITE PostMessage TargetOrigin: ', targetOrigin, '->', modifiedTargetOrigin);
                            }
                            originalPostMessage.call(this, message, modifiedTargetOrigin, transfer);
                        };


                        function executeRedirects() {
                            const path = window.location.pathname;
                            
                            if (path === '/pt/witch-power/email') {
                                console.log('🤖 ANDROID: /email → /onboarding');
                                window.location.href = '/pt/witch-power/onboarding';
                                return true;
                            }
                            
                            if (path === '/pt/witch-power/date') {
                                console.log('🤖 ANDROID: /date → reload');
                                window.location.reload();
                                return true;
                            }
                            
                            if (path === '/pt/witch-power/trialChoice') {
                                console.log('🤖 ANDROID: /trialChoice → SALVANDO UTMs + reload');
                                saveUtmsBeforeReload();
                                setTimeout(() => {
                                    window.location.reload();
                                }, 100);
                                return true;
                            }
                            
                            return false;
                        }

                        if (window.location.pathname === '/pt/witch-power/trialChoice') {
                            restoreUtmsAfterReload();
                        }
                        
                        executeRedirects();
                        setTimeout(executeRedirects, 50);
                        setTimeout(executeRedirects, 100);
                        setTimeout(executeRedirects, 200);

                        document.addEventListener('DOMContentLoaded', function() {
                            if (window.location.pathname === '/pt/witch-power/trialChoice') {
                                restoreUtmsAfterReload();
                            }
                            executeRedirects();
                            
                        });

                        let currentUrl = window.location.href;
                        setInterval(function() {
                            if (window.location.href !== currentUrl) {
                                currentUrl = window.location.href;
                                console.log('🤖 ANDROID: URL mudou para:', currentUrl);
                                executeRedirects();
                            }
                        }, 100);

                        const originalPushState = history.pushState;
                        history.pushState = function() {
                            originalPushState.apply(this, arguments);
                            setTimeout(executeRedirects, 25);
                        };

                        const originalReplaceState = history.replaceState;
                        history.replaceState = function() {
                            originalReplaceState.apply(this, arguments);
                            setTimeout(executeRedirects, 25);
                        };

                        window.addEventListener('popstate', function() {
                            setTimeout(executeRedirects, 25);
                        });
                        
                    })();
                    </script>
                `;

                const noscriptCodes = `
                    <noscript><img height="1" width="1" style="display:none"
                    src="https://www.facebook.com/tr?id=1162364828302806&ev=PageView&noscript=1"
                    /></noscript>
                    
                    <noscript><img height="1" width="1" style="display:none"
                    src="https://www.facebook.com/tr?id=1770667103479094&ev=PageView&noscript=1"
                    /></noscript>
                `;

                html = html.replace('</head>', UTM_PERSISTENCE_SCRIPT + pixelsCompletos + scriptsEssenciais + '</head>');
                html = html.replace('<body', noscriptCodes + '<body');



                html = html.replace('</body>', `
                    <div style="position: fixed; bottom: 15px; right: 15px; font-size: 14px; color: rgba(255,255,255,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); z-index: 999999; pointer-events: none; font-family: Arial, sans-serif;">c🔱</div>
                    </body>`);


                
                console.log('🤖✅ ANDROID: COM RELOAD DO TRIALCHOICE + UTMs PRESERVADAS NO RELOAD!');
                console.log('🎯✅ ANDROID: Script ANTI-CORRUPÇÃO de UTMs CORRIGIDO para trialChoice!');
                return res.status(response.status).send(html);
            }

            console.log('📱💻 iOS/Desktop: Processamento completo');
            
            const $ = cheerio.load(html);

            $('head').append(`
                <script>
                (function() {
                    function saveUtmsBeforeReload() {
                        const currentParams = new URLSearchParams(window.location.search);
                        const utmParams = {};
                        
                        for (const [key, value] of currentParams.entries()) {
                            if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid' || key === 'fbc' || key === 'fbp') {
                                utmParams[key] = value;
                            }
                        }
                        
                        if (Object.keys(utmParams).length > 0) {
                            sessionStorage.setItem('utm_backup_trialchoice', JSON.stringify(utmParams));
                            sessionStorage.setItem('utm_backup_timestamp', Date.now().toString());
                            console.log('📱💾 iOS/Desktop: UTMs salvas antes do reload:', utmParams);
                        }
                    }

                    function restoreUtmsAfterReload() {
                        const path = window.location.pathname;
                        if (path === '/pt/witch-power/trialChoice') {
                            const currentParams = new URLSearchParams(window.location.search);
                            const hasUtms = Array.from(currentParams.keys()).some(key => 
                                key.startsWith('utm_') || key === 'fbclid' || key === 'gclid'
                            );
                            
                            if (!hasUtms) {
                                const backup = sessionStorage.getItem('utm_backup_trialchoice');
                                const timestamp = sessionStorage.getItem('utm_backup_timestamp');
                                
                                if (backup && timestamp) {
                                    const now = Date.now();
                                    const stored = parseInt(timestamp);
                                    
                                    if ((now - stored) < (5 * 60 * 1000)) { // 5 minutos
                                        try {
                                            const utmParams = JSON.parse(backup);
                                            const newParams = new URLSearchParams();
                                            
                                            Object.keys(utmParams).forEach(key => {
                                                newParams.set(key, utmParams[key]);
                                            });
                                            
                                            const newUrl = window.location.pathname + '?' + newParams.toString();
                                            window.history.replaceState({}, '', newUrl);
                                            console.log('📱✅ iOS/Desktop: UTMs restauradas após reload:', newUrl);
                                        } catch (error) {
                                            console.error('📱❌ iOS/Desktop: Erro ao restaurar UTMs:', error);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    function executeRedirects() {
                        const path = window.location.pathname;
                        
                        if (path === '/pt/witch-power/email') {
                            console.log('📱 iOS: /email → /onboarding');
                            window.location.href = '/pt/witch-power/onboarding';
                            return true;
                        }
                        
                        if (path === '/pt/witch-power/date') {
                            console.log('📱 iOS: /date → reload');
                            window.location.reload();
                            return true;
                        }
                        
                        if (path === '/pt/witch-power/trialChoice') {
                            console.log('📱 iOS: /trialChoice → SALVANDO UTMs + reload');
                            saveUtmsBeforeReload();
                            setTimeout(() => {
                                window.location.reload();
                            }, 100);
                            return true;
                        }
                        
                        return false;
                    }

                    if (window.location.pathname === '/pt/witch-power/trialChoice') {
                        restoreUtmsAfterReload();
                    }

                    executeRedirects();

                    let currentUrl = window.location.href;
                    setInterval(function() {
                        if (window.location.href !== currentUrl) {
                            currentUrl = window.location.href;
                            executeRedirects();
                        }
                    }, 100);

                    const originalPushState = history.pushState;
                    history.pushState = function() {
                        originalPushState.apply(this, arguments);
                        setTimeout(executeRedirects, 50);
                    };

                    window.addEventListener('popstate', () => setTimeout(executeRedirects, 50));
                    document.addEventListener('DOMContentLoaded', () => {
                        if (window.location.pathname === '/pt/witch-power/trialChoice') {
                            restoreUtmsAfterReload();
                        }
                        executeRedirects();
                    });
                })();
                </script>
            `);

            $('noscript').each((i, el) => {
                const text = $(el).text();
                if (text.includes('You need to enable JavaScript to run this app')) {
                    $(el).remove();
                    console.log('🔥 NOSCRIPT CONFLITANTE REMOVIDO');
                }
            });

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
                        if (originalUrl.startsWith('/')) {
                        } else if (originalUrl.startsWith(MAIN_TARGET_URL)) {
                            element.attr(attrName, originalUrl.replace(MAIN_TARGET_URL, ''));
                        } else if (originalUrl.startsWith(READING_SUBDOMAIN_TARGET)) {
                            element.attr(attrName, originalUrl.replace(READING_SUBDOMAIN_TARGET, '/reading'));
                        } else if (originalUrl.includes('media.appnebula.co')) {
                            element.attr(attrName, originalUrl.replace('https://media.appnebula.co', '/media-proxy'));
                        } else if (originalUrl.includes('palmistry-media.appnebula.co')) {
                            element.attr(attrName, originalUrl.replace('https://palmistry-media.appnebula.co', '/palmistry-proxy'));
                        }
                    }
                }
            });

            const pixelCodes = `
                <!-- Meta Pixel Code -->
                <script>
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '1162364828302806');
                fbq('track', 'PageView');
                </script>
                <!-- End Meta Pixel Code -->

                <!-- Meta Pixel Code -->
                <script>
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '1770667103479094');
                fbq('track', 'PageView');
                </script>
                <!-- End Meta Pixel Code -->

                <script>
                window.pixelId = "67f4b913c96cba3bbf63bc84";
                var a = document.createElement("script");
                a.setAttribute("async", "");
                a.setAttribute("defer", "");
                a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
                document.head.appendChild(a);
                </script>

                <script
                src="https://cdn.utmify.com.br/scripts/utms/latest.js"
                data-utmify-prevent-xcod-sck
                data-utmify-prevent-subids
                async
                defer
                ></script>

                <script src="https://curtinaz.github.io/keep-params/keep-params.js"></script>
            `;

            $('head').prepend(UTM_PERSISTENCE_SCRIPT);
            $('head').prepend(pixelCodes);

            const noscriptCodes = `
                <noscript><img height="1" width="1" style="display:none"
                src="https://www.facebook.com/tr?id=1162364828302806&ev=PageView&noscript=1"
                /></noscript>
                
                <noscript><img height="1" width="1" style="display:none"
                src="https://www.facebook.com/tr?id=1770667103479094&ev=PageView&noscript=1"
                /></noscript>
            `;

            $('body').prepend(noscriptCodes);

            const clientScript =
                '<script>' +
                '(function() {' +
                'console.log(\'CLIENT: INJECTED SCRIPT: Script started execution.\');' +
                'const readingSubdomainTarget = \'' + READING_SUBDOMAIN_TARGET + '\';' +
                'const mainTargetOrigin = \'' + MAIN_TARGET_URL + '\';' +
                'const proxyReadingPrefix = \'/reading\';' +
                'const proxyApiPrefix = \'' + currentProxyHost + '/api-proxy\';' +
                'const currentProxyHost = \'' + currentProxyHost + '\';' +
                'const targetPagePath = \'/pt/witch-power/wpGoal\';' +

                'const originalFetch = window.fetch;' +
                'window.fetch = function(input, init) {' +
                'let url = input;' +
                'if (typeof input === \'string\') {' +
                'if (input.startsWith(readingSubdomainTarget)) { url = input.replace(readingSubdomainTarget, proxyReadingPrefix); console.log(\'CLIENT: PROXY SHIM: REWRITE FETCH URL (Reading): \', input, \'->\', url); }' +
                'else if (input.startsWith(\'https://api.appnebula.co\')) { url = input.replace(\'https://api.appnebula.co\', proxyApiPrefix); console.log(\'CLIENT: PROXY SHIM: REWRITE FETCH URL (API): \', input, \'->\', url); }' +
                'else if (input.startsWith(mainTargetOrigin)) { url = input.replace(mainTargetOrigin, currentProxyHost); console.log(\'CLIENT: PROXY SHIM: REWRITE FETCH URL (Main): \', input, \'->\', url); }' +
                '} else if (input instanceof Request) {' +
                'if (input.url.startsWith(readingSubdomainTarget)) { url = new Request(input.url.replace(readingSubdomainTarget, proxyReadingPrefix), input); console.log(\'CLIENT: PROXY SHIM: REWRITE FETCH Request Object URL (Reading): \', input.url, \'->\', url.url); }' +
                'else if (input.url.startsWith(\'https://api.appnebula.co\')) { url = new Request(input.url.replace(\'https://api.appnebula.co\', proxyApiPrefix), input); console.log(\'CLIENT: PROXY SHIM: REWRITE FETCH Request Object URL (API): \', input.url, \'->\', url.url); }' +
                'else if (input.url.startsWith(mainTargetOrigin)) { url = new Request(input.url.replace(mainTargetOrigin, currentProxyHost), input); console.log(\'CLIENT: PROXY SHIM: REWRITE FETCH Request Object URL (Main): \', input.url, \'->\', url.url); }' +
                '}' +
                'return originalFetch.call(this, url, init);' +
                '};' +
                'const originalXHRopen = XMLHttpRequest.prototype.open;' +
                'XMLHttpRequest.prototype.open = function(method, url, async, user, password) {' +
                'let modifiedUrl = url;' +
                'if (typeof url === \'string\') {' +
                'if (url.startsWith(readingSubdomainTarget)) { modifiedUrl = url.replace(readingSubdomainTarget, proxyReadingPrefix); console.log(\'CLIENT: PROXY SHIM: REWRITE XHR URL (Reading): \', url, \'->\', modifiedUrl); }' +
                'else if (url.startsWith(\'https://api.appnebula.co\')) { modifiedUrl = url.replace(\'https://api.appnebula.co\', proxyApiPrefix); console.log(\'CLIENT: PROXY SHIM: REWRITE XHR URL (API): \', url, \'->\', modifiedUrl); }' +
                'else if (url.startsWith(mainTargetOrigin)) { modifiedUrl = url.replace(mainTargetOrigin, currentProxyHost); console.log(\'CLIENT: PROXY SHIM: REWRITE XHR URL (Main): \', url, \'->\', modifiedUrl); }' +
                '}' +
                'originalXHRopen.call(this, method, modifiedUrl, async, user, password);' +
                '};\n' +
                'const originalPostMessage = window.postMessage;' +
                'window.postMessage = function(message, targetOrigin, transfer) {' +
                'let modifiedTargetOrigin = targetOrigin;' +
                'if (typeof targetOrigin === \'string\' && targetOrigin.startsWith(mainTargetOrigin)) { modifiedTargetOrigin = currentProxyHost; console.log(\'CLIENT: PROXY SHIM: REWRITE PostMessage TargetOrigin: \', targetOrigin, \'->\', modifiedTargetOrigin); }' +
                'originalPostMessage.call(this, message, modifiedTargetOrigin, transfer);' +
                '};\n' +

                

                '})();' +
                '</script>';

            $('head').prepend(clientScript);

            console.log('SERVER: Script de cliente injetado no <head>.');

            html = $.html().replace(CONVERSION_PATTERN, (match, p1) => {
                const usdValue = parseFloat(p1);
                const brlValue = (usdValue * USD_TO_BRL_RATE).toFixed(2);
                return `R$${brlValue.replace('.', ',')}`;
            });


html = html.replace('</body>', `
    <div style="position: fixed; bottom: 15px; right: 15px; font-size: 14px; color: rgba(255,255,255,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); z-index: 999999; pointer-events: none; font-family: Arial, sans-serif;">c🔱</div>
    </body>`);

                    
            console.log('🎯✅ iOS/Desktop: COM RELOAD DO TRIALCHOICE + UTMs PRESERVADAS NO RELOAD!');            
            console.log('🎯✅ iOS/Desktop: Script ANTI-CORRUPÇÃO de UTMs CORRIGIDO para trialChoice!');
            res.status(response.status).send(html);
        } else {
            res.status(response.status).send(responseData);
        }

    } catch (error) {
        console.error(`❌ SERVER: ERRO no proxy para ${targetUrl}:`, error.message);
        errorCount++;
        if (error.response) {
            console.error('SERVER: Status do destino:', error.response.status);
            res.status(error.response.status).send(error.response.data || 'Erro ao processar a requisição de proxy.');
        } else {
            res.status(500).send('Erro ao processar a requisição de proxy.');
        }
    }
});

setInterval(() => {
    const now = Date.now();

    let staticCleared = 0;
    for (const [key, value] of staticCache.entries()) {
        if (now - value.timestamp > CACHE_SETTINGS.STATIC) {
            staticCache.delete(key);
            staticCleared++;
        }
    }

    let apiCleared = 0;
    for (const [key, value] of apiCache.entries()) {
        if (now - value.timestamp > CACHE_SETTINGS.API) {
            apiCache.delete(key);
            apiCleared++;
        }
    }

    let htmlCleared = 0;
    for (const [key, value] of htmlCache.entries()) {
        if (now - value.timestamp > CACHE_SETTINGS.HTML) {
            htmlCache.delete(key);
            htmlCleared++;
        }
    }

    let imageCleared = 0;
    for (const [key, value] of imageCache.entries()) {
        if (now - value.timestamp > CACHE_SETTINGS.IMAGES) {
            imageCache.delete(key);
            imageCleared++;
        }
    }

    const staticForced = cleanCache(staticCache, CACHE_LIMITS.STATIC, 'Static');
    const apiForced = cleanCache(apiCache, CACHE_LIMITS.API, 'API');
    const htmlForced = cleanCache(htmlCache, CACHE_LIMITS.HTML, 'HTML');
    const imageForced = cleanCache(imageCache, CACHE_LIMITS.IMAGES, 'Images');

    if (staticCleared > 0 || apiCleared > 0 || htmlCleared > 0 || imageCleared > 0 || 
        staticForced > 0 || apiForced > 0 || htmlForced > 0 || imageForced > 0) {
        console.log(`🧹 Cache cleanup: Static=${staticCleared}+${staticForced}, API=${apiCleared}+${apiForced}, HTML=${htmlCleared}+${htmlForced}, Images=${imageCleared}+${imageForced}`);
    }

    if (global.gc) {
        global.gc();
    }
}, 5000);

setInterval(() => {
    const uptime = Math.floor((Date.now() - startTime) / 60000);
    const requestsPerMin = Math.floor(requestCount / Math.max(uptime, 1));
    const cacheHitRatio = requestCount > 0 ? Math.floor((cacheHits / requestCount) * 100) : 0;
    const errorRate = requestCount > 0 ? Math.floor((errorCount / requestCount) * 100) : 0;

    console.log(`📊 Performance: ${requestCount} requests, ${requestsPerMin}/min, ${cacheHitRatio}% cache hit, ${errorRate}% errors, uptime ${uptime}min`);
    console.log(`💾 Cache sizes: Static=${staticCache.size}/${CACHE_LIMITS.STATIC}, API=${apiCache.size}/${CACHE_LIMITS.API}, HTML=${htmlCache.size}/${CACHE_LIMITS.HTML}, Images=${imageCache.size}/${CACHE_LIMITS.IMAGES}`);

    if (uptime % 30 === 0 && uptime > 0) {
        requestCount = 0;
        errorCount = 0;
        cacheHits = 0;
        startTime = Date.now();
        console.log('📈 Estatísticas resetadas');
    }
}, 60000);

app.get('/health', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 60000);
    const memUsage = process.memoryUsage();

    res.json({
        status: 'OK',
        uptime: `${uptime} minutes`,
        requests: requestCount,
        errors: errorCount,
        cacheHits: cacheHits,
        memory: {
            rss: Math.floor(memUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.floor(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.floor(memUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        cache: {
            static: `${staticCache.size}/${CACHE_LIMITS.STATIC}`,
            api: `${apiCache.size}/${CACHE_LIMITS.API}`,
            html: `${htmlCache.size}/${CACHE_LIMITS.HTML}`,
            images: `${imageCache.size}/${CACHE_LIMITS.IMAGES}`
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 SERVIDOR PROXY DEFINITIVAMENTE CORRIGIDO na porta ${PORT}`);
    console.log(`✅ TRIALCHOICE: RELOAD MANTIDO + UTMs PRESERVADAS NO RELOAD!`);
    console.log(`✅ SOLUÇÃO: UTMs são salvas antes do reload e restauradas depois!`);
    console.log(`🎯 FUNCIONAMENTO: trialChoice + reload + UTMs permanentes na URL!`);
    console.log(`💯 PERFEITO: Reload continua + UTMs nunca somem!`);
});
