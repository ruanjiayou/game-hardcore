/**
 * 玩家管理服务
 * 负责玩家的创建、查询、更新等操作
 */

import { v7 } from 'uuid';
import { MPlayer, MUser } from '../models';
import redis from '../utils/redis'
import config from '../config';
import { isEmpty, sumBy } from 'lodash';

export class PlayerService {

  /**
   * 创建或获取玩家
   */
  async getOrCreatePlayer(user_id: string, game_id: string) {
    // 如果玩家已存在，返回该玩家
    let player = await MPlayer.findOne({ user_id }).lean(true);
    if (player) {
      return player;
    }
    const user = await MUser.findById(user_id).lean(true);
    if (!user) {
      throw new Error('用户不存在')
    }
    // 创建新玩家
    const time = new Date();
    player = await MPlayer.create({
      _id: v7(),
      game_id,
      user_id,
      user_name: user.name,
      status: 1,
      online: true,
      state: 'idle',
      avatar: user.avatar,
      createdAt: time,
      updatedAt: time,
      stats: {
        games: 0,
        winnings: 0,
        win_rate: 0,
        flee_rate: 0,
      }
    });

    console.log(`✨ 新玩家创建:  (${player._id})`);
    return player;
  }

  /**
   * 获取玩家信息
   */
  async getPlayerById(_id: string) {
    return MPlayer.findOne({ _id }).lean(true);
  }

  /**
   * 更新玩家状态
   */
  async updatePlayerStatus(player_id: string, status: string) {
    await MPlayer.updateOne({ _id: player_id }, { $set: { status } })
  }

  /**
   * TODO: 更新玩家统计
   */
  async updatePlayerStats(player_id: string, isWin: boolean, ratingChange: number = 0) {
    const player = await MPlayer.findById(player_id).lean(true)
    if (!player) return;

    const stats = player.stats;
    stats.games++;

    if (isWin) {
      stats.winnings++;
    }

    stats.wins_rate = stats.games > 0 ? stats.winnings / stats.games : 0;

    // 升级逻辑：每赢10局升1级
    const requiredWins = player.level * 10;
    if (stats.winnings >= requiredWins) {
      player.level++;
      console.log(`🎉 玩家 ${player.user_id} 升级到 Lv.${player.level}`);
    }
  }

  /**
   * 获取排行榜
   */
  async getLeaderboard(limit: number = 10) {
    const players = await MPlayer.find().limit(limit).sort({ level: -1, rating: -1 }).lean(true)
    return players;
  }

  /**
   * 获取玩家统计
   */
  async getStats() {
    const key = config.prefix + 'stats:players'
    let stats: { [key: string]: string | number } = await redis.hgetall(key)
    if (isEmpty(stats)) {
      const players = await MPlayer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

      const in_room = sumBy(players.filter(v => v.status === 'in-room'), 'count');
      const in_game = sumBy(players.filter(v => v.status === 'in-game'), 'count');
      stats = {
        total: sumBy(players, 'count'),
        online: in_game + in_room,
        in_room, in_game,
      };
      await redis.pipeline().hmset(key, stats).expire(key, config.expires).exec()
    }
    return stats;
  }
}

export const playerService = new PlayerService();