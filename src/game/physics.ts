import {
  ARENA_SURFACE_Y,
  PLATFORM_RADIUS,
  RINGOUT_FALL_DEPTH,
  GhostZoneEffect,
  LooseToken,
  PlayerState,
} from './types';

export const GRAVITY = -50;
export const RUN_ACCELERATION = 90;
export const AIR_ACCELERATION = 20; // Reduced air steering so players knocked off cannot easily float/steer back
export const MAX_RUN_SPEED = 14;
export const JUMP_VELOCITY = 17;
export const GROUND_FRICTION = 0.82;
export const AIR_DRAG = 0.98;
export const JELLY_FRICTION = 0.985;

export function updatePlayerPhysics(
  player: PlayerState,
  dt: number,
  moveInputX: number,
  moveInputZ: number,
  jumpInput: boolean,
  ghostZones: GhostZoneEffect[],
  safeRadius: number = PLATFORM_RADIUS
): boolean {
  if (player.isEliminated || player.isGhost || player.respawnTimer > 0) {
    if (player.isGhost) {
      // FREE ROAM GHOST: full 3D flight!
      const inputLen = Math.hypot(moveInputX, moveInputZ);
      if (inputLen > 0.05) {
        player.vx = (moveInputX / inputLen) * 16;
        player.vz = (moveInputZ / inputLen) * 16;
        player.rotationY = Math.atan2(moveInputX, moveInputZ);
      } else {
        player.vx *= 0.88;
        player.vz *= 0.88;
      }

      if (jumpInput) {
        player.vy = 12; // fly upward
      } else {
        player.vy *= 0.9;
      }

      player.x += player.vx * dt;
      player.z += player.vz * dt;
      player.y += player.vy * dt;

      // Clamp ghost flight within stadium bounds
      player.y = Math.max(2, Math.min(22, player.y));
      const dist = Math.hypot(player.x, player.z);
      if (dist > PLATFORM_RADIUS + 16) {
        player.x = (player.x / dist) * (PLATFORM_RADIUS + 16);
        player.z = (player.z / dist) * (PLATFORM_RADIUS + 16);
      }
    }
    return false;
  }

  // Check if player is on Jelly Patch
  let onJelly = false;
  for (const zone of ghostZones) {
    if (zone.warmupTimer <= 0 && zone.type === 'JELLY_PATCH') {
      const dist = Math.hypot(player.x - zone.x, player.z - zone.z);
      if (dist < zone.radius && Math.abs(player.y - zone.y) < 2.5) {
        onJelly = true;
        player.squashX = 1.15;
        player.squashY = 0.88;
        break;
      }
    }
  }

  // Check Gust Fan (Strong wind force pushing players)
  for (const zone of ghostZones) {
    if (zone.warmupTimer <= 0 && zone.type === 'GUST_FAN') {
      const dist = Math.hypot(player.x - zone.x, player.z - zone.z);
      if (dist < zone.radius) {
        const dirX = zone.directionX ?? 1;
        const dirZ = zone.directionZ ?? 0;
        player.vx += dirX * 52 * dt;
        player.vz += dirZ * 52 * dt;
        player.squashX = 1.25;
        player.squashY = 0.8;
      }
    }
  }

  // Check Token Tornado (Vortex pulling and swirling players)
  for (const zone of ghostZones) {
    if (zone.warmupTimer <= 0 && zone.type === 'TOKEN_TORNADO') {
      const dist = Math.hypot(player.x - zone.x, player.z - zone.z);
      if (dist < zone.radius) {
        const dx = zone.x - player.x;
        const dz = zone.z - player.z;
        const pull = 38;
        player.vx += (dx / Math.max(1, dist)) * pull * dt;
        player.vz += (dz / Math.max(1, dist)) * pull * dt;
        // Tangential vortex spin
        player.vx += (-dz / Math.max(1, dist)) * 26 * dt;
        player.vz += (dx / Math.max(1, dist)) * 26 * dt;
        if (player.isGrounded && Math.random() < 0.3) {
          player.vy = 5;
          player.isGrounded = false;
        }
      }
    }
  }

  // 3D Movement
  if (player.stunTimer <= 0 && player.dodgeTimer <= 0) {
    if (jumpInput && player.isGrounded) {
      player.vy = JUMP_VELOCITY;
      player.isGrounded = false;
      player.squashX = 0.8;
      player.squashY = 1.3;
    }

    const inputLen = Math.hypot(moveInputX, moveInputZ);
    if (inputLen > 0.05) {
      const normX = moveInputX / inputLen;
      const normZ = moveInputZ / inputLen;

      // When on Jelly Patch, reduce traction/steering by 75% for fun slippery drift!
      // When airborne, drastically reduce air control so players cannot easily recover after being launched off!
      // If player was recently hit (hitReactionTimer > 0), disable air control completely!
      const canAirSteer = player.isGrounded || player.hitReactionTimer <= 0;
      const accel = player.isGrounded
        ? (onJelly ? RUN_ACCELERATION * 0.25 : RUN_ACCELERATION)
        : (canAirSteer ? AIR_ACCELERATION : 0);

      player.vx += normX * accel * dt;
      player.vz += normZ * accel * dt;

      // ONLY clamp running speed when grounded!
      // In mid-air, do NOT brake high-velocity knockback trajectories!
      if (player.isGrounded) {
        const horizSpeed = Math.hypot(player.vx, player.vz);
        const maxSpd = onJelly ? MAX_RUN_SPEED * 1.25 : MAX_RUN_SPEED;
        if (horizSpeed > maxSpd) {
          player.vx = (player.vx / horizSpeed) * maxSpd;
          player.vz = (player.vz / horizSpeed) * maxSpd;
        }
      }

      const targetAngle = Math.atan2(normX, normZ);
      let angleDiff = targetAngle - player.rotationY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const turnRate = onJelly ? 6 : (player.isGrounded ? 18 : 6);
      player.rotationY += angleDiff * Math.min(1, turnRate * dt);
    } else {
      const friction = onJelly
        ? 0.995 // Extreme slippery ice drift
        : player.isGrounded
        ? GROUND_FRICTION
        : AIR_DRAG;
      player.vx *= Math.pow(friction, dt * 60);
      player.vz *= Math.pow(friction, dt * 60);
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
      if (Math.abs(player.vz) < 0.1) player.vz = 0;
    }
  } else if (player.dodgeTimer > 0) {
    player.dodgeTimer -= dt;
    if (player.dodgeTimer <= 0) {
      player.isInvulnerable = false;
    }
  }

  // Gravity
  player.vy += GRAVITY * dt;

  // Integrate
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.z += player.vz * dt;

  // Overtime safe radius shrink: repel player inward if outside safe perimeter
  const distFromCenter = Math.hypot(player.x, player.z);
  if (safeRadius < PLATFORM_RADIUS && distFromCenter > safeRadius && player.y >= -1.0) {
    // Electric perimeter shock horizontally inward
    const inX = -player.x / distFromCenter;
    const inZ = -player.z / distFromCenter;
    player.vx += inX * 45 * dt;
    player.vz += inZ * 45 * dt;
    // Only give a single small hop if firmly grounded, never continuous upward lift!
    if (player.isGrounded && player.vy <= 0) {
      player.vy = 2.5;
      player.isGrounded = false;
    }
  }

  // Platform collision
  const isOverPlatform = distFromCenter <= PLATFORM_RADIUS;
  if (isOverPlatform && player.y <= ARENA_SURFACE_Y && player.y >= -1.5 && player.vy <= 0) {
    player.y = ARENA_SURFACE_Y;
    player.vy = 0;
    player.isGrounded = true;
  } else {
    player.isGrounded = false;
  }

  // Decay timers
  if (player.stunTimer > 0) player.stunTimer -= dt;
  if (player.hitReactionTimer > 0) player.hitReactionTimer -= dt;
  if (player.invulnerableTimer > 0) {
    player.invulnerableTimer -= dt;
    if (player.invulnerableTimer <= 0 && player.dodgeTimer <= 0) {
      player.isInvulnerable = false;
    }
  }

  player.squashX += (1 - player.squashX) * 12 * dt;
  player.squashY += (1 - player.squashY) * 12 * dt;

  // Ring-out
  const isRingOut = player.y < RINGOUT_FALL_DEPTH;
  return isRingOut;
}

