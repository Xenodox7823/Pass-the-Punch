import React, { useRef, useState, useCallback, useEffect } from 'react';
import { triggerHaptic } from '../game/haptics';

interface VirtualJoypadProps {
  onMove: (analogX: number, analogY: number) => void;
  scale?: number;
  opacity?: number;
}

export const VirtualJoypad: React.FC<VirtualJoypadProps> = ({
  onMove,
  scale = 1.0,
  opacity = 0.85,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState<boolean>(false);
  const touchIdRef = useRef<number | null>(null);
  const baseRadius = 55; // Maximum stick radius in px

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (touchIdRef.current !== null) return;
    touchIdRef.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setIsActive(true);
    triggerHaptic('tap');
    updateKnob(e.clientX, e.clientY);
  };

  const updateKnob = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const dist = Math.hypot(rawDx, rawDy);

      let clampedX = rawDx;
      let clampedY = rawDy;

      if (dist > baseRadius) {
        clampedX = (rawDx / dist) * baseRadius;
        clampedY = (rawDy / dist) * baseRadius;
      }

      setKnobPos({ x: clampedX, y: clampedY });

      // Deadzone threshold (12%)
      const deadzone = 0.12;
      const normDist = dist / baseRadius;

      if (normDist < deadzone) {
        onMove(0, 0);
      } else {
        // analogX: -1 (left) to +1 (right)
        // analogY: -1 (backward/down) to +1 (forward/up)
        const analogX = Math.max(-1, Math.min(1, clampedX / baseRadius));
        const analogY = Math.max(-1, Math.min(1, -clampedY / baseRadius));
        onMove(analogX, analogY);
      }
    },
    [onMove]
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateKnob(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    touchIdRef.current = null;
    setIsActive(false);
    setKnobPos({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    return () => {
      onMoveRef.current(0, 0);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: `${128 * scale}px`,
        height: `${128 * scale}px`,
        opacity,
      }}
      className="relative rounded-full select-none touch-none cursor-pointer transition-opacity"
    >
      {/* Outer Joypad Ring */}
      <div
        className={`relative w-full h-full rounded-full border-2 backdrop-blur-md transition-colors shadow-2xl overflow-visible ${
          isActive
            ? 'bg-slate-900/80 border-amber-400 shadow-amber-500/30'
            : 'bg-slate-950/70 border-slate-700/80 shadow-black/60'
        }`}
      >
        {/* Subtle Cardinal Directions Crosshairs */}
        <div className="absolute w-[2px] h-3 bg-amber-400/40 top-1 left-1/2 -translate-x-1/2 rounded-full pointer-events-none" />
        <div className="absolute w-[2px] h-3 bg-amber-400/40 bottom-1 left-1/2 -translate-x-1/2 rounded-full pointer-events-none" />
        <div className="absolute h-[2px] w-3 bg-amber-400/40 left-1 top-1/2 -translate-y-1/2 rounded-full pointer-events-none" />
        <div className="absolute h-[2px] w-3 bg-amber-400/40 right-1 top-1/2 -translate-y-1/2 rounded-full pointer-events-none" />

        {/* Inner concentric guideline ring - perfectly centered */}
        <div className="absolute inset-0 m-auto w-16 h-16 rounded-full border border-dashed border-slate-600/50 pointer-events-none" />

        {/* Dynamic Draggable Thumbstick Knob - perfectly centered at rest */}
        <div
          style={{
            transform: `translate(calc(-50% + ${knobPos.x * scale}px), calc(-50% + ${knobPos.y * scale}px))`,
            transition: isActive ? 'none' : 'transform 0.16s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          className={`absolute left-1/2 top-1/2 w-14 h-14 rounded-full border-2 shadow-xl flex items-center justify-center pointer-events-none select-none ${
            isActive
              ? 'bg-gradient-to-tr from-amber-600 to-yellow-400 border-white text-slate-950 shadow-amber-500/50 scale-105'
              : 'bg-gradient-to-tr from-slate-800 to-slate-700 border-slate-500 text-slate-300'
          }`}
        >
          {/* Thumb grip groove */}
          <div className="w-7 h-7 rounded-full bg-black/20 border border-white/20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
};
