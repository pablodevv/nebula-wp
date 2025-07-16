import React from 'react';
import TrialChoice from './TrialChoice';
import './TrialChoice.css';

function App() {
  // Simular o texto capturado do <b></b>
  const capturedText = "encontrar marcas e símbolos que as guiam";

  return (
    <div className="min-h-screen bg-gray-100">
      <TrialChoice capturedText={capturedText} />
    </div>
  );
}

export default App;