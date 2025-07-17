// src/App.tsx

import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  const [capturedText, setCapturedText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState(0); // Para tentar algumas vezes

  useEffect(() => {
    const fetchCapturedText = async () => {
      setAttemptCount(prev => prev + 1);
      try {
        console.log(`🚀 React: Iniciando busca por texto capturado (Tentativa ${attemptCount + 1})...`);
        
        const response = await fetch('/api/captured-text');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📨 React: Resposta do servidor:', data);
        
        if (data.capturedText && data.capturedText.trim()) {
          console.log('✅ React: Texto capturado recebido:', `"${data.capturedText}"`);
          setCapturedText(data.capturedText);
          setError('');
          setLoading(false); // Carregamento completo com sucesso
        } else if (data.isCapturing && attemptCount < 5) { // Tenta mais algumas vezes se estiver capturando
          console.log('⏳ React: Servidor está capturando, tentando novamente em breve...');
          setTimeout(fetchCapturedText, 1000); // Tenta novamente após 1 segundo
        }
        else {
          console.log('⚠️ React: Nenhum texto capturado encontrado ou captura falhou após tentativas.');
          setCapturedText('explorar origens de vidas passadas'); // Seu fallback preferencial
          setError('Conteúdo personalizado não disponível no momento. Usando padrão.');
          setLoading(false); // Carregamento completo com fallback
        }
      } catch (error) {
        console.error('❌ React: Erro ao buscar texto capturado:', error);
        setCapturedText('explorar origens de vidas passadas'); // Seu fallback preferencial
        setError('Erro ao carregar conteúdo personalizado. Usando padrão.');
        setLoading(false); // Carregamento completo com erro e fallback
      }
    };

    fetchCapturedText();
  }, []); // [] para rodar apenas uma vez no mount

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Capturando informações personalizadas...</p>
          <p className="text-sm text-gray-500 mt-2">Isso pode demorar um pouco na primeira vez...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4 mx-4">
          <div className="flex">
            <div className="text-yellow-700 text-xs">
              {error}
            </div>
          </div>
        </div>
      )}
      <TrialChoice capturedText={capturedText} />
    </div>
  );
}

export default App;
