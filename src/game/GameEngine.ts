import {
  ARENA_SURFACE_Y,
  INITIAL_LIVES,
  PLATFORM_RADIUS,
  ComicParticle,
  GameSnapshot,
  GhostAbilityType,
  MatchSettings,
  PlayerInputPacket,
  PlayerState,
} from './types';
import { updatePlayerPhysics } from './physics';
import { checkPunchCollisions, startDodge, startPunch } from './combat';
import { TokenSystem } from './tokens';
import { ModifierSystem } from './modifiers';
import { GhostSabotageSystem } from './ghostAbilities';
import { BotAI } from './bots';
import { MatchFlowManager } from './matchFlow';
import { sound } from './audio';
import { triggerHaptic } from './haptics';

const PLAYER_COLORS = [
  { color: '#ef4444', accent: '#fca5a5', glove: '#b91c1c' }, // 1: Red
  { color: '#3b82f6', accent: '#93c5fd', glove: '#1d4ed8' }, // 2: Blue
  { color: '#10b981', accent: '#6ee7b7', glove: '#047857' }, // 3: Green
  { color: '#f59e0b', accent: '#fde68a', glove: '#d97706' }, // 4: Yellow/Orange
  { color: '#8b5cf6', accent: '#c4b5fd', glove: '#6d28d9' }, // 5: Purple
  { color: '#ec4899', accent: '#fbcfe8', glove: '#be185d' }, // 6: Pink
  { color: '#06b6d4', accent: '#a5f3fc', glove: '#0e7490' }, // 7: Cyan
];

const BOT_NAMES = ['BASH BOT', 'CRUSH CADET', 'BONK BARRY', 'SLUGGER SAM', 'PUNCHY PETE', 'WHAM WILLY'];

export class GameEngine {
  public settings: MatchSettings;
  public players: PlayerState[] = [];
  public tokenSystem = new TokenSystem();
  public modifierSystem = new ModifierSystem();
  public ghostSystem = new GhostSabotageSystem();
  public botAI = new BotAI();
  public matchFlow = new MatchFlowManager();

  public particles: ComicParticle[] = [];
  private nextParticleId: number = 1;

  public screenShake: number = 0;
  public screenFlash: number = 0;

  public isPaused: boolean = false;
  private animFrameId: number | null = null;
  private serverIntervalId: NodeJS.Timeout | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDt: number = 1 / 60;

  public currentFps: number = 60;
  private fpsFrames: number = 0;
  private fpsTimer: number = 0;

