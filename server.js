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

// Usa express-fileupload para lidar com uploads de arquivos (multipart/form-data)
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Limite de 50MB, ajuste se necessário
    createParentPath: true,
    uriDecodeFileNames: true,
    preserveExtension: true
}));

// Middleware para servir arquivos estáticos da build do React
app.use(express.static(path.join(__dirname, 'dist')));

// API endpoint para obter o texto capturado
app.get('/api/captured-text', (req, res) => {
    console.log('API chamada - retornando texto capturado:', capturedBoldText);
    res.json({ capturedText: capturedBoldText });
});

// Rota específica para a página customizada de trialChoice
app.get('/pt/witch-power/trialChoice', async (req, res) => {
    console.log('\n=== INTERCEPTANDO TRIALCHOICE ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL acessada:', req.url);
    
    // RESET do texto capturado para garantir captura fresca
    const oldText = capturedBoldText;
    capturedBoldText = '';
    console.log('Texto anterior:', oldText);
    console.log('Texto resetado para captura fresca');
    
    let browser;
    try {
        console.log('\n--- INICIANDO PUPPETEER PARA PÁGINA JAVASCRIPT ---');
        
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
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        // Configurar User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('🌐 Navegando para:', `${MAIN_TARGET_URL}/pt/witch-power/trialChoice`);
        
        // Navegar para a página e aguardar o carregamento completo
        await page.goto(`${MAIN_TARGET_URL}/pt/witch-power/trialChoice`, {
            waitUntil: 'networkidle0', // Aguarda até não haver requisições por 500ms
            timeout: 30000
        });
        
        console.log('✅ Página carregada, aguardando renderização...');
        
        // Aguardar um pouco mais para garantir que o JavaScript renderizou
        await page.waitForTimeout(3000);
        
        // Tentar aguardar pelo elemento específico aparecer
        try {
            await page.waitForSelector('p.sc-edafe909-6.pLaXn', { timeout: 5000 });
            console.log('✅ Elemento com classe sc-edafe909-6 pLaXn encontrado!');
        } catch (e) {
            console.log('⚠️ Elemento específico não encontrado, continuando...');
        }
        
        // Obter o HTML renderizado
        const htmlContent = await page.content();
        console.log('📄 HTML renderizado obtido, tamanho:', htmlContent.length, 'caracteres');
        
        // DEBUG: Salvar uma amostra do HTML para análise
        const htmlSample = htmlContent.substring(0, 2000);
        console.log('\n--- AMOSTRA DO HTML RECEBIDO ---');
        console.log(htmlSample);
        console.log('--- FIM DA AMOSTRA ---\n');
        
        // Usar Puppeteer para extrair o texto diretamente
        console.log('\n--- EXTRAINDO TEXTO COM PUPPETEER ---');
        
        // Estratégia 1: Procurar pelo seletor específico
        let boldText = await page.evaluate(() => {
            const paragraph = document.querySelector('p.sc-edafe909-6.pLaXn');
            if (paragraph) {
                const boldElement = paragraph.querySelector('b');
                if (boldElement) {
                    return boldElement.textContent.trim();
                }
            }
            return null;
        });
        
        if (boldText) {
            capturedBoldText = boldText;
            console.log('✅ Texto capturado com seletor específico:', `"${capturedBoldText}"`);
        } else {
            console.log('❌ Seletor específico não funcionou, tentando alternativas...');
            
            // Estratégia 2: Procurar em parágrafos que contenham "Ajudamos milhões"
            boldText = await page.evaluate(() => {
                const paragraphs = document.querySelectorAll('p');
                for (const p of paragraphs) {
                    if (p.textContent.includes('Ajudamos milhões')) {
                        const boldElement = p.querySelector('b');
                        if (boldElement) {
                            return boldElement.textContent.trim();
                        }
                    }
                }
                return null;
            });
            
            if (boldText) {
                capturedBoldText = boldText;
                console.log('✅ Texto capturado em parágrafo "Ajudamos milhões":', `"${capturedBoldText}"`);
            } else {
                console.log('❌ Parágrafo "Ajudamos milhões" não encontrado, tentando busca geral...');
                
                // Estratégia 3: Buscar qualquer <b> relevante
                const allBoldTexts = await page.evaluate(() => {
                    const boldElements = document.querySelectorAll('b');
                    const texts = [];
                    boldElements.forEach(b => {
                        const text = b.textContent.trim();
                        if (text.length > 5 && !text.includes('$') && !text.includes('€') && !text.includes('R$')) {
                            texts.push(text);
                        }
                    });
                    return texts;
                });
                
                console.log('📝 Todos os <b> relevantes encontrados:', allBoldTexts);
                
                if (allBoldTexts.length > 0) {
                    capturedBoldText = allBoldTexts[0]; // Pega o primeiro
                    console.log('✅ Texto capturado do primeiro <b> relevante:', `"${capturedBoldText}"`);
                } else {
                    // Estratégia 4: Buscar <strong> também
                    const allStrongTexts = await page.evaluate(() => {
                        const strongElements = document.querySelectorAll('strong');
                        const texts = [];
                        strongElements.forEach(s => {
                            const text = s.textContent.trim();
                            if (text.length > 5 && !text.includes('$') && !text.includes('€') && !text.includes('R$')) {
                                texts.push(text);
                            }
                        });
                        return texts;
                    });
                    
                    console.log('📝 Todos os <strong> relevantes encontrados:', allStrongTexts);
                    
                    if (allStrongTexts.length > 0) {
                        capturedBoldText = allStrongTexts[0];
                        console.log('✅ Texto capturado do primeiro <strong> relevante:', `"${capturedBoldText}"`);
                    }
                }
            }
        }
        
        // Fechar o browser
        await browser.close();
        browser = null;
        
        // Fallback se nada foi encontrado
        if (!capturedBoldText) {
            capturedBoldText = 'descobrir seus poderes ocultos';
            console.log('⚠️ Usando fallback absoluto:', `"${capturedBoldText}"`);
        }
        
        console.log('\n=== RESULTADO FINAL ===');
        console.log('Texto que será usado:', `"${capturedBoldText}"`);
        console.log('Timestamp final:', new Date().toISOString());
        
        // Serve a página React customizada IMEDIATAMENTE
        console.log('✅ Servindo página React customizada...\n');
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        
    } catch (error) {
        console.error('\n❌ ERRO no Puppeteer:', error.message);
        
        // Fechar browser se ainda estiver aberto
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Erro ao fechar browser:', closeError.message);
            }
        }
        
        // Mesmo com erro, serve a página React com fallback
        capturedBoldText = 'descobrir seus poderes ocultos';
        console.log('Usando texto fallback de erro:', `"${capturedBoldText}"`);
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
});

