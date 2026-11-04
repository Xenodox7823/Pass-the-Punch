import {
  ARENA_SURFACE_Y,
  MATCH_DURATION,
  MAYHEM_START_TIME,
  PLATFORM_RADIUS,
  AnnouncerMessage,
  KillfeedEntry,
  MatchPhase,
  PlayerState,
} from './types';
import { sound } from './audio';
import { ModifierSystem } from './modifiers';
import { TokenSystem } from './tokens';

export class MatchFlowManager {
  public phase: MatchPhase = 'NORMAL';
  public timeRemaining: number = MATCH_DURATION;
  public overtimeElapsed: number = 0;
  public safeRadius: number = PLATFORM_RADIUS;
  public winner: PlayerState | null = null;
  public gigaBonkSpawnedInMayhem: boolean = false;
  public messages: AnnouncerMessage[] = [];
  public killfeed: KillfeedEntry[] = [];
  public countdownTimer: number = 3.5; // 3-2-1 countdown before match starts
  private nextMsgId: number = 1;
  private nextKillfeedId: number = 1;

  public reset() {
    this.phase = 'NORMAL';
    this.countdownTimer = 3.5;
    this.timeRemaining = MATCH_DURATION;
    this.overtimeElapsed = 0;
    this.safeRadius = PLATFORM_RADIUS;
    this.winner = null;
    this.gigaBonkSpawnedInMayhem = false;
    this.messages = [];
    this.killfeed = [];
  }

  public addKillfeed(entry: KillfeedEntry) {
    this.killfeed.unshift(entry);
    if (this.killfeed.length > 5) {
      this.killfeed.pop();
    }
  }

  public addMessage(text: string, subtitle?: string, color: string = '#f59e0b', duration: number = 2.5) {
    this.messages.push({
      id: this.nextMsgId++,
      text,
      subtitle,
      color,
      duration,
      scale: 1.0,
    });
  }

  public getLivingPlayers(players: PlayerState[]): PlayerState[] {
    return players.filter((p) => !p.isEliminated && !p.isGhost);
  }

