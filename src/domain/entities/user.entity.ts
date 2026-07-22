/**
 * User domain entity.
 * Identity only — preferences live in UserSettings.
 */

export interface UserEntity {
  readonly id: string;
  readonly telegramId: bigint;
  readonly telegramUsername: string | null;
  readonly firstName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data required to create a new user */
export interface CreateUserData {
  readonly telegramId: bigint;
  readonly telegramUsername?: string;
  readonly firstName?: string;
}

/** Fields that can be updated on a user profile */
export interface UpdateUserData {
  readonly telegramUsername?: string;
  readonly firstName?: string;
}
