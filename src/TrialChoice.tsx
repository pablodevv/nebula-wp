import React, { useState } from 'react';

interface TrialChoiceProps {
  capturedText?: string;
}

const TrialChoice: React.FC<TrialChoiceProps> = ({ capturedText = "encontrar marcas e símbolos que as guiam" }) => {
  const [selectedPrice, setSelectedPrice] = useState<string>('');

  const prices = [
    { value: '$1', link: '/pt/witch-power/trial-1' },
    { value: '$5', link: '/pt/witch-power/trial-5' },
    { value: '$9', link: '/pt/witch-power/trial-9' },
    { value: '$13.67', link: '/pt/witch-power/trial-13' }
  ];

  const handlePriceSelect = (price: string) => {
    setSelectedPrice(price);
  };

  const handleViewReading = () => {
    if (selectedPrice) {
      const selectedPriceData = prices.find(p => p.value === selectedPrice);
      if (selectedPriceData) {
        window.location.href = selectedPriceData.link;
      }
    }
  };

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
                Ajudamos milhões de pessoas a <b>{capturedText}</b>, e queremos ajudar você também.
              </p>
            </div>

            <div className="economy-section">
              <h2 className="section-title">SUA ECONOMIA, NOSSA PRIORIDADE</h2>
              <p className="description">
                Apesar do nosso custo real ser de $13.67*, por favor selecione um valor que você considere justo.
              </p>
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
              
              <div className="help-text">
                <p>Esta opção nos ajudará a financiar aqueles que precisam escolher os menores preços de teste!</p>
                <div className="arrow-pointer">→</div>
              </div>
            </div>

            <button 
              className={`view-reading-button ${selectedPrice ? 'active' : 'inactive'}`}
              onClick={handleViewReading}
              disabled={!selectedPrice}
            >
              Ver minha leitura
            </button>

            <p className="disclaimer">*Custo do teste em fevereiro de 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialChoice;