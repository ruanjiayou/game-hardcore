/**
 * 房间管理服务 - 支持密码和自动解散
 */

import { v7 } from 'uuid';
import type { IRoom, IPlayer, RoomStatus } from '../types/index';
import { MPlayer, MRoom } from '../models'
import { isEmpty, sumBy } from 'lodash';
import redis from '../utils/redis'
import config from '../config';

export class RoomService {

  /**
   * 创建房间 - 支持密码
   */
  async createRoom(data: Partial<IRoom>) {
    data._id = v7();
    data.status = 'waiting'
    data.createdAt = new Date();
    data.updatedAt = new Date();

    await MRoom.create(data);

    console.log(`✨ 房间创建: ${data._id} (${data.name}) ${data.isPrivate ? '🔒 私密' : '🔓 公开'}`);
    return data;
  }

  /**
   * 获取房间
   */
  async getRoomById(roomId: string): Promise<IRoom | null> {
    const room = await MRoom.findById(roomId).lean(true);
    return room || null;
  }
  async getRoomByPlayerId(player_id: string): Promise<IRoom | null> {
    const room = await MRoom.findOne({ 'players._id': player_id }).lean(true);
    return room || null;
  }

  /**
   * 获取游戏的所有房间
   */
  async getRoomsByGameId(gameId: string): Promise<IRoom[]> {
    const rooms = await MRoom.find({ gameId, status: { $ne: 'finished' } }).lean(true);
    return rooms;
  }

  /**
   * 获取所有房间
   */
  async getAllRooms(): Promise<IRoom[]> {
    const rooms = await MRoom.find({}).lean(true);
    return rooms;
  }

  /**
   * 验证房间密码
   */
  async verifyPassword(roomId: string, password: string) {
    const room = await MRoom.findById(roomId).lean(true);
    if (!room) return false;

    if (!room.isPrivate) return true; // 公开房间无需密码

    return room.password === password;
  }

  /**
   * 玩家加入房间 - 支持密码验证
   */
  async joinRoom(roomId: string, player: IPlayer, password?: string) {
    const room = await MRoom.findById(roomId).lean(true);
    if (!room) return false;

    // 检查房间是否已满
    if (room.players.length >= room.numbers.max) {
      console.log(`❌ 房间已满: ${roomId}`);
      return false;
    }

    // 检查房间状态
    if (room.status === 'playing' || room.status === 'loading') {
      console.log(`❌ 房间游戏已开始: ${roomId}`);
      return false;
    }

    // 验证密码
    if (room.isPrivate && !this.verifyPassword(roomId, password || '')) {
      console.log(`❌ 房间密码错误: ${roomId}`);
      return false;
    }

    // 检查玩家是否已在房间中
    if (room.players.some(p => p._id === player._id)) {
      return false;
    }

    room.players.push(player);
    await MRoom.updateOne({ _id: room._id }, { $set: { players: room.players } })
    await MPlayer.updateOne({ _id: player._id }, { $set: { status: 'in-room' } })
    console.log(`👤 玩家 ${player._id} 加入房间 ${roomId}，当前人数: ${room.players.length}`);
    return true;
  }

  /**
   * 玩家离开房间 - 支持自动解散
   */
  async leaveRoom(roomId: string, playerId: string): Promise<{ left: boolean; roomDestroyed: boolean }> {
    const room = await MRoom.findById(roomId).lean(true);
    if (!room) return { left: false, roomDestroyed: false };

    const playerIndex = room.players.findIndex(p => p._id === playerId);
    if (playerIndex === -1) return { left: false, roomDestroyed: false };

    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    await MRoom.updateOne({ _id: room._id }, { $set: { players: room.players } })
    await MPlayer.updateOne({ _id: player._id }, { $set: { status: 'in-lobby' } })
    console.log(`👤 玩家 ${player.user_id} 离开房间 ${roomId}，当前人数: ${room.players.length}`);

    // 关键：如果房间没人了，自动解散
    if (room.players.length === 0) {
      this.destroyRoom(roomId);
      return { left: true, roomDestroyed: true };
    }

    // 如果房主离开，转移房主权或解散
    if (player._id === room.owner_id) {
      if (room.players.length > 0) {
        await MRoom.updateOne({ _id: room._id }, { $set: { owner_id: room.players[0].user_id } })
        console.log(`👑 房间 ${roomId} 房主转移给 ${room.players[0].user_id}`);
      } else {
        this.destroyRoom(roomId);
        return { left: true, roomDestroyed: true };
      }
    }

    return { left: true, roomDestroyed: false };
  }

  /**
   * 开始游戏
   */
  async startGame(roomId: string) {
    const room = await MRoom.findById(roomId).lean(true);
    if (!room) return false;

    if (room.players.length < room.numbers.max) {
      return false;
    }

    room.status = 'loading';
    room.startedAt = new Date();

    console.log(`🎮 房间 ${roomId} 开始游戏，玩家数: ${room.players.length}`);
    return true;
  }

  /**
   * 房间是否已满
   */
  async isRoomFull(roomId: string) {
    const room = await MRoom.findById(roomId).lean(true);
    return room ? room.players.length >= room.numbers.max : false;
  }

  /**
   * 获取房间信息
   */
  async getRoomInfo(roomId: string) {
    const room = await MRoom.findById(roomId).lean(true);
    if (!room) return null;

    return {
      _id: room._id,
      gameId: room.gameId,
      name: room.name,
      status: room.status,
      owner_id: room.owner_id,
      users: room.players.length,
      numbers: room.numbers,
      players: room.players,
      createdAt: room.createdAt,
      isPrivate: room.isPrivate
    };
  }

  /**
   * 销毁房间
   */
  private async destroyRoom(roomId: string): Promise<void> {
    const room = await MRoom.findById(roomId).lean(true);
    if (!room) return;
    await MRoom.updateOne({ _id: roomId }, { $set: { status: 'finished' } });
    console.log(`🗑️  房间自动解散: ${roomId}`);
  }

  /**
   * 更新房间状态
   */
  async updateRoomStatus(roomId: string, status: RoomStatus) {
    const room = await MRoom.findById(roomId).lean(true);
    if (!room) return false;

    await MRoom.updateOne({ _id: roomId }, { $set: { status } });
    return true;
  }

  /**
   * 获取房间统计
   */
  async getStats() {
    const key = config.prefix + 'stats:room'
    let stats: { [key: string]: string | number } = await redis.hgetall(key)
    if (isEmpty(stats)) {
      const summary = await MRoom.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]);
      const waits = summary.find(v => v._id === 'waiting')?.total || 0;
      const finishedRooms = summary.find(v => v._id === 'finished')?.total || 0;
      stats = {
        active: sumBy(summary, 'total') - finishedRooms,
        waits,
      }
      await redis.pipeline().hmset(key, stats).expire(key, config.expires).exec()
    }
    return stats;
  }
}

export const roomService = new RoomService();