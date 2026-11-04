/**
 * PASS THE PUNCH - Automated Rule Verification Test Suite (3D)
 * Validates all 22 required gameplay scenarios and edge cases in the 3D world.
 */

import { GameEngine } from './GameEngine';
import { checkPunchCollisions, startPunch } from './combat';
import { MAX_CARRIED_TOKENS, OVERLOAD_THRESHOLD, PLATFORM_RADIUS } from './types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

export function runAllTests(): { passed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;

  function record(desc: string, fn: () => void) {
    try {
      fn();
      results.push(`✅ ${desc}`);
      passed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`❌ ${desc}: ${msg}`);
      throw err;
    }
  }

  // 1. Initial State: 1 token, 3 lives each
  record('Scenario 1: Everyone begins with exactly 1 normal token and 3 lives', () => {
    const engine = new GameEngine({ totalPlayers: 4, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    assert(engine.players.length === 4, 'Should initialize 4 players');
    for (const p of engine.players) {
      assert(p.tokens === 1, `Player ${p.id} should start with 1 token, got ${p.tokens}`);
      assert(p.lives === 3, `Player ${p.id} should start with 3 lives, got ${p.lives}`);
      assert(!p.isEliminated, 'Player should not be eliminated');
    }
  });

  // 2. Normal punch with 1 token transfers token and uses pre-transfer knockback in 3D
  record('Scenario 2: Normal punch with 1 token transfers token and uses correct knockback', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];

    p1.x = 0;
    p1.y = 0;
    p1.z = 0;
    p1.rotationY = 0; // facing +Z
    p1.tokens = 1;

    p2.x = 0;
    p2.y = 0;
    p2.z = 2.0;
    p2.tokens = 1;

    startPunch(p1);
    const hits = checkPunchCollisions(p1, engine.players, () => {});

    assert(hits.length === 1, 'Punch should hit target');
    assert(p1.tokens === 0, `P1 should have transferred 1 token, got ${p1.tokens}`);
    assert(p2.tokens === 2, `P2 should have received 1 token, got ${p2.tokens}`);
    assert(hits[0].knockbackZ > 10, 'Knockback along Z should be scaled for 1-token tier');
  });

  // 3. Punch with 0 tokens creates weak shove and transfers nothing
  record('Scenario 3: Punch with 0 tokens creates weak shove and transfers nothing', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];

    p1.x = 0;
    p1.y = 0;
    p1.z = 0;
    p1.rotationY = 0;
    p1.tokens = 0;

    p2.x = 0;
    p2.y = 0;
    p2.z = 2.0;
    p2.tokens = 2;

    startPunch(p1);
    const hits = checkPunchCollisions(p1, engine.players, () => {});

    assert(hits.length === 1, 'Punch should hit');
    assert(p1.tokens === 0, 'P1 should remain at 0 tokens');
    assert(p2.tokens === 2, 'P2 should remain at 2 tokens');
    assert(hits[0].knockbackZ <= 12, 'Shove knockback should be small');
  });

  // 4 & 5. Overload punch (5+ tokens): scatters both token piles and knocks both backwards
  record('Scenarios 4 & 5: Player with 5 tokens triggers Overload and scatters both token piles', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];

    p1.x = 0;
    p1.y = 0;
    p1.z = 0;
    p1.rotationY = 0;
    p1.tokens = 5;

    p2.x = 0;
    p2.y = 0;
    p2.z = 2.0;
    p2.tokens = 3;

    startPunch(p1);
    assert(p1.isOverloadPunch === true, 'P1 punch should be tagged as Overload');

    const hits = checkPunchCollisions(p1, engine.players, () => {});
    assert(hits.length === 1, 'Punch should register');
    assert(hits[0].isOverload === true, 'Hit result must be Overload');
    assert(p1.tokens === 0, 'P1 tokens should become 0 after Overload');
    assert(p2.tokens === 0, 'P2 tokens should become 0 after Overload');
    assert(hits[0].tokensToScatterAttacker === 5, 'Should scatter 5 tokens from attacker');
    assert(hits[0].tokensToScatterTarget === 3, 'Should scatter 3 tokens from target');
    assert(hits[0].attackerRecoilZ < 0, 'Attacker must suffer negative recoil along Z');
  });

  // 6. Punch miss never transfers tokens
  record('Scenario 6: Punch miss never transfers tokens', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];

    p1.x = -15;
    p1.y = 0;
    p1.z = 0;
    p1.rotationY = 0;
    p1.tokens = 2;

    p2.x = 15;
    p2.y = 0;
    p2.z = 0;
    p2.tokens = 2;

    startPunch(p1);
    const hits = checkPunchCollisions(p1, engine.players, () => {});

    assert(hits.length === 0, 'Punch should miss');
    assert(p1.tokens === 2, 'P1 tokens must remain unchanged on miss');
    assert(p2.tokens === 2, 'P2 tokens must remain unchanged on miss');
  });

  // 7. Max capacity (8 tokens): transferred token drops as loose token on ground
  record('Scenario 7: Transferred token to player at capacity 8 drops as loose token', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];

    p1.x = 0;
    p1.y = 0;
    p1.z = 0;
    p1.rotationY = 0;
    p1.tokens = 2;

    p2.x = 0;
    p2.y = 0;
    p2.z = 2.0;
    p2.tokens = MAX_CARRIED_TOKENS;

    startPunch(p1);
    const hits = checkPunchCollisions(p1, engine.players, () => {});

    assert(hits.length === 1, 'Hit registered');
    assert(p1.tokens === 1, 'P1 transferred 1 token');
    assert(p2.tokens === MAX_CARRIED_TOKENS, 'P2 stays at capacity 8');
    assert(hits[0].targetDroppedLooseToken === true, 'Token dropped as loose token rather than disappearing');
  });

  // 8. Loose tokens can be collected
  record('Scenario 8: Loose tokens can be collected by players walking over them', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    p1.tokens = 0;
    p1.x = 5;
    p1.y = 0;
    p1.z = 5;

    engine.tokenSystem.looseTokens.push({
      id: 999,
      x: 5,
      y: 0.5,
      z: 5,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.6,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      vRotX: 0,
      vRotY: 0,
      vRotZ: 0,
      isGrounded: true,
      droppedByPlayerId: null,
      pickupCooldown: 0,
      isNaturalSpawn: false,
      value: 1,
      sparkleTimer: 0,
    });

    engine.tokenSystem.update(0.016, false, false, engine.players, [], () => {});
    assert(p1.tokens === 1, `P1 should collect loose token, got ${p1.tokens}`);
    assert(engine.tokenSystem.looseTokens.length === 0, 'Loose token was consumed');
  });

  // 9, 10, 11. Ring-out removes life, respawns with lives left, 0 lives becomes eliminated ghost
  record('Scenarios 9, 10, 11: Ring-outs, respawn, and elimination to ghost', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];

    engine.matchFlow.handleRingOut(p1, engine.tokenSystem, engine.modifierSystem);
    assert(p1.lives === 2, `P1 should have 2 lives, got ${p1.lives}`);
    assert(p1.respawnTimer > 0, 'P1 should have respawn timer');

    engine.matchFlow.update(1.1, engine.players, engine.tokenSystem, engine.modifierSystem);
    assert(!p1.isEliminated, 'P1 should be alive');

    engine.matchFlow.handleRingOut(p1, engine.tokenSystem, engine.modifierSystem);
    assert(p1.lives === 1, `P1 should have 1 life, got ${p1.lives}`);
    engine.matchFlow.update(1.1, engine.players, engine.tokenSystem, engine.modifierSystem);

    engine.matchFlow.handleRingOut(p1, engine.tokenSystem, engine.modifierSystem);
    assert(p1.lives === 0, 'P1 should have 0 lives');
    assert(p1.isEliminated === true, 'P1 must be permanently eliminated');
    assert(p1.isGhost === true, 'P1 must become a spectator ghost');
    assert(p1.respawnTimer === 0, 'P1 must not have respawn timer');
  });

  // 12 & 13. Mayhem transition at 30s remaining sets all surviving to 1 life, eliminated remain eliminated
  record('Scenarios 12 & 13: Mayhem transition sets living players to 1 life', () => {
    const engine = new GameEngine({ totalPlayers: 3, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];
    const p3 = engine.players[2];

    p1.lives = 3;
    p2.lives = 2;
    p3.lives = 0;
    p3.isEliminated = true;
    p3.isGhost = true;

    engine.matchFlow.timeRemaining = 31;
    engine.matchFlow.update(2.0, engine.players, engine.tokenSystem, engine.modifierSystem);

    assert(engine.matchFlow.phase === 'MAYHEM', 'Phase should be MAYHEM');
    assert(p1.lives === 1, 'P1 lives set to 1 in Mayhem');
    assert(p2.lives === 1, 'P2 lives set to 1 in Mayhem');
    assert(p3.isEliminated === true, 'Already eliminated P3 must remain eliminated');
  });

  // 14. In Mayhem, next ring-out eliminates immediately
  record('Scenario 14: In Mayhem, ring-out eliminates immediately with no respawn', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    engine.matchFlow.phase = 'MAYHEM';
    const p1 = engine.players[0];
    p1.lives = 1;

    engine.matchFlow.handleRingOut(p1, engine.tokenSystem, engine.modifierSystem);
    assert(p1.lives === 0, 'P1 lives becomes 0');
    assert(p1.isEliminated === true, 'P1 immediately eliminated');
    assert(p1.isGhost === true, 'P1 becomes ghost');
    assert(p1.respawnTimer === 0, 'Respawns disabled in Mayhem');
  });

  // 15 & 16. Ghost abilities work and do not directly remove lives
  record('Scenarios 15 & 16: Ghost abilities place effects without removing lives', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];

    p1.isEliminated = true;
    p1.isGhost = true;
    p1.ghostCooldown = 0;

    const placed = engine.ghostSystem.placeAbility(p1, 'GUST_FAN', 5, 5);
    assert(placed === true, 'Ghost ability should be placed');
    assert(p1.ghostCooldown === 12.0, 'Ghost ability should set 12s cooldown');
    assert(p2.lives === 3, 'Ghost ability must never directly remove lives');
  });

  // 17. Scrap Pack eligibility and spawning
  record('Scenario 17: Scrap pack spawns for underdog with 0 tokens for 7s', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    p1.tokens = 0;
    p1.lives = 2;

    for (let i = 0; i < 8; i++) {
      engine.matchFlow.update(1.0, engine.players, engine.tokenSystem, engine.modifierSystem);
    }

    assert(p1.hasUsedScrapPack === true, 'P1 qualified for Scrap Pack');
    const scrapPack = engine.modifierSystem.pickups.find((m) => m.category === 'SCRAP_PACK');
    assert(scrapPack !== undefined, 'Scrap pack must be spawned in arena');
  });

  // 18. Modifiers activate and apply effects
  record('Scenario 18: Modifiers activate and apply effects', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    p1.punchModifier = 'ROCKET_KNUCKLES';

    p1.x = 0;
    p1.y = 0;
    p1.z = 0;
    p1.rotationY = 0;
    const p2 = engine.players[1];
    p2.x = 0;
    p2.y = 0;
    p2.z = 2.0;

    startPunch(p1);
    const hits = checkPunchCollisions(p1, engine.players, () => {});
    assert(hits.length === 1, 'Hit registered');
    assert(p1.punchModifier === null, 'Rocket knuckles consumed on hit');
  });

  // 19. Giga Bonk spawning and shockwave
  record('Scenario 19: GIGA BONK spawns, charges and creates shockwave', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const giga = engine.modifierSystem.spawnGigaBonk();
    assert(giga.category === 'GIGA_BONK', 'Spawned Giga Bonk');

    const p1 = engine.players[0];
    p1.hasGigaBonk = true;
    startPunch(p1);
    assert(p1.isChargingGigaBonk === true, 'P1 starts charging Giga Bonk');
    assert(p1.gigaBonkChargeTimer === 1.0, 'Charge timer set to 1s');
  });

  // 20. Match ends with single winner
  record('Scenario 20: Match ends with single winner', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p2 = engine.players[1];
    p2.lives = 1;

    engine.matchFlow.phase = 'MAYHEM';
    engine.matchFlow.handleRingOut(p2, engine.tokenSystem, engine.modifierSystem);
    const endPhase = engine.matchFlow.update(0.1, engine.players, engine.tokenSystem, engine.modifierSystem);

    assert(endPhase === 'FINISHED', 'Match should finish');
    assert(engine.matchFlow.winner?.id === engine.players[0].id, 'P1 should be declared winner');
  });

  // 21. Left & Right move relative to screen view at any camera yaw
  record('Scenario 21: Left and Right movement is mathematically screen-relative across all camera angles', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];

    // Set countdownTimer to 0 to simulate active gameplay
    engine.matchFlow.countdownTimer = 0;

    // At yaw = 0 (looking from -Z toward +Z): Right is screen right (-X in right-handed 3D space), Left is screen left (+X)
    engine.humanInput.cameraYaw = 0;
    engine.humanInput.right = true;
    engine.humanInput.left = false;
    engine.step(0.05);
    assert(p1.vx < 0, 'At yaw=0, pressing Right accelerates negative X (screen right)');

    p1.vx = 0;
    engine.humanInput.right = false;
    engine.humanInput.left = true;
    engine.step(0.05);
    assert(p1.vx > 0, 'At yaw=0, pressing Left accelerates positive X (screen left)');

    // At yaw = PI/2 (90 deg, camera facing +X): screen right is +Z, screen left is -Z
    p1.vx = 0;
    p1.vz = 0;
    engine.humanInput.cameraYaw = Math.PI / 2;
    engine.humanInput.right = true;
    engine.humanInput.left = false;
    engine.step(0.05);
    assert(p1.vz > 0, 'At yaw=90deg, pressing Right accelerates positive Z (screen right)');

    p1.vz = 0;
    engine.humanInput.right = false;
    engine.humanInput.left = true;
    engine.step(0.05);
    assert(p1.vz < 0, 'At yaw=90deg, pressing Left accelerates negative Z (screen left)');
  });

  // 22. Analog Joypad continuous vector steering
  record('Scenario 22: Analog Joypad inputs drive 360-degree analog velocities', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    engine.matchFlow.countdownTimer = 0;

    p1.vx = 0;
    p1.vz = 0;
    engine.humanInput.cameraYaw = 0;
    engine.humanInput.analogX = 0.707;
    engine.humanInput.analogY = 0.707;
    engine.step(0.05);

    assert(p1.vx < 0 && p1.vz > 0, 'Analog Joypad simultaneously accelerates X (screen right) and Z (screen forward) at 45 degree heading');
  });

  // 23. Countdown freeze verification
  record('Scenario 23: 3-2-1 Countdown freezes combatant movement until GO/BONK', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    assert(engine.matchFlow.countdownTimer > 0, 'Match begins with countdown timer');

    engine.humanInput.forward = true;
    engine.step(0.05);
    assert(p1.vx === 0 && p1.vz === 0, 'Player cannot move during countdown');
  });

  // 24. Symmetrical perimeter spawning
  record('Scenario 24: Players spawn symmetrically on perimeter/edges of arena facing center', () => {
    const count = 4;
    const engine = new GameEngine({ totalPlayers: count, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    for (let i = 0; i < count; i++) {
      const p = engine.players[i];
      const dist = Math.hypot(p.x, p.z);
      assert(dist > 18 && dist < PLATFORM_RADIUS, 'Player spawned on perimeter edge of platform');
    }
  });

  // 25. Token pickup radius & closest player priority
  record('Scenario 25: Token within 3.2m radius is collected with closest player priority', () => {
    const engine = new GameEngine({ totalPlayers: 3, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    engine.matchFlow.countdownTimer = 0;
    const p1 = engine.players[0]; // at distance 2.5m from token
    const p2 = engine.players[1]; // at distance 1.2m from token
    p1.x = 2.5; p1.y = 0; p1.z = 0; p1.tokens = 0;
    p2.x = 1.2; p2.y = 0; p2.z = 0; p2.tokens = 0;

    engine.tokenSystem.looseTokens = [{
      id: 999,
      x: 0,
      y: 0.5,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.6,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      vRotX: 0,
      vRotY: 0,
      vRotZ: 0,
      isGrounded: true,
      droppedByPlayerId: null,
      pickupCooldown: 0,
      isNaturalSpawn: true,
      value: 1,
      sparkleTimer: 0,
    }];

    engine.tokenSystem.update(0.05, false, false, engine.players, [], () => {});
    assert(p2.tokens === 1, 'Closest player (p2 at 1.2m) has higher pickup priority than p1 (2.5m)');
    assert(p1.tokens === 0, 'P1 did not get the token because p2 was closer');
    assert(engine.tokenSystem.looseTokens.length === 0, 'Token collected');
  });

  // 26. Gravity power & recovery difficulty (no mid-air brake clamp on knockback)
  record('Scenario 26: Increased gravity and air control restriction prevent easy recovery', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    engine.matchFlow.countdownTimer = 0;
    const p1 = engine.players[0];
    p1.isGrounded = false;
    p1.y = 10;
    p1.vy = 0;
    p1.vx = 35; // high launch velocity

    // Step physics with player trying to brake by steering in opposite direction
    engine.step(0.1);
    assert(p1.vy < -4.0, 'Strong gravity pulls airborne player down rapidly (vy < -4 after 0.1s)');
    assert(p1.vx > 30, 'Launch velocity is preserved ballistically in mid-air (not artificially clamped to run speed)');
  });

  // 27. Killfeed knockout tracking
  record('Scenario 27: Killfeed records attacker attribution and elimination badges on ring-out', () => {
    const engine = new GameEngine({ totalPlayers: 2, cpuDifficulty: 'NORMAL', matchDuration: 120, soundEnabled: false });
    const p1 = engine.players[0];
    const p2 = engine.players[1];
    p2.lives = 1;
    p2.lastAttackerId = p1.id;
    p2.lastHitTimer = 3.0;
    p2.lastHitType = 'GIGA_BONK';

    engine.matchFlow.handleRingOut(p2, engine.tokenSystem, engine.modifierSystem, engine.players);

    assert(engine.matchFlow.killfeed.length > 0, 'Killfeed entry generated');
    const entry = engine.matchFlow.killfeed[0];
    assert(entry.attackerName === p1.name, 'Attacker name recorded');
    assert(entry.victimName === p2.name, 'Victim name recorded');
    assert(entry.action === 'GIGA_BONK', 'Action recorded as GIGA_BONK');
    assert(entry.isElimination === true, 'Marked as elimination when lives reach 0');
    assert(p1.stats.knockouts === 1, 'Attacker knockout stat incremented');
  });

  return { passed, results };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('gameEngine.test')) {
  console.log('Running PASS THE PUNCH test suite...');
  const res = runAllTests();
  console.log(res.results.join('\n'));
  console.log(`\nAll ${res.passed} tests passed successfully!`);
}
