// src/App.tsx

import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  const [chosenQuizOption, setChosenQuizOption] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const getQuizChoiceFromLocalStorage = () => {
      console.log('🚀 React: Tentando ler a escolha do quiz do localStorage...');
      const savedChoice = localStorage.getItem('nebulaQuizChoice');

      if (savedChoice && savedChoice.trim()) {
        console.log('✅ React: Escolha do quiz encontrada no localStorage:', `"${savedChoice}"`);
        setChosenQuizOption(savedChoice);
      } else {
        console.warn('⚠️ React: Nenhuma escolha do quiz encontrada no localStorage ou vazia. Usando fallback.');
        setChosenQuizOption('explorar origens de vidas passadas'); // Fallback consistente
      }
      setLoading(false);
    };

    getQuizChoiceFromLocalStorage();

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      getQuizChoiceFromLocalStorage();
    };
    window.addEventListener('popstate', handlePopState);

    window.addEventListener('storage', getQuizChoiceFromLocalStorage);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('storage', getQuizChoiceFromLocalStorage);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparando sua experiência personalizada...</p>
          <p className="text-sm text-gray-500 mt-2">Carregando...</p>
        </div>
      </div>
    );
  }

  // Lógica de roteamento simples para renderizar o componente correto
  // Se a rota for a nossa rota customizada para TrialChoice, renderiza TrialChoice.
  // Caso contrário, mostra uma mensagem genérica.
  // IMPORTANTE: Seu React App deve ter apenas a página de TrialChoice para simplificar.
  // Se houver outras páginas, você precisará de um roteador mais completo como react-router-dom.
  if (currentPath === '/meu-app/trial-choice') {
    return (
      <div className="min-h-screen bg-gray-100">
        <TrialChoice capturedText={chosenQuizOption} />
      </div>
    );
  }

  // Fallback para outras rotas (ex: se alguém tentar acessar a raiz do seu app)
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-600">Conteúdo da rota {currentPath} (não TrialChoice). Verifique a URL.</p>
    </div>
  );
}

export default App;
