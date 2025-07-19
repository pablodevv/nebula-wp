const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // Para manipular o HTML
const path = require('path');

const app = express();
const PORT = 3000;
const TARGET_URL_BASE = 'https://quiz.quizmagic.net'; // URL base do site alvo

// Taxa de conversão USD para BRL (você pode ajustar conforme necessário)
const USD_TO_BRL_RATE = 5.20;
// Padrão de regex para encontrar valores em USD (ex: $1.99, $19.99)
const CONVERSION_PATTERN = /\$(\d+\.?\d*)/g;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota principal do proxy
app.all('*', async (req, res) => {
    const targetPath = req.originalUrl;
    const targetUrl = `${TARGET_URL_BASE}${targetPath}`;

    console.log(`Requisição recebida para: ${targetPath}`);
    console.log(`Proxying para: ${targetUrl}`);

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: {
                'User-Agent': req.headers['user-agent'],
                'Accept-Encoding': 'identity', // Importante para evitar compressão e facilitar manipulação
                ...req.headers,
                host: new URL(TARGET_URL_BASE).host, // Garante que o cabeçalho host seja o do site alvo
            },
            data: req.method === 'POST' ? req.body : undefined,
            responseType: 'arraybuffer', // Para lidar com dados binários (imagens, etc.)
            validateStatus: function (status) {
                return status >= 200 && status < 500; // Não lança erro para 4xx, permitindo repassar status codes
            },
        });

        // Copia os cabeçalhos da resposta original, exceto 'content-encoding' e 'content-length'
        for (const key in response.headers) {
            if (key.toLowerCase() === 'content-encoding' || key.toLowerCase() === 'content-length') {
                continue; // Ignora cabeçalhos que podem causar problemas após modificação do conteúdo
            }
            res.setHeader(key, response.headers[key]);
        }

        const contentType = response.headers['content-type'] || '';

        // Manipula apenas respostas HTML
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf8');
            const $ = cheerio.load(html);

            // --- Lógica de Proxy de PostMessage (Mantido o código que resolveu o SyntaxError) ---
            const targetOrigin = TARGET_URL_BASE;
            $('head').prepend(
                '<script>' +
                '(() => {' +
                'const originalPostMessage = window.parent.postMessage;' +
                'const targetPagePath = \'/pt/witch-power/wpGoal\';' + // Definindo a página alvo aqui

                'window.parent.postMessage = function(message, targetOrigin, transfer) {' +
                'const modifiedTargetOrigin = targetOrigin === \'*\' ? window.location.origin : targetOrigin;' +
                'originalPostMessage.call(this, message, modifiedTargetOrigin, transfer);' +
                '};' +

                // --- Lógica de Botões Invisíveis (Mantido o código que resolveu o SyntaxError) ---
                'let buttonsInjected = false;' +
                'const invisibleButtonsConfig = [' +
                '{ ' +
                'id: \'btn-choice-1\',' +
                'top: \'206px\',' +
                'left: \'40px\',' +
                'width: \'330px\',' +
                'height: \'66px\',' +
                'text: \'Entender meu mapa astral\'' +
                '},' +
                '{ ' +
                'id: \'btn-choice-2\',' +
                'top: \'292px\',' +
                'left: \'40px\',' +
                'width: \'330px\',' +
                'height: \'66px\',' +
                'text: \'Identificar meu arquétipo de bruxa\'' +
                '},' +
                '{ ' +
                'id: \'btn-choice-3\',' +
                'top: \'377px\',' +
                'left: \'40px\',' +
                'width: \'330px\',' +
                'height: \'66px\',' +
                'text: \'Explorar minhas vidas passadas\'' +
                '},' +
                '{ ' +
                'id: \'btn-choice-4\',' +
                'top: \'460px\',' +
                'left: \'40px\',' +
                'width: \'330px\',' +
                'height: \'66px\',' +
                'text: \'Revelar minha aura de bruxa\'' +
                '},' +
                '{ ' +
                'id: \'btn-choice-5\',' +
                'top: \'543px\',' +
                'left: \'40px\',' +
                'width: \'330px\',' +
                'height: \'66px\',' +
                'text: \'Desvendar meu destino e propósito\'' +
                '},' +
                '{ ' +
                'id: \'btn-choice-6\',' +
                'top: \'629px\',' +
                'left: \'40px\',' +
                'width: \'330px\',' +
                'height: \'66px\',' +
                'text: \'Encontrar marcas, símbolos que me guiem\'' +
                '}' +
                '];' +

                'function manageInvisibleButtons() {' +
                'const currentPagePath = window.location.pathname;' +
                'const isTargetPage = currentPagePath === targetPagePath;' +
                'console.log(\'[Monitor] URL atual: \' + currentPagePath + \'. Página alvo: \' + targetPagePath + \'. É a página alvo? \' + isTargetPage);' +

                'if (isTargetPage && !buttonsInjected) {' +
                'console.log(\'Página wpGoal detectada! Injetando botões invisíveis...\');' +
                'invisibleButtonsConfig.forEach(config => {' +
                'const button = document.createElement(\'div\');' +
                'button.id = config.id;' +
                'button.style.position = \'absolute\';' +
                'button.style.top = config.top;' +
                'button.style.left = config.left;' +
                'button.style.width = config.width;' +
                'button.style.height = config.height;' +
                'button.style.zIndex = \'9999999\';' +
                'button.style.cursor = \'pointer\';' +
                'button.style.opacity = \'0\';' +
                'button.style.pointerEvents = \'auto\';' +
                'document.body.appendChild(button);' +
                'console.log(\'✅ Botão invisível \\\'\' + config.id + \'\\\' injetado na página wpGoal!\');' +

                'button.addEventListener(\'click\', (event) => {' +
                'console.log(\'🎉 Botão invisível \\\'\' + config.id + \'\\\' clicado na wpGoal!\');' +
                'button.style.pointerEvents = \'none\';' +
                'const rect = button.getBoundingClientRect();' +
                'const x = rect.left + rect.width / 2;' +
                'const y = rect.top + rect.height / 2;' +
                'const targetElement = document.elementFromPoint(x, y);' +

                'if (targetElement) {' +
                'console.log(\'Simulando clique no elemento original:\', targetElement);' +
                'const clickEvent = new MouseEvent(\'click\', {' +
                'view: window,' +
                'bubbles: true,' +
                'cancelable: true,' +
                'clientX: x,' +
                'clientY: y' +
                '});' +
                'targetElement.dispatchEvent(clickEvent);' +
                'console.log(\'Cliques simulados em:\', targetElement);' +

                // 2. Enviar dados para o front-end React (TrialChoice.tsx)
                'window.postMessage({' +
                'type: \'QUIZ_CHOICE_SELECTED\',' +
                'text: config.text' +
                '}, window.location.origin);' +
                'console.log(\'Dados enviados para o React: \\\'\' + config.text + \'\\\'\');' +
                '} else {' +
                'console.warn(\'Nenhum elemento encontrado para simular clique nas coordenadas. O botão original não foi detectado.\');' +
                '}' +
                'button.remove();' +
                'console.log(\'🗑️ Botão invisível \\\'\' + config.id + \'\\\' removido após simulação de clique.\');' +
                'buttonsInjected = false;' +
                '});' +
                '});' +
                'buttonsInjected = true;' +
                '} else if (!isTargetPage && buttonsInjected) {' +
                'console.log(\'Saindo da página wpGoal. Removendo botões invisíveis...\');' +
                'invisibleButtonsConfig.forEach(config => {' +
                'const buttonElement = document.getElementById(config.id);' +
                'if (buttonElement) {' +
                'buttonElement.remove();' +
                'console.log(\'🗑️ Botão invisível \\\'\' + config.id + \'\\\' removido.\');' +
                '}' +
                '});' +
                'buttonsInjected = false;' +
                '}' +
                '}' +

                // Lógica de Inicialização e Monitoramento
                'document.addEventListener(\'DOMContentLoaded\', function() {' +
                'console.log(\'Script de injeção de proxy carregado no cliente.\');' +
                'manageInvisibleButtons();' +
                'setInterval(manageInvisibleButtons, 500);' +
                '});' +
                '})();' +
                '</script>'
            );

            // --- REDIRECIONAMENTO CLIENT-SIDE MAIS AGRESSIVO PARA /pt/witch-power/email (Seu código antigo) ---
            $('head').append(
                '<script>' +
                'console.log(\'CLIENT-SIDE REDIRECT SCRIPT: Initializing.\');' +
                'let redirectCheckInterval;' +
                'function handleEmailRedirect() {' +
                'const currentPath = window.location.pathname;' +
                'if (currentPath.startsWith(\'/pt/witch-power/email\')) {' +
                'console.log(\'CLIENT-SIDE REDIRECT: URL /pt/witch-power/email detectada. Forçando redirecionamento para /pt/witch-power/onboarding\');' +
                'if (redirectCheckInterval) {' +
                'clearInterval(redirectCheckInterval);' +
                '}' +
                'window.location.replace(\'/pt/witch-power/onboarding\');' +
                '}' +
                '}' +
                'document.addEventListener(\'DOMContentLoaded\', handleEmailRedirect);' +
                'window.addEventListener(\'popstate\', handleEmailRedirect);' +
                'redirectCheckInterval = setInterval(handleEmailRedirect, 100);' +
                'window.addEventListener(\'beforeunload\', () => {' +
                'if (redirectCheckInterval) {' +
                'clearInterval(redirectCheckInterval);' +
                '}' +
                '});' +
                'handleEmailRedirect();' +
                '</script>'
            );

            // --- REDIRECIONAMENTO CLIENT-SIDE PARA /pt/witch-power/trialChoice (Seu código antigo) ---
            $('head').append(
                '<script>' +
                'console.log(\'CLIENT-SIDE TRIALCHOICE REDIRECT SCRIPT: Initializing.\');' +
                'let trialChoiceRedirectInterval;' +
                'function handleTrialChoiceRedirect() {' +
                'const currentPath = window.location.pathname;' +
                'if (currentPath === \'/pt/witch-power/trialChoice\') {' +
                'console.log(\'CLIENT-SIDE REDIRECT: URL /pt/witch-power/trialChoice detectada. Forçando reload para interceptação do servidor.\');' +
                'if (trialChoiceRedirectInterval) {' +
                'clearInterval(trialChoiceRedirectInterval);' +
                '}' +
                'window.location.reload();' +
                '}' +
                '}' +
                'document.addEventListener(\'DOMContentLoaded\', handleTrialChoiceRedirect);' +
                'window.addEventListener(\'popstate\', handleTrialChoiceRedirect);' +
                'trialChoiceRedirectInterval = setInterval(handleTrialChoiceRedirect, 200);' +
                'if (window.MutationObserver && document.body) {' +
                'const observer = new MutationObserver(function(mutations) {' +
                'mutations.forEach(function(mutation) {' +
                'if (mutation.type === \'childList\' && mutation.addedNodes.length > 0) {' +
                'setTimeout(handleTrialChoiceRedirect, 50);' +
                '}' +
                '});' +
                '});' +
                'observer.observe(document.body, {' +
                'childList: true,' +
                'subtree: true' +
                '});' +
                '}' +
                'window.addEventListener(\'beforeunload\', () => {' +
                'if (trialChoiceRedirectInterval) {' +
                'clearInterval(trialChoiceRedirectInterval);' +
                '}' +
                '});' +
                'handleTrialChoiceRedirect();' +
                '</script>'
            );

            // --- MODIFICAÇÕES ESPECÍFICAS PARA /pt/witch-power/trialPaymentancestral (Seu código antigo) ---
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
            // Se não é HTML, apenas repassa o dado bruto (imagens, CSS, JS, etc.)
            res.status(response.status).send(response.data);
        }

    } catch (error) {
        console.error('Erro no proxy principal:', error.message);
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
