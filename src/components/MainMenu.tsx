import React, { useState } from 'react';
import { CpuDifficulty, MatchSettings } from '../game/types';
import { Volume2, VolumeX, Users, Globe, Bot, Play, Settings, Maximize } from 'lucide-react';
import { sound } from '../game/audio';
import { triggerFullscreen } from '../utils/fullscreen';

interface MainMenuProps {
  settings: MatchSettings;
  onUpdateSettings: (settings: MatchSettings) => void;
  onStartLocalGame: () => void;
  onCreateOnlineRoom: (playerName: string) => void;
  onJoinOnlineRoom: (code: string, playerName: string) => void;
  onOpenSettings: () => void;
  isConnecting?: boolean;
  connectionError?: string | null;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  settings,
  onUpdateSettings,
  onStartLocalGame,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onOpenSettings,
  isConnecting = false,
  connectionError = null,
}) => {
  const [activeTab, setActiveTab] = useState<'LOCAL' | 'ONLINE'>('LOCAL');
  const [playerName, setPlayerName] = useState<string>(() => {
    return 'Player_' + Math.floor(100 + Math.random() * 900);
  });
  const [joinCode, setJoinCode] = useState<string>('');

  const toggleSound = () => {
    triggerFullscreen();
    const nextVal = sound.toggleSound();
    onUpdateSettings({ ...settings, soundEnabled: nextVal });
  };

  const setTotalPlayers = (count: number) => {
    triggerFullscreen();
    onUpdateSettings({ ...settings, totalPlayers: count });
  };

  const setDifficulty = (diff: CpuDifficulty) => {
    triggerFullscreen();
    onUpdateSettings({ ...settings, cpuDifficulty: diff });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    triggerFullscreen();
    if (joinCode.trim()) {
      onJoinOnlineRoom(joinCode.trim().toUpperCase(), playerName.trim() || 'Player');
    }
  };

  const handleStartLocal = () => {
    triggerFullscreen();
    onStartLocalGame();
  };

  const handleCreateRoom = () => {
    triggerFullscreen();
    onCreateOnlineRoom(playerName.trim() || 'Player');
  };

  return (
    <div
      onClick={triggerFullscreen}
      className="relative w-full h-[100dvh] max-h-[100dvh] flex flex-col justify-between p-2 sm:p-3 md:p-5 bg-slate-950 text-slate-100 overflow-hidden select-none"
    >
      {/* Background glowing energy */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-red-600 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-amber-500 rounded-full blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between pb-1.5 md:pb-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="text-base sm:text-lg md:text-2xl font-black tracking-tight text-amber-400 font-['Fredoka']">
            PASS THE PUNCH
          </span>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={() => {
              triggerFullscreen();
              onOpenSettings();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] md:text-xs font-semibold hover:border-slate-700 transition-colors text-amber-300"
            title="Customise Controls"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            onClick={triggerFullscreen}
            className="p-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            title="Fullscreen Mode"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleSound}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] md:text-xs font-semibold hover:border-slate-700 transition-colors"
            title="Toggle Sound"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Hero & Mode Switcher */}
      <main className="relative z-10 w-full max-w-2xl mx-auto flex-1 flex flex-col items-center justify-center py-1 sm:py-2 md:py-3 gap-1.5 sm:gap-2.5 min-h-0">
        {/* Title & Tagline */}
        <div className="text-center space-y-0.5 shrink-0">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 font-['Fredoka'] tracking-tight drop-shadow-md">
            PASS THE PUNCH!
          </h1>
          <p className="max-w-md text-[10px] sm:text-xs md:text-sm text-slate-300 leading-tight font-medium line-clamp-2">
            Punch to give tokens. At <span className="text-red-400 font-bold">5 tokens</span> trigger a massive <span className="text-amber-400 font-bold">OVERLOAD!</span> Knock opponents off in 3D!
          </p>
        </div>

        {/* Tab Switcher: Local VS Bots | Online Multiplayer */}
        <div className="flex bg-slate-900/90 border border-slate-800 p-1 rounded-2xl w-full max-w-sm sm:max-w-md shrink-0 shadow-lg">
          <button
            onClick={() => {
              triggerFullscreen();
              setActiveTab('LOCAL');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] sm:text-xs md:text-sm font-black transition-all ${
              activeTab === 'LOCAL'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            PLAY VS BOTS
          </button>

          <button
            onClick={() => {
              triggerFullscreen();
              setActiveTab('ONLINE');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] sm:text-xs md:text-sm font-black transition-all ${
              activeTab === 'ONLINE'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            ONLINE MULTIPLAYER
          </button>
        </div>

        {/* Tab Card: Local Play */}
        {activeTab === 'LOCAL' && (
          <div className="w-full max-w-sm sm:max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 md:p-4 shadow-2xl backdrop-blur-md space-y-2 shrink-0">
            {/* Combatants count */}
            <div>
              <div className="flex items-center justify-between mb-1 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-slate-300">
                  <Users className="w-3 h-3 text-amber-400" /> Combatants
                </span>
                <span className="text-amber-400 font-bold font-mono">
                  {settings.totalPlayers} Players (You + {settings.totalPlayers - 1} Bots)
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[2, 3, 4, 5, 6, 7].map((num) => (
                  <button
                    key={num}
                    onClick={() => setTotalPlayers(num)}
                    className={`py-1 rounded-xl font-mono text-[11px] md:text-xs font-bold transition-all ${
                      settings.totalPlayers === num
                        ? 'bg-amber-500 text-slate-950 font-black border border-amber-300'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1">
                Bot Difficulty
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['EASY', 'NORMAL', 'CHAOTIC'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`py-1 rounded-xl text-[11px] font-bold transition-all ${
                      settings.cpuDifficulty === diff
                        ? 'bg-amber-500 text-slate-950 font-black border border-amber-300'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartLocal}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs md:text-sm font-['Fredoka'] tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              START LOCAL BRAWL!
            </button>
          </div>
        )}

        {/* Tab Card: Online Multiplayer */}
        {activeTab === 'ONLINE' && (
          <div className="w-full max-w-sm sm:max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 md:p-4 shadow-2xl backdrop-blur-md space-y-2 shrink-0">
            {/* Player Name */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Fighter Nickname
              </label>
              <input
                type="text"
                maxLength={14}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-400"
                placeholder="Enter fighter nickname"
              />
            </div>

            {/* Error badge */}
            {connectionError && (
              <div className="p-1.5 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-[11px] text-center font-bold">
                {connectionError}
              </div>
            )}

            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              disabled={isConnecting}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs md:text-sm font-['Fredoka'] tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5" />
              {isConnecting ? 'CONNECTING...' : 'CREATE ONLINE ROOM'}
            </button>

            {/* Join Room Form */}
            <form onSubmit={handleJoin} className="pt-1.5 border-t border-slate-800 space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 block">
                Have a 5-letter Room Code?
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE (e.g. BONK1)"
                  className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono font-black text-amber-300 text-xs sm:text-sm tracking-widest uppercase focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim() || isConnecting}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs font-['Fredoka'] transition-transform active:scale-95 disabled:opacity-40"
                >
                  JOIN
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
