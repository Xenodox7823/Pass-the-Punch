import React from 'react';
import { PlayerState } from '../game/types';
import { Trophy, RotateCcw, Home } from 'lucide-react';
import { triggerFullscreen } from '../utils/fullscreen';

interface ResultsScreenProps {
  winner: PlayerState | null;
  allPlayers: PlayerState[];
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  winner,
  allPlayers,
  onPlayAgain,
  onMainMenu,
}) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-2 sm:p-4 select-none overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 text-center">
        {/* Trophy & Winner Title */}
        <div className="space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-1 animate-bounce">
            <Trophy className="w-10 h-10" />
          </div>

          <h2 className="text-sm font-black tracking-widest text-amber-400 uppercase">
            MATCH COMPLETE
          </h2>

          <h1 className="text-3xl md:text-5xl font-black text-white font-['Fredoka'] tracking-wide">
            {winner ? `${winner.name} WINS!` : 'VICTORY ROYALE!'}
          </h1>

          {winner && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: winner.color }}
              />
              <span className="text-sm font-bold text-slate-300">
                {winner.isHuman ? 'You conquered the brawl!' : 'CPU Victorious!'}
              </span>
            </div>
          )}
        </div>

        {/* Detailed Match Statistics Table */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            Match Combat Breakdown
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {allPlayers.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs ${
                  p.id === winner?.id
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold font-['Fredoka'] text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.name}</span>
                  {p.isHuman && (
                    <span className="text-[10px] px-1 rounded bg-sky-500/20 text-sky-400 font-sans">
                      YOU
                    </span>
                  )}
                  {p.id === winner?.id && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black">
                      WINNER
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 md:flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span title="Punches Landed">🥊 {p.stats.punchesLanded} Hits</span>
                  <span title="Tokens Transferred">🪙 {p.stats.tokensTransferred} Passed</span>
                  <span title="Tokens Collected">💰 {p.stats.tokensCollected} Looted</span>
                  <span title="Ring-Outs Suffered">💀 {p.stats.ringOuts} Ringouts</span>
                  <span title="Perfect Dodges">⚡ {p.stats.perfectDodges} Dodges</span>
                  {p.stats.ghostAbilitiesUsed > 0 && (
                    <span title="Ghost Mischief Cast">👻 {p.stats.ghostAbilitiesUsed} Spells</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pt-1">
          <button
            onClick={() => {
              triggerFullscreen();
              onPlayAgain();
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 hover:from-red-500 hover:to-amber-400 text-slate-950 font-black text-base rounded-xl flex items-center justify-center gap-2 shadow-xl transition-all transform active:scale-95 font-['Fredoka']"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </button>

          <button
            onClick={() => {
              triggerFullscreen();
              onMainMenu();
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors text-sm"
          >
            <Home className="w-4 h-4" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
