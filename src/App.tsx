// src/App.tsx

import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice'; // Seu componente TrialChoice
import './TrialChoice.css'; // Seus estilos CSS
// Importe outros componentes que seu App.tsx pode renderizar para outras rotas, se houver.

function App() {
  const [chosenQuizOption, setChosenQuizOption] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    // Função para ler a escolha do quiz do localStorage
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

    // Chamada inicial
    getQuizChoiceFromLocalStorage();

    // Listener para mudanças de URL (se o navegador mudar a rota sem recarregar a página)
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      getQuizChoiceFromLocalStorage(); // Recarrega a escolha caso a rota mude e a escolha seja relevante
    };
    window.addEventListener('popstate', handlePopState);

    // Listener para o evento 'storage' (se a escolha for alterada em outra aba/janela)
    window.addEventListener('storage', getQuizChoiceFromLocalStorage);

    // Limpeza
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('storage', getQuizChoiceFromLocalStorage);
    };
  }, []); // Roda uma vez ao montar

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
  if (currentPath === '/meu-app/trial-choice') {
    return (
      <div className="min-h-screen bg-gray-100">
        <TrialChoice capturedText={chosenQuizOption} />
      </div>
    );
  }

  // Se a rota não for '/meu-app/trial-choice', você pode renderizar
  // outras partes do seu aplicativo ou uma página de erro/padrão.
  // Por exemplo, se seu App.tsx também lida com /onboarding, etc.
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-600">Conteúdo da rota {currentPath} (não TrialChoice).</p>
      {/* Você pode adicionar outros componentes aqui para outras rotas */}
    </div>
  );
}

export default App;
