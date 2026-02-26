/**
 * 大厅事件处理 - 支持密码加入和房间自动解散
 */

import type { Server, Socket } from 'socket.io';
import { gameService } from '../services/GameService';
import { roomService } from '../services/RoomService';
import { playerService } from '../services/PlayerService';
import type { AuthSocket } from '../middleware/auth';
import { userService } from '../services/UserService';

export function setupLobbyHandlers(io: Server, socket: AuthSocket, user_id: string) {
  const isLoggedIn = socket.isLoggedIn;
  const isGuest = socket.isGuest;

  /**
   * 获取游戏列表
   */
  socket.on('lobby:get-games', async (callback: (games: any[]) => void) => {
    const games = await gameService.getAllGames();
    callback(games);
  });

  /**
   * 获取房间列表
   */
  socket.on('lobby:get-rooms', async (data: { gameId: string }, callback: (rooms: any[]) => void) => {
    const { gameId } = data;
    const rooms = (await roomService.getRoomsByGameId(gameId)).map(room => roomService.getRoomInfo(room._id));

    callback(rooms);
  });

  /**
   * 创建房间 - 支持密码
   */
  socket.on(
    'lobby:create-room',
    async (
      data: { gameId: string; roomName: string; isPrivate?: boolean; password?: string },
      callback: (success: boolean, roomId?: string, error?: string) => void
    ) => {
      if (!isLoggedIn) {
        callback(false, undefined, '创建房间需要登陆');
        return;
      }

      const { gameId, roomName, isPrivate, password } = data;
      const player = await playerService.getPlayerById(user_id);

      if (!player) {
        callback(false, undefined, '玩家不存在');
        return;
      }

      const game = await gameService.getGameById(gameId);
      if (!game) {
        callback(false, undefined, '游戏不存在');
        return;
      }

      // 验证密码
      if (isPrivate && !password) {
        callback(false, undefined, '私密房间必须设置密码');
        return;
      }

      try {
        const room = await roomService.createRoom({
          gameId,
          name: roomName,
          owner: player,
          numbers: game.numbers,
          isPrivate: isPrivate || false,
          password: isPrivate ? password : undefined,
          settings: {
            difficulty: 'normal',
            mode: 'casual'
          }
        });

        roomService.joinRoom(room._id, player);
        socket.join(`room:${room._id}`);
        socket.join(`game:${gameId}`);

        io.to(`game:${gameId}`).emit('lobby:room-created', {
          roomId: room._id,
          roomName: room.name,
          playerCount: 1,
          numbers: room.numbers,
          isPrivate: isPrivate
        });

        callback(true, room._id);
        console.log(`✨ 房间创建: ${room._id} (玩家: ${player.user_id})`);
      } catch (error) {
        callback(false, undefined, '创建房间失败');
      }
    }
  );

  /**
   * 加入房间 - 支持密码验证
   */
  socket.on(
    'lobby:join-room',
    async (
      data: { roomId: string; password?: string },
      callback: (success: boolean, error?: string) => void
    ) => {
      if (!isLoggedIn) {
        callback(false, '加入房间需要登陆');
        return;
      }

      const { roomId, password } = data;
      const player = await playerService.getPlayerById(user_id);
      const room = await roomService.getRoomById(roomId);

      if (!player) {
        callback(false, '玩家不存在');
        return;
      }

      if (!room) {
        callback(false, '房间不存在');
        return;
      }

      // 检查房间是否已满
      if (room.players.length >= room.numbers.max) {
        callback(false, '房间已满');
        return;
      }

      // 检查房间状态
      if (room.status === 'playing' || room.status === 'loading') {
        callback(false, '游戏已开始，无法加入');
        return;
      }

      try {
        const joined = roomService.joinRoom(roomId, player, password);
        if (!joined) {
          callback(false, room.isPrivate ? '房间密码错误' : '加入房间失败');
          return;
        }

        socket.join(`room:${roomId}`);
        socket.join(`game:${room.gameId}`);

        io.to(`room:${roomId}`).emit('lobby:player-joined', {
          playerId: player._id,
          playerName: player.user_name,
          avatar: player.avatar,
          playerCount: room.players.length,
          numbers: room.numbers
        });

        socket.emit('lobby:joined-room', {
          roomId: room._id,
          roomInfo: await roomService.getRoomInfo(roomId)
        });

        callback(true);
        console.log(`👤 玩家 ${player.user_id} 加入房间 ${roomId}`);
      } catch (error) {
        callback(false, '加入房间失败');
      }
    }
  );

  /**
   * 离开房间 - 支持自动解散
   */
  socket.on('lobby:leave-room', async (callback: (success: boolean) => void) => {
    if (!isLoggedIn) {
      callback(false);
      return;
    }

    const player = await playerService.getPlayerById(user_id);
    if (!player) {
      callback(false);
      return;
    }

    const room = await roomService.getRoomByPlayerId(player._id);
    if (!room) {
      callback(false);
      return;
    }

    try {
      const result = await roomService.leaveRoom(room._id, user_id);

      if (!result.left) {
        callback(false);
        return;
      }

      socket.leave(`room:${room._id}`);

      if (result.roomDestroyed) {
        // 房间已解散，通知游戏中的其他玩家
        socket.leave(`game:${room?.gameId}`);
        io.to(`game:${room?.gameId}`).emit('lobby:room-destroyed', {
          roomId: room._id
        });
      } else if (room && room.players.length > 0) {
        // 房间还有人，通知其他玩家
        io.to(`room:${room._id}`).emit('lobby:player-left', {
          playerId: player._id,
          playerName: player.user_name,
          playerCount: room.players.length
        });
      }

      callback(true);
      console.log(`👤 玩家 ${player.user_id} 离开房间 ${room._id}`);
    } catch (error) {
      callback(false);
    }
  });

  /**
   * 获取房间详细信息
   */
  socket.on('lobby:get-room-info', (data: { roomId: string }, callback: (roomInfo: any) => void) => {
    const { roomId } = data;
    const roomInfo = roomService.getRoomInfo(roomId);
    callback(roomInfo);
  });

  /**
   * 获取用户个人信息
   */
  socket.on('lobby:get-user-info', async (callback: (userInfo: any | null) => void) => {
    if (!isLoggedIn || !socket.user_id) {
      callback(null);
      return;
    }

    const userInfo = await userService.getInfoById(socket.user_id);
    callback(userInfo);
  });

  /**
   * 获取排行榜
   */
  socket.on('lobby:get-leaderboard', (data: { limit?: number }, callback: (leaderboard: any[]) => void) => {
    const limit = data.limit || 10;
    const leaderboard = playerService.getLeaderboard(limit).map(player => ({
      rank: 0,
      id: player._id,
      name: player.user_name,
      level: player.level,
      avatar: player.avatar,
      winRate: (player.stats.winRate * 100).toFixed(1) + '%',
      rating: player.stats.rating
    })).map((item, index) => ({
      ...item,
      rank: index + 1
    }));

    callback(leaderboard);
  });

  /**
   * 获取大厅统计信息
   */
  socket.on('lobby:get-stats', async (callback: (stats: any) => void) => {
    const games = await gameService.getGameStats();
    const stats = {
      games,
      rooms: roomService.getRoomStats(),
      players: playerService.getPlayerStats()
    };
    callback(stats);
  });
}