  public update(
    dt: number,
    players: PlayerState[],
    tokenSystem: TokenSystem,
    modifierSystem: ModifierSystem
  ): MatchPhase {
    for (const msg of this.messages) {
      msg.duration -= dt;
    }
    this.messages = this.messages.filter((m) => m.duration > 0);

    // Tick down lastHitTimer on players
    for (const p of players) {
      if (p.lastHitTimer && p.lastHitTimer > 0) {
        p.lastHitTimer -= dt;
      }
    }

    // Expire killfeed entries older than 4.5 seconds
    const now = Date.now();
    this.killfeed = this.killfeed.filter((entry) => now - entry.timestamp < 4500);

    // If match is finished, do not advance combat/timers!
    if (this.phase === 'FINISHED') {
      return this.phase;
    }

    // 0. Initial 3-2-1 Match Countdown
    if (this.timeRemaining < MATCH_DURATION) {
      this.countdownTimer = 0;
    }

    if (this.countdownTimer > 0) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.countdownTimer = 0;
        this.addMessage('BONK!', 'Battle Begins!', '#facc15', 1.5);
      }
    }

    // 1. Normal / Mayhem Timer Countdown
    if (this.countdownTimer <= 0 && this.phase !== 'OVERTIME') {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        const living = this.getLivingPlayers(players);
        if (living.length === 1) {
          this.declareWinner(living[0]);
          return this.phase;
        } else if (living.length > 1) {
          this.phase = 'OVERTIME';
          this.overtimeElapsed = 0;
          this.safeRadius = PLATFORM_RADIUS;
          this.addMessage('SUDDEN DEATH OVERTIME!', 'Electric Ring is Shrinking!', '#ef4444', 3.5);
          sound.playMayhemAnnouncement();
          for (const p of living) {
            p.lives = 1;
          }
        } else {
          this.resolveTieBreak(players);
        }
      }
    } else {
      // OVERTIME PROGRESSION: Shrink the electric safe perimeter!
      this.overtimeElapsed += dt;
      // Shrink safe radius from 28 down to 6.0 over 30s
      this.safeRadius = Math.max(6, PLATFORM_RADIUS - this.overtimeElapsed * 0.75);

      const living = this.getLivingPlayers(players);
      // Punish players standing outside the electric safe boundary
      for (const p of living) {
        const dist = Math.hypot(p.x, p.z);
        if (dist > this.safeRadius) {
          p.hitReactionTimer = 0.2;
          p.squashX = 1.2;
          p.squashY = 0.8;
          // After 28 seconds of overtime, force ring-out on whoever is further out
          if (this.overtimeElapsed > 28 && living.length > 1) {
            const furthest = [...living].sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z))[0];
            this.handleRingOut(furthest, tokenSystem, modifierSystem);
            break;
          }
        }
      }
    }

    // 2. Mayhem Mode Transition (at 30 seconds left)
    if (this.phase === 'NORMAL' && this.timeRemaining <= MAYHEM_START_TIME) {
      this.phase = 'MAYHEM';
      this.addMessage('MAYHEM MODE!', '1 LIFE EACH · RESPAWNS DISABLED!', '#ef4444', 3.5);
      sound.playMayhemAnnouncement();

      for (const p of players) {
        if (!p.isEliminated && !p.isGhost) {
          p.lives = 1;
        }
      }
    }

    // 3. Giga Bonk spawn in Mayhem
    if (
      this.phase === 'MAYHEM' &&
      !this.gigaBonkSpawnedInMayhem &&
      this.timeRemaining <= MAYHEM_START_TIME - 2.0
    ) {
      this.gigaBonkSpawnedInMayhem = true;
      modifierSystem.spawnGigaBonk();
      this.addMessage('GIGA BONK SPAWNED!', 'Claim the ultimate punch!', '#f59e0b', 3.0);
    }

    // 4. Update underdog zero-token timers
    if (this.phase === 'NORMAL') {
      this.checkUnderdogs(dt, players, modifierSystem);
    }

    // 5. Update respawning players
    for (const player of players) {
      if (player.respawnTimer > 0) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          this.respawnPlayer(player);
        }
      }
    }

    // 6. Check win condition
    const living = this.getLivingPlayers(players);
    if (living.length === 1 && players.length > 1) {
      this.declareWinner(living[0]);
    } else if (living.length === 0 && players.length > 0) {
      this.resolveTieBreak(players);
    }

    return this.phase;
  }

  public handleRingOut(
    player: PlayerState,
    tokenSystem: TokenSystem,
    modifierSystem: ModifierSystem,
    allPlayers?: PlayerState[]
  ) {
    if (player.isEliminated || player.isGhost || player.respawnTimer > 0) {
      return;
    }

    sound.playRingOut();
    player.stats.ringOuts++;

    // Scatter carried tokens on the edge of the platform
    const edgeDist = Math.min(this.safeRadius - 2, PLATFORM_RADIUS - 3);
    const angle = Math.atan2(player.z, player.x);
    const scatterX = Math.cos(angle) * edgeDist;
    const scatterZ = Math.sin(angle) * edgeDist;
    if (player.tokens > 0) {
      tokenSystem.scatterTokens(scatterX, ARENA_SURFACE_Y + 0.5, scatterZ, player.tokens, player.id, 0.9);
      player.tokens = 0;
    }

    if (player.hasGigaBonk || player.isChargingGigaBonk) {
      player.hasGigaBonk = false;
      player.isChargingGigaBonk = false;
      modifierSystem.dropGigaBonkAt(0, 3, 0);
    }

    player.punchModifier = null;
    player.tokenModifier = null;
    player.lives -= 1;

    const canRespawn = this.phase === 'NORMAL' && player.lives > 0;

    // Attribute knockout to recent attacker if hit within last 4 seconds
    let attacker: PlayerState | undefined;
    if (allPlayers && player.lastAttackerId && player.lastHitTimer && player.lastHitTimer > 0) {
      attacker = allPlayers.find((p) => p.id === player.lastAttackerId);
      if (attacker && attacker.id !== player.id) {
        attacker.stats.knockouts++;
      }
    }

    const action = attacker
      ? (player.lastHitType || 'BONK')
      : (this.phase === 'OVERTIME' ? 'ZONE' : 'RING_OUT');

    this.addKillfeed({
      id: this.nextKillfeedId++,
      attackerName: attacker?.name,
      attackerColor: attacker?.color,
      attackerGloveColor: attacker?.gloveColor,
      victimName: player.name,
      victimColor: player.color,
      action,
      isElimination: !canRespawn,
      timestamp: Date.now(),
    });

    // Reset last hit tracking
    player.lastAttackerId = undefined;
    player.lastHitTimer = 0;
    player.lastHitType = undefined;

    if (canRespawn) {
      player.respawnTimer = 1.0;
      player.x = 0;
      player.y = -100;
      player.z = 0;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      this.addMessage(`${player.name} RING OUT!`, `${player.lives} lives remaining`, '#f97316', 1.8);
    } else {
      player.lives = 0;
      player.isEliminated = true;
      player.isGhost = true;
      player.respawnTimer = 0;
      player.ghostCooldown = 4.0;
      // Position ghost floating above the arena
      const gAngle = Math.atan2(player.z, player.x);
      player.x = Math.cos(gAngle) * 16;
      player.y = 8;
      player.z = Math.sin(gAngle) * 16;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;

      this.addMessage(
        `${player.name} ELIMINATED!`,
        'Haunting the arena as a ghost...',
        '#ef4444',
        2.2
      );
    }
  }

  private respawnPlayer(player: PlayerState) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 4 + Math.random() * 10;
    player.x = Math.cos(angle) * dist;
    player.y = 6;
    player.z = Math.sin(angle) * dist;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.isGrounded = false;
    player.isInvulnerable = true;
    player.invulnerableTimer = 0.9;
    player.tokens = 1;
    player.squashX = 0.8;
    player.squashY = 1.25;
  }

  private checkUnderdogs(
    dt: number,
    players: PlayerState[],
    modifierSystem: ModifierSystem
  ) {
    const living = this.getLivingPlayers(players);
    if (living.length <= 1) return;

    for (const player of living) {
      if (player.hasUsedScrapPack) continue;

      if (player.tokens === 0) {
        player.zeroTokenTime += dt;
        if (player.zeroTokenTime >= 7.0) {
          let isUnderdog = true;
          for (const other of living) {
            if (other.id === player.id) continue;
            if (other.lives < player.lives) {
              isUnderdog = false;
              break;
            } else if (other.lives === player.lives && other.tokens < player.tokens) {
              isUnderdog = false;
              break;
            }
          }

          if (isUnderdog) {
            const spawned = modifierSystem.spawnScrapPack(player);
            if (spawned) {
              player.hasUsedScrapPack = true;
              this.addMessage(
                'SCRAP PACK DROP!',
                `Emergency tokens for ${player.name}!`,
                '#38bdf8',
                2.5
              );
            }
          }
        }
      } else {
        player.zeroTokenTime = 0;
      }
    }
  }

  private resolveTieBreak(players: PlayerState[]) {
    this.phase = 'OVERTIME';
    this.overtimeElapsed = 0;
    this.safeRadius = PLATFORM_RADIUS;
    this.addMessage('TIE BREAK!', 'Sudden Death Overtime!', '#ef4444', 3.0);
    const sorted = [...players].sort((a, b) => b.stats.punchesLanded - a.stats.punchesLanded);
    const finalists = sorted.slice(0, 2);

    finalists.forEach((p, idx) => {
      p.isEliminated = false;
      p.isGhost = false;
      p.lives = 1;
      p.tokens = 1;
      p.x = idx === 0 ? -10 : 10;
      p.y = 5;
      p.z = 0;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.isInvulnerable = true;
      p.invulnerableTimer = 1.0;
    });
  }

  private declareWinner(winner: PlayerState) {
    this.phase = 'FINISHED';
    this.winner = winner;
    this.addMessage(`${winner.name} WINS!`, 'VICTORY ROYALE!', '#eab308', 999);
    sound.playVictory();
  }
}
