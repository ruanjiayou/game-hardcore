/**
 * 玩家匹配服务
 * 负责实时匹配算法
 */

import type { MatchingRequest, Player } from '../types/index';
import { playerService } from './PlayerService';

export class MatchingService {
  private matchingQueues: Map<string, MatchingRequest[]> = new Map(); // gameId -> requests

  /**
   * 添加到匹配队列
   */
  addToQueue(request: MatchingRequest): void {
    if (!this.matchingQueues.has(request.gameId)) {
      this.matchingQueues.set(request.gameId, []);
    }

    this.matchingQueues.get(request.gameId)!.push(request);
    console.log(`📍 玩家 ${request.playerId} 加入匹配队列 (游戏: ${request.gameId})`);
  }

  /**
   * 从匹配队列移除
   */
  removeFromQueue(gameId: string, playerId: string): void {
    const queue = this.matchingQueues.get(gameId);
    if (queue) {
      const index = queue.findIndex(r => r.playerId === playerId);
      if (index !== -1) {
        queue.splice(index, 1);
        console.log(`🚫 玩家 ${playerId} 取消匹配 (游戏: ${gameId})`);
      }
    }
  }

  /**
   * 执行匹配算法
   * 简单版本：找出匹配条件相近的玩家
   */
  findMatch(gameId: string, minGroupSize: number = 2, maxWaitTime: number = 30000): MatchingRequest[] | null {
    const queue = this.matchingQueues.get(gameId);
    if (!queue || queue.length < minGroupSize) {
      return null;
    }

    // 按匹配时间排序（最早的优先）
    queue.sort((a, b) => a.createdAt - b.createdAt);

    // 找出最早的 minGroupSize 个请求
    const matched = queue.slice(0, minGroupSize);

    // 检查等待时间
    const now = Date.now();
    const maxWaitTimeExceeded = matched.some(req => now - req.createdAt > maxWaitTime);

    if (matched.length === minGroupSize || maxWaitTimeExceeded) {
      // 从队列中移除已匹配的
      this.matchingQueues.set(
        gameId,
        queue.filter(req => !matched.includes(req))
      );

      console.log(`✅ 匹配成功: ${matched.length} 个玩家 (游戏: ${gameId})`);
      return matched;
    }

    return null;
  }

  /**
   * 获取匹配队列信息
   */
  getQueueInfo(gameId: string): any {
    const queue = this.matchingQueues.get(gameId) || [];
    return {
      gameId,
      queueSize: queue.length,
      averageWaitTime: queue.length > 0
        ? Math.round(
            (Date.now() - queue[0].createdAt) / 1000
          )
        : 0
    };
  }

  /**
   * 获取所有匹配队列信息
   */
  getAllQueuesInfo(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [gameId, queue] of this.matchingQueues) {
      result[gameId] = this.getQueueInfo(gameId);
    }
    return result;
  }
}

export const matchingService = new MatchingService();