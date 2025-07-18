import React, { useState, useEffect } from 'react';

interface TrialChoiceProps {
  // A prop capturedText ainda pode ser usada como um valor inicial/fallback
  capturedText?: string; 
}

// Interface para o tipo de mensagem que esperamos receber via postMessage
interface QuizChoiceMessage {
  type: 'QUIZ_CHOICE_SELECTED';
  text: string;
}

const TrialChoice: React.FC<TrialChoiceProps> = ({ capturedText = "explorar origens de vidas passadas" }) => {
  const [selectedPrice, setSelectedPrice] = useState<string>('');
  // O displayText será inicializado com capturedText, mas poderá ser atualizado via postMessage
  const [displayText, setDisplayText] = useState<string>(capturedText);

  // Atualiza o texto exibido quando capturedText (prop) muda
  useEffect(() => {
    if (capturedText && capturedText.trim()) {
      console.log('🔄 TrialChoice: Atualizando texto exibido (via prop):', `"${capturedText}"`);
      setDisplayText(capturedText);
    } else {
      console.log('⚠️ TrialChoice: Texto vazio na prop, mantendo padrão');
      setDisplayText("explorar origens de vidas passadas");
    }
  }, [capturedText]);

  // NOVO useEffect para escutar mensagens do window.postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // É CRUCIAL verificar a origem da mensagem para segurança!
      // O event.origin deve ser o URL do seu proxy (Render URL)
      // Em produção, seria 'https://appnebula-wp-3kdx.onrender.com'
      // Em desenvolvimento local, pode ser 'http://localhost:XXXX'
      if (event.origin !== window.location.origin) {
        console.warn('❌ TrialChoice: Mensagem recebida de origem desconhecida:', event.origin);
        return;
      }

      const data = event.data as QuizChoiceMessage;

      if (data.type === 'QUIZ_CHOICE_SELECTED' && data.text) {
        console.log('✅ TrialChoice: Mensagem de escolha do quiz recebida (via postMessage):', `"${data.text}"`);
        setDisplayText(data.text); // Atualiza o estado com o texto do botão invisível
        // Você pode adicionar aqui qualquer outra lógica necessária,
        // como salvar em um estado global, enviar para uma API, etc.
      }
    };

    // Adiciona o event listener
    window.addEventListener('message', handleMessage);

    // Função de limpeza: remove o event listener quando o componente é desmontado
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []); // O array de dependências vazio significa que este efeito roda uma vez no mount e uma vez no unmount

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

  const prices = [
    { value: '$1', link: '/pt/witch-power/trial-1' },
    { value: '$5', link: '/pt/witch-power/trial-5' },
    { value: '$9', link: '/pt/witch-power/trial-9' },
    { value: '$13.67', link: '/pt/witch-power/trial-13' }
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
              {/* Debug info - remover em produção */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-400 mt-2">
                  Debug: "{displayText}" (prop: "{capturedText}")
                </div>
              )}
            </div>

            <div className="economy-section">
              <h2 className="section-title">SUA ECONOMIA, NOSSA PRIORIDADE</h2>
              <p className="description">
                Ajudamos milhões de pessoas a <b>{displayText}</b>, e queremos ajudar você também.
              </p>
              {/* Debug info - remover em produção */}
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
