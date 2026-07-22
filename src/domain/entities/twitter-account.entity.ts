/**
 * TwitterAccount domain entity.
 *
 * Represents an X (Twitter) account linked via OAuth 2.0.
 * Tokens are stored encrypted in the database.
 */

export interface TwitterAccountEntity {
  readonly id: string;
  readonly userId: string;
  readonly twitterUserId: string;
  readonly twitterUsername: string;
  readonly displayName: string | null;
  readonly accessToken: string; // encrypted
  readonly refreshToken: string; // encrypted
  readonly tokenExpiresAt: Date;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Data required to create a new Twitter account link */
export interface CreateTwitterAccountData {
  readonly userId: string;
  readonly twitterUserId: string;
  readonly twitterUsername: string;
  readonly displayName?: string;
  readonly accessToken: string; // already encrypted
  readonly refreshToken: string; // already encrypted
  readonly tokenExpiresAt: Date;
}

/** Fields that can be updated on a Twitter account */
export interface UpdateTwitterAccountData {
  readonly twitterUsername?: string;
  readonly displayName?: string;
  readonly accessToken?: string; // already encrypted
  readonly refreshToken?: string; // already encrypted
  readonly tokenExpiresAt?: Date;
  readonly isActive?: boolean;
}
