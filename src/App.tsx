import React, { useState, useEffect } from 'react';
import TrialChoice from './TrialChoice';
import TrialPaymentAncestral from './TrialPaymentAncestral';
import Date from './Date';
import './TrialChoice.css';

interface PriceOption {
  value: string;
  link: string;
}

function App() {
  const [capturedText, setCapturedText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<'trial' | 'payment' | 'date'>('trial');
  const [selectedPrice, setSelectedPrice] = useState<PriceOption | null>(null);
  const [selectedBirthDate, setSelectedBirthDate] = useState('1990-01-01');

  useEffect(() => {
    const savedDate = localStorage.getItem('selectedBirthDate');
    if (savedDate) {
      const [day, month, year] = savedDate.split('/');
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      setSelectedBirthDate(formattedDate);
      console.log('📅 App.tsx: Data carregada do localStorage:', savedDate, '-> formatada:', formattedDate);
    }
  }, []);

  useEffect(() => {
    const currentPath = window.location.pathname;
    console.log('🔍 App.tsx: Detectando rota atual:', currentPath);
    
    if (currentPath === '/pt/witch-power/date') {
      console.log('✅ App.tsx: Rota /date detectada, carregando componente Date');
      setCurrentPage('date');
      setLoading(false);
      return;
    }
    
    if (currentPath === '/pt/witch-power/trialChoice') {
      console.log('✅ App.tsx: Rota /trialChoice detectada');
      setCurrentPage('trial');
    }
  }, []);

  useEffect(() => {
    if (currentPage === 'date') {
      console.log('⏭️ App.tsx: Página de data ativa, não buscando texto capturado');
      return;
    }
    
    const fetchCapturedText = async () => {
      try {
        console.log('🚀 React: Iniciando busca por texto capturado...');

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
        } else {
          console.log('⚠️ React: Nenhum texto capturado encontrado');
          setCapturedText('identificar seu arquétipo de bruxa');
          setError('Usando conteúdo padrão');
        }
      } catch (error) {
        console.error('❌ React: Erro ao buscar texto capturado:', error);
        setCapturedText('identificar seu arquétipo de bruxa');
        setError('Erro ao carregar conteúdo personalizado');
      } finally {
        setLoading(false);
      }
    };

    fetchCapturedText();
  }, [currentPage]);

  const handlePriceSelection = (priceOption: PriceOption) => {
    setSelectedPrice(priceOption);
    setCurrentPage('payment');
  };

  const handleBackToTrial = () => {
    setCurrentPage('trial');
  };

  if (currentPage === 'date') {
    console.log('📱 App.tsx: Renderizando componente Date');
    return <Date />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Capturando informações personalizadas...</p>
          <p className="text-sm text-gray-500 mt-2">Fazendo requisição direta para o servidor...</p>
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
      
      {currentPage === 'trial' ? (
        <TrialChoice 
          capturedText={capturedText} 
          onPriceSelect={handlePriceSelection}
        />
      ) : (
        <TrialPaymentAncestral 
          selectedPrice={selectedPrice}
          selectedBirthDate={selectedBirthDate}
          onBack={handleBackToTrial}
        />
      )}
    </div>
  );
}

export default App;
