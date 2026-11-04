export type MatchPhase = 'NORMAL' | 'MAYHEM' | 'OVERTIME' | 'FINISHED';

export type CpuDifficulty = 'EASY' | 'NORMAL' | 'CHAOTIC';

export type PunchModifierType =
  | 'ROCKET_KNUCKLES'
  | 'TRIPLE_BONK'
  | 'STRETCHY_ARM'
  | 'THUNDER_BONK'
  | 'BOOMERANG_BONK';

export type TokenModifierType =
  | 'TOKEN_MAGNET'
  | 'POCKET_JACKPOT'
  | 'TOKEN_BOMB'
  | 'DOUBLE_VALUE'
  | 'STICKY_FINGERS';

export type GhostAbilityType = 'GUST_FAN' | 'JELLY_PATCH' | 'TOKEN_TORNADO';

export interface PlayerStats {
  knockouts: number;
  ringOuts: number;
  punchesLanded: number;
  tokensTransferred: number;
  tokensCollected: number;
  perfectDodges: number;
  ghostAbilitiesUsed: number;
}

export interface PlayerState {
  id: number;
  name: string;
  isHuman: boolean;
  color: string;
  accentColor: string;
  gloveColor: string;

  // 3D Position & Velocity
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationY: number; // facing angle in radians
  facing: 1 | -1;

  width: number;
  height: number;
  radius: number;
  isGrounded: boolean;

  // Combat & Tokens
  tokens: number;
  lives: number;
  isEliminated: boolean;
  isGhost: boolean;

  // Timers & States
  punchCooldown: number;
  punchTimer: number;
  punchHitRegistered: boolean;
  isOverloadPunch: boolean;
  dodgeCooldown: number;
  dodgeTimer: number;
  isInvulnerable: boolean;
  invulnerableTimer: number;
  perfectDodgeWindow: boolean;
  stunTimer: number;
  respawnTimer: number;

  // Underdog tracking
  zeroTokenTime: number;
  hasUsedScrapPack: boolean;

  // Active Modifiers
  punchModifier: PunchModifierType | null;
  tokenModifier: TokenModifierType | null;
  tokenModifierTimer: number;
  doubleValueCharges: number;

  // Giga Bonk
  hasGigaBonk: boolean;
  isChargingGigaBonk: boolean;
  gigaBonkChargeTimer: number;

  // Animation / Visual feel
  squashX: number;
  squashY: number;
  hitReactionTimer: number;
  trailTimer: number;

  // Knockout & Killfeed tracking
  lastAttackerId?: number;
  lastHitTimer?: number;
  lastHitType?: 'BONK' | 'OVERLOAD' | 'GIGA_BONK';

  // Ghost sabotage (when eliminated)
  ghostCooldown: number;
  selectedGhostAbility: GhostAbilityType | null;

  // Stats
  stats: PlayerStats;
}

export interface LooseToken {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  isGrounded: boolean;
  droppedByPlayerId: number | null;
  pickupCooldown: number;
  isNaturalSpawn: boolean;
  value: number;
  sparkleTimer: number;
}

export interface ModifierPickup {
  id: number;
  category: 'PUNCH' | 'TOKEN' | 'GIGA_BONK' | 'SCRAP_PACK';
  punchType?: PunchModifierType;
  tokenType?: TokenModifierType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  width: number;
  height: number;
  bobTimer: number;
  lifetime: number;
}

export interface GhostZoneEffect {
  id: number;
  type: GhostAbilityType;
  sourcePlayerId: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  warmupTimer: number;
  duration: number;
  directionX?: number;
  directionZ?: number;
}

export interface ComicParticle {
  id: number;
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  alpha: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'SPARK' | 'STAR' | 'TEXT' | 'RING' | 'FEATHER';
  text?: string;
  scale?: number;
}

export interface AnnouncerMessage {
  id: number;
  text: string;
  subtitle?: string;
  color: string;
  duration: number;
  scale: number;
}

export interface MatchSettings {
  totalPlayers: number; // 2 to 7
  cpuDifficulty: CpuDifficulty;
  matchDuration: number; // 60, 90, 120s
  soundEnabled: boolean;
}

export interface GameSnapshot {
  phase: MatchPhase;
  countdownTimer: number; // 3-2-1 match start countdown
  timeRemaining: number;
  overtimeElapsed: number;
  safeRadius: number; // shrinks in overtime
  players: PlayerState[];
  looseTokenCount: number;
  livingCount: number;
  winner: PlayerState | null;
  isPaused: boolean;
  gigaBonkSpawned: boolean;
  gigaBonkActive: boolean;
  activeEffectsCount: number;
  messages: AnnouncerMessage[];
  debugFps: number;
  looseTokens?: LooseToken[];
  pickups?: ModifierPickup[];
  ghostZones?: GhostZoneEffect[];
  killfeed?: KillfeedEntry[];
}

export interface KillfeedEntry {
  id: number;
  attackerName?: string;
  attackerColor?: string;
  attackerGloveColor?: string;
  victimName: string;
  victimColor: string;
  action: 'BONK' | 'OVERLOAD' | 'GIGA_BONK' | 'RING_OUT' | 'ZONE';
  isElimination: boolean;
  timestamp: number;
}

// Online Multiplayer Types
export interface NetworkPlayer {
  id: number;
  socketId: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  isBot: boolean;
  isDisconnected: boolean;
}

export interface RoomState {
  code: string;
  hostId: number;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  players: NetworkPlayer[];
  settings: MatchSettings;
}

export interface PlayerInputPacket {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  punch: boolean;
  dodge: boolean;
  cameraYaw: number;
  analogX?: number; // -1 to 1 (left to right)
  analogY?: number; // -1 to 1 (backward to forward)
}

export interface KeybindSettings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  punch: string;
  dodge: string;
  secondaryAction?: string; // Reserved for upcoming right-click function
}

export interface TouchLayoutSettings {
  scale: number; // 0.75 to 1.3
  position: 'RIGHT_HANDED' | 'LEFT_HANDED' | 'CUSTOM';
  opacity: number; // 0.3 to 1.0
  joypadPos?: { xPercent: number; yPercent: number };
  actionButtonsPos?: { xPercent: number; yPercent: number };
}

// 3D Arena Dimensions
export const PLATFORM_RADIUS = 28;
export const RINGOUT_FALL_DEPTH = -14;
export const ARENA_SURFACE_Y = 0;

export const MAX_CARRIED_TOKENS = 8;
export const OVERLOAD_THRESHOLD = 5;
export const INITIAL_LIVES = 3;
export const MATCH_DURATION = 120;
export const MAYHEM_START_TIME = 30;
