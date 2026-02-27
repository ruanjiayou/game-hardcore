import mongoose from "mongoose";
import config from '../config';
import type { IGame, IRoom, IUser, IPlayer } from '../types/index';

mongoose.set('strictQuery', true);
mongoose.connect(config.mongo_url).catch(err => {
  console.log(err)
});

export const MGame = mongoose.model<IGame>('games', new mongoose.Schema({
  _id: String,
  name: String,
  desc: String,
  genre: String,
  icon: String,
  numbers: { min: Number, max: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'games', versionKey: false, }));

export const MRoom = mongoose.model<IRoom>('rooms', new mongoose.Schema({
  _id: String,
  gameId: String,
  name: String,
  status: String,
  owner_id: String,
  players: [{ _id: String, user_name: String, level: Number, user_id: String, avatar: String, }],
  numbers: { min: Number, max: Number },
  isPrivate: Boolean,
  password: String,
  startedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  settings: mongoose.SchemaTypes.Mixed,
}, { collection: 'rooms', versionKey: false, }));

export const MUser = mongoose.model<IUser>('users', new mongoose.Schema({
  _id: String,
  name: String,
  pass: String,
  avatar: String,
  email: String,
  phone: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'users', versionKey: false, }));

export const MPlayer = mongoose.model<IPlayer>('players', new mongoose.Schema({
  _id: String,
  game_id: String,
  user_id: String,
  user_name: String,
  avatar: String,
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  status: String,
  stats: mongoose.SchemaTypes.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'players', versionKey: false }))

export default {
  MGame,
  MRoom,
  MUser,
  MPlayer,
}