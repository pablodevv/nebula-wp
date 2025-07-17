// src/App.tsx

import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  // Estado para armazenar o texto capturado do quiz
  const [chosenQuizOption, setChosenQuizOption] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true); // Para exibir um loading enquanto busca no localStorage

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
        // Define um fallback padrão caso a escolha não seja encontrada
        setChosenQuizOption('explorar origens de vidas passadas');
      }
      setLoading(false); // Termina o estado de carregamento
    };

    // Chamada inicial da função
    getQuizChoiceFromLocalStorage();

    // Adiciona um listener para o evento 'storage' caso a escolha seja alterada em outra aba/janela
    // Embora para este caso não seja estritamente necessário, é uma boa prática para dados de localStorage
    window.addEventListener('storage', getQuizChoiceFromLocalStorage);

    // Limpeza: remove o listener ao desmontar o componente
    return () => {
      window.removeEventListener('storage', getQuizChoiceFromLocalStorage);
    };
  }, []); // O array vazio assegura que o efeito rode apenas uma vez ao montar o componente

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparando sua experiência personalizada...</p>
          <p className="text-sm text-gray-500 mt-2">Isso pode demorar um pouco na primeira vez...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Não precisamos mais de um estado de `error` específico aqui para a API,
          pois o fallback já lida com a ausência do texto. */}
      {/* O componente TrialChoice receberá o texto capturado como prop */}
      <TrialChoice capturedText={chosenQuizOption} />
    </div>
  );
}

export default App;
