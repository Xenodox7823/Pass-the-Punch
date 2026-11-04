import {
  PLATFORM_RADIUS,
  CpuDifficulty,
  GhostAbilityType,
  GhostZoneEffect,
  LooseToken,
  ModifierPickup,
  PlayerState,
} from './types';
import { distance3D } from './physics';
import { startDodge, startPunch } from './combat';

export interface BotDecision {
  moveInputX: number; // -1 to 1
  moveInputZ: number; // -1 to 1
  jump: boolean;
  punch: boolean;
  dodge: boolean;
}

export class BotAI {
  private reactionTimers: Map<number, number> = new Map();
  private lastDecisions: Map<number, BotDecision> = new Map();
  private orbitTimers: Map<number, number> = new Map();

  public reset() {
    this.reactionTimers.clear();
    this.lastDecisions.clear();
    this.orbitTimers.clear();
  }

  public updateBot(
    bot: PlayerState,
    difficulty: CpuDifficulty,
    dt: number,
    allPlayers: PlayerState[],
    looseTokens: LooseToken[],
    modifierPickups: ModifierPickup[],
    ghostZones: GhostZoneEffect[],
    safeRadius: number = PLATFORM_RADIUS,
    onGhostCast?: (bot: PlayerState, type: GhostAbilityType, x: number, z: number) => void
  ): BotDecision {
    if (bot.isGhost) {
      if (bot.ghostCooldown <= 0 && onGhostCast && Math.random() < 0.03) {
        const abilities: GhostAbilityType[] = ['GUST_FAN', 'JELLY_PATCH', 'TOKEN_TORNADO'];
        const chosen = abilities[Math.floor(Math.random() * abilities.length)];
        const living = allPlayers.filter((p) => !p.isEliminated && !p.isGhost && p.respawnTimer <= 0);
        if (living.length > 0) {
          const target = living[Math.floor(Math.random() * living.length)];
          onGhostCast(bot, chosen, target.x, target.z);
        }
      }
      // Ghost wanders smoothly around stadium
      const wanderAngle = (bot.id * 1.5 + Date.now() * 0.001);
      return {
        moveInputX: Math.cos(wanderAngle) * 0.6,
        moveInputZ: Math.sin(wanderAngle) * 0.6,
        jump: Math.sin(Date.now() * 0.002 + bot.id) > 0.4,
        punch: false,
        dodge: false,
      };
    }

    if (bot.isEliminated || bot.respawnTimer > 0) {
      return { moveInputX: 0, moveInputZ: 0, jump: false, punch: false, dodge: false };
    }

    let reactionDelay = 0.16;
    if (difficulty === 'EASY') reactionDelay = 0.28;
    if (difficulty === 'NORMAL') reactionDelay = 0.18;
    if (difficulty === 'CHAOTIC') reactionDelay = 0.09;

    let timer = (this.reactionTimers.get(bot.id) || 0) - dt;
    if (timer > 0 && this.lastDecisions.has(bot.id)) {
      this.reactionTimers.set(bot.id, timer);
      return this.lastDecisions.get(bot.id)!;
    }
    this.reactionTimers.set(bot.id, reactionDelay);

    let moveInputX = 0;
    let moveInputZ = 0;
    let jump = false;
    let punch = false;
    let dodge = false;

    const livingOpponents = allPlayers.filter(
      (p) => p.id !== bot.id && !p.isEliminated && !p.isGhost && p.respawnTimer <= 0
    );

    const isDuel = livingOpponents.length === 1;

    // 1. Boundary & Overtime Safe Ring avoidance
    const currentBound = Math.min(PLATFORM_RADIUS, safeRadius);
    const distFromCenter = Math.hypot(bot.x, bot.z);
    const edgeMargin = isDuel ? 3.5 : (difficulty === 'EASY' ? 4.0 : 5.5);

    if (distFromCenter > currentBound - edgeMargin) {
      // Steer back inwards toward (0, 0)
      const angle = Math.atan2(-bot.x, -bot.z);
      moveInputX = Math.sin(angle);
      moveInputZ = Math.cos(angle);
      if (distFromCenter > currentBound - 1.5 && bot.isGrounded) {
        jump = true;
      }
    }

    // 2. Identify nearest opponent
    let nearestOpponent: PlayerState | null = null;
    let nearestOpponentDist = Infinity;
    for (const opp of livingOpponents) {
      const d = distance3D(bot.x, bot.y, bot.z, opp.x, opp.y, opp.z);
      if (d < nearestOpponentDist) {
        nearestOpponentDist = d;
        nearestOpponent = opp;
      }
    }

    // 3. Dodge incoming punches
    if (nearestOpponent && nearestOpponent.punchTimer > 0 && nearestOpponentDist < 4.0) {
      const dodgeChance = difficulty === 'CHAOTIC' ? 0.75 : difficulty === 'NORMAL' ? 0.5 : 0.25;
      if (Math.random() < dodgeChance && bot.dodgeCooldown <= 0) {
        dodge = true;
      } else if (bot.isGrounded && Math.random() < 0.6) {
        jump = true;
      }
    }

    // 4. Anti-Orbiting & Duel Aggression Check
    let orbitTime = this.orbitTimers.get(bot.id) || 0;
    if (nearestOpponent && nearestOpponentDist < 7.0) {
      orbitTime += dt + reactionDelay;
    } else {
      orbitTime = 0;
    }
    this.orbitTimers.set(bot.id, orbitTime);

    // If bots have been circling/near each other for > 0.8s, commit to aggressive rushdown!
    const forceCharge = isDuel || orbitTime > 0.8;

    // 5. Target determination
    let targetX: number | null = null;
    let targetZ: number | null = null;

    const gigaBonkItem = modifierPickups.find((m) => m.category === 'GIGA_BONK');

    if (bot.hasGigaBonk && !bot.isChargingGigaBonk) {
      punch = true;
    }

    if (gigaBonkItem && !isDuel) {
      targetX = gigaBonkItem.x;
      targetZ = gigaBonkItem.z;
    } else if (forceCharge && nearestOpponent) {
      // Rush straight toward opponent!
      targetX = nearestOpponent.x;
      targetZ = nearestOpponent.z;
    } else {
      let bestToken: LooseToken | null = null;
      let bestTokenDist = Infinity;

      if (bot.tokens < 6 && !isDuel) {
        for (const token of looseTokens) {
          if (Math.hypot(token.x, token.z) < currentBound - 2 && token.y >= -1) {
            const d = distance3D(bot.x, bot.y, bot.z, token.x, token.y, token.z);
            if (d < bestTokenDist) {
              bestTokenDist = d;
              bestToken = token;
            }
          }
        }
      }

      if (bestToken && bestTokenDist < 16) {
        targetX = bestToken.x;
        targetZ = bestToken.z;
        if (bestToken.y > bot.y + 1.2 && bot.isGrounded && bestTokenDist < 3.5) {
          jump = true;
        }
      } else if (nearestOpponent) {
        targetX = nearestOpponent.x;
        targetZ = nearestOpponent.z;
      }
    }

    // 6. Navigation towards target
    if (moveInputX === 0 && moveInputZ === 0 && targetX !== null && targetZ !== null) {
      const dx = targetX - bot.x;
      const dz = targetZ - bot.z;
      const dLen = Math.hypot(dx, dz);
      if (dLen > 0.8) {
        moveInputX = dx / dLen;
        moveInputZ = dz / dLen;
      }
    }

    // 7. Punching Action (extended reach and aggressive execution)
    if (nearestOpponent && bot.punchCooldown <= 0) {
      const punchRange = bot.punchModifier === 'STRETCHY_ARM' ? 5.5 : 4.0;
      if (nearestOpponentDist <= punchRange) {
        const attackChance =
          forceCharge || difficulty === 'CHAOTIC'
            ? 0.95
            : difficulty === 'NORMAL'
            ? 0.8
            : 0.55;

        if (Math.random() < attackChance) {
          punch = true;
          // Align facing directly at target
          bot.rotationY = Math.atan2(nearestOpponent.x - bot.x, nearestOpponent.z - bot.z);
        }
      }
    }

    if (punch) startPunch(bot);
    if (dodge) startDodge(bot);
    if (jump && bot.isGrounded) {
      bot.vy = 15;
      bot.isGrounded = false;
      bot.squashX = 0.8;
      bot.squashY = 1.3;
    }

    const decision: BotDecision = { moveInputX, moveInputZ, jump, punch, dodge };
    this.lastDecisions.set(bot.id, decision);
    return decision;
  }
}
