import React, { useState, useCallback } from 'react';
import { GameSnapshot, GhostAbilityType, TouchLayoutSettings } from '../game/types';
import { Camera, Volume2, VolumeX, Pause, Settings, Wind, Droplets, Tornado, ChevronLeft, ChevronRight, Ghost, Sparkles, Sliders, Smartphone } from 'lucide-react';
import { CameraViewMode } from '../render/GameRenderer3D';
import { triggerFullscreen } from '../utils/fullscreen';
import { VirtualJoypad } from './VirtualJoypad';
import { triggerHaptic } from '../game/haptics';
import { MODIFIER_INFO } from '../game/modifiers';

interface GameHUDProps {
  snapshot: GameSnapshot;
  soundEnabled: boolean;
  cameraMode: CameraViewMode;
  touchLayout: TouchLayoutSettings;
  onToggleSound: () => void;
  onPause: () => void;
  onOpenSettings: () => void;
  onOpenLayoutEditor?: () => void;
  onCameraModeChange: (mode: CameraViewMode) => void;
  onGhostAbilitySelect: (type: GhostAbilityType) => void;
  selectedGhostAbility: GhostAbilityType | null;
  onVirtualInput: (
    action: 'forward' | 'backward' | 'left' | 'right' | 'jump' | 'punch' | 'dodge',
    isPressed: boolean
  ) => void;
  onAnalogInput?: (analogX: number, analogY: number) => void;
  myPlayerId?: number;
}

export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  if (isMobileUA) return true;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const isMobileScreen = window.innerWidth <= 1024;
  return Boolean(hasTouch && isMobileScreen);
};

