import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  const [capturedText, setCapturedText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Busca o texto capturado do servidor com retry
    const fetchCapturedText = async (retries = 3) => {
      try {
        console.log('🔄 React: Buscando texto capturado do servidor...');
        
        // Adiciona um delay pequeno para garantir que o servidor processou a captura
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await fetch('/api/captured-text');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('📨 React: Resposta recebida:', data);
        
        if (data.capturedText && data.capturedText.trim()) {
          console.log('✅ React: Texto recebido do servidor:', `"${data.capturedText}"`);
          setCapturedText(data.capturedText);
          setError('');
        } else {
          console.log('⚠️ React: Nenhum texto capturado, tentando novamente...');
          
          // Se não há texto capturado e ainda temos tentativas, tenta novamente
          if (retries > 0) {
            console.log(`🔄 React: Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchCapturedText(retries - 1);
          } else {
            console.log('⚠️ React: Esgotadas as tentativas, usando fallback');
            setCapturedText('descobrir seus poderes ocultos');
          }
        }
      } catch (error) {
        console.error('❌ React: Erro ao buscar texto capturado:', error);
        
        // Se ainda temos tentativas, tenta novamente
        if (retries > 0) {
          console.log(`🔄 React: Erro, tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchCapturedText(retries - 1);
        } else {
          console.log('❌ React: Esgotadas as tentativas, usando fallback');
          setCapturedText('descobrir seus poderes ocultos');
          setError('Erro ao carregar texto personalizado');
        }
      } finally {
        console.log('🏁 React: Finalizando loading...');
        setLoading(false);
      }
    };

    console.log('🚀 React: useEffect executado, iniciando busca...');
    fetchCapturedText();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Capturando informações...</p>
          <p className="text-sm text-gray-500 mt-2">Aguarde enquanto personalizamos sua experiência</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4 mx-4">
          <div className="flex">
            <div className="text-yellow-700 text-sm">
              {error} - Usando conteúdo padrão
            </div>
          </div>
        </div>
      )}
      <TrialChoice capturedText={capturedText} />
    </div>
  );
}

export default App;