// Middleware Principal do Proxy Reverso
app.use(async (req, res) => {
    // Declarar targetDomain no início para evitar erro
    let targetDomain = MAIN_TARGET_URL;
    let requestPath = req.url;

        // Estratégia 3: Procura por qualquer <b> que contenha texto relacionado
        if (!capturedBoldText) {
            console.log('3. Procurando por qualquer <b> relevante...');
            const allBolds = [];
            $('b').each((i, el) => {
                const text = $(el).text().trim();
                allBolds.push(text);
                if (text.length > 5 && !text.includes('$') && !text.includes('€') && !text.includes('R$')) {
                    capturedBoldText = text;
                    console.log(`   ✅ Texto capturado do <b> [${i}]:`, `"${capturedBoldText}"`);
                    return false; // break
                }
            });
            console.log('   Todos os <b> encontrados:', allBolds);
        }

        // Estratégia 5: Procura por <strong> também (às vezes usado no lugar de <b>)
        if (!capturedBoldText) {
            console.log('5. Procurando por elementos <strong>...');
            const allStrongs = [];
            $('strong').each((i, el) => {
                const text = $(el).text().trim();
                allStrongs.push(text);
                if (text.length > 5 && !text.includes('$') && !text.includes('€') && !text.includes('R$')) {
                    capturedBoldText = text;
                    console.log(`   ✅ Texto capturado do <strong> [${i}]:`, `"${capturedBoldText}"`);
                    return false; // break
                }
            });
            console.log('   Todos os <strong> encontrados:', allStrongs);
        }

        // Estratégia 6: Procura por texto em qualquer elemento que contenha palavras-chave
        if (!capturedBoldText) {
            console.log('6. Procurando texto em qualquer elemento...');
            const keywords = ['bruxa', 'arquétipo', 'poder', 'oculto', 'místico', 'espiritual'];
            $('*').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 10 && text.length < 100) {
                    for (const keyword of keywords) {
                        if (text.toLowerCase().includes(keyword)) {
                            // Verifica se não é um parágrafo inteiro, mas sim uma frase específica
                            if (!text.includes('Ajudamos milhões') && !text.includes('queremos ajudar')) {
                                capturedBoldText = text;
                                console.log(`   ✅ Texto capturado por keyword "${keyword}":`, `"${capturedBoldText}"`);
                                return false; // break
                            }
                        }
                    }
                }
            });
        }

        // Estratégia 4: Procura por texto específico relacionado a bruxas
        if (!capturedBoldText) {
            console.log('4. Procurando por texto relacionado a bruxas...');
            const keywords = ['bruxa', 'poder', 'magia', 'oculto', 'místico', 'espiritual', 'energia', 'vida'];
            $('b').each((i, el) => {
                const text = $(el).text().trim().toLowerCase();
                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        capturedBoldText = $(el).text().trim();
                        console.log(`   ✅ Texto capturado por keyword "${keyword}":`, `"${capturedBoldText}"`);
                        return false; // break
                    }
                }
            });
        }

        // Fallback absoluto se nada foi encontrado
        if (!capturedBoldText) {
            capturedBoldText = 'descobrir seus poderes ocultos';
            console.log('⚠️ Usando fallback absoluto:', `"${capturedBoldText}"`);
        }

        console.log('\n=== RESULTADO FINAL ===');
        console.log('Texto que será usado:', `"${capturedBoldText}"`);
        console.log('Timestamp final:', new Date().toISOString());
        
        // Serve a página React customizada IMEDIATAMENTE
        console.log('✅ Servindo página React customizada...\n');
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        
    } catch (error) {
        console.error('\n❌ ERRO ao capturar texto do <b>:', error.message);
        if (error.code === 'ECONNABORTED') {
            console.error('Timeout na requisição');
        } else if (error.code === 'ENOTFOUND') {
            console.error('Domínio não encontrado');
        } else {
            console.error('Detalhes do erro:', error.code, error.response?.status);
        }
        // Mesmo com erro, serve a página React com fallback
        capturedBoldText = 'descobrir seus poderes ocultos';
        console.log('Usando texto fallback de erro:', `"${capturedBoldText}"`);
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
});

