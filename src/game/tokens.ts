import {
  ARENA_SURFACE_Y,
  MAX_CARRIED_TOKENS,
  PLATFORM_RADIUS,
  GhostZoneEffect,
  LooseToken,
  PlayerState,
} from './types';
import { distance3D, updateLooseTokenPhysics } from './physics';
import { sound } from './audio';

export class TokenSystem {
  public looseTokens: LooseToken[] = [];
  private nextId: number = 1;
  private spawnTimer: number = 2.0;

  public reset() {
    this.looseTokens = [];
    this.nextId = 1;
    this.spawnTimer = 2.0;
  }

  public getNaturalTokenCount(): number {
    return this.looseTokens.filter((t) => t.isNaturalSpawn).length;
  }

  public spawnNaturalToken(isMayhem: boolean, isOvertime: boolean): LooseToken | null {
    if (isOvertime) return null;

    const maxNatural = isMayhem ? 18 : 12;
    if (this.getNaturalTokenCount() >= maxNatural) return null;

    // Random position within 3D platform
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (PLATFORM_RADIUS - 6);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = 5 + Math.random() * 3;

    const token: LooseToken = {
      id: this.nextId++,
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 3,
      vy: 2,
      vz: (Math.random() - 0.5) * 3,
      radius: 0.6,
      rotationX: Math.random() * Math.PI * 2,
      rotationY: Math.random() * Math.PI * 2,
      rotationZ: Math.random() * Math.PI * 2,
      vRotX: (Math.random() - 0.5) * 6,
      vRotY: (Math.random() - 0.5) * 8,
      vRotZ: (Math.random() - 0.5) * 6,
      isGrounded: false,
      droppedByPlayerId: null,
      pickupCooldown: 0,
      isNaturalSpawn: true,
      value: 1,
      sparkleTimer: 0.8,
    };

    this.looseTokens.push(token);
    return token;
  }

  public scatterTokens(
    x: number,
    y: number,
    z: number,
    count: number,
    droppedByPlayerId: number | null,
    scatterForceMultiplier: number = 1.0
  ) {
    if (count <= 0) return;

    sound.playTokenExplosion();

    for (let i = 0; i < count; i++) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = (9 + Math.random() * 10) * scatterForceMultiplier;
      const upSpeed = (10 + Math.random() * 8) * scatterForceMultiplier;

      const token: LooseToken = {
        id: this.nextId++,
        x: x + Math.cos(angle) * 0.5,
        y: Math.max(1, y) + 0.5,
        z: z + Math.sin(angle) * 0.5,
        vx: Math.cos(angle) * speed,
        vy: upSpeed,
        vz: Math.sin(angle) * speed,
        radius: 0.6,
        rotationX: Math.random() * Math.PI * 2,
        rotationY: Math.random() * Math.PI * 2,
        rotationZ: Math.random() * Math.PI * 2,
        vRotX: (Math.random() - 0.5) * 12,
        vRotY: (Math.random() - 0.5) * 14,
        vRotZ: (Math.random() - 0.5) * 12,
        isGrounded: false,
        droppedByPlayerId,
        pickupCooldown: 0.65,
        isNaturalSpawn: false,
        value: 1,
        sparkleTimer: 0.5,
      };

      this.looseTokens.push(token);
    }
  }

  public update(
    dt: number,
    isMayhem: boolean,
    isOvertime: boolean,
    players: PlayerState[],
    ghostZones: GhostZoneEffect[],
    createSparkle: (x: number, y: number, z: number) => void
  ) {
    if (!isOvertime) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const spawned = this.spawnNaturalToken(isMayhem, isOvertime);
        if (spawned) {
          createSparkle(spawned.x, spawned.y, spawned.z);
        }
        this.spawnTimer = isMayhem
          ? 1.0 + Math.random() * 0.8
          : 2.2 + Math.random() * 1.2;
      }
    }

    // Token magnet attraction in 3D
    for (const player of players) {
      if (
        player.isEliminated ||
        player.isGhost ||
        player.respawnTimer > 0 ||
        player.tokenModifier !== 'TOKEN_MAGNET'
      ) {
        continue;
      }

      for (const token of this.looseTokens) {
        const d = distance3D(token.x, token.y, token.z, player.x, player.y, player.z);
        if (d < 12 && d > 0.5) {
          const pull = 24;
          token.vx += ((player.x - token.x) / d) * pull * dt;
          token.vy += ((player.y - token.y) / d) * pull * dt;
          token.vz += ((player.z - token.z) / d) * pull * dt;
        }
      }
    }

    // Update token physics
    for (const token of this.looseTokens) {
      updateLooseTokenPhysics(token, dt, ghostZones);
      if (token.sparkleTimer > 0) token.sparkleTimer -= dt;
    }

    // Collection
    const surviving: LooseToken[] = [];
    for (const token of this.looseTokens) {
      let collected = false;

      // Filter out tokens that fell completely below platform into the void
      if (token.y < -25) {
        continue;
      }

      // Find all eligible players within radius who have inventory space
      const candidates: { player: PlayerState; distance: number }[] = [];

      for (const player of players) {
        if (player.isEliminated || player.isGhost || player.respawnTimer > 0) continue;
        if (token.droppedByPlayerId === player.id && token.pickupCooldown > 0) continue;
        if (player.tokens >= MAX_CARRIED_TOKENS) continue;

        // Generous pickup radius: 3.2m default, 5.6m with Sticky Fingers
        const basePickupDist = 3.2;
        const pickupDist = player.tokenModifier === 'STICKY_FINGERS' ? basePickupDist * 1.75 : basePickupDist;

        const d = distance3D(player.x, player.y + 0.8, player.z, token.x, token.y, token.z);
        if (d <= pickupDist) {
          candidates.push({ player, distance: d });
        }
      }

      // Closest player within radius gets priority!
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.distance - b.distance);
        const bestPlayer = candidates[0].player;

        let valueToAdd = token.value;
        if (bestPlayer.tokenModifier === 'DOUBLE_VALUE' && bestPlayer.doubleValueCharges > 0) {
          valueToAdd *= 2;
          bestPlayer.doubleValueCharges--;
          if (bestPlayer.doubleValueCharges <= 0) bestPlayer.tokenModifier = null;
        }

        const spaceLeft = MAX_CARRIED_TOKENS - bestPlayer.tokens;
        const actualAdded = Math.min(spaceLeft, valueToAdd);
        bestPlayer.tokens += actualAdded;
        bestPlayer.stats.tokensCollected += actualAdded;

        sound.playTokenPickup();
        bestPlayer.squashX = 0.85;
        bestPlayer.squashY = 1.18;
        createSparkle(token.x, token.y, token.z);

        collected = true;
      }

      if (!collected) {
        surviving.push(token);
      }
    }

    this.looseTokens = surviving;
  }
}
