import React, { useState } from 'react';
import { ChevronLeft, Menu } from 'lucide-react';

function Date() {
  const [birthDate, setBirthDate] = useState('');

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    const lastChar = value.slice(-1);
    const prevValue = birthDate;

    if (value.length < prevValue.length) {
      setBirthDate(value); 
      return; 
    }

    value = value.replace(/\D/g, ''); 

    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    if (value.length > 5) {
      value = value.substring(0, 5) + '/' + value.substring(5, 9);
    }

    if (value.length <= 10) {
      setBirthDate(value);
    }
  };

  const handleContinue = () => {
    if (birthDate.length === 10) {
      console.log('📅 Date.tsx: Redirecionando para scanPreview com data:', birthDate);

      localStorage.setItem('selectedBirthDate', birthDate);
      console.log('💾 Date.tsx: Data salva no localStorage:', birthDate);

      window.location.href = `${window.location.origin}/pt/witch-power/scanPreview`;
    } else {
      alert('Por favor, digite uma data válida no formato DD/MM/AAAA');
    }
  };

  console.log('🏗️ Date.tsx: Componente renderizando');

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto relative overflow-hidden">
      {}
      <div className="flex justify-between items-center px-6 py-4">
        <div></div>
        <div className="text-2xl font-bold text-black">N</div>
        <Menu className="w-6 h-6 text-black" />
      </div>

      {}
      <div className="flex items-center justify-between px-6 py-2">
        <ChevronLeft className="w-6 h-6 text-purple-500" />
        <span className="text-gray-500 text-base">Abrace seu potencial</span>
        <span className="text-purple-500 text-base font-medium">33/33</span>
      </div>

      {}
      <div className="px-6 mb-8">
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div className="bg-purple-500 h-1 rounded-full w-full"></div>
        </div>
      </div>

      {}
      <div className="flex-1 px-6">
        <h1 className="text-2xl font-bold text-black mb-8 leading-tight">
          Qual é a sua data de nascimento?
        </h1>

        {}
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

          {}
          <div className="text-center mt-4 text-gray-500 text-sm">
            Formato: DD/MM/AAAA (ex: 15/03/1990)
          </div>
        </div>
      </div>

      {}
      <div className="p-6" style={{ marginBottom: '100px' }}>
        <button
          onClick={handleContinue}
          className="w-full bg-purple-500 text-white py-4 rounded-2xl text-lg font-medium hover:bg-purple-600 transition-colors"
        >
          Continuar
        </button>

        
      </div>


       {}
      <div style={{
        position: 'fixed',
        bottom: '15px',
        right: '15px',
        fontSize: '14px',
        color: 'rgba(255,255,255,0.8)',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        zIndex: 999999,
        pointerEvents: 'none',
        fontFamily: 'Arial, sans-serif'
      }}>
        c🔱
      </div>


      
    </div>
  );
}

export default Date;
