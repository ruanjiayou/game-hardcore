/**
 * 游戏管理服务
 * 负责游戏的创建、查询、更新等操作
 */

import { v7 } from 'uuid';
import type { IGame } from '../types/index';
import { MGame, MRoom } from '../models'
import { omit } from 'lodash';

export class GameService {

  /**
   * 获取所有游戏
   */
  async getAllGames(): Promise<IGame[]> {
    return MGame.find().lean(true)
  }

  /**
   * 按ID获取游戏
   */
  async getGameById(gameId: string): Promise<IGame | null> {
    return MGame.findById(gameId).lean(true);
  }

  /**
   * 按类型获取游戏
   */
  async getGamesByGenre(genre: string): Promise<IGame[]> {
    return MGame.find({ genre }).lean(true)
  }

  /**
   * 创建新游戏
   */
  async createGame(data: Omit<IGame, '_id' | 'createdAt'>): Promise<IGame> {
    const game: IGame = {
      ...data,
      _id: v7(),
      createdAt: Date.now(),
    };
    await MGame.create(game)
    return game;
  }

  /**
   * 更新游戏信息（房间数、玩家数等）
   */
  async updateGameStats(gameId: string, data: Partial<IGame>): Promise<void> {
    await MGame.updateOne({ _id: gameId }, { $set: omit(data, ['_id', 'createdAt']) })
  }

  /**
   * 获取游戏统计
   */
  async getGameStats() {
    const totalGames = await MGame.countDocuments();
    const totalRooms = await MRoom.countDocuments();
    const totalPlayers = (await MRoom.aggregate([{ $group: { _id: null, count: { $sum: { $size: '$players' } } } }]))[0]?.count || 0;
    return {
      totalGames, totalRooms, totalPlayers,
    };
  }
}

export const gameService = new GameService();