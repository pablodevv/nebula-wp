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

// Variável para armazenar o texto capturado (mantida, embora o localStorage seja a fonte principal agora)
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
// Isso DEVE vir antes do middleware de proxy principal.
app.use(express.static(path.join(__dirname, 'dist')));

// API endpoint para obter o texto capturado (mantido para compatibilidade)
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

// Função para extrair texto do HTML (mantida)
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

        // ESTRATÉGHE 2: Procurar em elementos específicos (revisado para ser mais genérico)
        const specificElements = $('p, span, div, h1, h2, h3, b').filter((i, el) => {
            const text = $(el).text().trim();
            return text.includes('Ajudamos milhões de pessoas a') && text.includes('e queremos ajudar você também');
        });

        if (specificElements.length > 0) {
            const textContent = specificElements.first().text();
            const match = textContent.match(/Ajudamos milhões de pessoas a\s*(.+?)\s*,\s*e queremos ajudar você também/i);
            if (match && match[1]) {
                const extracted = match[1].trim();
                if (extracted.length > 5) {
                    console.log(`✅ ESTRATÉGIA 2: Texto encontrado em elemento específico: "${extracted}"`);
                    return extracted;
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
                 text.includes('encontrar'))) {
                relevantTexts.push(text);
            }
        });

        console.log('📝 Todos os <b> relevantes encontrados:', relevantTexts);

        if (relevantTexts.length > 0) {
            console.log('✅ ESTRATÉGIA 3: Usando primeiro <b> relevante:', `"${relevantTexts[0]}"`);
            return relevantTexts[0];
        }

        // ESTRATÉGIA 4: Regex para encontrar o padrão no HTML bruto
        const regexPattern = /Ajudamos milhões de pessoas a\s*(?:<b[^>]*>)?([^<]+?)(?:<\/b>)?\s*,\s*e queremos ajudar você também/gi;
        const match = html.match(regexPattern);

        if (match && match[0]) {
            const boldMatch = match[0].match(/(?:<b[^>]*>)?([^<]+?)(?:<\/b>)?/i);
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

// Função para fazer requisição direta e capturar o texto (mantida)
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
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 30000
        });

        console.log('✅ Resposta recebida! Status:', response.status);
        console.log('📊 Tamanho do HTML:', response.data.length);

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

        // Tentar com diferentes textos conhecidos no HTML (fallback)
        const knownTexts = [
            'identificar seu arquétipo de bruxa',
            'explorar origens de vidas passadas',
            'desvendar seu destino e propósito',
            'descobrir seus poderes ocultos',
            'encontrar marcas e símbolos que as guiam',
            'revelar seus dons espirituais',
            'revelar minha aura de bruxa' // Adicionado da sua lista
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
        lastCaptureTime = Date.24();
        console.log('⚠️ Usando fallback de erro:', `"${capturedBoldText}"`);

        return capturedBoldText;
    } finally {
        isCapturing = false;
        console.log('🏁 Captura finalizada\n');
    }
}