// Middleware Principal do Proxy Reverso
app.use(async (req, res) => {
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

            // ---
            // REDIRECIONAMENTO CLIENT-SIDE MAIS AGRESSIVO PARA /pt/witch-power/email
            // Este script será injetado em TODAS as páginas HTML para forçar o redirecionamento
            $('head').append(`
                <script>
                    console.log('CLIENT-SIDE REDIRECT SCRIPT: Initializing.');

                    // Variável para armazenar o ID do intervalo, permitindo limpá-lo
                    let redirectCheckInterval;

                    function handleEmailRedirect() {
                        const currentPath = window.location.pathname;
                        // Use startsWith para pegar /email e /email?param=value
                        if (currentPath.startsWith('/pt/witch-power/email')) {
                            console.log('CLIENT-SIDE REDIRECT: URL /pt/witch-power/email detectada. Forçando redirecionamento para /pt/witch-power/onboarding');
                            // Limpa o intervalo imediatamente para evitar múltiplos redirecionamentos
                            if (redirectCheckInterval) {
                                clearInterval(redirectCheckInterval);
                            }
                            window.location.replace('/pt/witch-power/onboarding'); // Usa replace para não deixar no histórico
                        }
                    }

                    // 1. Executa no carregamento inicial da página (para quando há uma requisição HTTP direta ou client-side inicial)
                    document.addEventListener('DOMContentLoaded', handleEmailRedirect);

                    // 2. Monitora mudanças na história do navegador (para navegações via SPA - pushState/replaceState)
                    window.addEventListener('popstate', handleEmailRedirect);

                    // 3. Adiciona um verificador periódico como uma camada extra de segurança
                    // para capturar qualquer transição que os eventos não peguem
                    redirectCheckInterval = setInterval(handleEmailRedirect, 100); // Verifica a cada 100ms

                    // Limpa o intervalo se a página for descarregada para evitar vazamento de memória
                    window.addEventListener('beforeunload', () => {
                        if (redirectCheckInterval) {
                            clearInterval(redirectCheckInterval);
                        }
                    });

                    // Tenta executar imediatamente também para casos onde o script é injetado muito cedo
                    handleEmailRedirect();

                </script>
            `);

            // ---
            // REDIRECIONAMENTO CLIENT-SIDE PARA /pt/witch-power/trialChoice
            // Este script força o redirecionamento quando o usuário navega via SPA
            $('head').append(`
                <script>
                    console.log('CLIENT-SIDE TRIALCHOICE REDIRECT SCRIPT: Initializing.');

                    // Variável para armazenar o ID do intervalo
                    let trialChoiceRedirectInterval;

                    function handleTrialChoiceRedirect() {
                        const currentPath = window.location.pathname;
                        if (currentPath === '/pt/witch-power/trialChoice') {
                            console.log('CLIENT-SIDE REDIRECT: URL /pt/witch-power/trialChoice detectada. Forçando reload para interceptação do servidor.');
                            // Limpa o intervalo imediatamente
                            if (trialChoiceRedirectInterval) {
                                clearInterval(trialChoiceRedirectInterval);
                            }
                            // Força um reload da página para que o servidor possa interceptar
                            window.location.reload();
                        }
                    }

                    // 1. Executa no carregamento inicial da página
                    document.addEventListener('DOMContentLoaded', handleTrialChoiceRedirect);

                    // 2. Monitora mudanças na história do navegador (navegação SPA)
                    window.addEventListener('popstate', handleTrialChoiceRedirect);

                    // 3. Verificador periódico para capturar navegações SPA que não disparam eventos
                    trialChoiceRedirectInterval = setInterval(handleTrialChoiceRedirect, 200);

                    // 4. Monitora mudanças no DOM que podem indicar navegação SPA
                    if (window.MutationObserver) {
                        const observer = new MutationObserver(function(mutations) {
                            // Verifica se houve mudanças significativas no DOM que podem indicar nova página
                            mutations.forEach(function(mutation) {
                                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                    // Pequeno delay para permitir que a URL seja atualizada
                                    setTimeout(handleTrialChoiceRedirect, 50);
                                }
                            });
                        });
                        
                        // Observa mudanças no body
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                    }

                    // Limpa o intervalo se a página for descarregada
                    window.addEventListener('beforeunload', () => {
                        if (trialChoiceRedirectInterval) {
                            clearInterval(trialChoiceRedirectInterval);
                        }
                    });

                    // Executa imediatamente também
                    handleTrialChoiceRedirect();

                </script>
            `);
            // ---

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