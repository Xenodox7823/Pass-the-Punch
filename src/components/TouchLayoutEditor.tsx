import React, { useState, useRef } from 'react';
import { TouchLayoutSettings } from '../game/types';
import { VirtualJoypad } from './VirtualJoypad';
import { Move, Check, RotateCcw, X, Smartphone, Sliders } from 'lucide-react';
import { triggerHaptic } from '../game/haptics';

interface TouchLayoutEditorProps {
  isOpen: boolean;
  onClose: () => void;
  layout: TouchLayoutSettings;
  onSaveLayout: (newLayout: TouchLayoutSettings) => void;
}

export const TouchLayoutEditor: React.FC<TouchLayoutEditorProps> = ({
  isOpen,
  onClose,
  layout,
  onSaveLayout,
}) => {
  // Default positions: Joypad on bottom-left (12% X, 80% Y), Actions on bottom-right (84% X, 80% Y)
  const [joypadPos, setJoypadPos] = useState<{ xPercent: number; yPercent: number }>(
    layout.joypadPos || {
      xPercent: layout.position === 'LEFT_HANDED' ? 84 : 15,
      yPercent: 80,
    }
  );

  const [actionsPos, setActionsPos] = useState<{ xPercent: number; yPercent: number }>(
    layout.actionButtonsPos || {
      xPercent: layout.position === 'LEFT_HANDED' ? 15 : 82,
      yPercent: 80,
    }
  );

  const [scale, setScale] = useState<number>(layout.scale || 1.0);
  const [opacity, setOpacity] = useState<number>(layout.opacity || 0.85);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Active drag tracking
  const draggingItemRef = useRef<'JOYPAD' | 'ACTIONS' | null>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  if (!isOpen) return null;

  const startDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    item: 'JOYPAD' | 'ACTIONS',
    currentPos: { xPercent: number; yPercent: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;

    triggerHaptic('tap');
    draggingItemRef.current = item;

    const rect = containerRef.current.getBoundingClientRect();
    const itemPxX = (currentPos.xPercent / 100) * rect.width;
    const itemPxY = (currentPos.yPercent / 100) * rect.height;

    dragOffsetRef.current = {
      offsetX: e.clientX - itemPxX,
      offsetY: e.clientY - itemPxY,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingItemRef.current || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - dragOffsetRef.current.offsetX;
    const rawY = e.clientY - dragOffsetRef.current.offsetY;

    // Clamp between 8% and 92% to avoid clipping edges
    const xPercent = Math.max(8, Math.min(92, (rawX / rect.width) * 100));
    const yPercent = Math.max(15, Math.min(90, (rawY / rect.height) * 100));

    if (draggingItemRef.current === 'JOYPAD') {
      setJoypadPos({ xPercent, yPercent });
    } else if (draggingItemRef.current === 'ACTIONS') {
      setActionsPos({ xPercent, yPercent });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingItemRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    draggingItemRef.current = null;
    triggerHaptic('tap');
  };

  const handleResetDefaults = () => {
    triggerHaptic('tap');
    setJoypadPos({ xPercent: 15, yPercent: 80 });
    setActionsPos({ xPercent: 82, yPercent: 80 });
    setScale(1.0);
    setOpacity(0.85);
  };

  const handleApply = () => {
    triggerHaptic('win');
    onSaveLayout({
      scale,
      opacity,
      position: 'CUSTOM',
      joypadPos,
      actionButtonsPos: actionsPos,
    });
    onClose();
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="fixed inset-0 z-50 select-none bg-slate-950/90 backdrop-blur-xl flex flex-col justify-between overflow-hidden touch-none"
    >
      {/* Top Floating Control Bar */}
      <div className="w-full bg-slate-900/90 border-b border-slate-700/80 px-3 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xl z-30">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/20 border border-amber-400 rounded-xl text-amber-300">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-black text-white font-['Fredoka'] flex items-center gap-1.5">
              <span>TOUCH CONTROLS PREVIEW & LAYOUT</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                DRAG TO POSITION
              </span>
            </h2>
            <p className="text-[10px] md:text-xs text-slate-400">
              Hold and drag the handles to place controls anywhere on screen
            </p>
          </div>
        </div>

        {/* Sliders and Action Buttons */}
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          {/* Scale Slider */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300 font-bold">Size:</span>
            <input
              type="range"
              min="0.75"
              max="1.3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-16 md:w-24 accent-amber-500 cursor-pointer"
            />
            <span className="text-amber-400 font-mono text-[11px] w-8">
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700 text-xs hidden sm:flex">
            <span className="text-slate-300 font-bold">Opacity:</span>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-16 md:w-20 accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Reset Defaults */}
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-bold transition-all"
            title="Reset to default layout"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Reset</span>
          </button>

          {/* Save & Apply */}
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs shadow-lg hover:from-emerald-500 hover:to-teal-400 active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Save & Apply</span>
          </button>

          {/* Close without save */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Arena Mock Grid Backdrop */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
        <div className="w-[85vmin] h-[85vmin] rounded-full border-2 border-dashed border-amber-400/40 flex items-center justify-center">
          <div className="w-[50vmin] h-[50vmin] rounded-full border border-sky-400/30 flex items-center justify-center">
            <span className="font-['Fredoka'] font-black text-slate-600 tracking-widest text-sm md:text-base">
              STADIUM ARENA PREVIEW
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          1. DRAGGABLE VIRTUAL JOYPAD WIDGET
         ===================================================================== */}
      <div
        style={{
          left: `${joypadPos.xPercent}%`,
          top: `${joypadPos.yPercent}%`,
          transform: 'translate(-50%, -50%)',
        }}
        className="absolute z-20 flex flex-col items-center select-none"
      >
        {/* Drag Handle Badge */}
        <div
          onPointerDown={(e) => startDrag(e, 'JOYPAD', joypadPos)}
          className="px-2.5 py-1 mb-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] md:text-xs flex items-center gap-1 shadow-lg cursor-grab active:cursor-grabbing border border-yellow-200 active:scale-105 transition-transform"
        >
          <Move className="w-3 h-3" />
          <span>DRAG JOYPAD</span>
        </div>

        {/* Virtual Joypad Preview */}
        <div
          onPointerDown={(e) => startDrag(e, 'JOYPAD', joypadPos)}
          className="cursor-grab active:cursor-grabbing"
        >
          <VirtualJoypad onMove={() => {}} scale={scale} opacity={opacity} />
        </div>
      </div>

      {/* =====================================================================
          2. DRAGGABLE ACTION BUTTONS CLUSTER (PUNCH, DODGE, JUMP)
         ===================================================================== */}
      <div
        style={{
          left: `${actionsPos.xPercent}%`,
          top: `${actionsPos.yPercent}%`,
          transform: 'translate(-50%, -50%)',
        }}
        className="absolute z-20 flex flex-col items-center select-none"
      >
        {/* Drag Handle Badge */}
        <div
          onPointerDown={(e) => startDrag(e, 'ACTIONS', actionsPos)}
          className="px-2.5 py-1 mb-1.5 rounded-full bg-sky-500 text-slate-950 font-black text-[10px] md:text-xs flex items-center gap-1 shadow-lg cursor-grab active:cursor-grabbing border border-sky-200 active:scale-105 transition-transform"
        >
          <Move className="w-3 h-3" />
          <span>DRAG ACTIONS</span>
        </div>

        {/* Action Buttons Mock Layout */}
        <div
          onPointerDown={(e) => startDrag(e, 'ACTIONS', actionsPos)}
          style={{
            transform: `scale(${scale})`,
            opacity,
          }}
          className="cursor-grab active:cursor-grabbing flex items-end gap-2 p-1.5 rounded-3xl bg-slate-900/40 border border-slate-700/50 backdrop-blur-sm"
        >
          {/* JUMP */}
          <div className="w-13 h-13 rounded-full bg-slate-900/90 border-2 border-sky-500 text-sky-300 font-black text-xs font-['Fredoka'] flex flex-col items-center justify-center shadow-xl">
            <span>JUMP</span>
          </div>

          {/* DODGE */}
          <div className="w-13 h-13 rounded-full bg-slate-900/90 border-2 border-emerald-500 text-emerald-300 font-black text-xs font-['Fredoka'] flex flex-col items-center justify-center shadow-xl">
            <span>DODGE</span>
          </div>

          {/* PUNCH */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-red-500 border-2 border-yellow-300 text-white font-black text-xs font-['Fredoka'] tracking-wider flex flex-col items-center justify-center shadow-2xl ring-2 ring-amber-500/40">
            <span className="text-xl">🥊</span>
            <span>BONK!</span>
          </div>
        </div>
      </div>

      {/* Bottom Guidance Bar */}
      <div className="w-full py-2 bg-slate-950/80 border-t border-slate-800 text-center text-[11px] text-slate-400 z-30">
        Touch and reposition buttons to match your grip in portrait or landscape mode.
      </div>
    </div>
  );
};
