import { v7 } from 'uuid';
import { MUser } from '../models'
import crypto from 'node:crypto'
import { omit, pick } from 'lodash';
import { IUser } from '../types';
import * as z from "zod";
import jwt from 'jsonwebtoken'

const VUser = z.object({
  name: z.string().trim().min(1, '参数必填'),
  pass: z.string().trim().min(6, '长度最少为6').max(18, '长度最多18'),
});

export class UserService {

  async getInfoById(_id: string) {
    const user = await MUser.findById(_id, { pass: 0 }).lean(true);
    return user;
  }
}

export const userService = new UserService();