  // Singleplayer default human input
  public humanInput: PlayerInputPacket = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    punch: false,
    dodge: false,
    cameraYaw: 0,
  };

  // Multiplayer inputs mapped by playerId (1..7)
  public playerInputs: Map<number, PlayerInputPacket> = new Map();

  private snapshotCallback?: (snap: GameSnapshot) => void;
  private snapshotTimer: number = 0;

  constructor(settings: MatchSettings, humanNames: string[] = ['PLAYER 1 (YOU)']) {
    this.settings = settings;
    sound.setEnabled(settings.soundEnabled);
    this.initMatch(humanNames);
  }

  public setSnapshotCallback(cb: (snap: GameSnapshot) => void) {
    this.snapshotCallback = cb;
  }

  public initMatch(humanNames: string[] = ['PLAYER 1 (YOU)']) {
    this.tokenSystem.reset();
    this.modifierSystem.reset();
    this.ghostSystem.reset();
    this.botAI.reset();
    this.matchFlow.reset();
    this.particles = [];
    this.screenShake = 0;
    this.screenFlash = 0;
    this.playerInputs.clear();

    const count = Math.max(2, Math.min(7, this.settings.totalPlayers));
    this.players = [];

    // Spawn everyone symmetrically on the perimeter/edge of the platform facing inward
    const spawnRadius = PLATFORM_RADIUS * 0.72; // ~20.16m on 28m platform

    for (let i = 0; i < count; i++) {
      const isHuman = i < humanNames.length;
      const palette = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const startX = Math.cos(angle) * spawnRadius;
      const startZ = Math.sin(angle) * spawnRadius;

      const playerName = isHuman
        ? humanNames[i]
        : BOT_NAMES[i - humanNames.length] || `BOT ${i + 1}`;

      const player: PlayerState = {
        id: i + 1,
        name: playerName,
        isHuman,
        color: palette.color,
        accentColor: palette.accent,
        gloveColor: palette.glove,

        // 3D Position
        x: startX,
        y: ARENA_SURFACE_Y,
        z: startZ,
        vx: 0,
        vy: 0,
        vz: 0,
        rotationY: Math.atan2(-startX, -startZ),
        facing: 1,

        width: 1.8,
        height: 2.8,
        radius: 1.0,
        isGrounded: true,

        tokens: 1,
        lives: INITIAL_LIVES,
        isEliminated: false,
        isGhost: false,

        punchCooldown: 0,
        punchTimer: 0,
        punchHitRegistered: false,
        isOverloadPunch: false,
        dodgeCooldown: 0,
        dodgeTimer: 0,
        isInvulnerable: false,
        invulnerableTimer: 0,
        perfectDodgeWindow: false,
        stunTimer: 0,
        respawnTimer: 0,

        zeroTokenTime: 0,
        hasUsedScrapPack: false,

        punchModifier: null,
        tokenModifier: null,
        tokenModifierTimer: 0,
        doubleValueCharges: 0,

        hasGigaBonk: false,
        isChargingGigaBonk: false,
        gigaBonkChargeTimer: 0,

        squashX: 1,
        squashY: 1,
        hitReactionTimer: 0,
        trailTimer: 0,

        ghostCooldown: 0,
        selectedGhostAbility: null,

        stats: {
          knockouts: 0,
          ringOuts: 0,
          punchesLanded: 0,
          tokensTransferred: 0,
          tokensCollected: 0,
          perfectDodges: 0,
          ghostAbilitiesUsed: 0,
        },
      };

      this.players.push(player);
    }
  }

  public setPlayerInput(playerId: number, input: PlayerInputPacket) {
    this.playerInputs.set(playerId, input);
  }

  public start() {
    this.stop();
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.isPaused = false;
    if (typeof requestAnimationFrame !== 'undefined') {
      this.loop(this.lastTime);
    }
  }

  public startServerLoop(tickRate: number = 30) {
    this.stop();
    this.isPaused = false;
    const intervalMs = Math.round(1000 / tickRate);
    const dt = intervalMs / 1000;
    this.serverIntervalId = setInterval(() => {
      this.step(dt);
    }, intervalMs);
  }

  public stop() {
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.serverIntervalId !== null) {
      clearInterval(this.serverIntervalId);
      this.serverIntervalId = null;
    }
  }

  public step(dt: number) {
    if (!this.isPaused) {
      this.fixedUpdate(dt);
    }
    this.emitSnapshot();
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (!paused) {
      this.lastTime = performance.now();
    }
  }

  public triggerHumanPunch(playerId: number = 1) {
    const p = this.players.find((player) => player.id === playerId);
    if (p) startPunch(p);
  }

  public triggerHumanDodge(playerId: number = 1) {
    const p = this.players.find((player) => player.id === playerId);
    if (p) startDodge(p);
  }

  public triggerHumanGhostAbility(type: GhostAbilityType, targetX: number, targetZ: number, playerId: number = 1) {
    const p = this.players.find((player) => player.id === playerId);
    if (p) {
      const placed = this.ghostSystem.placeAbility(p, type, targetX, targetZ);
      if (placed) {
        triggerHaptic('mischief');
        const label = type === 'GUST_FAN' ? 'GUST FAN!' : type === 'JELLY_PATCH' ? 'JELLY TRAP!' : 'TORNADO!';
        this.addComicParticle(targetX, 2, targetZ, label, '#c084fc', 1.3);
      }
    }
  }

  public addComicParticle(
    x: number,
    y: number,
    z: number,
    text: string,
    color: string = '#facc15',
    scale: number = 1.0
  ) {
    this.particles.push({
      id: this.nextParticleId++,
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 4,
      vy: 8 + Math.random() * 4,
      vz: (Math.random() - 0.5) * 4,
      alpha: 1.0,
      size: 16 * scale,
      color,
      life: 0.8,
      maxLife: 0.8,
      type: 'TEXT',
      text,
      scale,
    });
  }

  public addSparks(x: number, y: number, z: number, color: string = '#fef08a', count: number = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        id: this.nextParticleId++,
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vy: 3 + Math.random() * 6,
        vz: Math.sin(angle) * speed,
        alpha: 1.0,
        size: 0.4 + Math.random() * 0.4,
        color,
        life: 0.4,
        maxLife: 0.4,
        type: 'SPARK',
      });
    }
  }

  private triggerGigaBlast(user: PlayerState) {
    sound.playGigaBonkBlast();
    this.screenShake = 22;
    this.screenFlash = 0.85;

    this.addComicParticle(0, 10, 0, 'GIGA BONK!!!', '#ef4444', 2.4);
    this.matchFlow.addMessage('GIGA BONK DETONATION!', 'Massive Arena Shockwave!', '#ef4444', 3.0);

    for (const p of this.players) {
      if (p.isEliminated || p.isGhost || p.respawnTimer > 0) continue;

      if (p.isInvulnerable && p.dodgeTimer > 0) {
        this.addComicParticle(p.x, p.y + 2, p.z, 'BLAST DODGED!', '#38bdf8', 1.2);
      } else {
        const isPuncher = p.id === user.id;
        // Puncher knockback decreased 75% (so 25% remaining)
        const dx = p.x - user.x;
        const dz = p.z - user.z;
        const dist = Math.hypot(dx, dz) || 1;
        // Devastating outward horizontal blast force (50-58 m/s) with variation
        const gigaForce = isPuncher ? 9 : (50 + Math.random() * 8);
        p.vx = (dx / dist) * gigaForce;
        p.vz = (dz / dist) * gigaForce;
        p.vy = isPuncher ? 3 : 12; // Controlled launch arc: sharp outward trajectory
        p.stunTimer = isPuncher ? 0.12 : 0.65;
        p.hitReactionTimer = isPuncher ? 0.2 : 0.6; // Disables air control recovery while launched

        if (!isPuncher) {
          p.lastAttackerId = user.id;
          p.lastHitTimer = 4.0;
          p.lastHitType = 'GIGA_BONK';
        }
      }

      if (p.tokens > 0) {
        this.tokenSystem.scatterTokens(p.x, p.y, p.z, p.tokens, p.id, 1.4);
        p.tokens = 0;
      }
    }
  }

  private fixedUpdate(dt: number) {
    if (this.matchFlow.phase === 'FINISHED') {
      return;
    }

    const isMayhem = this.matchFlow.phase === 'MAYHEM';
    const isOvertime = this.matchFlow.phase === 'OVERTIME';
    const isCountdown = this.matchFlow.countdownTimer > 0;

    // 1. Process All Players (Humans & Bots)
    for (const player of this.players) {
      if (player.isHuman) {
        const input = this.playerInputs.get(player.id) || (player.id === 1 ? this.humanInput : null);
        let moveX = 0;
        let moveZ = 0;
        let jumpInput = false;

        if (input) {
          // Combine discrete keyboard and analog inputs additively
          let rawX = 0;
          let rawZ = 0;

          if (input.left) rawX -= 1;
          if (input.right) rawX += 1;
          if (input.forward) rawZ += 1;
          if (input.backward) rawZ -= 1;

          if (input.analogX !== undefined && input.analogX !== 0) {
            rawX += input.analogX;
          }
          if (input.analogY !== undefined && input.analogY !== 0) {
            rawZ += input.analogY;
          }

          rawX = Math.max(-1, Math.min(1, rawX));
          rawZ = Math.max(-1, Math.min(1, rawZ));

          // Screen-relative movement calculation:
          const yaw = input.cameraYaw || 0;

          if (!isCountdown) {
            moveX = -rawX * Math.cos(yaw) + rawZ * Math.sin(yaw);
            moveZ = rawX * Math.sin(yaw) + rawZ * Math.cos(yaw);
            jumpInput = input.jump;
          }
          input.jump = false;

          if (!isCountdown && input.punch && !player.isEliminated && !player.isGhost && player.respawnTimer <= 0) {
            if (rawX === 0 && rawZ === 0 && input.cameraYaw !== undefined) {
              player.rotationY = input.cameraYaw;
            }
            startPunch(player);
            input.punch = false;
          }
          if (!isCountdown && input.dodge && !player.isEliminated && !player.isGhost && player.respawnTimer <= 0) {
            startDodge(player);
            input.dodge = false;
          }
        }

        const isRingOut = updatePlayerPhysics(
          player,
          dt,
          moveX,
          moveZ,
          jumpInput,
          this.ghostSystem.activeZones,
          this.matchFlow.safeRadius
        );
        if (isRingOut) {
          this.matchFlow.handleRingOut(player, this.tokenSystem, this.modifierSystem, this.players);
          this.screenShake = Math.max(this.screenShake, player.lives <= 0 ? 28 : 16);
          this.screenFlash = player.lives <= 0 ? 0.6 : 0.3;
          triggerHaptic(player.lives <= 0 ? 'knockout' : 'ringout');
        }
      } else {
        // CPU Bot (frozen during 3-2-1 countdown)
        const decision = isCountdown
          ? { moveInputX: 0, moveInputZ: 0, jump: false, punch: false, dodge: false }
          : this.botAI.updateBot(
              player,
              this.settings.cpuDifficulty,
              dt,
              this.players,
              this.tokenSystem.looseTokens,
              this.modifierSystem.pickups,
              this.ghostSystem.activeZones,
              this.matchFlow.safeRadius,
              (b, type, x, z) => this.ghostSystem.placeAbility(b, type, x, z)
            );

        const isRingOut = updatePlayerPhysics(
          player,
          dt,
          decision.moveInputX,
          decision.moveInputZ,
          decision.jump,
          this.ghostSystem.activeZones,
          this.matchFlow.safeRadius
        );
        if (isRingOut) {
          this.matchFlow.handleRingOut(player, this.tokenSystem, this.modifierSystem, this.players);
          this.screenShake = Math.max(this.screenShake, player.lives <= 0 ? 28 : 16);
          this.screenFlash = player.lives <= 0 ? 0.6 : 0.3;
          triggerHaptic(player.lives <= 0 ? 'knockout' : 'ringout');
        }
      }
    }

    // 2. Combat Checks
    for (const player of this.players) {
      if (player.punchCooldown > 0) player.punchCooldown -= dt;
      if (player.dodgeCooldown > 0) player.dodgeCooldown -= dt;

      if (player.punchTimer > 0) {
        player.punchTimer -= dt;

        const hits = checkPunchCollisions(player, this.players, (x, y, z, text) => {
          this.addComicParticle(x, y, z, text || 'BONK!', '#fde047', 1.2);
          this.addSparks(x, y, z, '#fde047', 6);
          this.screenShake = Math.max(this.screenShake, 6);
        });

        for (const hit of hits) {
          const target = this.players.find((p) => p.id === hit.hitTargetId);
          if (player.isHuman || target?.isHuman) {
            triggerHaptic(hit.isOverload ? 'overload' : 'hit');
          }

          if (hit.isOverload) {
            this.screenShake = 16;
            this.screenFlash = 0.4;
            if (hit.tokensToScatterAttacker > 0) {
              this.tokenSystem.scatterTokens(player.x, player.y, player.z, hit.tokensToScatterAttacker, player.id, 1.2);
            }
            if (target && hit.tokensToScatterTarget > 0) {
              this.tokenSystem.scatterTokens(target.x, target.y, target.z, hit.tokensToScatterTarget, target.id, 1.2);
            }
          } else if (hit.isTokenBomb) {
            if (target && hit.tokensToScatterTarget > 0) {
              this.tokenSystem.scatterTokens(target.x, target.y, target.z, hit.tokensToScatterTarget, target.id, 0.9);
            }
          } else if (hit.targetDroppedLooseToken) {
            if (target) {
              this.tokenSystem.scatterTokens(target.x, target.y, target.z, 1, player.id, 0.6);
            }
          }
        }
      }
    }

    // 3. Update Token System
    this.tokenSystem.update(
      dt,
      isMayhem,
      isOvertime,
      this.players,
      this.ghostSystem.activeZones,
      (x, y, z) => this.addSparks(x, y, z, '#facc15', 5)
    );

    // 4. Update Modifiers
    this.modifierSystem.update(
      dt,
      isMayhem,
      isOvertime,
      this.players,
      this.tokenSystem,
      (x, y, z, text) => this.addComicParticle(x, y, z, text, '#a855f7', 1.1),
      (user) => this.triggerGigaBlast(user),
      (player, title, desc, icon) => {
        if (player.isHuman) {
          this.matchFlow.addMessage(`${icon} ${title.toUpperCase()}`, desc, '#38bdf8', 3.0);
          triggerHaptic('powerup');
        }
      }
    );

    // 5. Update Ghost Sabotage
    this.ghostSystem.update(dt, this.players);

    // 6. Update Match Flow
    this.matchFlow.update(
      dt,
      this.players,
      this.tokenSystem,
      this.modifierSystem
    );

    // 7. Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.z !== undefined && p.vz !== undefined) p.z += p.vz * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.screenShake > 0) {
      this.screenShake *= Math.pow(0.82, dt * 60);
      if (this.screenShake < 0.2) this.screenShake = 0;
    }
    if (this.screenFlash > 0) {
      this.screenFlash -= dt * 2.5;
      if (this.screenFlash < 0) this.screenFlash = 0;
    }
  }

  private loop = (currentTime: number) => {
    const elapsed = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    this.fpsFrames++;
    this.fpsTimer += elapsed;
    if (this.fpsTimer >= 1.0) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    if (!this.isPaused) {
      this.accumulator += elapsed;
      while (this.accumulator >= this.fixedDt) {
        this.fixedUpdate(this.fixedDt);
        this.accumulator -= this.fixedDt;
      }
    }

    this.snapshotTimer += elapsed;
    if (this.snapshotTimer >= 0.033) {
      this.snapshotTimer = 0;
      this.emitSnapshot();
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private emitSnapshot() {
    if (!this.snapshotCallback) return;

    const living = this.players.filter((p) => !p.isEliminated && !p.isGhost);
    const hasGigaBonk = this.players.some((p) => p.hasGigaBonk || p.isChargingGigaBonk);

    const snapshot: GameSnapshot = {
      phase: this.matchFlow.phase,
      countdownTimer: this.matchFlow.countdownTimer,
      timeRemaining: Math.max(0, Math.ceil(this.matchFlow.timeRemaining)),
      overtimeElapsed: Math.floor(this.matchFlow.overtimeElapsed),
      safeRadius: this.matchFlow.safeRadius,
      players: this.players.map((p) => ({ ...p, stats: { ...p.stats } })),
      looseTokenCount: this.tokenSystem.looseTokens.length,
      livingCount: living.length,
      winner: this.matchFlow.winner ? { ...this.matchFlow.winner } : null,
      isPaused: this.isPaused,
      gigaBonkSpawned: this.modifierSystem.gigaBonkSpawned,
      gigaBonkActive: hasGigaBonk,
      activeEffectsCount: this.ghostSystem.activeZones.length,
      messages: [...this.matchFlow.messages],
      debugFps: this.currentFps,
      looseTokens: this.tokenSystem.looseTokens.map((t) => ({ ...t })),
      pickups: this.modifierSystem.pickups.map((m) => ({ ...m })),
      ghostZones: this.ghostSystem.activeZones.map((z) => ({ ...z })),
      killfeed: [...this.matchFlow.killfeed],
    };

    this.snapshotCallback(snapshot);
  }
}
