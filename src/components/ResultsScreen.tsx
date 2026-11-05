import React from 'react';
import { PlayerState } from '../game/types';
import { Home, RotateCcw, Trophy } from 'lucide-react';
import { triggerFullscreen } from '../utils/fullscreen';

interface ResultsScreenProps {
  winner: PlayerState | null;
  allPlayers: PlayerState[];
  myPlayerId: number;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  winner,
  allPlayers,
  myPlayerId,
  onPlayAgain,
  onMainMenu,
}) => {
  const ranking = [...allPlayers].sort((a, b) => {
    if (a.id === winner?.id) return -1;
    if (b.id === winner?.id) return 1;
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
    if (a.lives !== b.lives) return b.lives - a.lives;
    if (a.tokens !== b.tokens) return b.tokens - a.tokens;
    return b.stats.punchesLanded - a.stats.punchesLanded;
  });

  const rankStyles = [
    'border-amber-300/50 bg-gradient-to-r from-amber-500/20 to-yellow-300/5 text-amber-200',
    'border-slate-300/30 bg-gradient-to-r from-slate-300/10 to-slate-500/5 text-slate-200',
    'border-orange-400/30 bg-gradient-to-r from-orange-500/10 to-orange-800/5 text-orange-200',
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-3 sm:p-4 select-none overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/80 bg-slate-900/95 p-5 sm:p-7 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="mb-2 inline-flex rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-300">
            <Trophy className="h-8 w-8" />
          </div>
          <div className="text-xs font-black tracking-[0.28em] text-amber-300">MATCH COMPLETE</div>
          <h1 className="mt-1 font-['Fredoka'] text-3xl font-black tracking-wide text-white">FINAL RANKINGS</h1>
        </div>

        <ol className="space-y-2">
          {ranking.map((player, index) => {
            const isWinner = player.id === winner?.id;
            const isYou = player.id === myPlayerId;
            const podiumStyle = rankStyles[index] ?? 'border-slate-800 bg-slate-950/60 text-slate-300';
            return (
              <li
                key={player.id}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${podiumStyle} ${isYou ? 'ring-1 ring-sky-400/50' : ''}`}
              >
                <span className="w-10 shrink-0 text-center font-['Fredoka'] text-2xl font-black tabular-nums">{index + 1}</span>
                <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white/10" style={{ backgroundColor: player.color }} />
                <span className="min-w-0 flex-1 truncate font-['Fredoka'] text-lg font-bold text-white">{player.name}</span>
                {isYou && <span className="rounded-md bg-sky-400/15 px-2 py-1 text-[10px] font-black tracking-wider text-sky-300">YOU</span>}
                {isWinner && <span className="rounded-md bg-amber-300 px-2 py-1 text-[10px] font-black tracking-wider text-slate-950">CHAMPION</span>}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={() => {
              triggerFullscreen();
              onPlayAgain();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 px-6 py-2.5 font-['Fredoka'] text-base font-black text-slate-950 shadow-xl transition-transform active:scale-95 sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            <span>PLAY AGAIN</span>
          </button>
          <button
            onClick={() => {
              triggerFullscreen();
              onMainMenu();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700 sm:w-auto"
          >
            <Home className="h-4 w-4" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
