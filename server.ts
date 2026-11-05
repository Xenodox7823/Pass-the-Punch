import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { RoomManager } from './src/server/RoomManager';
import { GhostAbilityType, PlayerInputPacket } from './src/game/types';

const [nodeMajor, nodeMinor, nodePatch] = process.versions.node.split('.').map(Number);
if (
  nodeMajor < 24 ||
  (nodeMajor === 24 &&
    (nodeMinor < 22 || (nodeMinor === 22 && nodePatch < 2)))
) {
  throw new Error(
    `Pass the Punch requires Node.js 24.22.2 or newer in the 24.x line; current runtime is ${process.versions.node}.`
  );
}

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parsePlayerInput = (value: unknown): PlayerInputPacket | null => {
  if (!isRecord(value)) return null;
  const booleanFields = ['forward', 'backward', 'left', 'right', 'jump', 'punch', 'dodge'] as const;
  if (!booleanFields.every((field) => typeof value[field] === 'boolean')) return null;
  if (typeof value.cameraYaw !== 'number' || !Number.isFinite(value.cameraYaw)) return null;

  const input: PlayerInputPacket = {
    forward: value.forward as boolean,
    backward: value.backward as boolean,
    left: value.left as boolean,
    right: value.right as boolean,
    jump: value.jump as boolean,
    punch: value.punch as boolean,
    dodge: value.dodge as boolean,
    cameraYaw: value.cameraYaw,
  };
  for (const axis of ['analogX', 'analogY'] as const) {
    const axisValue = value[axis];
    if (axisValue !== undefined) {
      if (typeof axisValue !== 'number' || !Number.isFinite(axisValue)) return null;
      input[axis] = Math.max(-1, Math.min(1, axisValue));
    }
  }
  return input;
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    maxPayload: 16 * 1024,
    perMessageDeflate: false,
  });
  const roomManager = new RoomManager();

  let nextSocketId = 1;

  wss.on('connection', (ws: WebSocket) => {
    const socketId = `user_${nextSocketId++}`;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!isRecord(msg) || typeof msg.type !== 'string') return;

        switch (msg.type) {
          case 'CREATE_ROOM': {
            const playerName = typeof msg.playerName === 'string' ? msg.playerName.trim().slice(0, 24) : 'PLAYER';
            const room = roomManager.createRoom(socketId, playerName, ws);
            const state = room.getRoomState();
            ws.send(JSON.stringify({
              type: 'ROOM_CREATED',
              room: state,
              myPlayerId: 1,
            }));
            break;
          }

          case 'JOIN_ROOM': {
            if (typeof msg.code !== 'string') break;
            const playerName = typeof msg.playerName === 'string' ? msg.playerName.trim().slice(0, 24) : 'PLAYER';
            const res = roomManager.joinRoom(msg.code.slice(0, 12), socketId, playerName, ws);
            if (!res.room) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: res.error || 'Failed to join room',
              }));
            } else {
              const state = res.room.getRoomState();
              ws.send(JSON.stringify({
                type: 'ROOM_JOINED',
                room: state,
                myPlayerId: res.playerId,
              }));
              res.room.broadcast({
                type: 'ROOM_STATE',
                room: state,
              });
            }
            break;
          }

          case 'UPDATE_SETTINGS': {
            const room = roomManager.getRoomBySocket(socketId);
            if (room && room.hostSocketId === socketId && room.status === 'LOBBY') {
              if (!isRecord(msg.settings)) break;
              const candidate = { ...room.settings, ...msg.settings };
              const { totalPlayers, cpuDifficulty, matchDuration } = candidate;
              if (
                Number.isInteger(totalPlayers) && (totalPlayers as number) >= 2 && (totalPlayers as number) <= 7 &&
                ['EASY', 'NORMAL', 'HARD'].includes(String(cpuDifficulty)) &&
                [60, 90, 120].includes(Number(matchDuration))
              ) {
                room.settings = {
                  ...room.settings,
                  totalPlayers: totalPlayers as number,
                  cpuDifficulty: cpuDifficulty as typeof room.settings.cpuDifficulty,
                  matchDuration: matchDuration as number,
                };
              }
              room.broadcast({
                type: 'ROOM_STATE',
                room: room.getRoomState(),
              });
            }
            break;
          }

          case 'TOGGLE_READY': {
            const room = roomManager.getRoomBySocket(socketId);
            if (room && room.status === 'LOBBY') {
              const client = room.clients.get(socketId);
              if (client) {
                client.isReady = !client.isReady;
                room.broadcast({
                  type: 'ROOM_STATE',
                  room: room.getRoomState(),
                });
              }
            }
            break;
          }

          case 'START_MATCH': {
            const room = roomManager.getRoomBySocket(socketId);
            if (room && room.hostSocketId === socketId && room.status === 'LOBBY') {
              room.startMatch();
            }
            break;
          }

          case 'PLAYER_INPUT': {
            const room = roomManager.getRoomBySocket(socketId);
            if (room && room.status === 'PLAYING') {
              const input = parsePlayerInput(msg.input);
              if (input) room.handleInput(socketId, input, Number(msg.sequence));
            }
            break;
          }

          case 'GHOST_SABOTAGE': {
            const room = roomManager.getRoomBySocket(socketId);
            if (room && room.status === 'PLAYING') {
              const abilities: GhostAbilityType[] = ['GUST_FAN', 'JELLY_PATCH', 'TOKEN_TORNADO'];
              if (
                abilities.includes(msg.abilityType as GhostAbilityType) &&
                typeof msg.x === 'number' && Number.isFinite(msg.x) &&
                typeof msg.z === 'number' && Number.isFinite(msg.z)
              ) {
                room.handleGhostSabotage(socketId, msg.abilityType as GhostAbilityType, msg.x, msg.z);
              }
            }
            break;
          }

          case 'RETURN_TO_LOBBY': {
            const room = roomManager.getRoomBySocket(socketId);
            if (room && room.hostSocketId === socketId) {
              room.stopMatch();
              room.broadcast({
                type: 'ROOM_STATE',
                room: room.getRoomState(),
              });
            }
            break;
          }

          case 'LEAVE_ROOM': {
            const room = roomManager.removeSocket(socketId);
            if (room) {
              room.broadcast({
                type: 'ROOM_STATE',
                room: room.getRoomState(),
              });
            }
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: msg.timestamp, serverTime: Date.now() }));
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Socket message parse error:', err);
      }
    });

    ws.on('close', () => {
      const room = roomManager.removeSocket(socketId);
      if (room) {
        room.broadcast({
          type: 'ROOM_STATE',
          room: room.getRoomState(),
        });
      }
    });

    ws.on('error', () => {
      const room = roomManager.removeSocket(socketId);
      if (room) {
        room.broadcast({
          type: 'ROOM_STATE',
          room: room.getRoomState(),
        });
      }
    });
  });

  // REST health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: Date.now() });
  });

  if (!isProduction) {
    // Mount Vite middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
