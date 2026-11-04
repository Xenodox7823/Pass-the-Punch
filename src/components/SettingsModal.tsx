import React, { useState, useEffect } from 'react';
import { KeybindSettings, TouchLayoutSettings } from '../game/types';
import { X, Keyboard, Smartphone, Volume2, RotateCcw, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keybinds: KeybindSettings;
  onUpdateKeybinds: (k: KeybindSettings) => void;
  touchLayout: TouchLayoutSettings;
  onUpdateTouchLayout: (t: TouchLayoutSettings) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenLayoutEditor?: () => void;
}

export const DEFAULT_KEYBINDS: KeybindSettings = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  punch: 'Mouse0', // Left Click by default!
  dodge: 'ShiftLeft',
  secondaryAction: 'Mouse2', // Right Click reserved for upcoming special action
};

export const DEFAULT_TOUCH_LAYOUT: TouchLayoutSettings = {
  scale: 1.0,
  position: 'RIGHT_HANDED',
  opacity: 0.85,
  joypadPos: { xPercent: 15, yPercent: 80 },
  actionButtonsPos: { xPercent: 82, yPercent: 80 },
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  keybinds,
  onUpdateKeybinds,
  touchLayout,
  onUpdateTouchLayout,
  soundEnabled,
  onToggleSound,
  onOpenLayoutEditor,
}) => {
  const [activeTab, setActiveTab] = useState<'KEYBINDS' | 'TOUCH' | 'AUDIO'>('KEYBINDS');
  const [bindingAction, setBindingAction] = useState<keyof KeybindSettings | null>(null);

  useEffect(() => {
    if (!bindingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setBindingAction(null);
        return;
      }

      onUpdateKeybinds({
        ...keybinds,
        [bindingAction]: e.code,
      });
      setBindingAction(null);
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mouseCode = `Mouse${e.button}`;
      onUpdateKeybinds({
        ...keybinds,
        [bindingAction]: mouseCode,
      });
      setBindingAction(null);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [bindingAction, keybinds, onUpdateKeybinds]);

  if (!isOpen) return null;

  const formatKeyName = (code?: string) => {
    if (!code) return 'NONE';
    if (code === 'Mouse0') return 'LEFT CLICK';
    if (code === 'Mouse1') return 'MIDDLE CLICK';
    if (code === 'Mouse2') return 'RIGHT CLICK';
    if (code === 'Mouse3') return 'MOUSE 4';
    if (code === 'Mouse4') return 'MOUSE 5';
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    if (code === 'Space') return 'SPACE';
    if (code === 'ShiftLeft') return 'LEFT SHIFT';
    if (code === 'ShiftRight') return 'RIGHT SHIFT';
    if (code.startsWith('Arrow')) return code.replace('Arrow', '↑ ');
    return code;
  };

  const actionLabels: { key: keyof KeybindSettings; label: string; desc: string }[] = [
    { key: 'forward', label: 'Move Forward', desc: 'Walk forward in camera view' },
    { key: 'backward', label: 'Move Backward', desc: 'Walk backward' },
    { key: 'left', label: 'Move Left', desc: 'Strafe left' },
    { key: 'right', label: 'Move Right', desc: 'Strafe right' },
    { key: 'jump', label: 'Jump / Ascend', desc: 'Jump on ground or fly upward as ghost' },
    { key: 'punch', label: 'Punch / Bonk', desc: 'Pass token or attack (Default: Left Click)' },
    { key: 'dodge', label: 'Dodge / Dash', desc: 'Evade incoming strikes with i-frames' },
    { key: 'secondaryAction', label: 'Special / Secondary', desc: 'Right click (Reserved for upcoming action)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <h2 className="text-lg font-black text-white font-['Fredoka'] tracking-wide">
                CONTROLS & SETTINGS
              </h2>
              <p className="text-[11px] text-slate-400">Customise layout for PC and mobile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2">
          <button
            onClick={() => setActiveTab('KEYBINDS')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'KEYBINDS'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            PC KEYBINDS
          </button>
          <button
            onClick={() => setActiveTab('TOUCH')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'TOUCH'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            TOUCH CONTROLS
          </button>
          <button
            onClick={() => setActiveTab('AUDIO')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'AUDIO'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            SOUND
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'KEYBINDS' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                <span className="text-slate-400">Click a key slot to rebind:</span>
                <button
                  onClick={() => onUpdateKeybinds({ ...DEFAULT_KEYBINDS })}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
              </div>

              {actionLabels.map(({ key, label, desc }) => {
                const isBinding = bindingAction === key;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{label}</div>
                      <div className="text-[10px] text-slate-400">{desc}</div>
                    </div>

                    <button
                      onClick={() => setBindingAction(isBinding ? null : key)}
                      className={`min-w-[85px] px-3 py-1.5 rounded-xl border font-mono text-xs font-black transition-all ${
                        isBinding
                          ? 'bg-amber-500 border-amber-300 text-slate-950 animate-pulse'
                          : 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800 hover:border-amber-400'
                      }`}
                    >
                      {isBinding ? 'Press Key...' : formatKeyName(keybinds[key])}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'TOUCH' && (
            <div className="space-y-5">
              {/* Handedness / Layout Preset */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  Handedness / Button Positions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onUpdateTouchLayout({ ...touchLayout, position: 'RIGHT_HANDED' })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      touchLayout.position === 'RIGHT_HANDED'
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">Right-Handed (Default)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">D-pad on Left, Punch on Right</div>
                  </button>

                  <button
                    onClick={() => onUpdateTouchLayout({ ...touchLayout, position: 'LEFT_HANDED' })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      touchLayout.position === 'LEFT_HANDED'
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">Left-Handed</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Punch on Left, D-pad on Right</div>
                  </button>
                </div>
              </div>

              {/* Touch Button Scale */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                  <span>Button Size</span>
                  <span className="text-amber-400 font-mono">{Math.round(touchLayout.scale * 100)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Compact', val: 0.85 },
                    { label: 'Standard', val: 1.0 },
                    { label: 'Large', val: 1.2 },
                  ].map(({ label, val }) => (
                    <button
                      key={label}
                      onClick={() => onUpdateTouchLayout({ ...touchLayout, scale: val })}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        Math.abs(touchLayout.scale - val) < 0.05
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                  <span>Touch Overlay Opacity</span>
                  <span className="text-amber-400 font-mono">{Math.round(touchLayout.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={touchLayout.opacity}
                  onChange={(e) =>
                    onUpdateTouchLayout({ ...touchLayout, opacity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Custom Drag Layout Preview Editor Button */}
              {onOpenLayoutEditor && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onOpenLayoutEditor();
                      onClose();
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 text-white font-black text-xs md:text-sm font-['Fredoka'] tracking-wide shadow-xl hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 border border-yellow-300"
                  >
                    <span>🎮</span>
                    <span>OPEN INTERACTIVE TOUCH LAYOUT PREVIEW</span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    Drag and place Joypad & buttons freely on screen to fit your phone or tablet grip!
                  </p>
                </div>
              )}

              {/* Camera Panning Tip */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                <span className="text-amber-400 text-base">💡</span>
                <span>
                  <strong>Camera & Aiming:</strong> On laptop, move your mouse naturally to pan the 3D camera. On mobile, swipe the middle screen area!
                </span>
              </div>
            </div>
          )}

          {activeTab === 'AUDIO' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700">
                <div>
                  <div className="text-xs font-bold text-white">Sound Effects & Synth Audio</div>
                  <div className="text-[10px] text-slate-400">Punch bonks, crowd cheering, and announcer lines</div>
                </div>
                <button
                  onClick={onToggleSound}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                    soundEnabled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {soundEnabled ? 'ENABLED' : 'MUTED'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs font-['Fredoka'] tracking-wider shadow-lg transition-transform active:scale-95"
          >
            <Check className="w-4 h-4" />
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
