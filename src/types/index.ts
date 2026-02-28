export type CB = Function;
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
  createdAt: Date;
  updatedAt: Date;
  rooms?: number;
  players?: number;
}

// ========== 房间相关 ==========
export type RoomStatus = 'waiting' | 'loading' | 'playing' | 'closed';

// 更新 Room 接口
export interface IRoom {
  _id: string;
  gameId: string;
  name: string;
  status: string; // 'waiting' | 'playing' | 'closed'
  owner_id: string;
  players: IRoomPlayer[];
  numbers: { min: number, max: number };
  isPrivate: boolean;
  password?: string;  // 新增：房间密码
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
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

  title: string; // 称号
  level: number; // 等级
  score: number; // 分数
  exp: number; // 经验值
  stats: PlayerStats;
  online: boolean;
  status: number; // 1 normal 2 muted 3 banned
  state: string; // idle ready in-lobby matching in-game watching
  createdAt: Date;
  updatedAt: Date;
}
export interface IRoomPlayer extends IPlayer {
  type: string; // play watch
  is_robot: boolean; // 是否是人机
}

export interface PlayerStats {
  games: number;
  winnings: number;
  wins_rate: number;
  flee_rate: number;
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