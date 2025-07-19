import React, { useState } from 'react';
import { ChevronLeft, Menu } from 'lucide-react';

function App() {
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
      alert(`Data selecionada: ${birthDate}`);
    } else {
      alert('Por favor, digite uma data válida no formato DD/MM/AAAA');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto relative overflow-hidden">
      {/* Status Bar */}
      <div className="flex justify-between items-center px-6 py-2 text-black text-lg font-medium">
        <span>10:47</span>
        <div className="flex items-center space-x-1">
          <div className="flex space-x-1">
            <div className="w-1 h-3 bg-black rounded-sm"></div>
            <div className="w-1 h-3 bg-black rounded-sm"></div>
            <div className="w-1 h-3 bg-black rounded-sm"></div>
          </div>
          <svg width="18" height="12" viewBox="0 0 18 12" className="ml-2">
            <path d="M2 2L9 9L16 2" stroke="black" strokeWidth="2" fill="none"/>
          </svg>
          <div className="bg-gray-400 rounded-md px-2 py-1 text-xs text-white font-medium">62</div>
        </div>
      </div>

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

      {/* Browser Navigation */}
      <div className="bg-gray-800 text-white p-3 rounded-t-2xl">
        <div className="flex justify-center">
          <div className="bg-gray-600 rounded-full px-4 py-2 flex items-center space-x-3 text-sm">
            <span>aA</span>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-sm bg-gray-400"></div>
              <span>appnebula.co</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-400">
              <path d="M8 2V14M14 8H2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        </div>
        
        {/* Navigation Icons */}
        <div className="flex justify-around mt-3 text-blue-400">
          <ChevronLeft className="w-6 h-6" />
          <div className="w-6 h-6"></div>
          <svg width="24" height="24" viewBox="0 0 24 24" className="w-6 h-6">
            <path d="M19 21L12 15L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" 
                  stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
          <svg width="24" height="24" viewBox="0 0 24 24" className="w-6 h-6">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/>
            <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
        </div>
        
        {/* Home Indicator */}
        <div className="flex justify-center mt-3">
          <div className="w-32 h-1 bg-white rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

export default App;
