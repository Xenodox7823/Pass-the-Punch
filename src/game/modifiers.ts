import {
  ARENA_SURFACE_Y,
  MAX_CARRIED_TOKENS,
  PLATFORM_RADIUS,
  ModifierPickup,
  PlayerState,
  PunchModifierType,
  TokenModifierType,
} from './types';
import { distance3D } from './physics';
import { sound } from './audio';
import { TokenSystem } from './tokens';

const PUNCH_MODIFIERS: PunchModifierType[] = [
  'ROCKET_KNUCKLES',
  'TRIPLE_BONK',
  'STRETCHY_ARM',
  'THUNDER_BONK',
  'BOOMERANG_BONK',
];

const TOKEN_MODIFIERS: TokenModifierType[] = [
  'TOKEN_MAGNET',
  'POCKET_JACKPOT',
  'TOKEN_BOMB',
  'DOUBLE_VALUE',
  'STICKY_FINGERS',
];

export const MODIFIER_INFO: Record<string, { title: string; desc: string; icon: string }> = {
  ROCKET_KNUCKLES: {
    title: 'Rocket Knuckles',
    desc: '+60% Knockback Launch! Blast enemies off the edge.',
    icon: '🚀',
  },
  TRIPLE_BONK: {
    title: 'Triple Bonk',
    desc: 'Triple strike flurry! Punches 3 rapid hits in an arc.',
    icon: '🥊',
  },
  STRETCHY_ARM: {
    title: 'Stretchy Arm',
    desc: 'Extended Reach! Hit rivals from double distance.',
    icon: '🦾',
  },
  THUNDER_BONK: {
    title: 'Thunder Bonk',
    desc: 'Electric Stun! Shocks rivals and freezes their movement.',
    icon: '⚡',
  },
  BOOMERANG_BONK: {
    title: 'Boomerang Bonk',
    desc: 'Returning fist loops around to strike opponents.',
    icon: '🪃',
  },
  TOKEN_MAGNET: {
    title: 'Token Magnet',
    desc: 'Pulls nearby loose tokens straight into your stash!',
    icon: '🧲',
  },
  POCKET_JACKPOT: {
    title: 'Pocket Jackpot',
    desc: '+3 Instant Tokens loaded into your pockets!',
    icon: '💰',
  },
  DOUBLE_VALUE: {
    title: 'Double Value',
    desc: 'Your next 3 tokens score double value!',
    icon: '✨',
  },
  STICKY_FINGERS: {
    title: 'Sticky Fingers',
    desc: 'Steals extra tokens from enemies on physical hits!',
    icon: '🖐️',
  },
  TOKEN_BOMB: {
    title: 'Token Bomb',
    desc: 'Dropping tokens triggers an explosive concussive blast!',
    icon: '💣',
  },
  GIGA_BONK: {
    title: 'GIGA BONK ULTIMATE',
    desc: 'Charge to blast all stadium rivals with huge outward shockwave!',
    icon: '💥',
  },
  SCRAP_PACK: {
    title: 'Scrap Pack',
    desc: 'Emergency salvage! Claim 2 tokens immediately.',
    icon: '📦',
  },
};

export class ModifierSystem {
  public pickups: ModifierPickup[] = [];
  public gigaBonkSpawned: boolean = false;
  public gigaBonkUsed: boolean = false;
  public activeScrapPackId: number | null = null;
  private nextId: number = 100;
  private spawnTimer: number = 3.5;

  public reset() {
    this.pickups = [];
    this.gigaBonkSpawned = false;
    this.gigaBonkUsed = false;
    this.activeScrapPackId = null;
    this.nextId = 100;
    this.spawnTimer = 3.5;
  }

  public spawnRandomModifier(isMayhem: boolean, isOvertime: boolean): ModifierPickup | null {
    if (isOvertime) return null;

    const maxPickups = isMayhem ? 6 : 4;
    if (this.pickups.length >= maxPickups) return null;

    const isPunch = Math.random() < 0.5;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (PLATFORM_RADIUS - 8);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = 1.2;

    const pickup: ModifierPickup = {
      id: this.nextId++,
      category: isPunch ? 'PUNCH' : 'TOKEN',
      punchType: isPunch
        ? PUNCH_MODIFIERS[Math.floor(Math.random() * PUNCH_MODIFIERS.length)]
        : undefined,
      tokenType: !isPunch
        ? TOKEN_MODIFIERS[Math.floor(Math.random() * TOKEN_MODIFIERS.length)]
        : undefined,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      width: 1.5,
      height: 1.5,
      bobTimer: Math.random() * Math.PI * 2,
      lifetime: isMayhem ? 20 : 30,
    };

    this.pickups.push(pickup);
    return pickup;
  }

