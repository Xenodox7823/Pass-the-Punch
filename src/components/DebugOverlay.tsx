import React from 'react';
import { GameSnapshot } from '../game/types';

interface DebugOverlayProps {
  snapshot: GameSnapshot;
  onClose: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ snapshot, onClose }) => {
  return (
    <div className="absolute top-16 left-4 z-40 bg-slate-950/95 border border-amber-500/60 rounded-xl p-3 shadow-2xl font-mono text-[11px] text-amber-300 max-w-xs pointer-events-auto backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-amber-500/30 pb-1 mb-2">
        <span className="font-bold text-amber-400">DEBUG CONSOLE (F1)</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white px-1 text-xs"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1 text-slate-300">
        <div>
          <span className="text-slate-400">FPS:</span>{' '}
          <span className="text-emerald-400 font-bold">{snapshot.debugFps}</span>
        </div>
        <div>
          <span className="text-slate-400">Phase:</span>{' '}
          <span className="text-yellow-400 font-bold">{snapshot.phase}</span>
        </div>
        <div>
          <span className="text-slate-400">Timer:</span>{' '}
          <span className="text-white font-bold">{snapshot.timeRemaining}s remaining</span>
        </div>
        <div>
          <span className="text-slate-400">Combatants:</span>{' '}
          <span className="text-sky-400">{snapshot.livingCount} alive / {snapshot.players.length} total</span>
        </div>
        <div>
          <span className="text-slate-400">Loose Tokens:</span>{' '}
          <span className="text-amber-400 font-bold">{snapshot.looseTokenCount}</span>
        </div>
        <div>
          <span className="text-slate-400">GIGA BONK Spawned:</span>{' '}
          <span className={snapshot.gigaBonkSpawned ? 'text-emerald-400' : 'text-slate-500'}>
            {snapshot.gigaBonkSpawned ? 'YES' : 'NO'}
          </span>
        </div>
        <div>
          <span className="text-slate-400">GIGA BONK Held:</span>{' '}
          <span className={snapshot.gigaBonkActive ? 'text-red-400 font-bold' : 'text-slate-500'}>
            {snapshot.gigaBonkActive ? 'YES' : 'NO'}
          </span>
        </div>
        <div>
          <span className="text-slate-400">Ghost Zones Active:</span>{' '}
          <span className="text-purple-400">{snapshot.activeEffectsCount} / 2 max</span>
        </div>
      </div>

      <div className="border-t border-slate-800 mt-2 pt-1 text-[10px] space-y-0.5">
        <div className="text-slate-400 font-bold">Player States:</div>
        {snapshot.players.map((p) => (
          <div key={p.id} className="flex justify-between text-slate-300">
            <span>{p.name.slice(0, 10)}:</span>
            <span>
              {p.lives}❤️ | {p.tokens}🪙
              {p.isGhost ? ' (GHOST)' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
