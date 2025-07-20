import React, { useState, useEffect } from 'react';
import { Star, Book, MessageCircle, Shield, Lock } from 'lucide-react';

interface TrialPaymentAncestralProps {
  selectedPrice?: { value: string; link: string } | null;
  selectedBirthDate?: string;
  onBack?: () => void;
}

const TrialPaymentAncestral: React.FC<TrialPaymentAncestralProps> = ({ 
  selectedPrice, 
  selectedBirthDate = '01-01-1990',
  onBack 
}) => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 9, seconds: 40 });

  // Função para converter data para formato brasileiro
  const formatBrazilianDate = (dateStr: string) => {
    // Se a data já está no formato brasileiro, retorna como está
    if (dateStr.includes('/')) {
      return dateStr;
    }
    
    // Converte de DD-MM-YYYY para DD/MM/YYYY
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    
    return dateStr;
  };

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

  const handlePayment = () => {
    // Redireciona para o link externo específico do preço selecionado
    window.location.href = paymentLink;
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
                src="https://images.pexels.com/photos/6148911/pexels-photo-6148911.jpeg?auto=compress&cs=tinysrgb&w=400" 
                alt="Bruxa Ancestral" 
                className="w-64 h-80 object-cover rounded-xl"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Tipo de bruxa</p>
                <p className="text-black font-bold text-lg">Bruxa ancestral</p>
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
                  Especializada em conectar-se e honrar seus ancestrais; 
                  habilidosa em tecer conhecimento e sabedoria 
                  ancestral em sua prática mágica.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-black mb-2">Forças pessoais</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Empática, introspectiva e profundamente ligada às suas 
                  raízes; valoriza tradição, herança e as lições passadas 
                  através das gerações.
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
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src="/images/life_line.png"
                    alt="Linha da vida"
                    className="w-8 h-8"
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
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src="/images/head_line.png"
                    alt="Linha da cabeça"
                    className="w-8 h-8"
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
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src="/images/marriage_line.png"
                    alt="Linha do casamento"
                    className="w-8 h-8"
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
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-3">
                    <img 
                      src="/images/love_line.png"
                      alt="Linha do amor"
                      className="w-6 h-6"
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
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-3">
                    <img 
                      src="/images/fate_line.png"
                      alt="Linha do dinheiro"
                      className="w-6 h-6"
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
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <img 
                    src="/images/fingers.png"
                    alt="Dedos da mão"
                    className="w-8 h-8"
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
                <div className="text-black font-serif text-lg font-bold" style={{fontFamily: 'Old English Text MT, serif'}}>
                  The New York Times
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-black font-bold text-xl">
                  Lifewire
                </div>
              </div>
              
              {/* Row 2 */}
              <div className="flex justify-center items-center">
                <div className="flex items-center">
                  <div className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center mr-2">
                    <span className="text-black font-bold text-sm">R</span>
                  </div>
                  <span className="text-black font-bold text-lg">REFINERY29</span>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-black font-bold text-xl">
                  Bustle
                </div>
              </div>
              
              {/* Row 3 */}
              <div className="flex justify-center col-span-2">
                <div className="text-black font-light text-xl tracking-widest">
                  WELL+GOOD
                </div>
              </div>
              
              {/* Row 4 */}
              <div className="flex justify-center">
                <div className="text-black font-bold text-lg">
                  URBAN<br/>LIST
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-black font-bold text-xl">
                  Beebom
                </div>
              </div>
              <div className="flex justify-center">
                <div className="text-pink-400 font-bold text-xl">
                  HYPEBAE
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
            onClick={onBack}
            className="block mx-auto mt-4 text-purple-600 underline text-sm"
          >
            ← Voltar para seleção de preços
          </button>
        )}
      </div>
    </div>
  );
};

export default TrialPaymentAncestral;
