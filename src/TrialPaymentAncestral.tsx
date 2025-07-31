import React, { useState, useEffect } from 'react';
import { Star, Book, MessageCircle, Shield, Lock } from 'lucide-react';

interface TrialPaymentAncestralProps {
  selectedPrice?: { value: string; link: string } | null;
  selectedBirthDate?: string;
  onBack?: () => void;
}

// Declaração de tipos para o Facebook Pixel
declare global {
  interface Window {
    fbq: any;
    utmify: any;
  }
}

interface WitchProfile {
  type: string;
  profile: string;
  strengths: string;
  image: string;
}

const TrialPaymentAncestral: React.FC<TrialPaymentAncestralProps> = ({ 
  selectedPrice, 
  selectedBirthDate = '01-01-1990',
  onBack 
}) => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 9, seconds: 40 });

  // SCROLL TO TOP - Força o scroll para o topo quando o componente é montado
  useEffect(() => {
    // Múltiplas estratégias para garantir que funcione em diferentes browsers/contextos
    const scrollToTop = () => {
      // Estratégia 1: window.scrollTo
      window.scrollTo(0, 0);
      
      // Estratégia 2: document.documentElement
      document.documentElement.scrollTop = 0;
      
      // Estratégia 3: document.body (fallback para browsers mais antigos)
      document.body.scrollTop = 0;
      
      // Estratégia 4: Usando scrollIntoView no elemento root
      const rootElement = document.getElementById('root') || document.body;
      if (rootElement) {
        rootElement.scrollIntoView({ 
          behavior: 'instant', 
          block: 'start' 
        });
      }
    };

    // Executa imediatamente
    scrollToTop();

    // Executa após um pequeno delay para garantir que o DOM foi totalmente renderizado
    // Especialmente útil quando vem de links externos (Facebook, etc.)
    const timeoutId = setTimeout(scrollToTop, 100);

    // Cleanup do timeout
    return () => clearTimeout(timeoutId);
  }, []); // Array vazio para executar apenas na montagem do componente

  // Função para obter informações da bruxa baseado no mês
  const getWitchProfile = (dateStr: string): WitchProfile => {
    let month: number;
    
    // Determinar o mês da data
    if (dateStr.includes('/')) {
      // Formato DD/MM/YYYY
      const parts = dateStr.split('/');
      month = parseInt(parts[1], 10);
    } else {
      // Formato YYYY-MM-DD
      const parts = dateStr.split('-');
      month = parseInt(parts[1], 10);
    }

    switch (month) {
      case 1: // Janeiro
        return {
          type: "Bruxa ancestral",
          profile: "Especializada em conectar-se e honrar seus ancestrais; habilidosa em tecer conhecimento e sabedoria ancestral em sua prática mágica.",
          strengths: "Empática, introspectiva e profundamente ligada às suas raízes; valoriza tradição, herança e as lições passadas através das gerações.",
          image: "/images/ancestral.png"
        };
      
      case 2: // Fevereiro
        return {
          type: "Bruxa do lar",
          profile: "Especialista em magia doméstica, proteção do lar e lareira, e no uso de objetos do dia a dia para fins mágicos; imprime magia nos aspectos comuns da vida.",
          strengths: "Acolhedora, hospitaleira e prática; encontra alegria nos momentos cotidianos e abraça a magia nas coisas simples da vida.",
          image: "/images/lar.png"
        };
      
      case 3: // Março
        return {
          type: "Bruxa dos cristais",
          profile: "Hábil no trabalho com cristais, pedras preciosas e minerais para adivinhação e trabalho energético; conhece as propriedades únicas de várias pedras e suas aplicações mágicas.",
          strengths: "Sensível, introspectiva e autoconsciente; valoriza o crescimento interior, o desenvolvimento pessoal e o aproveitamento das energias da Terra.",
          image: "/images/crystal.png"
        };
      
      case 4: // Abril
        return {
          type: "Bruxa cósmica",
          profile: "Conhecedora de astrologia, alinhamentos planetários e energias celestiais; usa padrões cósmicos para guiar e fortalecer sua prática mágica.",
          strengths: "Perspicaz, visionária e conectada ao cosmos; valoriza a interconexão de todas as coisas e vê o quadro geral.",
          image: "/images/cosmic.png"
        };
      
      case 5: // Maio
        return {
          type: "Bruxa verde",
          profile: "Hábil em trabalhar com a natureza, ervas e plantas; excelente em cura, magia da fertilidade e conexão com os ciclos da Terra.",
          strengths: "Conectada, cuidadosa, paciente e ligada à natureza; frequentemente empática e sintonizada com as emoções dos outros.",
          image: "/images/verde.png"
        };
      
      case 6: // Junho
        return {
          type: "Bruxa eclética",
          profile: "Versátil em várias práticas e tradições mágicas; habilidosa em combinar elementos diferentes para criar um caminho mágico único e personalizado.",
          strengths: "Mente aberta, curiosa e versátil; gosta de explorar diversas tradições e práticas para criar um caminho mágico único.",
          image: "/images/eclectic.png"
        };
      
      case 7: // Julho
        return {
          type: "Bruxa cósmica",
          profile: "Conhecedora de astrologia, alinhamentos planetários e energias celestiais; usa padrões cósmicos para guiar e fortalecer sua prática mágica.",
          strengths: "Perspicaz, visionária e conectada ao cosmos; valoriza a interconexão de todas as coisas e vê o quadro geral.",
          image: "/images/cosmic.png"
        };
      
      case 8: // Agosto
        return {
          type: "Bruxa do lar",
          profile: "Especialista em magia doméstica, proteção do lar e lareira, e no uso de objetos do dia a dia para fins mágicos; imprime magia nos aspectos comuns da vida.",
          strengths: "Acolhedora, hospitaleira e prática; encontra alegria nos momentos cotidianos e abraça a magia nas coisas simples da vida.",
          image: "/images/lar.png"
        };
      
      case 9: // Setembro
        return {
          type: "Bruxa solitária",
          profile: "Independente e autodidata; confia na intuição e orientação interior para desenvolver uma prática mágica pessoal, sem estar preso a tradições específicas ou influências de grupos.",
          strengths: "Independente, autossuficiente e introspectiva; confia na intuição e orientação interior para desenvolver sua prática mágica.",
          image: "/images/solitary.png"
        };
      
      case 10: // Outubro
        return {
          type: "Bruxa verde",
          profile: "Hábil em trabalhar com a natureza, ervas e plantas; excelente em cura, magia da fertilidade e conexão com os ciclos da Terra.",
          strengths: "Conectada, cuidadosa, paciente e ligada à natureza; frequentemente empática e sintonizada com as emoções dos outros.",
          image: "/images/verde.png"
        };
      
      case 11: // Novembro
        return {
          type: "Bruxa solitária",
          profile: "Independente e autodidata; confia na intuição e orientação interior para desenvolver uma prática mágica pessoal, sem estar preso a tradições específicas ou influências de grupos.",
          strengths: "Independente, autossuficiente e introspectiva; confia na intuição e orientação interior para desenvolver sua prática mágica.",
          image: "/images/solitary.png"
        };
      
      case 12: // Dezembro
        return {
          type: "Bruxa eclética",
          profile: "Versátil em várias práticas e tradições mágicas; habilidosa em combinar elementos diferentes para criar um caminho mágico único e personalizado.",
          strengths: "Mente aberta, curiosa e versátil; gosta de explorar diversas tradições e práticas para criar um caminho mágico único.",
          image: "/images/eclectic.png"
        };
      
      default:
        // Fallback para bruxa ancestral
        return {
          type: "Bruxa ancestral",
          profile: "Especializada em conectar-se e honrar seus ancestrais; habilidosa em tecer conhecimento e sabedoria ancestral em sua prática mágica.",
          strengths: "Empática, introspectiva e profundamente ligada às suas raízes; valoriza tradição, herança e as lições passadas através das gerações.",
          image: "/images/ancestral.png"
        };
    }
  };

  // Função para converter data para formato brasileiro
  const formatBrazilianDate = (dateStr: string) => {
    // Se a data já está no formato brasileiro, retorna como está
    if (dateStr.includes('/')) {
      return dateStr;
    }
    
    // Converte de YYYY-MM-DD para DD/MM/YYYY
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    
    return dateStr;
  };

  // Obter perfil da bruxa baseado na data de nascimento
  const witchProfile = getWitchProfile(selectedBirthDate);

  // Determina o preço a ser exibido
  const displayPrice = selectedPrice?.value || '$13.67';
  const paymentLink = selectedPrice?.link || 'https://example.com/payment-13';

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { minutes: prev.minutes - 1, seconds: 59 };
        } else {
          return { minutes: 0, seconds: 0 };
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Função para disparar eventos de pixel
  const firePixelEvents = () => {
    try {
      // Dispara evento InitiateCheckout para ambos os pixels do Facebook
      if (window.fbq) {
        // Pixel 1: 1162364828302806
        window.fbq('trackSingle', '1162364828302806', 'InitiateCheckout', {
          value: displayPrice.replace('R$ ', '').replace('$', ''),
          currency: displayPrice.includes('R$') ? 'BRL' : 'USD',
          content_name: 'Leitura Personalizada Nebula',
          content_category: 'Spiritual Reading'
        });

        // Pixel 2: 1770667103479094
        window.fbq('trackSingle', '1770667103479094', 'InitiateCheckout', {
          value: displayPrice.replace('R$ ', '').replace('$', ''),
          currency: displayPrice.includes('R$') ? 'BRL' : 'USD',
          content_name: 'Leitura Personalizada Nebula',
          content_category: 'Spiritual Reading'
        });

        console.log('✅ Facebook Pixel - InitiateCheckout disparado para ambos os pixels');
      } else {
        console.warn('⚠️ Facebook Pixel não encontrado');
      }

      // Dispara evento para o pixel Utmify se disponível
      if (window.utmify) {
        window.utmify.track('InitiateCheckout', {
          value: displayPrice.replace('R$ ', '').replace('$', ''),
          currency: displayPrice.includes('R$') ? 'BRL' : 'USD',
          content_name: 'Leitura Personalizada Nebula'
        });
        console.log('✅ Utmify Pixel - InitiateCheckout disparado');
      }

    } catch (error) {
      console.error('❌ Erro ao disparar eventos de pixel:', error);
    }
  };

  const handlePayment = () => {
    // Dispara os eventos de pixel antes do redirecionamento
    firePixelEvents();

    // Pequeno delay para garantir que os eventos sejam enviados antes do redirecionamento
    setTimeout(() => {
      // Redireciona para o link externo específico do preço selecionado
      window.location.href = paymentLink;
    }, 100);
  };

  // Função para voltar que também força scroll to top
  const handleBack = () => {
    if (onBack) {
      onBack();
      // Força scroll to top após voltar
      setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 50);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* CSS personalizado para animação pulsante */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        .pulse-button {
          animation: pulse 2s infinite;
        }
      `}</style>

      {/* Timer Section */}
      <div className="flex justify-between items-center px-4 py-3 bg-white">
        <div>
          <p className="text-gray-700 text-sm">O desconto expira em</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-black">
              {String(timeLeft.minutes).padStart(2, '0')} : {String(timeLeft.seconds).padStart(2, '0')}
            </span>
            <div className="text-xs text-gray-500 ml-2">
              <div>min</div>
              <div>sec</div>
            </div>
          </div>
        </div>
        <button 
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium text-sm pulse-button"
          onClick={handlePayment}
        >
          OBTER MINHA<br />LEITURA
        </button>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Nebula Header */}
        <div className="flex justify-between items-center">
          <div className="text-2xl font-light tracking-widest text-black">
            NEBULA
          </div>
          <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
            <Star className="w-4 h-4 text-purple-600 fill-current" />
            <span className="font-bold text-lg">4.8</span>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="text-3xl font-bold text-black leading-tight">
          Conheça sua bruxa interior com o Nebula
        </h1>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <Book className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-black text-lg">Obtenha respostas</h3>
              <p className="text-gray-600 text-sm">com sua leitura personalizada em PDF</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-black text-lg">Receba orientação</h3>
              <p className="text-gray-600 text-sm">através de um chat privado com um vidente</p>
            </div>
          </div>
        </div>

        {/* Ready Section */}
        <div className="text-center py-6">
          <h2 className="text-2xl font-bold text-black leading-tight">
            Suas Leituras de Quiromancia e Poder de Bruxa estão prontas!
          </h2>
        </div>

        {/* Pricing Section */}
        <div className="bg-white rounded-2xl border-2 border-purple-600 overflow-hidden">
          <div className="bg-purple-600 text-white text-center py-3">
            <span className="font-medium">Oferta especial</span>
          </div>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold text-black">Leitura personalizada por</span>
              <span className="text-2xl font-bold text-purple-600">{displayPrice}</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <span className="text-gray-700">Total hoje:</span>
              <span className="font-bold text-black">{displayPrice}</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="flex items-center justify-center gap-2 py-4">
          <Shield className="w-5 h-5 text-green-600" />
          <span className="text-gray-700 text-sm">Pagamentos com segurança garantida</span>
        </div>

        {/* CTA Button */}
        <button 
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg pulse-button"
          onClick={handlePayment}
        >
          OBTER MINHA LEITURA
        </button>

        {/* Personalization Section */}
        <div className="pt-8">
          <h2 className="text-2xl font-bold text-black mb-6">
            Personalizamos sua Leitura do Poder de Bruxa
          </h2>
          
          {/* Witch Image */}
          <div className="bg-gradient-to-b from-purple-100 to-purple-50 rounded-2xl p-6 mb-6">
            <div className="flex justify-center mb-6">
              <img 
                src={witchProfile.image}
                alt={witchProfile.type}
                className="w-64 h-80 object-cover rounded-xl"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Tipo de bruxa</p>
                <p className="text-black font-bold text-lg">{witchProfile.type}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Data de nascimento</p>
                <p className="text-black font-bold text-lg">{formatBrazilianDate(selectedBirthDate)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-black mb-2">Perfil de bruxa</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {witchProfile.profile}
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-black mb-2">Forças pessoais</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {witchProfile.strengths}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-black mb-2">Visão geral</h4>
                <div className="bg-gray-200 rounded-lg p-4 relative">
                  <div className="blur-sm text-gray-500 text-sm">
                    A magia ancestral da vida bruxa está em grande parte
                    na sua capacidade de honrar os ancestrais através
                    das tradições que incluem magia herbária... [conteúdo]
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-purple-500 w-12 h-12 rounded-full flex items-center justify-center">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Palmistry Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-black leading-tight">
              O que suas mãos e dedos podem revelar sobre você
            </h2>
            
            <p className="text-gray-700 text-sm leading-relaxed">
              Suas mãos e dedos são como um livro pessoal, com cada 
              linha representando um capítulo da sua vida
            </p>

            {/* Palm Lines */}
            <div className="space-y-4">
              <div className="bg-purple-50 rounded-xl p-4 flex items-start gap-4">
                <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src="/images/life_line.png"
                    alt="Linha da vida"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-purple-700 mb-1">Linha da vida</h4>
                  <p className="text-gray-700 text-sm">
                    é um símbolo de vitalidade, traz pistas sobre sua 
                    saúde, energia e paixão pela vida
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-4">
                <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src="/images/head_line.png"
                    alt="Linha da cabeça"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-purple-700 mb-1">Linha da cabeça</h4>
                  <p className="text-gray-700 text-sm">
                    reflete os interesses intelectuais e as 
                    forças mentais
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-4">
                <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src="/images/marriage_line.png"
                    alt="Linha do casamento"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-purple-700 mb-1">Linha do casamento</h4>
                  <p className="text-gray-700 text-sm">
                    oferece uma visão sobre seus relacionamentos, 
                    parcerias românticas e potencial para 
                    casamento
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-white rounded-lg overflow-hidden mb-3">
                    <img 
                      src="/images/love_line.png"
                      alt="Linha do amor"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h4 className="font-bold text-purple-700 mb-1 text-sm">Linha do amor</h4>
                  <p className="text-gray-700 text-xs">
                    pode revelar insights sobre sua jornada 
                    romântica, mapeando os desejos do seu 
                    coração
                  </p>
                </div>

                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-white rounded-lg overflow-hidden mb-3">
                    <img 
                      src="/images/fate_line.png"
                      alt="Linha do dinheiro"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h4 className="font-bold text-purple-700 mb-1 text-sm">Linha do dinheiro</h4>
                  <p className="text-gray-700 text-xs">
                    revela insights sobre seu potencial 
                    financeiro e 
                    abordagem em 
                    relação à riqueza
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-4">
                <div className="w-16 h-16 bg-white rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src="/images/fingers.png"
                    alt="Dedos da mão"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-gray-700 text-sm">
                    <span className="font-bold text-black">Cada dedo é um pilar da sua personalidade</span>, desde liderança e 
                    ambição até criatividade e 
                    autoexpressão
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials Section */}
          <div className="pt-8">
            <h2 className="text-2xl font-bold text-black mb-6 text-center">
              Aqui estão algumas histórias de usuários do Nebula
            </h2>

            <div className="space-y-4">
              {/* Testimonial 1 */}
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-300 rounded-full flex items-center justify-center text-white font-bold">
                    LR
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-black">Lucas Ramos</p>
                        <p className="text-gray-500 text-xs">24/02/2024</p>
                      </div>
                      <div className="flex text-yellow-400">
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="text-4xl text-gray-400 leading-none">"</div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Quando procurei orientação para desbloquear 
                    meu potencial, o conselho que recebi foi ao 
                    mesmo tempo firme e esclarecedor. Ajudou a 
                    dissipar da dúvida, com dicas práticas para o 
                    crescimento pessoal. Agradeço muito pelo 
                    direcionamento. Altamente recomendado!
                  </p>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-300 rounded-full flex items-center justify-center text-white font-bold">
                    JP
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-black">João Pedro</p>
                        <p className="text-gray-500 text-xs">03/04/2024</p>
                      </div>
                      <div className="flex text-yellow-400">
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="text-4xl text-gray-400 leading-none">"</div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    A orientação que recebi foi incrível, e me ajudou a 
                    ver meus pontos fortes e como aproveitá-los. Foi 
                    uma verdadeira revelação e impactou bastante 
                    no meu desenvolvimento pessoal.
                  </p>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-300 rounded-full flex items-center justify-center text-white font-bold">
                    TS
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-black">Thamires Souza</p>
                        <p className="text-gray-500 text-xs">17/03/2024</p>
                      </div>
                      <div className="flex text-yellow-400">
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="text-4xl text-gray-400 leading-none">"</div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Obrigada, Nebula! Essa experiência me deixou 
                    mais otimista sobre alcançar meus objetivos, com 
                    uma visão mais clara do que quero conquistar.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Media Logos Section */}
          <div className="pt-8">
            <h2 className="text-2xl font-bold text-black mb-6 text-center">
              Destaque no
            </h2>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Row 1 */}
              <div className="flex justify-center">
                <div className="text-blue-600 font-bold text-xl">
                  Globo.com
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-blue-700 font-bold text-xl">
                  UOL
                </div>
              </div>
              
              {/* Row 2 */}
              <div className="flex justify-center">
                <div className="text-black font-bold text-lg">
                  Folha de S.Paulo
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-red-600 font-bold text-xl">
                  G1
                </div>
              </div>
              
              {/* Row 3 */}
              <div className="flex justify-center">
                <div className="text-orange-600 font-bold text-xl">
                  R7
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-red-700 font-bold text-xl">
                  VEJA
                </div>
              </div>
              
              {/* Row 4 */}
              <div className="flex justify-center">
                <div className="text-blue-800 font-bold text-lg">
                  Terra
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-purple-600 font-bold text-lg">
                  IstoÉ
                </div>
              </div>
              
              {/* Row 5 */}
              <div className="flex justify-center col-span-2">
                <div className="text-blue-600 font-bold text-lg">
                  O Estado de S. Paulo
                </div>
              </div>
            </div>

            {/* Money Back Guarantee */}
            <div className="bg-purple-50 rounded-2xl p-6 mb-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-black text-center mb-4">
                Garantia de reembolso
              </h3>
              
              <p className="text-gray-700 text-center leading-relaxed">
                Estamos certos de que este relatório vai 
                ajudar você a entender melhor seu parceiro e 
                sugerir formas de melhorar seu 
                relacionamento. Com muitas avaliações 
                excelentes de clientes, estamos prontos para 
                devolver seu dinheiro caso você sinta que o 
                relatório não trouxe valor algum.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-gray-500 text-sm">
        {onBack && (
          <button 
            onClick={handleBack}
            className="block mx-auto mt-4 text-purple-600 underline text-sm"
          >
            ← Voltar para seleção de preços
          </button>
        )}
        
      <p className="text-gray-700 text-center leading-relaxed">
                "Desvende o que está escrito e molde o que virá. O verdadeiro poder reside em conhecer seu destino para então dominá-lo." ~São Cipriano c🔱
              </p>
        
      </div>
    </div>
  );
};

export default TrialPaymentAncestral;
