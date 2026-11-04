import { WebSocket } from 'ws';
import { GameEngine } from '../game/GameEngine';
import {
  GameSnapshot,
  GhostAbilityType,
  MatchSettings,
  NetworkPlayer,
  PlayerInputPacket,
  RoomState,
} from '../game/types';

interface ConnectedClient {
  socket: WebSocket;
  socketId: string;
  name: string;
  playerId: number;
  isReady: boolean;
  isHost: boolean;
  isDisconnected: boolean;
}

export class GameRoom {
  public code: string;
  public hostSocketId: string;
  public status: 'LOBBY' | 'PLAYING' | 'FINISHED' = 'LOBBY';
  public settings: MatchSettings = {
    totalPlayers: 4,
    cpuDifficulty: 'NORMAL',
    matchDuration: 120,
    soundEnabled: true,
  };

  public clients: Map<string, ConnectedClient> = new Map();
  public engine: GameEngine | null = null;
  private simulationTimer: NodeJS.Timeout | null = null;

  constructor(code: string, hostSocketId: string, hostName: string, hostSocket: WebSocket) {
    this.code = code;
    this.hostSocketId = hostSocketId;

    this.clients.set(hostSocketId, {
      socket: hostSocket,
      socketId: hostSocketId,
      name: hostName || 'HOST',
      playerId: 1,
      isReady: true,
      isHost: true,
      isDisconnected: false,
    });
  }

  public getRoomState(): RoomState {
    const players: NetworkPlayer[] = [];
    const clientList = Array.from(this.clients.values());

    for (const c of clientList) {
      players.push({
        id: c.playerId,
        socketId: c.socketId,
        name: c.name,
        color: this.getPlayerColor(c.playerId),
        isHost: c.isHost,
        isReady: c.isReady,
        isBot: false,
        isDisconnected: c.isDisconnected,
      });
    }

    // Add remaining bot slots in lobby view
    const totalCombatants = this.settings.totalPlayers;
    const botCount = Math.max(0, totalCombatants - players.length);
    for (let b = 0; b < botCount; b++) {
      const botId = players.length + 1;
      players.push({
        id: botId,
        socketId: `bot_${botId}`,
        name: `BOT ${botId}`,
        color: this.getPlayerColor(botId),
        isHost: false,
        isReady: true,
        isBot: true,
        isDisconnected: false,
      });
    }

    const hostClient = this.clients.get(this.hostSocketId);

    return {
      code: this.code,
      hostId: hostClient ? hostClient.playerId : 1,
      status: this.status,
      players,
      settings: { ...this.settings },
    };
  }

  private getPlayerColor(id: number): string {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[(id - 1) % colors.length];
  }

  public addClient(socketId: string, name: string, socket: WebSocket): { success: boolean; playerId: number; error?: string } {
    if (this.clients.size >= 7) {
      return { success: false, playerId: -1, error: 'Room is full (max 7 players)' };
    }

    // Check if reconnecting
    for (const client of this.clients.values()) {
      if (client.isDisconnected && client.name.toLowerCase() === name.toLowerCase()) {
        client.socket = socket;
        client.socketId = socketId;
        client.isDisconnected = false;
        return { success: true, playerId: client.playerId };
      }
    }

    // Assign next available player ID
    const takenIds = new Set(Array.from(this.clients.values()).map((c) => c.playerId));
    let nextId = 1;
    while (takenIds.has(nextId) && nextId <= 7) {
      nextId++;
    }

    this.clients.set(socketId, {
      socket,
      socketId,
      name: name || `PLAYER ${nextId}`,
      playerId: nextId,
      isReady: false,
      isHost: false,
      isDisconnected: false,
    });

    return { success: true, playerId: nextId };
  }

  public removeClient(socketId: string): boolean {
    const client = this.clients.get(socketId);
    if (!client) return this.clients.size === 0;

    if (this.status === 'PLAYING') {
      // In active match, keep player state but mark disconnected so match isn't ruined
      client.isDisconnected = true;
      if (this.engine) {
        const p = this.engine.players.find((player) => player.id === client.playerId);
        if (p) p.isHuman = false; // Turn into AI bot
      }
    } else {
      this.clients.delete(socketId);
    }

    // Reassign host if host left
    if (this.hostSocketId === socketId) {
      const active = Array.from(this.clients.values()).find((c) => !c.isDisconnected);
      if (active) {
        this.hostSocketId = active.socketId;
        active.isHost = true;
      }
    }

    const allDisconnected = Array.from(this.clients.values()).every((c) => c.isDisconnected);
    return allDisconnected || this.clients.size === 0;
  }

  public startMatch() {
    this.status = 'PLAYING';

    const humanClients = Array.from(this.clients.values()).filter((c) => !c.isDisconnected);
    // Sort humans by playerId
    humanClients.sort((a, b) => a.playerId - b.playerId);
    const humanNames = humanClients.map((c) => c.name);

    this.engine = new GameEngine(this.settings, humanNames);

    this.engine.setSnapshotCallback((snapshot: GameSnapshot) => {
      this.broadcast({
        type: 'GAME_SNAPSHOT',
        snapshot,
      });

      if (snapshot.phase === 'FINISHED') {
        this.status = 'FINISHED';
      }
    });

    // Keep authoritative physics at 60 Hz; send state at 20 Hz to reduce
    // serialization and network overhead. Clients interpolate between updates.
    const tickRate = 60;
    const dt = 1 / tickRate;
    let tick = 0;
    this.simulationTimer = setInterval(() => {
      if (this.engine) {
        tick += 1;
        this.engine.step(dt, tick % 3 === 0);
      }
    }, 1000 / tickRate);

    this.broadcast({
      type: 'MATCH_STARTED',
      room: this.getRoomState(),
    });
  }

  public stopMatch() {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }
    this.status = 'LOBBY';
  }

  public handleInput(socketId: string, input: PlayerInputPacket) {
    const client = this.clients.get(socketId);
    if (!client || !this.engine) return;
    this.engine.setPlayerInput(client.playerId, input);
  }

  public handleGhostSabotage(socketId: string, ability: GhostAbilityType, x: number, z: number) {
    const client = this.clients.get(socketId);
    if (!client || !this.engine) return;
    this.engine.triggerHumanGhostAbility(ability, x, z, client.playerId);
  }

  public broadcast(message: object) {
    const json = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (!client.isDisconnected && client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(json);
        } catch {
          // ignore closed socket error
        }
      }
    }
  }
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private socketToRoom: Map<string, string> = new Map();

  public createRoom(socketId: string, hostName: string, socket: WebSocket): GameRoom {
    const code = this.generateRoomCode();
    const room = new GameRoom(code, socketId, hostName, socket);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    return room;
  }

  public joinRoom(
    code: string,
    socketId: string,
    playerName: string,
    socket: WebSocket
  ): { room: GameRoom | null; playerId: number; error?: string } {
    const cleanCode = code.trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      return { room: null, playerId: -1, error: 'Room not found. Check code.' };
    }

    const res = room.addClient(socketId, playerName, socket);
    if (!res.success) {
      return { room: null, playerId: -1, error: res.error };
    }

    this.socketToRoom.set(socketId, cleanCode);
    return { room, playerId: res.playerId };
  }

  public getRoomBySocket(socketId: string): GameRoom | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    return this.rooms.get(code) || null;
  }

  public removeSocket(socketId: string): GameRoom | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(code);
    if (!room) return null;

    const shouldDelete = room.removeClient(socketId);
    if (shouldDelete) {
      room.stopMatch();
      this.rooms.delete(code);
      return null;
    }
    return room;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }
}
