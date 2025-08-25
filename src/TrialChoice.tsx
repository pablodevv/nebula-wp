import React, { useState, useEffect } from 'react';
import './TrialChoice.css';

interface TrialChoiceProps {
  capturedText?: string;
  onPriceSelect: (priceOption: { value: string; link: string }) => void;
}

interface QuizChoiceMessage {
  type: 'QUIZ_CHOICE_SELECTED';
  text: string;
}

const TrialChoice: React.FC<TrialChoiceProps> = ({ capturedText, onPriceSelect }) => {
  const [selectedPrice, setSelectedPrice] = useState<string>('');
  const [displayText, setDisplayText] = useState<string>(capturedText && capturedText.trim() ? capturedText : "explorar origens de vidas passadas");

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        console.warn('❌ TrialChoice: Mensagem recebida de origem desconhecida:', event.origin);
        return;
      }

      const data = event.data as QuizChoiceMessage;

      if (data.type === 'QUIZ_CHOICE_SELECTED' && data.text) {
        console.log('✅ TrialChoice: Mensagem de escolha do quiz recebida (via postMessage):', `"${data.text}"`);
        setDisplayText(data.text);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []); 


  useEffect(() => {
    if (capturedText && capturedText.trim()) {
      console.log('🔄 TrialChoice: Atualizando texto exibido (via prop):', `"${capturedText}"`);
      setDisplayText(capturedText);
    } else if (!displayText) { 
      console.log('⚠️ TrialChoice: Texto vazio na prop, mantendo padrão');
      setDisplayText("explorar origens de vidas passadas");
    }
  }, [capturedText, displayText]); 

  const handlePriceSelect = (price: string) => {
    setSelectedPrice(price);
  };

  const handleViewReading = () => {
    if (selectedPrice) {
      const selectedPriceData = prices.find(p => p.value === selectedPrice);
      if (selectedPriceData) {
        onPriceSelect(selectedPriceData);
      }
    }
  };

  const prices = [
    { value: 'R$ 39,90', link: 'https://app.pushinpay.com.br/service/pay/9f6fa6a5-bd70-481e-b73d-67674871106c' },
    { value: 'R$ 53,99', link: 'https://app.pushinpay.com.br/service/pay/9f6fa5f6-a665-4b6e-b427-aefa08395f15' },
    { value: 'R$ 69,91', link: 'https://app.pushinpay.com.br/service/pay/9f6fa3bb-1b37-4edf-9939-3e0121abd723' }
  ];

  return (
    <div className="trial-choice-container">
      <div className="content-wrapper">
        <div className="main-content">
          <div className="header">
            <div className="logo-container">
              <img src="https://appnebula.co/logo.png" alt="N" className="logo" />
            </div>
            <button className="menu-button">
              <div className="menu-icon">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
          </div>

          <div className="content">
            <h1 className="title">Escolha um Preço de Teste</h1>

            <div className="satisfaction-section">
              <h2 className="section-title">SUA SATISFAÇÃO É IMPORTANTE PARA NÓS</h2>
              <p className="description">
                Ajudamos milhões de pessoas a <b>{displayText}</b>, e queremos ajudar você também.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-400 mt-2">
                  Debug: "{displayText}" (prop: "{capturedText}")
                </div>
              )}
            </div>

            <div className="economy-section">
              <h2 className="section-title">SUA ECONOMIA, NOSSA PRIORIDADE</h2>
              <p className="description">
                Apesar do nosso custo real ser de R$ 69,91*, por favor selecione um valor que você considere justo.
               </p>
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-400 mt-2">
                  Debug: "{displayText}" (prop: "{capturedText}")
                </div>
              )}
            </div>

            <div className="price-selection">
              <div className="price-buttons">
                {prices.map((price) => (
                  <button
                    key={price.value}
                    className={`price-button ${selectedPrice === price.value ? 'selected' : ''}`}
                    onClick={() => handlePriceSelect(price.value)}
                  >
                    {price.value}
                  </button>
                ))}
              </div>

              <div className="help-text-container">
                <div className="help-text">
                  Esta opção nos ajudará a financiar aqueles que precisam escolher os menores preços de teste!
                </div>
                <div className="curved-arrow">
  <svg width="120" height="80" viewBox="0 0 120 80" className="arrow-svg">

                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                              refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                      </marker>
                    </defs>
                    <path d="M 60 70 Q 80 40 60 10" stroke="#666" strokeWidth="2" 
                          fill="none" markerEnd="url(#arrowhead)" />
                  </svg>
                </div>
              </div>
            </div>

            <button
              className={`view-reading-button ${selectedPrice ? 'active' : 'inactive'}`}
              onClick={handleViewReading}
              disabled={!selectedPrice}
            >
              Ver minha leitura
            </button>

            <p className="disclaimer">*Custo do teste em julho de 2025</p>
            <br />
              <p className="description">c🔱</p>
            

            
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialChoice;
