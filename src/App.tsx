import { useState } from 'react';
import { StartScreen } from './screens/StartScreen';
import { GameScreen } from './screens/GameScreen';

function App() {
  const [currentScreen, setCurrentScreen] = useState<'start' | 'game'>('start');

  const handleStart = () => {
    setCurrentScreen('game');
  };

  return (
    <>
      {currentScreen === 'start' && <StartScreen onStart={handleStart} />}
      {currentScreen === 'game' && <GameScreen />}
    </>
  );
}

export default App;