export function updateLooseTokenPhysics(
  token: LooseToken,
  dt: number,
  ghostZones: GhostZoneEffect[]
) {
  for (const zone of ghostZones) {
    if (zone.warmupTimer <= 0) {
      const dist = Math.hypot(token.x - zone.x, token.z - zone.z);
      if (dist < zone.radius) {
        if (zone.type === 'GUST_FAN') {
          token.vx += (zone.directionX ?? 1) * 16 * dt;
          token.vz += (zone.directionZ ?? 0) * 16 * dt;
        } else if (zone.type === 'TOKEN_TORNADO') {
          const dx = zone.x - token.x;
          const dz = zone.z - token.z;
          const pull = 22;
          token.vx += (dx / Math.max(1, dist)) * pull * dt;
          token.vz += (dz / Math.max(1, dist)) * pull * dt;
          token.vx += (-dz / Math.max(1, dist)) * 14 * dt;
          token.vz += (dx / Math.max(1, dist)) * 14 * dt;
          token.vy += 12 * dt;
        }
      }
    }
  }

  token.vy += GRAVITY * 0.85 * dt;
  token.x += token.vx * dt;
  token.y += token.vy * dt;
  token.z += token.vz * dt;

  token.rotationX += token.vRotX * dt;
  token.rotationY += token.vRotY * dt;
  token.rotationZ += token.vRotZ * dt;

  // Platform perimeter clamp: prevent tokens from ever falling off the arena platform!
  const maxRadius = PLATFORM_RADIUS - 1.8;
  const distFromCenter = Math.hypot(token.x, token.z);
  if (distFromCenter > maxRadius) {
    token.x = (token.x / distFromCenter) * maxRadius;
    token.z = (token.z / distFromCenter) * maxRadius;
    // Inward bounce reflection
    const inX = -token.x / maxRadius;
    const inZ = -token.z / maxRadius;
    const dot = token.vx * inX + token.vz * inZ;
    if (dot < 0) {
      token.vx = inX * Math.abs(token.vx) * 0.4;
      token.vz = inZ * Math.abs(token.vz) * 0.4;
    }
  }

  // Floor collision & high friction: settle tokens firmly on ground so they don't slide
  if (token.y <= ARENA_SURFACE_Y + token.radius) {
    token.y = ARENA_SURFACE_Y + token.radius;
    token.vy = -token.vy * 0.35;
    token.vx *= 0.6;
    token.vz *= 0.6;
    token.vRotX *= 0.6;
    token.vRotZ *= 0.6;

    if (Math.abs(token.vy) < 0.8) {
      token.vy = 0;
      token.isGrounded = true;
    }
    if (Math.hypot(token.vx, token.vz) < 0.25) {
      token.vx = 0;
      token.vz = 0;
      token.vRotX = 0;
      token.vRotY = 0;
      token.vRotZ = 0;
    }
  } else {
    token.isGrounded = false;
  }

  if (token.pickupCooldown > 0) {
    token.pickupCooldown -= dt;
  }
}

export function distance3D(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
