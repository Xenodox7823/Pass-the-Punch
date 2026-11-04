import React from 'react';
import { Volume2, VolumeX, Play, RotateCcw, Home } from 'lucide-react';

interface PauseMenuProps {
  soundEnabled: boolean;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onToggleSound: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  soundEnabled,
  onResume,
  onRestart,
  onMainMenu,
  onToggleSound,
}) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
        <h2 className="text-3xl font-black text-amber-400 font-['Fredoka'] tracking-wide">
          MATCH PAUSED
        </h2>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Resume Game</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <span>Restart Match</span>
          </button>

          <button
            onClick={onToggleSound}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-5 h-5 text-emerald-400" />
                <span>Sound: Enabled</span>
              </>
            ) : (
              <>
                <VolumeX className="w-5 h-5 text-slate-500" />
                <span>Sound: Muted</span>
              </>
            )}
          </button>

          <button
            onClick={onMainMenu}
            className="w-full py-3 px-4 bg-red-950/60 hover:bg-red-900/60 text-red-300 font-semibold rounded-xl flex items-center justify-center gap-2 border border-red-800/60 transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Exit to Main Menu</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">Press Esc to resume</p>
      </div>
    </div>
  );
};
