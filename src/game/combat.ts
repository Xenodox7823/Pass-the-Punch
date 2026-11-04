import {
  MAX_CARRIED_TOKENS,
  OVERLOAD_THRESHOLD,
  PlayerState,
} from './types';
import { distance3D } from './physics';
import { sound } from './audio';

export interface CombatHitResult {
  hitTargetId: number;
  attackerId: number;
  isOverload: boolean;
  isTokenBomb: boolean;
  tokensToScatterAttacker: number;
  tokensToScatterTarget: number;
  targetDroppedLooseToken: boolean;
  knockbackX: number;
  knockbackY: number;
  knockbackZ: number;
  attackerRecoilX: number;
  attackerRecoilY: number;
  attackerRecoilZ: number;
  isCounterattack: boolean;
}

export function startPunch(player: PlayerState): boolean {
  if (
    player.isEliminated ||
    player.isGhost ||
    player.respawnTimer > 0 ||
    player.stunTimer > 0 ||
    player.dodgeTimer > 0 ||
    player.punchCooldown > 0 ||
    player.punchTimer > 0
  ) {
    return false;
  }

  // Giga Bonk punch activation
  if (player.hasGigaBonk && !player.isChargingGigaBonk) {
    player.isChargingGigaBonk = true;
    player.gigaBonkChargeTimer = 1.0;
    sound.playGigaBonkCharge();
    return true;
  }

  const isOverload = player.tokens >= OVERLOAD_THRESHOLD;
  player.isOverloadPunch = isOverload;
  player.punchTimer = isOverload ? 0.38 : 0.28;
  player.punchCooldown = isOverload ? 0.8 : 0.55;
  player.punchHitRegistered = false;

  player.squashX = 1.35;
  player.squashY = 0.8;
  return true;
}

export function startDodge(player: PlayerState): boolean {
  if (
    player.isEliminated ||
    player.isGhost ||
    player.respawnTimer > 0 ||
    player.stunTimer > 0 ||
    player.dodgeCooldown > 0 ||
    player.dodgeTimer > 0
  ) {
    return false;
  }

  player.dodgeCooldown = 1.0;
  player.dodgeTimer = 0.22;
  player.isInvulnerable = true;
  player.invulnerableTimer = 0.22;
  player.punchTimer = 0;

  // Dash forward along facing rotation in 3D
  const forwardX = Math.sin(player.rotationY);
  const forwardZ = Math.cos(player.rotationY);
  const dashSpeed = 26;

  player.vx = forwardX * dashSpeed;
  player.vz = forwardZ * dashSpeed;
  player.vy = 4; // slight hop

  player.squashX = 1.4;
  player.squashY = 0.7;

  sound.playDodge();
  return true;
}

