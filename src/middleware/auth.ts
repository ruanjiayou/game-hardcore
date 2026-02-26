/**
 * 认证中间件 - 支持登陆用户和游客
 */

import type { Socket } from 'socket.io';
import { playerService } from '../services/PlayerService';

export interface AuthSocket extends Socket {
  user_id?: string;
  isLoggedIn?: boolean;
  isGuest?: boolean;
}

// 模拟的用户数据库（实际应使用真实数据库）
const users = new Map<string, { username: string; password: string }>([
  ['admin', { username: 'admin', password: 'admin123' }],
  ['user1', { username: 'user1', password: 'password1' }],
  ['user2', { username: 'user2', password: 'password2' }]
]);

/**
 * 验证用户名和密码
 */
export function validateCredentials(username: string, password: string): boolean {
  const user = users.get(username);
  return user ? user.password === password : false;
}

/**
 * Socket.io 认证中间件
 */
export async function authMiddleware(socket: AuthSocket, next: (err?: Error) => void) {
  const user_id = socket.handshake.auth.user_id || socket.handshake.query.user_id;
  const isGuest = socket.handshake.auth.isGuest === true;
  const isLoggedIn = socket.handshake.auth.isLoggedIn === true;

  if (!user_id) {
    return next(new Error('用户id不能为空'));
  }

  // 获取或创建玩家
  const player = await playerService.getOrCreatePlayer(user_id);

  socket.user_id = user_id;
  socket.isLoggedIn = isLoggedIn;
  socket.isGuest = isGuest;

  console.log(
    `🔐 玩家认证成功: ${player.user_name} (${player._id}) | 状态: ${isLoggedIn ? '登陆' : '游客'}`
  );

  next();
}

/**
 * 登陆验证中间件 - 用于需要登陆的事件
 */
export function requireLogin(socket: AuthSocket, next: (err?: Error) => void) {
  if (!socket.isLoggedIn) {
    return next(new Error('此操作需要登陆'));
  }
  next();
}

/**
 * 检查权限的辅助函数
 */
export function hasPermission(socket: AuthSocket, permission: string): boolean {
  // 游客权限：只能查看、不能操作
  if (socket.isGuest) {
    const guestPermissions = ['view-games', 'view-rooms', 'view-leaderboard', 'view-stats'];
    return guestPermissions.includes(permission);
  }

  // 登陆用户权限：完全权限
  if (socket.isLoggedIn) {
    return true;
  }

  return false;
}

/**
 * 权限检查装饰器
 */
export function checkPermission(permission: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (socket: AuthSocket, ...args: any[]) {
      if (!hasPermission(socket, permission)) {
        socket.emit('error', {
          code: 'PERMISSION_DENIED',
          message: '您没有权限执行此操作'
        });
        return;
      }

      return originalMethod.apply(this, [socket, ...args]);
    };

    return descriptor;
  };
}