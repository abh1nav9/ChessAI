import React from 'react';
import Board from './components/Board';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-100">
      <h1 className="text-4xl mb-4">Chess Game</h1>
      <Board />
    </div>
  );
};

export default App;
