import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  const [capturedText, setCapturedText] = useState<string>('identificar seu arquétipo de bruxa');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Busca o texto capturado do servidor
    const fetchCapturedText = async () => {
      try {
        console.log('Buscando texto capturado do servidor...');
        const response = await fetch('/api/captured-text');
        const data = await response.json();
        
        if (data.capturedText) {
          console.log('Texto recebido do servidor:', data.capturedText);
          setCapturedText(data.capturedText);
        }
      } catch (error) {
        console.error('Erro ao buscar texto capturado:', error);
        // Mantém o fallback padrão
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
          <p className="text-gray-600">Carregando...</p>
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