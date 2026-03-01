/**
 * 房间事件处理
 */

import type { Server } from 'socket.io';
import { CB } from '../types';
import { roomService } from '../services/RoomService';
import type { AuthSocket } from '../middleware/auth';

export function setupRoomHandlers(io: Server, socket: AuthSocket, user_id: string) {
  const isLoggedIn = socket.isLoggedIn;

  socket.on('room:get-info', getRoomInfo);
  socket.on('room:update-settings', updateRoom);
  socket.on('room:send-message', sendMessage);
  socket.on('room:kick-player', kickPlayer,);
  socket.on('room:leave', leaveRoom);
  socket.on('room:player-ready', playerReadyChange)
  socket.on('room:start-game', startGame);
  socket.on('room:close', closeRoom)

  async function getRoomInfo(data: { roomId: string }, cb: CB) {
    const { roomId } = data;
    const roomInfo = await roomService.getRoomById(roomId);
    cb(roomInfo);
  }
  /**
   * 发送房间消息
   */
  async function sendMessage(data: { roomId: string; message: string }, callback: (success: boolean) => void) {
    console.log(`玩家发言 ${data.roomId} ${data.message}`)
    if (!socket.isLoggedIn) {
      callback(false);
      return;
    }

    const { roomId, message } = data;
    const room = await roomService.getRoomById(roomId);
    if (!room || !message) {
      callback(false);
      return;
    }
    const player = room.players.find(p => p.user_id === user_id);

    if (!player) {
      callback(false);
      return;
    }
    callback(true);

    console.log('广播')
    io.to(`room:${roomId}`).emit('room:message', {
      player_id: player._id,
      player_name: player.user_name,
      message,
      timestamp: Date.now()
    });

  }
  /**
   * 房主开始游戏
   */
  async function startGame(data: { roomId: string }, callback: (success: boolean, error?: string) => void) {
    if (!socket.isLoggedIn) {
      callback(false, '需要登陆');
      return;
    }

    const { roomId } = data;
    const room = await roomService.getRoomById(roomId);
    if (!room) {
      callback(false, '房间或玩家不存在');
      return;
    }
    try {
      const started = await roomService.startGame(roomId, user_id);
      if (!started) {
        callback(false, '开始游戏失败');
        return;
      }

      callback(true);

      io.to(`room:${roomId}`).emit('room:game-started', {
        roomId,
        playerCount: room.players.length,
        timestamp: Date.now()
      });

    } catch (error) {
      callback(false, '开始游戏失败');
    }
  }

  /**
   * 房主踢出玩家
   */
  async function kickPlayer(data: { roomId: string; player_id: string }, callback: (success: boolean) => void) {
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
      const success = await roomService.leaveRoom(roomId, player_id);

      if (!success) {
        callback(false);
        return;
      }

      // 通知被踢的玩家
      io.to(player_id).emit('room:kicked', {
        roomId,
        message: '你已被房主踢出房间'
      });

      // 通知房间内其他玩家
      if (success) {
        io.to(`room:${roomId}`).emit('room:player-kicked', {
          player_id: player_id,
        });
      }

      callback(true);
      console.log(`👢 玩家 ${user_id} 被从房间 ${roomId} 踢出`);
    } catch (error) {
      callback(false);
    }
  }
  async function playerReadyChange(data: { roomId: string; player_id: string; ready: boolean }, callback: (success: boolean) => void) {
    const user_id = socket.user_id || '';
    if (!socket.isLoggedIn || !user_id) {
      callback(false);
      return;
    }

    const { roomId, ready } = data;
    const room = await roomService.getRoomById(roomId);

    if (!room) {
      callback(false);
      return;
    }

    try {
      const { success, roomReady } = await roomService.playerReady(roomId, ready, data.player_id);

      callback(success);
      if (success) {
        io.to(`room:${roomId}`).emit('room:room-ready', roomReady)
        console.log(`🏠 房间 ${roomId} ${roomReady ? "已就绪" : "未就绪"}`);
      }
    } catch (error) {
      callback(false);
    }
  }
  /**
   * 更新房间设置
   */
  async function updateRoom(data: { roomId: string; settings: Record<string, any> }, callback: (success: boolean) => void) {
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
  /**
   * 离开房间
   */
  async function leaveRoom(data: { roomId: string; }, callback: (success: boolean) => void) {
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
      const success = await roomService.leaveRoom(room._id, player._id);
      if (!success) {
        callback(false);
        return;
      }
      socket.room_id = undefined;
      socket.leave(`room:${room._id}`);
      io.to(`room:${room._id}`).emit('room:player-leaved', { room_id: room._id, player_id: player._id, player_name: player.user_name });

      callback(true);
      console.log(`👤 玩家 ${player.user_id} 离开房间 ${room._id}`);
    } catch (error) {
      console.log(error, 'err')
      callback(false);
    }
  }

  async function closeRoom(data: { roomId: string }, cb: Function) {
    const room = await roomService.destroyRoom(data.roomId);
    if (room) {
      // 房间已解散，通知游戏中的其他玩家
      socket.leave(`game:${room?.gameId}`);
      io.to(`game:${room?.gameId}`).emit('lobby:room-destroyed', {
        roomId: room._id
      });
      cb(true);
    } else {
      cb(false);
    }
  }
}