// Rota específica para a página customizada de trialChoice (mantida)
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

        res.sendFile(path.join(__dirname, 'dist', 'index.html'));

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO:', error.message);

        // Mesmo com erro, serve a página React com fallback
        capturedBoldText = 'identificar seu arquétipo de bruxa';
        lastCaptureTime = Date.now();

        console.log('Usando texto fallback de erro:', `"${capturedBoldText}"`);
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
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

            // REDIRECIONAMENTO CLIENT-SIDE MAIS AGRESSIVO PARA /pt/witch-power/email (mantido)
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

            // MODIFICAÇÕES ESPECÍFICAS PARA /pt/witch-power/trialPaymentancestral (mantido)
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

            // --- NOVO SCRIPT PARA CAPTURAR O QUIZ E INSERIR BOTÕES INVISÍVEIS ---
            // APENAS NA PÁGINA ESPECÍFICA DO QUIZ: /pt/witch-power/wpGoal
            if (req.url.includes('/pt/witch-power/wpGoal')) {
                console.log('Injetando script de botões invisíveis na página wpGoal.');

                // Estilos CSS para o botão invisível
                $('head').append(`
                    <style>
                        .invisible-overlay-button {
                            position: absolute;
                            z-index: 99999; /* Garante que ele fique acima de tudo */
                            opacity: 0; /* Totalmente invisível */
                            background: rgba(0, 255, 0, 0.1); /* Cor para debug, remova ou defina para 0 */
                            cursor: pointer;
                            border: none;
                            padding: 0;
                            margin: 0;
                            box-sizing: border-box; /* Garante que o padding não afete o tamanho */
                        }
                    </style>
                `);

                // Script JavaScript para criar e posicionar os botões invisíveis
                $('body').append(`
                    <script>
                        (function() {
                            const setupInvisibleButtons = () => {
                                console.log('🔮 Configurando botões invisíveis para o quiz...');
                                const originalButtons = document.querySelectorAll('li[data-testid="answer-button"]');
                                console.log('Encontrados ' + originalButtons.length + ' botões originais do quiz.');

                                originalButtons.forEach((originalButton, index) => {
                                    // Remove qualquer botão invisível anterior para evitar duplicatas
                                    const existingOverlay = originalButton.querySelector('.invisible-overlay-button');
                                    if (existingOverlay) {
                                        existingOverlay.remove();
                                    }

                                    const rect = originalButton.getBoundingClientRect();
                                    
                                    // Cria o botão invisível
                                    const overlayButton = document.createElement('button');
                                    overlayButton.className = 'invisible-overlay-button';
                                    
                                    // Posiciona o botão invisível exatamente sobre o botão original
                                    overlayButton.style.top = (rect.top + window.scrollY) + 'px';
                                    overlayButton.style.left = (rect.left + window.scrollX) + 'px';
                                    overlayButton.style.width = rect.width + 'px';
                                    overlayButton.style.height = rect.height + 'px';

                                    // Adiciona o texto da opção para facilitar a identificação
                                    const chosenTextElement = originalButton.querySelector('span.sc-5303d838-10.gdosuv');
                                    const chosenText = chosenTextElement ? chosenTextElement.textContent.trim() : 'Opção ' + (index + 1);
                                    overlayButton.dataset.quizChoice = chosenText; // Armazena a escolha no dataset

                                    overlayButton.addEventListener('click', function(event) {
                                        event.preventDefault(); // Evita qualquer comportamento padrão extra do botão invisível
                                        event.stopPropagation(); // Impede que o clique se propague para elementos abaixo imediatamente

                                        const capturedChoice = this.dataset.quizChoice;
                                        console.log('✅ Botão invisível clicado! Escolha capturada: ' + capturedChoice);
                                        localStorage.setItem('nebulaQuizChoice', capturedChoice); // Salva no localStorage

                                        // Agora, simula o clique no botão original
                                        console.log('Simulando clique no botão original...');
                                        originalButton.click(); // Isso deve acionar o script original do quiz
                                    });

                                    // Adiciona o botão invisível ao corpo do documento
                                    document.body.appendChild(overlayButton);
                                    console.log('Botão invisível #' + (index + 1) + ' para "' + chosenText + '" criado e posicionado.');
                                });
                            };

                            // Chama a função de setup quando o DOM estiver pronto
                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', setupInvisibleButtons);
                            } else {
                                setupInvisibleButtons();
                            }

                            // Observa mudanças no DOM caso os botões sejam carregados dinamicamente
                            const observer = new MutationObserver((mutationsList, observer) => {
                                for (const mutation of mutationsList) {
                                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                        // Verifica se algum dos nós adicionados ou seus descendentes são os botões do quiz
                                        const foundButtons = Array.from(mutation.addedNodes).some(node =>
                                            node.nodeType === 1 && (node.matches('li[data-testid="answer-button"]') || node.querySelector('li[data-testid="answer-button"]'))
                                        );
                                        if (foundButtons) {
                                            console.log('🎨 Botões do quiz detectados por MutationObserver. Re-configurando botões invisíveis.');
                                            setupInvisibleButtons();
                                            // Opcional: desconectar o observer após a primeira configuração bem-sucedida se os botões não mudarem mais
                                            // observer.disconnect();
                                            break; // Para de observar após encontrar e re-configurar
                                        }
                                    }
                                }
                            });

                            // Começa a observar o corpo do documento para mudanças
                            observer.observe(document.body, { childList: true, subtree: true });

                            // Adiciona um listener para redimensionamento de tela para reajustar os botões
                            window.addEventListener('resize', setupInvisibleButtons);
                            window.addEventListener('scroll', setupInvisibleButtons); // Se a página for scrollável e os botões saírem da posição fixa
                        })();
                    </script>
                `);
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
