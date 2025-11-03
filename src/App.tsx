import { useState } from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import LandingPage from './components/LandingPage';
import StoryView from './components/StoryView';
import ChatBox from './components/ChatBox';
import EndingView from './components/EndingView';
import './App.css';

function AppContent() {
  const { phase } = useGame();
  const [fullyOpenDoor, setFullyOpenDoor] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<string[]>([]);

  return (
    <div className="App">
      {phase === 'landing' && <LandingPage />}
      {phase === 'story' && (
        <>
          <StoryView 
            fullyOpenDoor={fullyOpenDoor}
            setFullyOpenDoor={setFullyOpenDoor}
            decisions={decisions}
            setDecisions={setDecisions}
          />
          <ChatBox 
            onInputMatch={setFullyOpenDoor}
            decisions={decisions}
          />
        </>
      )}
      {phase === 'ending' && <EndingView />}
    </div>
  );
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