export const GameHUD: React.FC<GameHUDProps> = ({
  snapshot,
  soundEnabled,
  cameraMode,
  touchLayout,
  onToggleSound,
  onPause,
  onOpenSettings,
  onOpenLayoutEditor,
  onCameraModeChange,
  onGhostAbilitySelect,
  selectedGhostAbility,
  onVirtualInput,
  onAnalogInput,
  myPlayerId = 1,
}) => {
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() => isTouchDevice());
  const [isMischiefOpen, setIsMischiefOpen] = useState<boolean>(false);
  const [isRosterCollapsed, setIsRosterCollapsed] = useState<boolean>(false);

  const me = snapshot.players.find((p) => p.id === myPlayerId) || snapshot.players.find((p) => p.isHuman);
  const isGhost = me?.isGhost ?? false;

  // Format MM:SS timer
  const minutes = Math.floor(snapshot.timeRemaining / 60);
  const seconds = snapshot.timeRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const isMayhem = snapshot.phase === 'MAYHEM';
  const isOvertime = snapshot.phase === 'OVERTIME';

  const dpadOnLeft = touchLayout.position !== 'LEFT_HANDED';

  const handleJoypadMove = useCallback(
    (ax: number, ay: number) => {
      if (onAnalogInput) {
        onAnalogInput(ax, ay);
      } else {
        onVirtualInput('left', ax < -0.25);
        onVirtualInput('right', ax > 0.25);
        onVirtualInput('forward', ay > 0.25);
        onVirtualInput('backward', ay < -0.25);
      }
    },
    [onAnalogInput, onVirtualInput]
  );

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 select-none overflow-hidden">
      {/* =========================================================================
          TOP BAR (Compact Header)
         ========================================================================= */}
      <div className="flex items-center justify-between w-full gap-2 shrink-0 z-20">
        {/* Left utility buttons */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={onPause}
            className="p-1.5 md:p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
            title="Pause Match"
          >
            <Pause className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button
            onClick={onToggleSound}
            className="p-1.5 md:p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
            title="Toggle Audio"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            )}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 md:p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-amber-300 hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
            title="Customise Keybinds & Touch Layout"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Center: Match Countdown Timer & Mode Badge */}
        <div className="flex flex-col items-center pointer-events-auto">
          <div
            className={`px-3 md:px-5 py-1 rounded-2xl border shadow-xl flex items-center gap-2 md:gap-3 backdrop-blur-md transition-all ${
              isMayhem || isOvertime
                ? 'bg-red-950/90 border-red-500 shadow-red-900/40 animate-pulse'
                : 'bg-slate-900/90 border-slate-700'
            }`}
          >
            <span
              className={`text-[10px] md:text-xs font-black uppercase tracking-wider font-['Fredoka'] ${
                isOvertime
                  ? 'text-yellow-400'
                  : isMayhem
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}
            >
              {isOvertime ? 'OVERTIME' : isMayhem ? 'MAYHEM' : 'NORMAL'}
            </span>

            <span className="font-mono text-xl md:text-2xl font-black text-white tabular-nums tracking-wider">
              {timeFormatted}
            </span>
          </div>

          <div className="text-[10px] font-bold text-slate-300 mt-0.5 drop-shadow">
            {snapshot.livingCount} of {snapshot.players.length} Alive
            {isOvertime && (
              <span className="ml-1 text-red-400 font-mono">
                [Safe: {Math.round(snapshot.safeRadius)}m]
              </span>
            )}
          </div>
        </div>

        {/* Right utility buttons: Camera Mode & Touch Toggle */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => {
              const modes: CameraViewMode[] = ['THIRD_PERSON', 'CINEMATIC', 'ISOMETRIC'];
              const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
              onCameraModeChange(modes[nextIdx]);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-amber-300 hover:bg-slate-800 shadow-lg active:scale-95"
            title="Cycle 3D Camera Perspective"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[10px] md:text-xs uppercase hidden sm:inline">
              {cameraMode === 'THIRD_PERSON' ? '3rd Person' : cameraMode === 'CINEMATIC' ? 'Arena Cam' : 'Iso 3D'}
            </span>
          </button>

          {isTouchDevice() && (
            <>
              <button
                onClick={() => setShowTouchControls(!showTouchControls)}
                className="px-2 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-[10px] md:text-xs font-semibold text-slate-300 hover:bg-slate-800 shadow-lg"
              >
                {showTouchControls ? 'Touch: ON' : 'Touch: OFF'}
              </button>

              {onOpenLayoutEditor && (
                <button
                  onClick={onOpenLayoutEditor}
                  className="p-1.5 md:p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-amber-300 hover:bg-slate-800 shadow-lg active:scale-95"
                  title="Touch Layout Editor & Preview"
                >
                  <Smartphone className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          ANNOUNCER POPUP MESSAGES
         ========================================================================= */}
      <div className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-30 max-w-[90vw]">
        {snapshot.messages.map((msg) => (
          <div
            key={msg.id}
            className="px-4 md:px-6 py-2 rounded-2xl bg-slate-950/95 border-2 shadow-2xl text-center transform transition-all animate-bounce"
            style={{ borderColor: msg.color }}
          >
            <div
              className="text-base md:text-xl font-black font-['Fredoka'] tracking-wide"
              style={{ color: msg.color }}
            >
              {msg.text}
            </div>
            {msg.subtitle && (
              <div className="text-[11px] md:text-xs font-bold text-slate-300 mt-0.5">
                {msg.subtitle}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* =========================================================================
          3-2-1 MATCH START COUNTDOWN OVERLAY
         ========================================================================= */}
      {snapshot.countdownTimer > 0 && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none select-none">
          <div className="flex flex-col items-center justify-center animate-pulse drop-shadow-[0_20px_35px_rgba(0,0,0,0.9)]">
            <div
              className="text-8xl sm:text-9xl md:text-[13rem] font-black font-['Fredoka'] tracking-tighter leading-none"
              style={{
                color:
                  snapshot.countdownTimer > 2.0
                    ? '#38bdf8'
                    : snapshot.countdownTimer > 1.0
                    ? '#facc15'
                    : '#ef4444',
                textShadow:
                  '0 0 40px rgba(0,0,0,0.9), 0 0 25px currentColor, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000',
              }}
            >
              {snapshot.countdownTimer > 2.0
                ? '3'
                : snapshot.countdownTimer > 1.0
                ? '2'
                : '1'}
            </div>
            <div className="mt-2 px-6 py-1.5 rounded-full bg-slate-950/85 border-2 border-amber-400 text-amber-300 font-['Fredoka'] font-black text-sm sm:text-base md:text-xl tracking-widest uppercase shadow-2xl backdrop-blur-md">
              GET READY TO BONK!
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RIGHT SIDEBAR: LIVE COMBAT KILLFEED
         ========================================================================= */}
      <div className="absolute top-22 md:top-26 right-2 md:right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-none max-w-[240px] sm:max-w-[320px]">
        {snapshot.killfeed && snapshot.killfeed.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-xl text-[11px] sm:text-xs font-semibold text-white transition-all animate-in slide-in-from-right-4 fade-in duration-200"
          >
            {entry.attackerName ? (
              <div className="flex items-center gap-1 truncate">
                <span
                  className="font-bold font-['Fredoka'] truncate max-w-[70px] sm:max-w-[95px]"
                  style={{ color: entry.attackerColor || '#facc15' }}
                >
                  {entry.attackerName}
                </span>

                <span className="text-xs shrink-0 drop-shadow">
                  {entry.action === 'GIGA_BONK' ? '💥' : entry.action === 'OVERLOAD' ? '⚡' : '🥊'}
                </span>

                <span
                  className="font-bold font-['Fredoka'] truncate max-w-[70px] sm:max-w-[95px]"
                  style={{ color: entry.victimColor || '#ef4444' }}
                >
                  {entry.victimName}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 truncate">
                <span
                  className="font-bold font-['Fredoka'] truncate max-w-[85px] sm:max-w-[110px]"
                  style={{ color: entry.victimColor || '#ef4444' }}
                >
                  {entry.victimName}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-300 shrink-0">
                  {entry.action === 'ZONE' ? '⚡ Ring Shock' : '🌊 Ring Out'}
                </span>
              </div>
            )}

            {entry.isElimination ? (
              <span className="ml-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-600/90 text-white shadow-sm shrink-0 font-mono">
                💀 KO
              </span>
            ) : (
              <span className="ml-1 text-[9px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-1 rounded shrink-0 font-mono">
                -1❤️
              </span>
            )}
          </div>
        ))}
      </div>

      {/* =========================================================================
          LEFT SIDEBAR: COMPACT PLAYER DASHBOARD (Lowered to clear top controls)
         ========================================================================= */}
      <div className="absolute top-22 md:top-26 left-2 md:left-4 z-20 flex flex-col items-start gap-1 pointer-events-auto">
        <button
          onClick={() => setIsRosterCollapsed(!isRosterCollapsed)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white backdrop-blur-md"
        >
          {isRosterCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          <span>{isRosterCollapsed ? 'ROSTER' : 'HIDE'}</span>
        </button>

        {!isRosterCollapsed && (
          <div className="flex flex-col gap-1 max-h-[55vh] md:max-h-[65vh] overflow-y-auto pr-1">
            {snapshot.players.map((p) => {
              const isDead = p.isEliminated || p.lives === 0;
              const isOverload = p.tokens >= 5;
              const isLocalMe = p.id === (me?.id ?? 1);

              return (
                <div
                  key={p.id}
                  className={`px-2.5 py-1 rounded-xl border flex items-center gap-2 backdrop-blur-md shadow-md transition-all ${
                    isDead
                      ? 'bg-slate-950/40 border-slate-900/60 opacity-60'
                      : isLocalMe
                      ? 'bg-slate-900/90 border-amber-400/90 ring-1 ring-amber-400/30'
                      : 'bg-slate-950/70 border-slate-800/80'
                  }`}
                >
                  {/* Player Dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-inner"
                    style={{ backgroundColor: p.color }}
                  />

                  {/* Info Column */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-black text-white leading-tight font-['Fredoka'] max-w-[85px] truncate">
                        {p.name}
                      </span>
                      {isLocalMe && (
                        <span className="text-[9px] font-bold text-amber-400">(YOU)</span>
                      )}
                    </div>

                    {/* Lives & Tokens */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-red-400 font-mono tracking-tighter">
                        {'❤️'.repeat(Math.max(0, p.lives))}
                        {p.lives === 0 && '💀'}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          isOverload ? 'text-red-400 font-black animate-pulse' : 'text-yellow-400'
                        }`}
                      >
                        🪙 {p.tokens}
                      </span>
                    </div>
                  </div>

                  {/* Active Modifier icon/pill */}
                  {p.hasGigaBonk && (
                    <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white animate-pulse">
                      GIGA
                    </span>
                  )}
                  {p.punchModifier && !p.hasGigaBonk && (
                    <span className="ml-auto text-[9px] font-bold px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      BONK+
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          GHOST MISCHIEF: FLOATING BUTTON + COLLAPSIBLE DRAWER
         ========================================================================= */}
      {isGhost && (
        <div className="absolute top-16 right-2 md:right-4 z-30 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Floating Mischief Button with Cooldown */}
          <button
            onClick={() => setIsMischiefOpen(!isMischiefOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 shadow-2xl backdrop-blur-md transition-all active:scale-95 ${
              isMischiefOpen
                ? 'bg-purple-600 border-purple-300 text-white'
                : me && me.ghostCooldown > 0
                ? 'bg-slate-900/90 border-slate-700 text-slate-300'
                : 'bg-purple-950/90 border-purple-400 text-purple-200 animate-pulse'
            }`}
          >
            <Ghost className="w-4 h-4 text-purple-300" />
            <span className="text-xs font-black font-['Fredoka']">
              {me && me.ghostCooldown > 0
                ? `MISCHIEF (${Math.ceil(me.ghostCooldown)}s)`
                : '👻 MISCHIEF READY!'}
            </span>
          </button>

          {/* Collapsible Mischief Drawer */}
          {isMischiefOpen && (
            <div className="bg-slate-900/95 border-2 border-purple-500/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md w-72 text-center space-y-2 animate-in slide-in-from-right">
              <div className="text-[11px] font-bold text-purple-300 pb-1 border-b border-purple-500/30">
                Spectator Sabotage Tricks
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    onGhostAbilitySelect('GUST_FAN');
                    setIsMischiefOpen(false);
                  }}
                  disabled={me && me.ghostCooldown > 0}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    selectedGhostAbility === 'GUST_FAN'
                      ? 'bg-sky-600/40 border-sky-400 text-sky-200 scale-105'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750 disabled:opacity-40'
                  }`}
                >
                  <Wind className="w-4 h-4 text-sky-400" />
                  <span className="text-[10px] font-bold">GUST FAN</span>
                  <span className="text-[8px] text-slate-400">Push edge</span>
                </button>

                <button
                  onClick={() => {
                    onGhostAbilitySelect('JELLY_PATCH');
                    setIsMischiefOpen(false);
                  }}
                  disabled={me && me.ghostCooldown > 0}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    selectedGhostAbility === 'JELLY_PATCH'
                      ? 'bg-pink-600/40 border-pink-400 text-pink-200 scale-105'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750 disabled:opacity-40'
                  }`}
                >
                  <Droplets className="w-4 h-4 text-pink-400" />
                  <span className="text-[10px] font-bold">JELLY</span>
                  <span className="text-[8px] text-slate-400">Slippery</span>
                </button>

                <button
                  onClick={() => {
                    onGhostAbilitySelect('TOKEN_TORNADO');
                    setIsMischiefOpen(false);
                  }}
                  disabled={me && me.ghostCooldown > 0}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    selectedGhostAbility === 'TOKEN_TORNADO'
                      ? 'bg-amber-600/40 border-amber-400 text-amber-200 scale-105'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750 disabled:opacity-40'
                  }`}
                >
                  <Tornado className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-bold">TORNADO</span>
                  <span className="text-[8px] text-slate-400">Swirl tokens</span>
                </button>
              </div>

              <p className="text-[9px] text-slate-300 leading-tight">
                Select trick, then tap anywhere in the 3D stadium to place it!
              </p>
              <div className="text-[9px] text-amber-300 font-bold bg-amber-950/60 border border-amber-500/30 rounded-lg py-1 px-2">
                ⚡ Right-Click ground to cast instantly!
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          LOCAL PLAYER ACTIVE POWERUP NOTIFICATIONS / BADGES
         ========================================================================= */}
      {me && (me.hasGigaBonk || me.punchModifier || me.tokenModifier) && (
        <div className="absolute bottom-28 md:bottom-12 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center gap-1.5 animate-in slide-in-from-bottom-2 duration-200 max-w-[90vw]">
          {me.hasGigaBonk && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-red-950/90 border-2 border-red-500 shadow-2xl backdrop-blur-md animate-pulse">
              <span className="text-xl">💥</span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-white font-['Fredoka']">GIGA BONK READY</span>
                <span className="text-[10px] text-red-300 font-medium leading-tight">Charge up punch for massive stadium shockwave!</span>
              </div>
            </div>
          )}
          {me.punchModifier && MODIFIER_INFO[me.punchModifier] && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-950/90 border border-amber-400/80 shadow-2xl backdrop-blur-md">
              <span className="text-lg">{MODIFIER_INFO[me.punchModifier].icon}</span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-amber-200 font-['Fredoka']">{MODIFIER_INFO[me.punchModifier].title}</span>
                <span className="text-[10px] text-amber-300/90 font-medium leading-tight">{MODIFIER_INFO[me.punchModifier].desc}</span>
              </div>
            </div>
          )}
          {me.tokenModifier && MODIFIER_INFO[me.tokenModifier] && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-cyan-950/90 border border-cyan-400/80 shadow-2xl backdrop-blur-md">
              <span className="text-lg">{MODIFIER_INFO[me.tokenModifier].icon}</span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-cyan-200 font-['Fredoka']">{MODIFIER_INFO[me.tokenModifier].title}</span>
                <span className="text-[10px] text-cyan-300/90 font-medium leading-tight">{MODIFIER_INFO[me.tokenModifier].desc}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          BOTTOM SECTION: TOUCH D-PAD & ACTION BUTTONS
         ========================================================================= */}
      {showTouchControls && (
        <>
          {touchLayout.position === 'CUSTOM' && touchLayout.joypadPos && touchLayout.actionButtonsPos ? (
            <>
              {/* Custom Positioned Virtual Joypad */}
              <div
                style={{
                  left: `${touchLayout.joypadPos.xPercent}%`,
                  top: `${touchLayout.joypadPos.yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-auto z-20"
              >
                <VirtualJoypad
                  onMove={handleJoypadMove}
                  scale={touchLayout.scale}
                  opacity={touchLayout.opacity}
                />
              </div>

              {/* Custom Positioned Action Buttons */}
              <div
                style={{
                  left: `${touchLayout.actionButtonsPos.xPercent}%`,
                  top: `${touchLayout.actionButtonsPos.yPercent}%`,
                  transform: `translate(-50%, -50%) scale(${touchLayout.scale})`,
                  opacity: touchLayout.opacity,
                }}
                className="absolute pointer-events-auto z-20 flex items-end gap-1.5 sm:gap-2 md:gap-2.5"
              >
                {/* JUMP / ASCEND */}
                <button
                  onPointerDown={() => {
                    triggerFullscreen();
                    triggerHaptic('tap');
                    onVirtualInput('jump', true);
                  }}
                  onPointerUp={() => onVirtualInput('jump', false)}
                  onPointerCancel={() => onVirtualInput('jump', false)}
                  className="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full bg-slate-900/85 border-2 border-sky-500 text-sky-300 active:bg-sky-500 active:text-slate-950 font-black text-[11px] md:text-xs font-['Fredoka'] flex flex-col items-center justify-center shadow-xl active:scale-95 touch-none"
                >
                  <span>JUMP</span>
                </button>

                {/* DODGE */}
                <button
                  onPointerDown={() => {
                    triggerFullscreen();
                    triggerHaptic('tap');
                    onVirtualInput('dodge', true);
                  }}
                  onPointerUp={() => onVirtualInput('dodge', false)}
                  onPointerCancel={() => onVirtualInput('dodge', false)}
                  className="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full bg-slate-900/85 border-2 border-emerald-500 text-emerald-300 active:bg-emerald-500 active:text-slate-950 font-black text-[11px] md:text-xs font-['Fredoka'] flex flex-col items-center justify-center shadow-xl active:scale-95 touch-none"
                >
                  <span>DODGE</span>
                </button>

                {/* PUNCH / BONK */}
                <button
                  onPointerDown={() => {
                    triggerFullscreen();
                    triggerHaptic('hit');
                    onVirtualInput('punch', true);
                  }}
                  onPointerUp={() => onVirtualInput('punch', false)}
                  onPointerCancel={() => onVirtualInput('punch', false)}
                  className="w-15 h-15 sm:w-16 sm:h-16 md:w-17 md:h-17 rounded-full bg-gradient-to-tr from-amber-600 to-red-500 border-2 border-yellow-300 text-white font-black text-xs md:text-sm font-['Fredoka'] tracking-wider flex flex-col items-center justify-center shadow-2xl active:scale-95 ring-2 ring-amber-500/40 touch-none"
                >
                  <span className="text-base sm:text-lg md:text-xl">🥊</span>
                  <span>BONK!</span>
                </button>
              </div>
            </>
          ) : (
            <div
              className="flex items-end justify-between w-full pointer-events-none pb-2 md:pb-3 px-1 md:px-2 z-20 shrink-0"
              style={{ opacity: touchLayout.opacity }}
            >
              {/* Virtual Joypad (Left or Right depending on handedness) */}
              <div
                className={`pointer-events-auto ${dpadOnLeft ? 'order-1' : 'order-2'}`}
              >
                <VirtualJoypad
                  onMove={handleJoypadMove}
                  scale={touchLayout.scale}
                  opacity={touchLayout.opacity}
                />
              </div>

              {/* Action Buttons (Punch, Dodge, Jump) */}
              <div
                className={`pointer-events-auto flex items-end gap-1.5 sm:gap-2 md:gap-2.5 ${
                  dpadOnLeft ? 'order-2' : 'order-1'
                }`}
                style={{
                  transform: `scale(${touchLayout.scale})`,
                  transformOrigin: dpadOnLeft ? 'bottom right' : 'bottom left',
                }}
              >
                {/* JUMP / ASCEND */}
                <button
                  onPointerDown={() => {
                    triggerFullscreen();
                    triggerHaptic('tap');
                    onVirtualInput('jump', true);
                  }}
                  onPointerUp={() => onVirtualInput('jump', false)}
                  onPointerCancel={() => onVirtualInput('jump', false)}
                  className="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full bg-slate-900/85 border-2 border-sky-500 text-sky-300 active:bg-sky-500 active:text-slate-950 font-black text-[11px] md:text-xs font-['Fredoka'] flex flex-col items-center justify-center shadow-xl active:scale-95 touch-none"
                >
                  <span>JUMP</span>
                </button>

                {/* DODGE */}
                <button
                  onPointerDown={() => {
                    triggerFullscreen();
                    triggerHaptic('tap');
                    onVirtualInput('dodge', true);
                  }}
                  onPointerUp={() => onVirtualInput('dodge', false)}
                  onPointerCancel={() => onVirtualInput('dodge', false)}
                  className="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full bg-slate-900/85 border-2 border-emerald-500 text-emerald-300 active:bg-emerald-500 active:text-slate-950 font-black text-[11px] md:text-xs font-['Fredoka'] flex flex-col items-center justify-center shadow-xl active:scale-95 touch-none"
                >
                  <span>DODGE</span>
                </button>

                {/* PUNCH / BONK */}
                <button
                  onPointerDown={() => {
                    triggerFullscreen();
                    triggerHaptic('hit');
                    onVirtualInput('punch', true);
                  }}
                  onPointerUp={() => onVirtualInput('punch', false)}
                  onPointerCancel={() => onVirtualInput('punch', false)}
                  className="w-15 h-15 sm:w-16 sm:h-16 md:w-17 md:h-17 rounded-full bg-gradient-to-tr from-amber-600 to-red-500 border-2 border-yellow-300 text-white font-black text-xs md:text-sm font-['Fredoka'] tracking-wider flex flex-col items-center justify-center shadow-2xl active:scale-95 ring-2 ring-amber-500/40 touch-none"
                >
                  <span className="text-base sm:text-lg md:text-xl">🥊</span>
                  <span>BONK!</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
