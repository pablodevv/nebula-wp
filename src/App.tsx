import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  const [capturedText, setCapturedText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Busca o texto capturado do servidor
    const fetchCapturedText = async () => {
      try {
        console.log('🔄 React: Buscando texto capturado do servidor...');
        const response = await fetch('/api/captured-text');
        const data = await response.json();
        
        console.log('📨 React: Resposta recebida:', data);
        
        if (data.capturedText && data.capturedText.trim()) {
          console.log('✅ React: Texto recebido do servidor:', `"${data.capturedText}"`);
          setCapturedText(data.capturedText);
        } else {
          console.log('⚠️ React: Nenhum texto capturado, usando fallback');
          setCapturedText('descobrir seus poderes ocultos');
        }
      } catch (error) {
        console.error('❌ React: Erro ao buscar texto capturado:', error);
        setCapturedText('descobrir seus poderes ocultos');
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TrialChoice capturedText={capturedText} />
    </div>
  );
}

export default App;