  public spawnGigaBonk(): ModifierPickup {
    this.gigaBonkSpawned = true;
    const pickup: ModifierPickup = {
      id: this.nextId++,
      category: 'GIGA_BONK',
      x: 0,
      y: 1.6,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      width: 2.2,
      height: 2.2,
      bobTimer: 0,
      lifetime: 9999,
    };

    this.pickups.push(pickup);
    sound.playMayhemAnnouncement();
    return pickup;
  }

  public spawnScrapPack(targetPlayer: PlayerState): ModifierPickup | null {
    if (this.activeScrapPackId !== null) {
      return null;
    }

    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDist = 5.0;
    let x = targetPlayer.x + Math.cos(offsetAngle) * offsetDist;
    let z = targetPlayer.z + Math.sin(offsetAngle) * offsetDist;

    // Clamp inside platform
    const dist = Math.hypot(x, z);
    if (dist > PLATFORM_RADIUS - 4) {
      x = (x / dist) * (PLATFORM_RADIUS - 4);
      z = (z / dist) * (PLATFORM_RADIUS - 4);
    }

    const pickup: ModifierPickup = {
      id: this.nextId++,
      category: 'SCRAP_PACK',
      x,
      y: 1.2,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      width: 1.8,
      height: 1.8,
      bobTimer: 0,
      lifetime: 20,
    };

    this.activeScrapPackId = pickup.id;
    this.pickups.push(pickup);
    return pickup;
  }

  public dropGigaBonkAt(x: number, y: number, z: number) {
    const pickup: ModifierPickup = {
      id: this.nextId++,
      category: 'GIGA_BONK',
      x,
      y: Math.max(1.5, y),
      z,
      vx: (Math.random() - 0.5) * 4,
      vy: 8,
      vz: (Math.random() - 0.5) * 4,
      width: 2.2,
      height: 2.2,
      bobTimer: 0,
      lifetime: 9999,
    };
    this.pickups.push(pickup);
  }

