import { useState } from 'react';
import { StartScreen } from './screens/StartScreen';
import { GameScreen } from './screens/GameScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function App() {
  const [currentScreen, setCurrentScreen] = useState<'start' | 'game' | 'settings'>('start');
  const [previousScreen, setPreviousScreen] = useState<'start' | 'game'>('start');
  const [gameMode, setGameMode] = useState<'training' | 'survival'>('training');

  const handleStart = (mode: 'training' | 'survival') => {
    setGameMode(mode);
    setCurrentScreen('game');
  };

  const handleOpenSettings = () => {
    setPreviousScreen(currentScreen === 'settings' ? previousScreen : currentScreen);
    setCurrentScreen('settings');
  };

  const handleBackFromSettings = () => {
    setCurrentScreen(previousScreen);
  };

  return (
    <>
      {currentScreen === 'start' && (
        <StartScreen onStart={handleStart} onSettings={handleOpenSettings} />
      )}
      {currentScreen === 'game' && (
        <GameScreen 
          mode={gameMode}
          onSettings={handleOpenSettings} 
          onGameEnd={() => setCurrentScreen('start')} 
        />
      )}
      {currentScreen === 'settings' && <SettingsScreen onBack={handleBackFromSettings} />}
    </>
  );
}

export default App;
