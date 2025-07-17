import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  const [capturedText, setCapturedText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchCapturedText = async () => {
      try {
        console.log('🚀 React: Iniciando busca por texto capturado...');
        
        // Buscar imediatamente
        const response = await fetch('/api/captured-text');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📨 React: Resposta do servidor:', data);
        
        if (data.capturedText && data.capturedText.trim()) {
          // Se o servidor ainda está capturando ou monitorando, aguardar um pouco
          if (data.isCapturing || data.monitoringActive) {
            console.log('⏳ React: Servidor ainda está processando, aguardando...');
            setTimeout(() => fetchCapturedText(), 1000); // Verifica a cada 1 segundo
            return;
          }
          
          console.log('✅ React: Texto capturado recebido:', `"${data.capturedText}"`);
          setCapturedText(data.capturedText);
          setError('');
        } else {
          // Se não há texto e o monitoramento está ativo, continuar tentando
          if (data.monitoringActive) {
            console.log('🔄 React: Monitoramento ativo, aguardando captura...');
            setTimeout(() => fetchCapturedText(), 1000);
            return;
          }
          
          console.log('⚠️ React: Nenhum texto capturado encontrado');
          setCapturedText('explorar origens de vidas passadas');
          setError('Usando conteúdo padrão');
        }
      } catch (error) {
        console.error('❌ React: Erro ao buscar texto capturado:', error);
        setCapturedText('explorar origens de vidas passadas');
        setError('Erro ao carregar conteúdo personalizado');
      } finally {
        setLoading(false);
      }
    };

    fetchCapturedText();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Capturando informações personalizadas...</p>
          <p className="text-sm text-gray-500 mt-2">Monitoramento em tempo real ativo...</p>
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
