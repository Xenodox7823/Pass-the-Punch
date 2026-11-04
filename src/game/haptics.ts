/**
 * Haptic and Rumble feedback engine
 * Supports Web Vibration API (mobile) and Gamepad Vibration Actuator (PC / Gamepad)
 */

export type HapticType =
  | 'tap'
  | 'hit'
  | 'heavy'
  | 'overload'
  | 'mischief'
  | 'win'
  | 'lose'
  | 'pickup'
  | 'powerup'
  | 'ringout'
  | 'knockout';

export function triggerHaptic(type: HapticType): void {
  // 1. Mobile Web Vibration API
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    try {
      switch (type) {
        case 'tap':
          navigator.vibrate(18);
          break;
        case 'pickup':
          navigator.vibrate([15, 30, 20]);
          break;
        case 'powerup':
          navigator.vibrate([25, 30, 45, 30, 60]);
          break;
        case 'hit':
          navigator.vibrate([40, 25, 55]);
          break;
        case 'heavy':
          navigator.vibrate([70, 30, 110]);
          break;
        case 'ringout':
          navigator.vibrate([80, 35, 120]);
          break;
        case 'knockout':
          navigator.vibrate([120, 50, 180, 50, 260]);
          break;
        case 'overload':
          navigator.vibrate([90, 40, 140, 40, 180]);
          break;
        case 'mischief':
          navigator.vibrate([30, 25, 40]);
          break;
        case 'win':
          navigator.vibrate([80, 40, 80, 40, 240]);
          break;
        case 'lose':
          navigator.vibrate([160, 60, 220]);
          break;
      }
    } catch {
      // Ignore vibration error on unsupported or blocked devices
    }
  }

  // 2. Connected Gamepad Rumble (Dual-rumble actuator)
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.getGamepads) {
    try {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;
        const actuator = (gp as unknown as { vibrationActuator?: { playEffect: (type: string, opts: object) => Promise<unknown> } }).vibrationActuator;
        if (actuator && typeof actuator.playEffect === 'function') {
          let duration = 120;
          let intensity = 0.5;

          if (type === 'tap' || type === 'pickup') {
            duration = 60;
            intensity = 0.25;
          } else if (type === 'hit') {
            duration = 140;
            intensity = 0.65;
          } else if (type === 'heavy') {
            duration = 240;
            intensity = 0.9;
          } else if (type === 'overload') {
            duration = 380;
            intensity = 1.0;
          } else if (type === 'win') {
            duration = 300;
            intensity = 0.8;
          } else if (type === 'lose') {
            duration = 250;
            intensity = 0.85;
          }

          actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration,
            weakMagnitude: intensity * 0.7,
            strongMagnitude: intensity,
          }).catch(() => {});
        }
      }
    } catch {
      // Ignore gamepad rumble errors
    }
  }
}
