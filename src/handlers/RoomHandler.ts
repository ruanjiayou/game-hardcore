/**
 * 房间事件处理 - 支持踢人
 */

import type { Server, Socket } from 'socket.io';
import { roomService } from '../services/RoomService';
import { playerService } from '../services/PlayerService';
import type { AuthSocket } from '../middleware/auth';

export function setupRoomHandlers(io: Server, socket: AuthSocket, playerId: string) {
  const isLoggedIn = socket.isLoggedIn;
  const isGuest = socket.isGuest;
  /**
   * 发送房间消息
   */
  socket.on(
    'room:send-message',
    async (data: { roomId: string; message: string }, callback: (success: boolean) => void) => {
      if (!socket.isLoggedIn) {
        callback(false);
        return;
      }

      const { roomId, message } = data;
      const player = await playerService.getPlayerById(playerId);

      if (!player || !message) {
        callback(false);
        return;
      }

      io.to(`room:${roomId}`).emit('room:message', {
        player_id: player._id,
        player_name: player.user_name,
        message,
        timestamp: Date.now()
      });

      callback(true);
    }
  );

  /**
   * 房主开始游戏
   */
  socket.on(
    'room:start-game',
    async (data: { roomId: string }, callback: (success: boolean, error?: string) => void) => {
      if (!socket.isLoggedIn) {
        callback(false, '需要登陆');
        return;
      }

      const { roomId } = data;
      const room = await roomService.getRoomById(roomId);
      const player = await playerService.getPlayerById(playerId);

      if (!room || !player) {
        callback(false, '房间或玩家不存在');
        return;
      }

      if (room.owner_id !== player.user_id) {
        callback(false, '只有房主可以开始游戏');
        return;
      }

      if (room.players.length < room.numbers.min) {
        callback(false, `玩家数不足，需要至少 ${room.numbers.min} 个玩家`);
        return;
      }

      try {
        const started = await roomService.startGame(roomId);
        if (!started) {
          callback(false, '开始游戏失败');
          return;
        }

        io.to(`room:${roomId}`).emit('room:game-started', {
          roomId,
          playerCount: room.players.length,
          timestamp: Date.now()
        });

        callback(true);
      } catch (error) {
        callback(false, '开始游戏失败');
      }
    }
  );

  /**
   * 房主踢出玩家
   */
  socket.on(
    'room:kick-player',
    async (
      data: { roomId: string; player_id: string },
      callback: (success: boolean) => void
    ) => {
      const user_id = socket.user_id || '';
      if (!socket.isLoggedIn || !user_id) {
        callback(false);
        return;
      }

      const { roomId, player_id } = data;
      const room = await roomService.getRoomById(roomId);

      if (!room || room.owner_id !== user_id) {
        callback(false);
        return;
      }

      try {
        const result = await roomService.leaveRoom(roomId, player_id);

        if (!result.left) {
          callback(false);
          return;
        }

        // 通知被踢的玩家
        io.to(player_id).emit('room:kicked', {
          roomId,
          message: '你已被房主踢出房间'
        });

        // 通知房间内其他玩家
        if (!result.roomDestroyed) {
          io.to(`room:${roomId}`).emit('room:player-kicked', {
            player_id: player_id,
          });
        } else {
          // 房间因此解散
          io.to(`game:${room.gameId}`).emit('lobby:room-destroyed', {
            roomId
          });
        }

        callback(true);
        console.log(`👢 玩家 ${user_id} 被从房间 ${roomId} 踢出`);
      } catch (error) {
        callback(false);
      }
    }
  );

  /**
   * 更新房间设置
   */
  socket.on(
    'room:update-settings',
    async (
      data: { roomId: string; settings: Record<string, any> },
      callback: (success: boolean) => void
    ) => {
      if (!socket.isLoggedIn) {
        callback(false);
        return;
      }

      const { roomId, settings } = data;
      const room = await roomService.getRoomById(roomId);

      if (!room || room.owner_id !== socket.user_id) {
        callback(false);
        return;
      }

      try {
        room.settings = { ...room.settings, ...settings };

        io.to(`room:${roomId}`).emit('room:settings-updated', {
          settings: room.settings
        });

        callback(true);
      } catch (error) {
        callback(false);
      }
    }
  );

  /**
   * 离开房间 - 支持自动解散
   */
  socket.on('room:leave', async (
    data: { roomId: string; },
    callback: (success: boolean) => void) => {
    if (!isLoggedIn) {
      callback(false);
      return;
    }
    const room = await roomService.getRoomById(data.roomId);
    if (!room) {
      callback(false);
      return;
    }
    const player = room.players.find(p => p.user_id === socket.user_id);
    if (!player) {
      callback(false);
      return;
    }

    try {
      const result = await roomService.leaveRoom(room._id, player._id);
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
          player_id: player._id,
          player_name: player.user_name,
        });
      }

      callback(true);
      console.log(`👤 玩家 ${player.user_id} 离开房间 ${room._id}`);
    } catch (error) {
      console.log(error, 'err')
      callback(false);
    }
  });

}