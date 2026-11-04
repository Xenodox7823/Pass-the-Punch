import {
  ARENA_SURFACE_Y,
  PLATFORM_RADIUS,
  GhostAbilityType,
  GhostZoneEffect,
  PlayerState,
} from './types';
import { sound } from './audio';

export class GhostSabotageSystem {
  public activeZones: GhostZoneEffect[] = [];
  private nextId: number = 500;

  public reset() {
    this.activeZones = [];
    this.nextId = 500;
  }

  public canPlaceAbility(player: PlayerState): boolean {
    if (player.ghostCooldown > 0) return false;
    return true;
  }

  public placeAbility(
    player: PlayerState,
    type: GhostAbilityType,
    targetX: number,
    targetZ: number
  ): boolean {
    if (!this.canPlaceAbility(player)) return false;

    // Clamp within platform radius
    const dist = Math.hypot(targetX, targetZ);
    let clampedX = targetX;
    let clampedZ = targetZ;
    if (dist > PLATFORM_RADIUS - 4) {
      clampedX = (targetX / dist) * (PLATFORM_RADIUS - 4);
      clampedZ = (targetZ / dist) * (PLATFORM_RADIUS - 4);
    }

    let radius = 6.5;
    let duration = 3.6;
    let directionX: number | undefined;
    let directionZ: number | undefined;

    if (type === 'GUST_FAN') {
      radius = 8.0;
      duration = 3.6;
      // Blow outwards or across stadium
      const angle = Math.atan2(clampedZ, clampedX);
      // Blow toward perimeter or angle
      directionX = Math.cos(angle);
      directionZ = Math.sin(angle);
    } else if (type === 'JELLY_PATCH') {
      radius = 7.5;
      duration = 4.5;
    } else if (type === 'TOKEN_TORNADO') {
      radius = 7.0;
      duration = 3.8;
    }

    const zone: GhostZoneEffect = {
      id: this.nextId++,
      type,
      sourcePlayerId: player.id,
      x: clampedX,
      y: ARENA_SURFACE_Y,
      z: clampedZ,
      radius,
      warmupTimer: 0.35,
      duration,
      directionX,
      directionZ,
    };

    // If max active zones reached, discard oldest
    if (this.activeZones.length >= 4) {
      this.activeZones.shift();
    }

    this.activeZones.push(zone);
    player.ghostCooldown = 12.0;
    player.stats.ghostAbilitiesUsed++;
    sound.playGhostAbility();
    return true;
  }

  public update(dt: number, players: PlayerState[]) {
    for (const player of players) {
      if (player.isGhost && player.ghostCooldown > 0) {
        player.ghostCooldown -= dt;
      }
    }

    const surviving: GhostZoneEffect[] = [];
    for (const zone of this.activeZones) {
      if (zone.warmupTimer > 0) {
        zone.warmupTimer -= dt;
      } else {
        zone.duration -= dt;
      }

      if (zone.duration > 0) {
        surviving.push(zone);
      }
    }
    this.activeZones = surviving;
  }
}
