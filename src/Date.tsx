import React, { useState } from 'react';
import { ChevronLeft, Menu } from 'lucide-react';

function Date() {
  const [birthDate, setBirthDate] = useState('');

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    
    // Adiciona as barras automaticamente
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length >= 5) {
      value = value.substring(0, 5) + '/' + value.substring(5, 9);
    }
    
    setBirthDate(value);
  };

  const handleContinue = () => {
    if (birthDate.length === 10) {
      console.log('📅 Date.tsx: Redirecionando para scanPreview com data:', birthDate);
      
      // Salva a data no localStorage para usar em outras páginas
      localStorage.setItem('selectedBirthDate', birthDate);
      console.log('💾 Date.tsx: Data salva no localStorage:', birthDate);
      
      // Redireciona para scanPreview mantendo no proxy (URL absoluta)
      window.location.href = `${window.location.origin}/pt/witch-power/scanPreview`;
    } else {
      alert('Por favor, digite uma data válida no formato DD/MM/AAAA');
    }
  };

  console.log('🏗️ Date.tsx: Componente renderizando');

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto relative overflow-hidden">
     

      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4">
        <div></div>
        <div className="text-2xl font-bold text-black">N</div>
        <Menu className="w-6 h-6 text-black" />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-2">
        <ChevronLeft className="w-6 h-6 text-purple-500" />
        <span className="text-gray-500 text-base">Abrace seu potencial</span>
        <span className="text-purple-500 text-base font-medium">33/33</span>
      </div>

      {/* Progress Bar */}
      <div className="px-6 mb-8">
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div className="bg-purple-500 h-1 rounded-full w-full"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6">
        <h1 className="text-2xl font-bold text-black mb-8 leading-tight">
          Qual é a sua data de nascimento?
        </h1>

        {/* Date Input */}
        <div className="mt-16 mb-8">
          <div className="bg-gray-50 rounded-2xl p-6 mx-4">
            <input
              type="text"
              value={birthDate}
              onChange={handleDateChange}
              placeholder="DD/MM/AAAA"
              maxLength={10}
              className="w-full text-center text-2xl font-semibold bg-transparent border-none outline-none text-black placeholder-gray-400"
            />
          </div>
          
          {/* Formato de exemplo */}
          <div className="text-center mt-4 text-gray-500 text-sm">
            Formato: DD/MM/AAAA (ex: 15/03/1990)
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="p-6">
        <button 
          onClick={handleContinue}
          className="w-full bg-purple-500 text-white py-4 rounded-2xl text-lg font-medium hover:bg-purple-600 transition-colors"
        >
          Continuar
        </button>
      </div>
</div>
     
    </div>
  );
}

export default Date;
