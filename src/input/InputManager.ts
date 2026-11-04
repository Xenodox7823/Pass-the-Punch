import { GameEngine } from '../game/GameEngine';
import { KeybindSettings, PlayerInputPacket } from '../game/types';

export class InputManager {
  private engine: GameEngine | null = null;
  public keybinds: KeybindSettings;
  private onTogglePause?: () => void;
  private onToggleDebug?: () => void;
  private onInputChange?: (packet: PlayerInputPacket) => void;
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;
  private mousedownHandler: (e: MouseEvent) => void;
  private mouseupHandler: (e: MouseEvent) => void;

  private keyState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    punch: false,
    dodge: false,
  };

  private virtualState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    punch: false,
    dodge: false,
  };

  private joypadState = {
    x: 0,
    y: 0,
  };

  public currentPacket: PlayerInputPacket = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    punch: false,
    dodge: false,
    cameraYaw: 0,
    analogX: 0,
    analogY: 0,
  };

  constructor(
    engine: GameEngine | null,
    keybinds: KeybindSettings,
    onTogglePause?: () => void,
    onToggleDebug?: () => void,
    onInputChange?: (packet: PlayerInputPacket) => void
  ) {
    this.engine = engine;
    this.keybinds = keybinds;
    this.onTogglePause = onTogglePause;
    this.onToggleDebug = onToggleDebug;
    this.onInputChange = onInputChange;

    this.keydownHandler = (e: KeyboardEvent) => {
      // Prevent browser scrolling with arrow/space keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.key === ' ') {
        e.preventDefault();
      }

      let changed = false;
      const keyLower = e.key ? e.key.toLowerCase() : '';

      if (e.code === this.keybinds.forward || e.code === 'KeyW' || e.code === 'ArrowUp' || keyLower === 'w' || keyLower === 'arrowup') {
        if (!this.keyState.forward) {
          this.keyState.forward = true;
          changed = true;
        }
      }
      if (e.code === this.keybinds.backward || e.code === 'KeyS' || e.code === 'ArrowDown' || keyLower === 's' || keyLower === 'arrowdown') {
        if (!this.keyState.backward) {
          this.keyState.backward = true;
          changed = true;
        }
      }
      if (e.code === this.keybinds.left || e.code === 'KeyA' || e.code === 'ArrowLeft' || keyLower === 'a' || keyLower === 'arrowleft') {
        if (!this.keyState.left) {
          this.keyState.left = true;
          changed = true;
        }
      }
      if (e.code === this.keybinds.right || e.code === 'KeyD' || e.code === 'ArrowRight' || keyLower === 'd' || keyLower === 'arrowright') {
        if (!this.keyState.right) {
          this.keyState.right = true;
          changed = true;
        }
      }
      if (e.code === this.keybinds.jump || e.code === 'Space' || e.key === ' ') {
        if (!this.keyState.jump) {
          this.keyState.jump = true;
          changed = true;
        }
      }
      if (e.code === this.keybinds.punch || e.code === 'KeyJ' || keyLower === 'j') {
        if (!this.keyState.punch) {
          this.keyState.punch = true;
          changed = true;
        }
      }
      if (
        e.code === this.keybinds.dodge ||
        e.code === 'KeyK' ||
        keyLower === 'k' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight' ||
        e.shiftKey
      ) {
        if (!this.keyState.dodge) {
          this.keyState.dodge = true;
          changed = true;
        }
      }

      if (e.code === 'Escape') {
        if (this.onTogglePause) this.onTogglePause();
      }
      if (e.code === 'F1') {
        e.preventDefault();
        if (this.onToggleDebug) this.onToggleDebug();
      }

      if (changed) {
        this.recomputePacket();
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      let changed = false;
      const keyLower = e.key ? e.key.toLowerCase() : '';

      if (e.code === this.keybinds.forward || e.code === 'KeyW' || e.code === 'ArrowUp' || keyLower === 'w' || keyLower === 'arrowup') {
        if (this.keyState.forward) {
          this.keyState.forward = false;
          changed = true;
        }
      }
      if (e.code === this.keybinds.backward || e.code === 'KeyS' || e.code === 'ArrowDown' || keyLower === 's' || keyLower === 'arrowdown') {
        if (this.keyState.backward) {
          this.keyState.backward = false;
          changed = true;
        }
      }
      if (e.code === this.keybinds.left || e.code === 'KeyA' || e.code === 'ArrowLeft' || keyLower === 'a' || keyLower === 'arrowleft') {
        if (this.keyState.left) {
          this.keyState.left = false;
          changed = true;
        }
      }
      if (e.code === this.keybinds.right || e.code === 'KeyD' || e.code === 'ArrowRight' || keyLower === 'd' || keyLower === 'arrowright') {
        if (this.keyState.right) {
          this.keyState.right = false;
          changed = true;
        }
      }
      if (e.code === this.keybinds.jump || e.code === 'Space' || e.key === ' ') {
        if (this.keyState.jump) {
          this.keyState.jump = false;
          changed = true;
        }
      }
      if (e.code === this.keybinds.punch || e.code === 'KeyJ' || keyLower === 'j') {
        if (this.keyState.punch) {
          this.keyState.punch = false;
          changed = true;
        }
      }
      if (e.code === this.keybinds.dodge || e.code === 'KeyK' || keyLower === 'k' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (this.keyState.dodge) {
          this.keyState.dodge = false;
          changed = true;
        }
      }

      if (changed) {
        this.recomputePacket();
      }
    };

    this.mousedownHandler = (e: MouseEvent) => {
      // Don't trigger combat input if clicking on UI interactive controls (modal/settings/pause)
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'INPUT')) {
        return;
      }

      const mouseCode = `Mouse${e.button}`;
      let changed = false;

      if (this.keybinds.punch === mouseCode) {
        if (!this.keyState.punch) {
          this.keyState.punch = true;
          changed = true;
        }
      }
      if (this.keybinds.dodge === mouseCode) {
        if (!this.keyState.dodge) {
          this.keyState.dodge = true;
          changed = true;
        }
      }
      if (this.keybinds.jump === mouseCode) {
        if (!this.keyState.jump) {
          this.keyState.jump = true;
          changed = true;
        }
      }

      if (changed) {
        this.recomputePacket();
      }
    };

    this.mouseupHandler = (e: MouseEvent) => {
      const mouseCode = `Mouse${e.button}`;
      let changed = false;

      if (this.keybinds.punch === mouseCode) {
        if (this.keyState.punch) {
          this.keyState.punch = false;
          changed = true;
        }
      }
      if (this.keybinds.dodge === mouseCode) {
        if (this.keyState.dodge) {
          this.keyState.dodge = false;
          changed = true;
        }
      }
      if (this.keybinds.jump === mouseCode) {
        if (this.keyState.jump) {
          this.keyState.jump = false;
          changed = true;
        }
      }

      if (changed) {
        this.recomputePacket();
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
    window.addEventListener('mousedown', this.mousedownHandler);
    window.addEventListener('mouseup', this.mouseupHandler);
  }

  public updateKeybinds(k: KeybindSettings) {
    this.keybinds = k;
  }

  public setCameraYaw(yaw: number) {
    this.currentPacket.cameraYaw = yaw;
    if (this.engine) {
      this.engine.humanInput.cameraYaw = yaw;
    }
  }

  public setVirtualInput(
    action: 'forward' | 'backward' | 'left' | 'right' | 'jump' | 'punch' | 'dodge',
    isPressed: boolean
  ) {
    this.virtualState[action] = isPressed;
    this.recomputePacket();
  }

  public setAnalogInput(analogX: number, analogY: number) {
    this.joypadState.x = analogX;
    this.joypadState.y = analogY;
    this.recomputePacket();
  }

  private recomputePacket() {
    this.currentPacket.forward = this.keyState.forward || this.virtualState.forward || this.joypadState.y > 0.25;
    this.currentPacket.backward = this.keyState.backward || this.virtualState.backward || this.joypadState.y < -0.25;
    this.currentPacket.left = this.keyState.left || this.virtualState.left || this.joypadState.x < -0.25;
    this.currentPacket.right = this.keyState.right || this.virtualState.right || this.joypadState.x > 0.25;
    this.currentPacket.jump = this.keyState.jump || this.virtualState.jump;
    this.currentPacket.punch = this.keyState.punch || this.virtualState.punch;
    this.currentPacket.dodge = this.keyState.dodge || this.virtualState.dodge;
    this.currentPacket.analogX = this.joypadState.x;
    this.currentPacket.analogY = this.joypadState.y;

    this.syncToEngine();
  }

  private syncToEngine() {
    if (this.engine) {
      Object.assign(this.engine.humanInput, this.currentPacket);
    }
    if (this.onInputChange) {
      this.onInputChange({ ...this.currentPacket });
    }
  }

  public destroy() {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    window.removeEventListener('mousedown', this.mousedownHandler);
    window.removeEventListener('mouseup', this.mouseupHandler);
  }
}