  public update(
    dt: number,
    isMayhem: boolean,
    isOvertime: boolean,
    players: PlayerState[],
    tokenSystem: TokenSystem,
    createComicEffect: (x: number, y: number, z: number, text: string) => void,
    triggerGigaBlast: (user: PlayerState) => void,
    onPowerupCollected?: (player: PlayerState, title: string, desc: string, icon: string) => void
  ) {
    if (!isOvertime) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnRandomModifier(isMayhem, isOvertime);
        this.spawnTimer = isMayhem
          ? 2.5 + Math.random() * 1.5
          : 5.5 + Math.random() * 2.5;
      }
    }

    const survivingPickups: ModifierPickup[] = [];
    for (const pickup of this.pickups) {
      pickup.bobTimer += dt * 3.5;
      pickup.lifetime -= dt;

      // Gravity if dropped
      if (pickup.vy !== 0 || pickup.y > 1.2) {
        pickup.vy -= 28 * dt;
        pickup.x += pickup.vx * dt;
        pickup.y += pickup.vy * dt;
        pickup.z += pickup.vz * dt;
        if (pickup.y <= 1.2 && Math.hypot(pickup.x, pickup.z) <= PLATFORM_RADIUS) {
          pickup.y = 1.2;
          pickup.vy = 0;
          pickup.vx = 0;
          pickup.vz = 0;
        }
      }

      if (pickup.lifetime <= 0 || pickup.y < -20) {
        if (pickup.id === this.activeScrapPackId) {
          this.activeScrapPackId = null;
        }
        continue;
      }

      let collected = false;
      for (const player of players) {
        if (player.isEliminated || player.isGhost || player.respawnTimer > 0) continue;

        const d = distance3D(player.x, player.y + 0.8, player.z, pickup.x, pickup.y, pickup.z);
        if (d < 2.2) {
          sound.playModifierPickup();

          let infoKey = '';
          if (pickup.category === 'PUNCH' && pickup.punchType) {
            player.punchModifier = pickup.punchType;
            infoKey = pickup.punchType;
            createComicEffect(pickup.x, pickup.y + 1.5, pickup.z, pickup.punchType.replace('_', ' '));
          } else if (pickup.category === 'TOKEN' && pickup.tokenType) {
            infoKey = pickup.tokenType;
            if (pickup.tokenType === 'POCKET_JACKPOT') {
              const add = Math.min(3, MAX_CARRIED_TOKENS - player.tokens);
              player.tokens += add;
              player.stats.tokensCollected += add;
              createComicEffect(pickup.x, pickup.y + 1.5, pickup.z, '+3 JACKPOT!');
            } else if (pickup.tokenType === 'DOUBLE_VALUE') {
              player.tokenModifier = 'DOUBLE_VALUE';
              player.doubleValueCharges = 3;
              createComicEffect(pickup.x, pickup.y + 1.5, pickup.z, 'DOUBLE VALUE (3x)');
            } else if (pickup.tokenType === 'TOKEN_MAGNET') {
              player.tokenModifier = 'TOKEN_MAGNET';
              player.tokenModifierTimer = 6.0;
              createComicEffect(pickup.x, pickup.y + 1.5, pickup.z, 'TOKEN MAGNET!');
            } else if (pickup.tokenType === 'STICKY_FINGERS') {
              player.tokenModifier = 'STICKY_FINGERS';
              player.tokenModifierTimer = 7.0;
              createComicEffect(pickup.x, pickup.y + 1.5, pickup.z, 'STICKY FINGERS!');
            } else if (pickup.tokenType === 'TOKEN_BOMB') {
              player.tokenModifier = 'TOKEN_BOMB';
              createComicEffect(pickup.x, pickup.y + 1.5, pickup.z, 'TOKEN BOMB LOADED!');
            }
          } else if (pickup.category === 'GIGA_BONK') {
            infoKey = 'GIGA_BONK';
            player.hasGigaBonk = true;
            createComicEffect(pickup.x, pickup.y + 2, pickup.z, 'GIGA BONK READY!');
          } else if (pickup.category === 'SCRAP_PACK') {
            infoKey = 'SCRAP_PACK';
            this.activeScrapPackId = null;
            const space = MAX_CARRIED_TOKENS - player.tokens;
            const collectedAmt = Math.min(space, 2);
            player.tokens += collectedAmt;
            player.stats.tokensCollected += collectedAmt;
            const overflow = 2 - collectedAmt;
            if (overflow > 0) {
              tokenSystem.scatterTokens(player.x, player.y, player.z, overflow, null, 0.5);
            }
            createComicEffect(pickup.x, pickup.y + 1.5, pickup.z, 'SCRAP PACK CLAIMED!');
          }

          if (infoKey && MODIFIER_INFO[infoKey] && onPowerupCollected) {
            const inf = MODIFIER_INFO[infoKey];
            onPowerupCollected(player, inf.title, inf.desc, inf.icon);
          }

          collected = true;
          break;
        }
      }

      if (!collected) {
        survivingPickups.push(pickup);
      }
    }
    this.pickups = survivingPickups;

    // Modifiers and Giga Bonk charging
    for (const player of players) {
      if (player.isEliminated || player.isGhost || player.respawnTimer > 0) {
        player.punchModifier = null;
        player.tokenModifier = null;
        player.hasGigaBonk = false;
        player.isChargingGigaBonk = false;
        continue;
      }

      if (
        player.tokenModifier === 'TOKEN_MAGNET' ||
        player.tokenModifier === 'STICKY_FINGERS'
      ) {
        player.tokenModifierTimer -= dt;
        if (player.tokenModifierTimer <= 0) {
          player.tokenModifier = null;
        }
      }

      if (player.isChargingGigaBonk) {
        player.gigaBonkChargeTimer -= dt;
        if (player.gigaBonkChargeTimer <= 0) {
          player.isChargingGigaBonk = false;
          player.hasGigaBonk = false;
          this.gigaBonkUsed = true;
          triggerGigaBlast(player);
        }
      }
    }
  }
}
