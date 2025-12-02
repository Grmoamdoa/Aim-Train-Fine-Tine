import React, { useMemo } from 'react';
import { SessionStats, ScenarioType } from '../types';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis, Cell, ReferenceLine } from 'recharts';

interface ResultsScreenProps {
  stats: SessionStats;
  onRestart: () => void;
  onMenu: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ stats, onRestart, onMenu }) => {
  // Prepare scatter data for misses (Hit map)
  const scatterData = useMemo(() => stats.missData.map((shot, idx) => ({
    x: shot.relativeX || 0,
    y: shot.relativeY || 0,
    hit: shot.hit,
    z: 1 
  })), [stats.missData]);

  // Calculate Statistics Locally
  const analysis = useMemo(() => {
    const misses = stats.missData.filter(s => !s.hit);
    const totalMisses = misses.length;
    
    if (totalMisses === 0) return {
        left: 0, right: 0, top: 0, bottom: 0,
        overshoots: 0, undershoots: 0,
        recommendation: "Perfect run! Your sensitivity is well-tuned."
    };

    const left = misses.filter(m => (m.relativeX || 0) < 0).length;
    const right = misses.filter(m => (m.relativeX || 0) > 0).length;
    const top = misses.filter(m => (m.relativeY || 0) > 0).length;
    const bottom = misses.filter(m => (m.relativeY || 0) < 0).length;

    // Tracking specific logic
    let overshoots = 0;
    let undershoots = 0;
    
    if (stats.scenario === ScenarioType.TRACKING) {
        const trackingMisses = misses.filter(m => m.targetVelocityX !== undefined);
        overshoots = trackingMisses.filter(m => 
            (m.targetVelocityX! > 0 && m.relativeX! > 0) || 
            (m.targetVelocityX! < 0 && m.relativeX! < 0)
        ).length;
        undershoots = trackingMisses.filter(m => 
            (m.targetVelocityX! > 0 && m.relativeX! < 0) || 
            (m.targetVelocityX! < 0 && m.relativeX! > 0)
        ).length;
    }

    // Heuristics for Recommendation
    let recommendation = "Your aim is balanced. Continue training to build consistency.";
    
    if (stats.scenario === ScenarioType.TRACKING) {
        if (overshoots > undershoots * 1.5 && overshoots > 3) {
            recommendation = "You consistently OVERSHOOT moving targets. \nTry LOWERING your sensitivity or DPI slightly.";
        } else if (undershoots > overshoots * 1.5 && undershoots > 3) {
            recommendation = "You consistently UNDERSHOOT moving targets. \nTry INCREASING your sensitivity or DPI slightly.";
        }
    } else {
        // Gridshot/Flicking
        const horizontalBias = Math.abs(left - right);
        const verticalBias = Math.abs(top - bottom);
        
        if (horizontalBias > totalMisses * 0.5) {
             recommendation = left > right 
                ? "You consistently miss to the LEFT. Check your initial crosshair placement or grip stability."
                : "You consistently miss to the RIGHT. You might be pulling your mouse too fast.";
        } else if (verticalBias > totalMisses * 0.5) {
            recommendation = "Significant vertical drift detected. Check your posture and mousepad friction.";
        } else {
            // Check spread width
            const avgSpread = misses.reduce((acc, m) => acc + Math.abs(m.relativeX || 0), 0) / totalMisses;
            if (avgSpread > 1.5) {
                recommendation = "Wide horizontal scatter detected. Your sensitivity might be too high for precise micro-adjustments.";
            }
        }
    }

    return { left, right, top, bottom, overshoots, undershoots, recommendation };
  }, [stats]);

  return (
    <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-8 overflow-auto">
      <div className="max-w-6xl w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl">
        <h2 className="text-4xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
          Session Analysis
        </h2>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Accuracy</p>
            <p className="text-3xl font-mono font-bold text-white">{stats.accuracy.toFixed(1)}%</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Score</p>
            <p className="text-3xl font-mono font-bold text-emerald-400">{stats.score}</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Hits</p>
            <p className="text-3xl font-mono font-bold text-zinc-300">{stats.shotsHit}</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Misses</p>
            <p className="text-3xl font-mono font-bold text-red-400">{stats.shotsFired - stats.shotsHit}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            {/* Left Col: Scatter Plot (Width 7/12) */}
            <div className="lg:col-span-7 bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-2 text-zinc-300">Impact Distribution</h3>
                <div className="w-full h-80 bg-zinc-900 relative rounded border border-zinc-800 overflow-hidden">
                    {/* Crosshair Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                        <div className="w-full h-px bg-white absolute"></div>
                        <div className="h-full w-px bg-white absolute"></div>
                        <div className="w-32 h-32 rounded-full border border-white absolute"></div>
                        <div className="w-16 h-16 rounded-full border border-zinc-500 border-dashed absolute"></div>
                    </div>
                    
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <XAxis type="number" dataKey="x" domain={['dataMin - 1', 'dataMax + 1']} hide />
                            <YAxis type="number" dataKey="y" domain={['dataMin - 1', 'dataMax + 1']} hide />
                            <ZAxis type="number" dataKey="z" range={[30, 30]} />
                            <Tooltip 
                                cursor={{ strokeDasharray: '3 3' }} 
                                contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff'}} 
                                formatter={(value: any, name: any) => [value.toFixed(2), name === 'x' ? 'Horizontal Offset' : 'Vertical Offset']}
                            />
                            <ReferenceLine y={0} stroke="#3f3f46" />
                            <ReferenceLine x={0} stroke="#3f3f46" />
                            <Scatter name="Shots" data={scatterData}>
                                {scatterData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.hit ? '#34d399' : '#ef4444'} fillOpacity={0.7} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-between w-full mt-2 px-4 text-xs text-zinc-500 font-mono">
                    <span>MISS LEFT: {analysis.left}</span>
                    <span>MISS RIGHT: {analysis.right}</span>
                </div>
            </div>

            {/* Right Col: Detailed Stats & Recommendation (Width 5/12) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
                
                {/* Miss Breakdown Table */}
                <div className="bg-zinc-950 p-6 rounded-lg border border-zinc-800">
                    <h3 className="text-lg font-semibold mb-4 text-zinc-300">Miss Breakdown</h3>
                    <div className="space-y-3">
                        {stats.scenario === ScenarioType.TRACKING && (
                            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-zinc-800 mb-4">
                                <div>
                                    <p className="text-zinc-500 text-xs">OVERSHOOTS</p>
                                    <p className={`text-2xl font-mono font-bold ${analysis.overshoots > analysis.undershoots ? 'text-orange-400' : 'text-zinc-400'}`}>
                                        {analysis.overshoots}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 text-xs">UNDERSHOOTS</p>
                                    <p className={`text-2xl font-mono font-bold ${analysis.undershoots > analysis.overshoots ? 'text-blue-400' : 'text-zinc-400'}`}>
                                        {analysis.undershoots}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                                <span className="block text-zinc-500 text-[10px]">UP</span>
                                <span className="font-mono text-white">{analysis.top}</span>
                            </div>
                            <div className="col-span-2 row-span-2 flex items-center justify-center bg-zinc-900/50 rounded border border-zinc-800/50">
                                <span className="text-zinc-600 text-xs italic">Target Center</span>
                            </div>
                            <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                                <span className="block text-zinc-500 text-[10px]">LEFT</span>
                                <span className="font-mono text-white">{analysis.left}</span>
                            </div>
                             <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                                <span className="block text-zinc-500 text-[10px]">RIGHT</span>
                                <span className="font-mono text-white">{analysis.right}</span>
                            </div>
                            <div className="p-2 bg-zinc-900 rounded border border-zinc-800 col-start-2">
                                <span className="block text-zinc-500 text-[10px]">DOWN</span>
                                <span className="font-mono text-white">{analysis.bottom}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recommendation Card */}
                <div className="flex-1 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-6 rounded-lg border border-indigo-500/30 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                    </div>
                    <h3 className="text-indigo-300 font-bold mb-2 uppercase text-sm tracking-widest">Feedback</h3>
                    <p className="text-white text-lg font-medium leading-snug whitespace-pre-wrap">
                        {analysis.recommendation}
                    </p>
                </div>
            </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={onMenu}
            className="px-6 py-3 rounded-lg font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-all border border-zinc-700"
          >
            Main Menu
          </button>
          <button
            onClick={onRestart}
            className="px-8 py-3 rounded-lg font-bold text-black bg-emerald-400 hover:bg-emerald-300 transition-all shadow-lg shadow-emerald-900/20"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};