import React, { useState } from 'react';
import { Game3D } from './components/Game3D';
import { ResultsScreen } from './components/ResultsScreen';
import { GameState, ScenarioType, SessionStats, ShotData } from './types';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [scenario, setScenario] = useState<ScenarioType>(ScenarioType.GRIDSHOT);
  const [sensitivity, setSensitivity] = useState<number>(1.0);
  const [lastStats, setLastStats] = useState<SessionStats | null>(null);

  const handleStartGame = (type: ScenarioType) => {
    setScenario(type);
    setGameState(GameState.PLAYING);
  };

  const handleGameFinish = (score: number, shotsFired: number, shotsHit: number, missData: ShotData[]) => {
    document.exitPointerLock();
    const stats: SessionStats = {
      score,
      shotsFired,
      shotsHit,
      accuracy: shotsFired > 0 ? (shotsHit / shotsFired) * 100 : 0,
      missData,
      scenario,
      sensitivity
    };
    setLastStats(stats);
    setGameState(GameState.RESULTS);
  };

  // Main Menu Component (Inline for simplicity of file structure)
  const MainMenu = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-600 mb-2">
          PRECISION AIM LAB
        </h1>
        <p className="text-zinc-400 text-lg">
          Train your aim in 3D. Analyze your misses. Optimize your DPI.
        </p>

        <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl">
          <div className="mb-8">
            <label className="block text-left text-sm font-bold text-zinc-300 mb-2">
              SENSITIVITY (Global Multiplier)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="font-mono bg-zinc-800 px-3 py-1 rounded text-emerald-400 w-16">
                {sensitivity}
              </span>
            </div>
            <p className="text-left text-xs text-zinc-500 mt-2">
              Note: This applies a multiplier to standard pointer lock movement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleStartGame(ScenarioType.GRIDSHOT)}
              className="p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group hover:border-emerald-500/50"
            >
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-bold text-white group-hover:text-emerald-400">Gridshot</h3>
              <p className="text-xs text-zinc-500 mt-1">Speed & precision. Static targets.</p>
            </button>

            <button
              onClick={() => handleStartGame(ScenarioType.TRACKING)}
              className="p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group hover:border-blue-500/50"
            >
              <div className="text-2xl mb-2">〰️</div>
              <h3 className="font-bold text-white group-hover:text-blue-400">Tracking</h3>
              <p className="text-xs text-zinc-500 mt-1">Smoothness. Moving targets.</p>
            </button>

            <button
              onClick={() => handleStartGame(ScenarioType.FLICKING)}
              className="p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group hover:border-purple-500/50"
            >
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-bold text-white group-hover:text-purple-400">Micro-Flick</h3>
              <p className="text-xs text-zinc-500 mt-1">Small adjustments. Tiny targets.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {gameState === GameState.MENU && <MainMenu />}
      
      {gameState === GameState.PLAYING && (
        <Game3D 
          scenario={scenario} 
          sensitivity={sensitivity} 
          onFinish={handleGameFinish} 
        />
      )}

      {gameState === GameState.RESULTS && lastStats && (
        <ResultsScreen 
          stats={lastStats} 
          onRestart={() => setGameState(GameState.PLAYING)}
          onMenu={() => setGameState(GameState.MENU)}
        />
      )}
    </>
  );
}

export default App;