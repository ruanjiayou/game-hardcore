/**
 * 玩家管理服务
 * 负责玩家的创建、查询、更新等操作
 */

import { v7 } from 'uuid';
import type { IPlayer, PlayerStats } from '../types/index';
import { MPlayer } from '../models';

export class PlayerService {
  private players: Map<string, IPlayer> = new Map();
  private playersByName: Map<string, IPlayer> = new Map();

  /**
   * 创建或获取玩家
   */
  async getOrCreatePlayer(user_id: string) {
    // 如果玩家已存在，返回该玩家
    let player = await MPlayer.findOne({ user_id }).lean(true);
    if (player) {
      return player;
    }
    // 创建新玩家
    player = await MPlayer.create({
      _id: v7(),
      stats: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        rating: 0
      }
    });

    console.log(`✨ 新玩家创建:  (${player._id})`);
    return player;
  }

  /**
   * 获取玩家
   */
  getPlayerById(user_id: string) {
    return MPlayer.findOne({ user_id }).lean(true);
  }

  /**
   * 获取玩家信息
   */
  getPlayerInfo(playerId: string): any {
    const player = this.getPlayerById(playerId);
    if (!player) return null;

    return player;
  }

  /**
   * 更新玩家状���
   */
  async updatePlayerStatus(playerId: string, status: string) {
    await MPlayer.updateOne({ _id: playerId }, { $set: { status } })
  }

  /**
   * 更新玩家统计
   */
  updatePlayerStats(playerId: string, isWin: boolean, ratingChange: number = 0): void {
    const player = this.players.get(playerId);
    if (!player) return;

    const stats = player.stats;
    stats.totalGames++;

    if (isWin) {
      stats.wins++;
    } else {
      stats.losses++;
    }

    stats.winRate = stats.totalGames > 0 ? stats.wins / stats.totalGames : 0;
    stats.rating = Math.max(0, stats.rating + ratingChange);

    // 升级逻辑：每赢10局升1级
    const requiredWins = player.level * 10;
    if (stats.wins >= requiredWins) {
      player.level++;
      console.log(`🎉 玩家 ${player.user_id} 升级到 Lv.${player.level}`);
    }
  }

  /**
   * 获取排行榜
   */
  getLeaderboard(limit: number = 10): IPlayer[] {
    return Array.from(this.players.values())
      .sort((a, b) => {
        // 按等级排序，再按评分排序
        if (b.level !== a.level) {
          return b.level - a.level;
        }
        return b.stats.rating - a.stats.rating;
      })
      .slice(0, limit);
  }

  /**
   * 获取在线玩家
   */
  getOnlinePlayers(): IPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'online' || p.status === 'in-lobby');
  }

  /**
   * 生成随机头像
   */
  private _generateAvatar(): string {
    const avatars = ['👨', '👩', '👦', '👧', '👨‍🦱', '👩‍🦱', '👨‍🦲', '👩‍🦲'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  }

  /**
   * 获取玩家统计
   */
  getPlayerStats() {
    const allPlayers = Array.from(this.players.values());
    return {
      totalPlayers: allPlayers.length,
      onlinePlayers: allPlayers.filter(p => p.status === 'online' || p.status === 'in-lobby').length,
      inRoomPlayers: allPlayers.filter(p => p.status === 'in-room').length,
      inGamePlayers: allPlayers.filter(p => p.status === 'in-game').length
    };
  }
}

export const playerService = new PlayerService();