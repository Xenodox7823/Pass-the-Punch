import React, { useState } from 'react';
import { MatchSettings, RoomState } from '../game/types';
import { Copy, Check, Crown, Bot, ArrowLeft, Play, Users } from 'lucide-react';
import { triggerFullscreen } from '../utils/fullscreen';

interface MultiplayerLobbyProps {
  room: RoomState;
  myPlayerId: number;
  onUpdateSettings: (settings: Partial<MatchSettings>) => void;
  onToggleReady: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  room,
  myPlayerId,
  onUpdateSettings,
  onToggleReady,
  onStartMatch,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);

  const me = room.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;

  const handleCopyCode = () => {
    triggerFullscreen();
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const humanPlayers = room.players.filter((p) => !p.isBot);
  const allHumansReady = humanPlayers.every((p) => p.isReady);

  const handleToggle = () => {
    triggerFullscreen();
    onToggleReady();
  };

  const handleStart = () => {
    triggerFullscreen();
    onStartMatch();
  };

  return (
    <div
      onClick={triggerFullscreen}
      className="fixed inset-0 z-40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-between p-2 sm:p-3 md:p-5 h-[100dvh] max-h-[100dvh] overflow-hidden select-none"
    >
      {/* Top Bar: Room Code & Back */}
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto shrink-0 pb-1">
        <button
          onClick={() => {
            triggerFullscreen();
            onLeaveRoom();
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Leave
        </button>

        {/* Room Code Badge */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border-2 border-amber-500/80 px-3 py-1 rounded-2xl shadow-xl">
          <span className="text-[10px] md:text-xs font-black text-slate-400">ROOM:</span>
          <span className="text-base sm:text-lg md:text-xl font-black font-mono text-amber-300 tracking-widest">
            {room.code}
          </span>
          <button
            onClick={handleCopyCode}
            className="p-1 rounded-lg bg-slate-800 text-amber-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Copy Room Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="text-[11px] md:text-xs font-bold text-slate-400 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <span>{humanPlayers.length} Human{humanPlayers.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Main Content Area: Fits mobile landscape and portrait */}
      <div className="w-full max-w-4xl mx-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 my-1 min-h-0 overflow-y-auto">
        {/* Left Column: Combatant Roster */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 md:p-4 flex flex-col justify-between shadow-xl backdrop-blur-md min-h-0">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] md:text-xs font-black text-slate-300 tracking-wider uppercase font-['Fredoka']">
                COMBATANTS ({room.players.length} / 7)
              </h3>
              <span className="text-[9px] text-slate-400">2-7 players</span>
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[30vh] sm:max-h-[35vh] md:max-h-[48vh] pr-1">
              {room.players.map((p) => {
                const isMe = p.id === myPlayerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      isMe
                        ? 'bg-slate-800/90 border-amber-400/80 shadow-md ring-1 ring-amber-400/30'
                        : p.isBot
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shadow-inner shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] md:text-xs font-bold text-white max-w-[110px] truncate">
                          {p.name} {isMe && '(YOU)'}
                        </span>
                        {p.isHost && (
                          <span title="Host">
                            <Crown className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.isBot ? (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-800 text-[9px] font-bold text-slate-400">
                          <Bot className="w-2.5 h-2.5" />
                          CPU
                        </span>
                      ) : p.isReady ? (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black">
                          <Check className="w-2.5 h-2.5" />
                          READY
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold">
                          NOT READY
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick instructions */}
          <div className="mt-1.5 p-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[9px] text-slate-400">
            Share code <strong>{room.code}</strong> with friends. Empty slots fill with bots!
          </div>
        </div>

        {/* Right Column: Host Match Settings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 md:p-4 flex flex-col justify-between shadow-xl backdrop-blur-md min-h-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <h3 className="text-[11px] md:text-xs font-black text-slate-300 tracking-wider uppercase font-['Fredoka']">
                MATCH SETTINGS
              </h3>
              {!isHost && (
                <span className="text-[9px] text-amber-400 font-bold">
                  Host controls settings
                </span>
              )}
            </div>

            {/* Total Combatants (2-7) */}
            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>Total Combatants</span>
                <span className="text-amber-400 font-mono">{room.settings.totalPlayers} Players</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[2, 3, 4, 5, 6, 7].map((count) => (
                  <button
                    key={count}
                    disabled={!isHost}
                    onClick={() => {
                      triggerFullscreen();
                      onUpdateSettings({ totalPlayers: count });
                    }}
                    className={`py-1 rounded-xl font-mono text-[11px] font-bold transition-all ${
                      room.settings.totalPlayers === count
                        ? 'bg-amber-500 text-slate-950 border border-amber-300 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-750 disabled:opacity-50'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Bot Difficulty */}
            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>CPU Difficulty</span>
                <span className="text-amber-400 font-mono">{room.settings.cpuDifficulty}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['EASY', 'NORMAL', 'CHAOTIC'] as const).map((diff) => (
                  <button
                    key={diff}
                    disabled={!isHost}
                    onClick={() => {
                      triggerFullscreen();
                      onUpdateSettings({ cpuDifficulty: diff });
                    }}
                    className={`py-1 rounded-xl text-[10px] md:text-xs font-bold transition-all ${
                      room.settings.cpuDifficulty === diff
                        ? 'bg-amber-500 text-slate-950 border border-amber-300 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-750 disabled:opacity-50'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Match Duration */}
            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                <span>Duration</span>
                <span className="text-amber-400 font-mono">{room.settings.matchDuration}s</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[60, 90, 120].map((dur) => (
                  <button
                    key={dur}
                    disabled={!isHost}
                    onClick={() => {
                      triggerFullscreen();
                      onUpdateSettings({ matchDuration: dur });
                    }}
                    className={`py-1 rounded-xl text-[10px] md:text-xs font-bold transition-all ${
                      room.settings.matchDuration === dur
                        ? 'bg-amber-500 text-slate-950 border border-amber-300 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-750 disabled:opacity-50'
                    }`}
                  >
                    {dur}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button: Ready / Start */}
          <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
            {!isHost ? (
              <button
                onClick={handleToggle}
                className={`w-full py-2.5 rounded-xl font-black text-xs md:text-sm font-['Fredoka'] tracking-wider shadow-lg transition-all ${
                  me?.isReady
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {me?.isReady ? 'READY! (TAP TO UNREADY)' : 'READY UP'}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!allHumansReady}
                className={`w-full py-2.5 rounded-xl font-black text-xs md:text-sm font-['Fredoka'] tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all ${
                  allHumansReady
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {allHumansReady ? 'START MULTIPLAYER MATCH!' : 'WAITING FOR PLAYERS'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
