import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  GameSnapshot,
  GhostAbilityType,
  KeybindSettings,
  MatchSettings,
  PlayerInputPacket,
  RoomState,
  TouchLayoutSettings,
} from './game/types';
import { GameEngine } from './game/GameEngine';
import { CameraViewMode, GameRenderer3D } from './render/GameRenderer3D';
import { InputManager } from './input/InputManager';
import { MainMenu } from './components/MainMenu';
import { GameHUD, isTouchDevice } from './components/GameHUD';
import { PauseMenu } from './components/PauseMenu';
import { ResultsScreen } from './components/ResultsScreen';
import { DebugOverlay } from './components/DebugOverlay';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import {
  SettingsModal,
  DEFAULT_KEYBINDS,
  DEFAULT_TOUCH_LAYOUT,
} from './components/SettingsModal';
import { TouchLayoutEditor } from './components/TouchLayoutEditor';
import { sound } from './game/audio';
import { triggerHaptic } from './game/haptics';
import { triggerFullscreen } from './utils/fullscreen';

type ScreenState = 'MENU' | 'LOBBY' | 'PLAYING' | 'RESULTS';

export function App() {
  const [screen, setScreen] = useState<ScreenState>('MENU');
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number>(1);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [settings, setSettings] = useState<MatchSettings>({
    totalPlayers: 4,
    cpuDifficulty: 'NORMAL',
    matchDuration: 120,
    soundEnabled: true,
  });

  const [keybinds, setKeybinds] = useState<KeybindSettings>(DEFAULT_KEYBINDS);
  const [touchLayout, setTouchLayout] = useState<TouchLayoutSettings>(() => {
    try {
      const saved = localStorage.getItem('punch_touch_layout');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TOUCH_LAYOUT;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showTouchLayoutEditor, setShowTouchLayoutEditor] = useState<boolean>(false);

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('THIRD_PERSON');
  const [selectedGhostAbility, setSelectedGhostAbility] = useState<GhostAbilityType | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  const lastPhaseRef = useRef<string | null>(null);
  const meEliminatedRef = useRef<boolean>(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const renderer3DRef = useRef<GameRenderer3D | null>(null);
  const inputManagerRef = useRef<InputManager | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onlineSnapshotsRef = useRef<Array<{ receivedAt: number; snapshot: GameSnapshot }>>([]);
  const pointerDragRef = useRef<{ isDragging: boolean; lastX: number; lastY: number; moved: boolean }>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    moved: false,
  });

  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = typeof document !== 'undefined' && document.pointerLockElement === viewportRef.current;
      setIsPointerLocked(locked);
    };
    document.addEventListener('pointerlockchange', handleLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, []);

  // =========================================================================
  // WEBSOCKET MANAGEMENT (Online Multiplayer)
  // =========================================================================
  const getWebSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        resolve(socketRef.current);
        return;
      }

      const configuredServer = import.meta.env.VITE_GAME_SERVER_URL?.trim();
      const wsUrl = configuredServer
        ? configuredServer.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:').replace(/\/$/, '')
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        socketRef.current = ws;
        resolve(ws);
      };

      ws.onerror = (err) => {
        reject(err);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleSocketMessage(msg);
        } catch (e) {
          console.error('Socket message parse error:', e);
        }
      };

      ws.onclose = () => {
        socketRef.current = null;
      };
    });
  }, []);

  const handleSocketMessage = (msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'ROOM_CREATED':
      case 'ROOM_JOINED': {
        const roomData = msg.room as RoomState;
        const playerId = msg.myPlayerId as number;
        setRoom(roomData);
        setMyPlayerId(playerId);
        setSettings(roomData.settings);
        setScreen('LOBBY');
        setIsOnline(true);
        setIsConnecting(false);
        setConnectionError(null);
        break;
      }

      case 'ROOM_STATE': {
        const roomData = msg.room as RoomState;
        setRoom(roomData);
        setSettings(roomData.settings);
        break;
      }

      case 'MATCH_STARTED': {
        const roomData = msg.room as RoomState;
        setRoom(roomData);
        startOnlineMatch(roomData);
        break;
      }

      case 'GAME_SNAPSHOT': {
        const snap = msg.snapshot as GameSnapshot;
        const snapshots = onlineSnapshotsRef.current;
        snapshots.push({ receivedAt: performance.now(), snapshot: snap });
        if (snapshots.length > 8) snapshots.splice(0, snapshots.length - 8);
        setSnapshot(snap);
        processSnapshotAnnouncements(snap);

        // Sync authoritative positions to client display engine for 3D rendering
        if (engineRef.current) {
          engineRef.current.players = snap.players;
          engineRef.current.matchFlow.phase = snap.phase;
          engineRef.current.matchFlow.countdownTimer = snap.countdownTimer;
          engineRef.current.matchFlow.timeRemaining = snap.timeRemaining;
          engineRef.current.matchFlow.safeRadius = snap.safeRadius;
          engineRef.current.matchFlow.winner = snap.winner;
          engineRef.current.matchFlow.messages = snap.messages;
          if (snap.looseTokens) {
            engineRef.current.tokenSystem.looseTokens = snap.looseTokens;
          }
          if (snap.pickups) {
            engineRef.current.modifierSystem.pickups = snap.pickups;
          }
          if (snap.ghostZones) {
            engineRef.current.ghostSystem.activeZones = snap.ghostZones;
          }
        }

        if (snap.phase === 'FINISHED') {
          setTimeout(() => {
            setScreen((cur) => (cur === 'PLAYING' ? 'RESULTS' : cur));
          }, 1200);
        }
        break;
      }

      case 'ERROR': {
        setIsConnecting(false);
        setConnectionError(String(msg.message || 'Multiplayer error'));
        break;
      }

      default:
        break;
    }
  };

  const sendSocketMessage = (payload: object) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  // Create Online Room
  const handleCreateOnlineRoom = async (playerName: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const ws = await getWebSocket();
      ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName }));
    } catch {
      setIsConnecting(false);
      setConnectionError('Could not connect to multiplayer server.');
    }
  };

  // Join Online Room
  const handleJoinOnlineRoom = async (code: string, playerName: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const ws = await getWebSocket();
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', code, playerName }));
    } catch {
      setIsConnecting(false);
      setConnectionError('Could not connect to multiplayer server.');
    }
  };

  // Start Online Match (Client-side setup for receiving authoritative snapshots)
  const startOnlineMatch = (currentRoom: RoomState) => {
    cleanupMatch();

    setSnapshot(null);
    setScreen('PLAYING');
    setIsPaused(false);
    setSelectedGhostAbility(null);

    // Create client display engine
    const engine = new GameEngine(currentRoom.settings);
    engineRef.current = engine;
    onlineSnapshotsRef.current = [];

    const inputMgr = new InputManager(
      engine,
      keybinds,
      () => {},
      () => setShowDebug((prev) => !prev),
      (packet: PlayerInputPacket) => {
        // Stream inputs to authoritative server
        sendSocketMessage({
          type: 'PLAYER_INPUT',
          input: packet,
        });
      }
    );
    inputManagerRef.current = inputMgr;
  };

  const processSnapshotAnnouncements = useCallback(
    (snap: GameSnapshot) => {
      // 1. Phase transitions (Haptics only, no voicelines)
      if (snap.phase !== lastPhaseRef.current) {
        if (snap.phase === 'FINISHED') {
          if (snap.winner && snap.winner.id === myPlayerId) {
            triggerHaptic('win');
          } else {
            triggerHaptic('lose');
          }
        }
        lastPhaseRef.current = snap.phase;
      }

      // 2. Personal elimination check
      const me = snap.players.find((p) => p.id === myPlayerId);
      if (me) {
        if ((me.isEliminated || me.isGhost) && !meEliminatedRef.current) {
          meEliminatedRef.current = true;
          triggerHaptic('lose');
        } else if (!me.isEliminated && !me.isGhost) {
          meEliminatedRef.current = false;
        }
      }
    },
    [myPlayerId]
  );

  // =========================================================================
  // LOCAL MATCH (Play vs Bots)
  // =========================================================================
  const handleStartLocalGame = () => {
    cleanupMatch();
    setIsOnline(false);
    setMyPlayerId(1);

    lastPhaseRef.current = null;
    meEliminatedRef.current = false;

    setSnapshot(null);
    setScreen('PLAYING');
    setIsPaused(false);
    setSelectedGhostAbility(null);

    const engine = new GameEngine(settings);
    engineRef.current = engine;

    engine.setSnapshotCallback((snap) => {
      setSnapshot(snap);
      processSnapshotAnnouncements(snap);
      if (snap.phase === 'FINISHED') {
        engine.setPaused(true);
        setTimeout(() => {
          setScreen((cur) => (cur === 'PLAYING' ? 'RESULTS' : cur));
        }, 1200);
      }
    });

    const inputMgr = new InputManager(
      engine,
      keybinds,
      () => {
        setIsPaused((prev) => {
          const next = !prev;
          engine.setPaused(next);
          if (next) {
            if (typeof document !== 'undefined' && document.pointerLockElement) {
              try {
                document.exitPointerLock();
              } catch {}
            }
          } else {
            if (viewportRef.current && !selectedGhostAbility) {
              try {
                viewportRef.current.requestPointerLock();
              } catch {}
            }
          }
          return next;
        });
      },
      () => setShowDebug((prev) => !prev)
    );
    inputManagerRef.current = inputMgr;

    engine.start();
  };

  const cleanupMatch = () => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {}
    }
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    if (inputManagerRef.current) {
      inputManagerRef.current.destroy();
      inputManagerRef.current = null;
    }
    if (renderer3DRef.current) {
      renderer3DRef.current.destroy();
      renderer3DRef.current = null;
    }
  };

  // Mount Three.js 3D Renderer when in PLAYING screen
  useEffect(() => {
    if (screen === 'PLAYING' && viewportRef.current && engineRef.current) {
      if (renderer3DRef.current) {
        renderer3DRef.current.destroy();
        renderer3DRef.current = null;
      }

      const renderer3D = new GameRenderer3D(viewportRef.current, engineRef.current);
      renderer3D.setCameraMode(cameraMode);
      renderer3D.targetPlayerId = myPlayerId;
      renderer3DRef.current = renderer3D;

      let animId: number;
      let lastTime = performance.now();

      const renderLoop = (time: number) => {
        const dt = Math.min(0.1, (time - lastTime) / 1000);
        lastTime = time;

        if (renderer3DRef.current) {
          if (isOnline && engineRef.current) {
            const buffer = onlineSnapshotsRef.current;
            const renderAt = performance.now() - 100;
            while (buffer.length > 2 && buffer[1].receivedAt <= renderAt) buffer.shift();
            if (buffer.length >= 2) {
              const first = buffer[0];
              const second = buffer[1];
              const span = Math.max(1, second.receivedAt - first.receivedAt);
              const alpha = Math.max(0, Math.min(1, (renderAt - first.receivedAt) / span));
              const previousPlayers = new Map(first.snapshot.players.map((player) => [player.id, player]));
              engineRef.current.players = second.snapshot.players;
              for (const player of engineRef.current.players) {
                const previous = previousPlayers.get(player.id);
                if (!previous) continue;
                player.x = previous.x + (player.x - previous.x) * alpha;
                player.y = previous.y + (player.y - previous.y) * alpha;
                player.z = previous.z + (player.z - previous.z) * alpha;
                const angleDelta = Math.atan2(Math.sin(player.rotationY - previous.rotationY), Math.cos(player.rotationY - previous.rotationY));
                player.rotationY = previous.rotationY + angleDelta * alpha;
              }
            }
          }
          renderer3DRef.current.targetPlayerId = myPlayerId;
          renderer3DRef.current.render(dt);

          // Keep cameraYaw in sync with input packets
          if (inputManagerRef.current) {
            inputManagerRef.current.setCameraYaw(renderer3DRef.current.cameraYaw);
          }
        }
        animId = requestAnimationFrame(renderLoop);
      };

      animId = requestAnimationFrame(renderLoop);

      return () => {
        cancelAnimationFrame(animId);
        if (renderer3DRef.current) {
          renderer3DRef.current.destroy();
          renderer3DRef.current = null;
        }
      };
    }
  }, [screen, myPlayerId, cameraMode, isOnline]);

  const handleCameraModeChange = (mode: CameraViewMode) => {
    setCameraMode(mode);
    if (renderer3DRef.current) {
      renderer3DRef.current.setCameraMode(mode);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    engineRef.current?.setPaused(true);
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {}
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    engineRef.current?.setPaused(false);
    if (viewportRef.current && !selectedGhostAbility) {
      try {
        viewportRef.current.requestPointerLock();
      } catch {}
    }
  };

  const handleRestart = () => {
    setIsPaused(false);
    if (isOnline) {
      sendSocketMessage({ type: 'RETURN_TO_LOBBY' });
      setScreen('LOBBY');
    } else {
      handleStartLocalGame();
    }
  };

  const handleMainMenu = () => {
    cleanupMatch();
    if (isOnline) {
      sendSocketMessage({ type: 'LEAVE_ROOM' });
      setIsOnline(false);
      setRoom(null);
    }
    setScreen('MENU');
    setIsPaused(false);
    setSnapshot(null);
  };

  const handleToggleSound = () => {
    const nextVal = sound.toggleSound();
    setSettings((prev) => ({ ...prev, soundEnabled: nextVal }));
  };

  // =========================================================================
  // MOUSE & TOUCH SWIPE CAMERA PANNING + GHOST SABOTAGE
  // =========================================================================
  const updateGhostSabotagePreview = (clientX: number, clientY: number) => {
    if (!viewportRef.current || !renderer3DRef.current || !selectedGhostAbility) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, renderer3DRef.current.camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(groundPlane, targetPoint);
    if (hit) {
      renderer3DRef.current.setSabotagePreview(targetPoint.x, targetPoint.z, selectedGhostAbility);
    }
  };

  const executeGhostMischief = (clientX: number, clientY: number, abilityType?: GhostAbilityType) => {
    if (!viewportRef.current || !renderer3DRef.current) return;
    const me =
      engineRef.current?.players.find((p) => p.id === myPlayerId) ||
      engineRef.current?.players.find((p) => p.isHuman);
    if (!me || !me.isGhost || me.ghostCooldown > 0) return;

    const chosenAbility: GhostAbilityType =
      abilityType || selectedGhostAbility || me.selectedGhostAbility || 'GUST_FAN';

    const isPointerLocked =
      typeof document !== 'undefined' && document.pointerLockElement === viewportRef.current;

    const raycaster = new THREE.Raycaster();
    if (isPointerLocked) {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), renderer3DRef.current.camera);
    } else {
      const rect = viewportRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, renderer3DRef.current.camera);
    }

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(groundPlane, targetPoint);

    const targetX = hit ? targetPoint.x : me.x;
    const targetZ = hit ? targetPoint.z : me.z;

    triggerHaptic('mischief');
    if (isOnline) {
      sendSocketMessage({
        type: 'GHOST_SABOTAGE',
        abilityType: chosenAbility,
        x: targetX,
        z: targetZ,
      });
    } else if (engineRef.current) {
      engineRef.current.triggerHumanGhostAbility(chosenAbility, targetX, targetZ, myPlayerId);
    }

    renderer3DRef.current.setSabotagePreview(0, 0, null);
    renderer3DRef.current.triggerShockwave(targetX, targetZ, 0xc084fc);
    setSelectedGhostAbility(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    triggerFullscreen();
    if (isPaused) return;

    const me =
      engineRef.current?.players.find((p) => p.id === myPlayerId) ||
      engineRef.current?.players.find((p) => p.isHuman);

    // Right-click immediately triggers ghost mischief when eliminated!
    if (e.button === 2 && me?.isGhost) {
      e.preventDefault();
      executeGhostMischief(e.clientX, e.clientY);
      return;
    }

    // Pointer lock for desktop mouse: hides cursor, eliminates screen boundaries & edge getting-stuck issues
    if (e.pointerType === 'mouse' && !selectedGhostAbility && viewportRef.current) {
      if (typeof document !== 'undefined' && document.pointerLockElement !== viewportRef.current) {
        try {
          viewportRef.current.requestPointerLock();
        } catch {}
      }

      // Handle mouse button combat keybinds (Left click punches by default!)
      const mouseCode = `Mouse${e.button}`;
      if (keybinds.punch === mouseCode || (keybinds.punch === 'Mouse0' && e.button === 0)) {
        inputManagerRef.current?.setVirtualInput('punch', true);
      } else if (keybinds.dodge === mouseCode) {
        inputManagerRef.current?.setVirtualInput('dodge', true);
      }
    }

    pointerDragRef.current = {
      isDragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Completely freeze camera panning if game is paused
    if (isPaused) return;

    if (selectedGhostAbility) {
      updateGhostSabotagePreview(e.clientX, e.clientY);
    }

    if (e.pointerType === 'mouse') {
      // Natural laptop/desktop camera pan with mouse (works seamlessly with Pointer Lock and unbound edge movement)
      if (renderer3DRef.current && (Math.abs(e.movementX) > 0 || Math.abs(e.movementY) > 0)) {
        renderer3DRef.current.onMouseMove(e.movementX, e.movementY);
        if (inputManagerRef.current) {
          inputManagerRef.current.setCameraYaw(renderer3DRef.current.cameraYaw);
        }
      }
    } else {
      // Mobile / tablet touch swipe
      if (!pointerDragRef.current.isDragging) return;
      const deltaX = e.clientX - pointerDragRef.current.lastX;
      const deltaY = e.clientY - pointerDragRef.current.lastY;

      if (Math.hypot(deltaX, deltaY) > 3) {
        pointerDragRef.current.moved = true;
      }

      pointerDragRef.current.lastX = e.clientX;
      pointerDragRef.current.lastY = e.clientY;

      if (renderer3DRef.current) {
        renderer3DRef.current.onPointerDrag(deltaX, deltaY);
        if (inputManagerRef.current) {
          inputManagerRef.current.setCameraYaw(renderer3DRef.current.cameraYaw);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (renderer3DRef.current) {
      renderer3DRef.current.onWheelZoom(e.deltaY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasDragging = pointerDragRef.current.moved;
    pointerDragRef.current.isDragging = false;

    if (e.pointerType === 'mouse') {
      const mouseCode = `Mouse${e.button}`;
      if (keybinds.punch === mouseCode || (keybinds.punch === 'Mouse0' && e.button === 0)) {
        inputManagerRef.current?.setVirtualInput('punch', false);
      } else if (keybinds.dodge === mouseCode) {
        inputManagerRef.current?.setVirtualInput('dodge', false);
      }
    }

    // If it was a quick tap/click without dragging, perform Ghost Sabotage placement
    if (!wasDragging && selectedGhostAbility && viewportRef.current && renderer3DRef.current) {
      executeGhostMischief(e.clientX, e.clientY, selectedGhostAbility);
    }
  };

  return (
    <div
      onClick={triggerFullscreen}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-screen h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 font-sans flex items-center justify-center select-none touch-none"
    >
      {/* 1. Main Menu */}
      {screen === 'MENU' && (
        <MainMenu
          settings={settings}
          onUpdateSettings={setSettings}
          onStartLocalGame={handleStartLocalGame}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onJoinOnlineRoom={handleJoinOnlineRoom}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isConnecting={isConnecting}
          connectionError={connectionError}
        />
      )}

      {/* 2. Multiplayer Lobby */}
      {screen === 'LOBBY' && room && (
        <MultiplayerLobby
          room={room}
          myPlayerId={myPlayerId}
          onUpdateSettings={(newSettings) => {
            sendSocketMessage({
              type: 'UPDATE_SETTINGS',
              settings: newSettings,
            });
          }}
          onToggleReady={() => {
            sendSocketMessage({ type: 'TOGGLE_READY' });
          }}
          onStartMatch={() => {
            sendSocketMessage({ type: 'START_MATCH' });
          }}
          onLeaveRoom={handleMainMenu}
        />
      )}

      {/* 3. In-Game 3D Match Viewport */}
      {screen === 'PLAYING' && (
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onPointerCancel={() => {
            pointerDragRef.current.isDragging = false;
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative w-full h-full bg-slate-950 overflow-hidden ${
            selectedGhostAbility ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          {/* Three.js canvas renders inside viewportRef */}

          {/* In-Game HUD & Controls */}
          {snapshot && (
            <GameHUD
              snapshot={snapshot}
              soundEnabled={settings.soundEnabled}
              cameraMode={cameraMode}
              touchLayout={touchLayout}
              onToggleSound={handleToggleSound}
              onPause={handlePause}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenLayoutEditor={() => setShowTouchLayoutEditor(true)}
              onCameraModeChange={handleCameraModeChange}
              onGhostAbilitySelect={(type) => {
                setSelectedGhostAbility((prev) => {
                  const next = prev === type ? null : type;
                  if (next && typeof document !== 'undefined' && document.pointerLockElement) {
                    try {
                      document.exitPointerLock();
                    } catch {}
                  }
                  return next;
                });
              }}
              selectedGhostAbility={selectedGhostAbility}
              onVirtualInput={(action, pressed) => {
                inputManagerRef.current?.setVirtualInput(action, pressed);
              }}
              onAnalogInput={(ax, ay) => {
                inputManagerRef.current?.setAnalogInput(ax, ay);
              }}
              myPlayerId={myPlayerId}
            />
          )}

          {/* Desktop Mouse Pointer Lock Indicator */}
          {!isPointerLocked && !isPaused && !isTouchDevice() && !selectedGhostAbility && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-20 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/80 text-[11px] text-slate-300 font-medium shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Click arena for 360° mouse look (ESC to release cursor)
            </div>
          )}

          {/* Pause Menu Modal */}
          {isPaused && (
            <PauseMenu
              soundEnabled={settings.soundEnabled}
              onResume={handleResume}
              onRestart={handleRestart}
              onMainMenu={handleMainMenu}
              onToggleSound={handleToggleSound}
            />
          )}

          {/* Debug Overlay */}
          {showDebug && snapshot && (
            <DebugOverlay
              snapshot={snapshot}
              onClose={() => setShowDebug(false)}
            />
          )}
        </div>
      )}

      {/* 4. Results Screen */}
      {screen === 'RESULTS' && snapshot && (
        <ResultsScreen
          winner={snapshot.winner}
          allPlayers={snapshot.players}
          onPlayAgain={isOnline ? handleRestart : handleStartLocalGame}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* 5. Settings Modal (PC Keybinds & Mobile Touch Customizer) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        keybinds={keybinds}
        onUpdateKeybinds={(newKeys) => {
          setKeybinds(newKeys);
          inputManagerRef.current?.updateKeybinds(newKeys);
        }}
        touchLayout={touchLayout}
        onUpdateTouchLayout={(newLayout) => {
          setTouchLayout(newLayout);
          try {
            localStorage.setItem('punch_touch_layout', JSON.stringify(newLayout));
          } catch {}
        }}
        onOpenLayoutEditor={() => setShowTouchLayoutEditor(true)}
        soundEnabled={settings.soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* 6. Interactive Touch Controls Layout Customizer / Preview */}
      {showTouchLayoutEditor && (
        <TouchLayoutEditor
          isOpen={showTouchLayoutEditor}
          onClose={() => setShowTouchLayoutEditor(false)}
          layout={touchLayout}
          onSaveLayout={(newLayout) => {
            setTouchLayout(newLayout);
            try {
              localStorage.setItem('punch_touch_layout', JSON.stringify(newLayout));
            } catch {}
          }}
        />
      )}
    </div>
  );
}

export default App;
