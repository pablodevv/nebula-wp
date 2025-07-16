# Guia de Integração - Proxy Reverso + React

## 1. Estrutura de Arquivos no seu GitHub

Você precisa ter essa estrutura no seu repositório:

```
seu-repositorio/
├── server.js (atualizar com o novo código)
├── package.json (atualizar dependências)
├── src/
│   ├── App.tsx
│   ├── TrialChoice.tsx
│   ├── TrialChoice.css
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
└── eslint.config.js
```

## 2. Passos para Integrar

### Passo 1: Atualizar package.json
Adicione essas dependências e scripts:

```json
{
  "name": "proxy-trial-choice",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node server.js"
  },
  "dependencies": {
    "axios": "^1.10.0",
    "cheerio": "^1.1.0",
    "express": "^5.1.0",
    "express-fileupload": "^1.5.2",
    "form-data": "^4.0.3",
    "lucide-react": "^0.344.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^5.4.2"
  }
}
```

### Passo 2: Atualizar server.js
Substitua seu server.js atual pelo código que criei (já está pronto com a interceptação).

### Passo 3: Criar arquivos React
Crie os arquivos .tsx e .css que mostrei.

### Passo 4: Configurar Vite e TypeScript
Crie os arquivos de configuração (vite.config.ts, tsconfig.json, etc).

## 3. Deploy no Render

### No Render, configure:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Node Version**: 18 ou superior

### O que acontece:
1. Render instala dependências
2. Vite builda o React para pasta `dist/`
3. Server.js serve os arquivos estáticos do `dist/`
4. Proxy intercepta `/pt/witch-power/trialChoice`
5. Serve sua página customizada

## 4. Fluxo Completo

```
Usuário acessa: /pt/witch-power/trialChoice
       ↓
Proxy intercepta e faz request para site original
       ↓
Captura texto do <b></b>
       ↓
Redireciona para página React customizada
       ↓
Página mostra texto capturado no lugar certo
```

## 5. Comandos Git

```bash
# No seu repositório local
git add .
git commit -m "Adicionar página trial choice customizada"
git push origin main
```

Render vai automaticamente fazer redeploy quando você fizer push.