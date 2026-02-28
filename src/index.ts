/**
 * 游戏大厅服务器入口
 * Bun + Express + Socket.io
 */

import express, { Express } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { authMiddleware, type AuthSocket } from './middleware/auth';
import { setupLobbyHandlers } from './handlers/LobbyHandler';
import { setupRoomHandlers } from './handlers/RoomHandler';
import { setupMatchingHandlers } from './handlers/MatchingHandler';
import { playerService } from './services/PlayerService';
import redis from './utils/redis'

import gameController from './controller/game'
import oauthController from './controller/oauth'
import config from './config';
import { userService } from './services/UserService';

const app: Express = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],  // 支持两种传输方式
  pingInterval: 25000,
  pingTimeout: 60000
});

const PORT = process.env.PORT || 3000;

/**
 * 中间件设置
 */
app.use(express.json());
app.use(express.static('public'));

/**
 * HTTP 路由
 */
app.get('/', (req, res) => {
  res.json({
    message: '🎮 游戏大厅服务器',
    version: '1.0.0',
    websocket: `ws://localhost:${PORT}`,
    docs: '/api/docs'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now()
  });
});

app.use('/api/games', gameController)
app.use('/api/oauth', oauthController)

/**
 * Socket.io 认证中间件
 */
io.use((socket, next) => {
  authMiddleware(socket as AuthSocket, next);
});

/**
 * Socket.io 连接处理
 */
io.on('connection', (socket: AuthSocket) => {
  const user_id = socket.user_id!;

  console.log(`\n✅ 玩家连接: ${user_id} (${socket.id})`);

  // 更新玩家状态为在线 ❌ 应该是用户服务
  // playerService.updatePlayerStatus(user_id, 'online');

  // 加入玩家专属的 Socket.io 房间
  socket.join(user_id);

  const key = config.prefix + 'stats:users'
  redis
    .ttl(key)
    .then(async (ttl) => {
      if (ttl === -2) {
        await userService.getStats()
      } else {
        await redis.pipeline().hincrby(key, 'total', 1).expire(key, config.expires).exec()
      }
    })
  // 广播用户上线
  if (socket.room_id) {
    io.to(`room:${socket.room_id}`).emit('room:player-network', { player_id: socket.player_id, online: true, timestamp: Date.now() });
  }
  io.emit('lobby:user-network', { user_id, online: true, timestamp: Date.now() });

  // 注册事件处理器
  setupLobbyHandlers(io, socket, user_id);
  setupRoomHandlers(io, socket, user_id);
  setupMatchingHandlers(io, socket, user_id);

  /**
   * 心跳检测
   */
  socket.on('ping', (callback) => {
    callback({ timestamp: Date.now() });
  });

  /**
   * 断开连接处理
   */
  socket.on('disconnect', () => {
    // 更新玩家状态
    // playerService.updatePlayerStatus(user_id, 'online'); // 实际应该设置为离线，但这里简化处理

    const key = config.prefix + 'stats:users'
    redis
      .ttl(key)
      .then(async (ttl) => {
        if (ttl === -2) {
          await userService.getStats()
        } else {
          await redis.pipeline().hincrby(key, 'total', -1).expire(key, config.expires).exec()
        }
      })
    // 广播玩家离线
    if (socket.room_id) {
      io.to(`room:${socket.room_id}`).emit('room:player-network', { player_id: socket.player_id, online: false, timestamp: Date.now() });
    }
    io.emit('lobby:user-network', { user_id, online: false, timestamp: Date.now() });


    console.log(`❌ 玩家断开: ${user_id} (${socket.id})\n`);
  });
});

/**
 * 启动服务器
 */
server.listen(PORT, () => {
  console.log(`\n🚀 游戏大厅服务器启动成功!`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📈 统计信息: http://localhost:${PORT}/api/stats\n`);
});

/**
 * 优雅关闭
 */
process.on('SIGINT', () => {
  console.log('\n🛑 服务器关闭中...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

export default app;