export function checkPunchCollisions(
  attacker: PlayerState,
  allPlayers: PlayerState[],
  createHitEffect: (x: number, y: number, z: number, text?: string) => void
): CombatHitResult[] {
  const results: CombatHitResult[] = [];
  if (attacker.punchTimer <= 0 || attacker.punchHitRegistered) {
    return results;
  }

  // Direction attacker is facing
  const forwardX = Math.sin(attacker.rotationY);
  const forwardZ = Math.cos(attacker.rotationY);

  const hasStretchy = attacker.punchModifier === 'STRETCHY_ARM';
  const maxReach = hasStretchy ? 5.8 : 4.0;

  for (const target of allPlayers) {
    if (
      target.id === attacker.id ||
      target.isEliminated ||
      target.isGhost ||
      target.respawnTimer > 0
    ) {
      continue;
    }

    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const dz = target.z - attacker.z;
    const distHoriz = Math.hypot(dx, dz);
    const distVert = Math.abs(dy);

    // Height check
    if (distVert > 3.2 || distHoriz > maxReach) {
      continue;
    }

    // Directional forward cone check (unless practically touching at point blank <= 1.5m)
    if (distHoriz > 1.5) {
      const dot = forwardX * (dx / distHoriz) + forwardZ * (dz / distHoriz);
      if (dot < 0.25) {
        // Behind or beside outside punch arc
        continue;
      }
    }

    if (distHoriz <= maxReach) {
      if (target.isInvulnerable) {
        if (target.dodgeTimer > 0.08 && !target.perfectDodgeWindow) {
          target.perfectDodgeWindow = true;
          target.stats.perfectDodges++;
          sound.playPerfectDodge();
          createHitEffect(target.x, target.y + 2, target.z, 'PERFECT DODGE!');
        }
        continue;
      }

      // Interrupt charging Giga Bonk
      if (target.isChargingGigaBonk) {
        target.isChargingGigaBonk = false;
        target.hasGigaBonk = false;
        target.gigaBonkChargeTimer = 0;
        createHitEffect(target.x, target.y + 2, target.z, 'INTERRUPTED!');
      }

      attacker.punchHitRegistered = true;
      attacker.stats.punchesLanded++;

      const preTokens = attacker.tokens;
      const isOverload = preTokens >= OVERLOAD_THRESHOLD;

      const isCounterattack = attacker.perfectDodgeWindow;
      const counterMultiplier = isCounterattack ? 1.4 : 1.0;
      if (isCounterattack) {
        attacker.perfectDodgeWindow = false;
        createHitEffect(attacker.x, attacker.y + 2, attacker.z, 'COUNTER BONK!');
      }

      const isRocketKnuckles = attacker.punchModifier === 'ROCKET_KNUCKLES';
      const rocketMultiplier = isRocketKnuckles ? 1.6 : 1.0;

      // Base knockback forces in 3D
      let baseHoriz = 12;
      let baseUp = 6;
      let recoilHoriz = 0;
      let recoilUp = 0;

      if (preTokens === 0) {
        baseHoriz = 10;
        baseUp = 4;
      } else if (preTokens === 1) {
        baseHoriz = 16;
        baseUp = 7;
      } else if (preTokens === 2) {
        baseHoriz = 22;
        baseUp = 9;
      } else if (preTokens === 3) {
        baseHoriz = 29;
        baseUp = 12;
      } else if (preTokens === 4) {
        baseHoriz = 38;
        baseUp = 15;
      } else {
        // OVERLOAD (5+ tokens)
        baseHoriz = 48;
        baseUp = 18;
        recoilHoriz = 32;
        recoilUp = 12;
      }

      // Calculate directional 3D vector away from attacker
      let toTargetX = target.x - attacker.x;
      let toTargetZ = target.z - attacker.z;
      const toLen = Math.hypot(toTargetX, toTargetZ) || 1;
      toTargetX /= toLen;
      toTargetZ /= toLen;

      // Blend punch forward direction with direct center-to-center vector
      const knockDirX = (forwardX * 0.6 + toTargetX * 0.4);
      const knockDirZ = (forwardZ * 0.6 + toTargetZ * 0.4);
      const kLen = Math.hypot(knockDirX, knockDirZ) || 1;

      // Knockback variation factors:
      // 1. Natural random spice (±14%)
      const spice = 0.86 + Math.random() * 0.28;
      // 2. Target token bonus: Carrying tokens makes victims volatile!
      const targetTokenBonus = 1.0 + Math.min(0.45, target.tokens * 0.08);
      // 3. Sweet spot bonus (dead-center hits deal devastating force)
      const hitDot = forwardX * toTargetX + forwardZ * toTargetZ;
      const isSweetSpot = hitDot > 0.85;
      const sweetSpotMultiplier = isSweetSpot ? 1.25 : 1.0;
      if (isSweetSpot) {
        createHitEffect(target.x, target.y + 2, target.z, 'CRITICAL BONK!');
      }
      // 4. Airborne vulnerability: mid-air targets have zero floor traction
      const airMultiplier = target.isGrounded ? 1.0 : 1.25;

      const isShove = preTokens === 0;
      const totalMultiplier = isShove
        ? counterMultiplier * (0.88 + Math.random() * 0.16)
        : counterMultiplier * rocketMultiplier * spice * targetTokenBonus * sweetSpotMultiplier * airMultiplier;
      const totalHoriz = isShove ? 10 * totalMultiplier : baseHoriz * totalMultiplier;

      // Attacker forward momentum transfer: sprinting or dashing into a punch transfers kinetic force!
      const attackerForwardSpeed = Math.max(0, forwardX * attacker.vx + forwardZ * attacker.vz);
      const momentumBonus = isShove ? 0 : Math.min(18, attackerForwardSpeed * 0.85);
      if (momentumBonus > 6) {
        createHitEffect(target.x, target.y + 2, target.z, 'MOMENTUM CRUSH!');
      }

      const knockbackX = (knockDirX / kLen) * (totalHoriz + momentumBonus);
      const knockbackZ = (knockDirZ / kLen) * (totalHoriz + momentumBonus);
      const knockbackY = Math.min(15, baseUp * (0.8 + Math.random() * 0.3) * counterMultiplier);

      const recoilMultiplier = attacker.hasGigaBonk ? 0.25 : 1.0;
      const attackerRecoilX = -forwardX * recoilHoriz * recoilMultiplier;
      const attackerRecoilZ = -forwardZ * recoilHoriz * recoilMultiplier;
      const attackerRecoilY = Math.min(10, recoilUp * recoilMultiplier);

      target.vx = knockbackX;
      target.vy = knockbackY;
      target.vz = knockbackZ;
      target.stunTimer = isOverload ? 0.45 : 0.22;
      target.hitReactionTimer = 0.35; // Prevents air steering recovery during hit stun!
      target.squashX = 0.65;
      target.squashY = 1.35;

      // Track last attacker for killfeed / knockout credit
      target.lastAttackerId = attacker.id;
      target.lastHitTimer = 3.5;
      target.lastHitType = isOverload ? 'OVERLOAD' : 'BONK';

      if (isOverload) {
        attacker.vx = attackerRecoilX;
        attacker.vy = attackerRecoilY;
        attacker.vz = attackerRecoilZ;
        attacker.stunTimer = attacker.hasGigaBonk ? 0.12 : 0.35;
        attacker.hitReactionTimer = 0.3;
        sound.playOverload();
        createHitEffect(
          (attacker.x + target.x) / 2,
          (attacker.y + target.y) / 2 + 1.5,
          (attacker.z + target.z) / 2,
          'OVERLOAD!!!'
        );
      } else if (preTokens >= 3) {
        sound.playHeavyPunch();
        createHitEffect(target.x, target.y + 1.5, target.z, 'BONK!');
      } else {
        sound.playLightPunch();
        createHitEffect(target.x, target.y + 1.5, target.z, preTokens === 0 ? 'SHOVE' : 'POW!');
      }

      const isTokenBomb = attacker.tokenModifier === 'TOKEN_BOMB' && !isOverload;
      let tokensToScatterAttacker = 0;
      let tokensToScatterTarget = 0;
      let targetDroppedLooseToken = false;

      if (isOverload) {
        tokensToScatterAttacker = attacker.tokens;
        tokensToScatterTarget = target.tokens;
        attacker.tokens = 0;
        target.tokens = 0;
      } else if (isTokenBomb) {
        tokensToScatterTarget = target.tokens;
        target.tokens = 0;
        attacker.tokenModifier = null;
        createHitEffect(target.x, target.y + 1.5, target.z, 'TOKEN BOMB!');
      } else if (preTokens > 0) {
        attacker.tokens -= 1;
        attacker.stats.tokensTransferred++;

        sound.playTokenPickup();
        createHitEffect(target.x, target.y + 2.4, target.z, 'TOKEN PASSED! +1 🪙');
        createHitEffect(attacker.x, attacker.y + 2.0, attacker.z, '-1 🪙');

        if (target.tokens < MAX_CARRIED_TOKENS) {
          target.tokens += 1;
        } else {
          targetDroppedLooseToken = true;
        }
      }

      // Consume one-shot punch modifiers
      if (
        attacker.punchModifier === 'ROCKET_KNUCKLES' ||
        attacker.punchModifier === 'STRETCHY_ARM' ||
        attacker.punchModifier === 'THUNDER_BONK' ||
        attacker.punchModifier === 'BOOMERANG_BONK'
      ) {
        attacker.punchModifier = null;
      }

      results.push({
        hitTargetId: target.id,
        attackerId: attacker.id,
        isOverload,
        isTokenBomb,
        tokensToScatterAttacker,
        tokensToScatterTarget,
        targetDroppedLooseToken,
        knockbackX,
        knockbackY,
        knockbackZ,
        attackerRecoilX,
        attackerRecoilY,
        attackerRecoilZ,
        isCounterattack,
      });

      break;
    }
  }

  return results;
}
