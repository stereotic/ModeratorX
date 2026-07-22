/**
 * UserSettings repository interface.
 */

import type {
  UserSettingsEntity,
  CreateUserSettingsData,
  UpdateUserSettingsData,
} from '../entities/user-settings.entity.js';

export interface UserSettingsRepository {
  findByUserId(userId: string): Promise<UserSettingsEntity | null>;
  create(data: CreateUserSettingsData): Promise<UserSettingsEntity>;
  updateByUserId(userId: string, data: UpdateUserSettingsData): Promise<UserSettingsEntity>;
  /** Create defaults if missing, otherwise return existing row */
  getOrCreate(userId: string): Promise<UserSettingsEntity>;
}
