/**
 * User repository interface.
 */

import type { UserEntity, CreateUserData, UpdateUserData } from '../entities/user.entity.js';

export interface UserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByTelegramId(telegramId: bigint): Promise<UserEntity | null>;
  create(data: CreateUserData): Promise<UserEntity>;
  update(id: string, data: UpdateUserData): Promise<UserEntity>;
  upsertByTelegramId(data: CreateUserData): Promise<UserEntity>;
}
