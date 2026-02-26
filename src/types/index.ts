/**
 * 游戏大厅系统的类型定义
 */

// ========== 游戏相关 ==========
export interface IGame {
  _id: string;
  name: string;
  desc: string;
  numbers: { min: number, max: number };
  genre: 'fps' | 'moba' | 'rpg' | 'card' | 'puzzle';
  icon: string;
  status: number;
  createdAt: number;
  updatedAt: number;
  rooms?: number;
  players?: number;
}

// ========== 房间相关 ==========
export type RoomStatus = 'waiting' | 'loading' | 'playing' | 'finished';

// 更新 Room 接口
export interface IRoom {
  _id: string;
  gameId: string;
  name: string;
  status: string;
  owner_id: string;
  players: IPlayer[];
  numbers: { min: number, max: number };
  isPrivate: boolean;
  password?: string;  // 新增：房间密码
  createdAt: number;
  startedAt?: number;
  settings: Record<string, any>;
}

export interface IUser {
  _id: string;
  name: string;
  avatar: string;
  pass: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

// ========== 玩家相关 ==========
export interface IPlayer {
  _id: string;
  game_id: string;
  user_id: string;
  user_name: string;
  avatar: string;

  level: number;
  exp: number;
  stats: PlayerStats;
  status: string; // 'online' | 'in-lobby' | 'in-room' | 'in-game';
  created_at: Date;
  updated_at: Date;
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  rating: number;
}

// ========== 匹配相关 ==========
export type MatchingMode = 'ranked' | 'casual' | 'team';

export interface MatchingRequest {
  playerId: string;
  gameId: string;
  mode: MatchingMode;
  minimumLevel?: number;
  maximumRating?: number;
  createdAt: number;
}

// ========== 事件相关 ==========
export interface SocketWithAuth {
  id: string;
  playerId: string;
  data: any;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data?: any) => void) => void;
  join: (room: string) => void;
  leave: (room: string) => void;
  disconnect: () => void;
}

// ========== 响应相关 ==========
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: number;
}

export interface Error {
  code: string;
  message: string;
}