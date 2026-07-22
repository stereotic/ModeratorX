/**
 * Twitter / X OAuth 2.0 PKCE service.
 *
 * Responsibilities:
 * - Build authorization URL with required scopes
 * - Exchange authorization code for tokens
 * - Refresh expired access tokens
 */

import { TwitterApi } from 'twitter-api-v2';
import type { EnvConfig } from '../../config/env.config.js';
import type { OAuthTokens, TwitterUserProfile } from '../../shared/types.js';
import { AuthenticationError } from '../../shared/errors.js';
import { createLogger } from '../../shared/logger.js';
import { mapTwitterError } from './twitter-error.mapper.js';

const log = createLogger('TwitterOAuthService');

/** Scopes required for moderation product */
export const TWITTER_OAUTH_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
  'tweet.moderate.write',
] as const;

/** Result of starting the OAuth dance */
export interface OAuthAuthorizationStart {
  readonly url: string;
  readonly state: string;
  readonly codeVerifier: string;
}

/** Result after successful code exchange */
export interface OAuthLoginResult {
  readonly tokens: OAuthTokens;
  readonly profile: TwitterUserProfile;
}

export class TwitterOAuthService {
  private readonly appClient: TwitterApi;

  constructor(private readonly config: EnvConfig) {
    this.appClient = new TwitterApi({
      clientId: config.TWITTER_CLIENT_ID,
      clientSecret: config.TWITTER_CLIENT_SECRET,
    });
  }

  /** Generate PKCE authorization URL */
  createAuthorizationUrl(): OAuthAuthorizationStart {
    const { url, codeVerifier, state } = this.appClient.generateOAuth2AuthLink(
      this.config.TWITTER_CALLBACK_URL,
      {
        scope: [...TWITTER_OAUTH_SCOPES],
      },
    );

    log.debug('Generated Twitter OAuth authorization URL');

    return { url, codeVerifier, state };
  }

  /**
   * Exchange authorization code for tokens and load the authenticated profile.
   */
  async exchangeCode(params: {
    readonly code: string;
    readonly codeVerifier: string;
  }): Promise<OAuthLoginResult> {
    try {
      const result = await this.appClient.loginWithOAuth2({
        code: params.code,
        codeVerifier: params.codeVerifier,
        redirectUri: this.config.TWITTER_CALLBACK_URL,
      });

      if (!result.refreshToken) {
        throw new AuthenticationError(
          'Twitter did not return a refresh token. Ensure offline.access scope is enabled.',
        );
      }

      const me = await result.client.v2.me({
        'user.fields': ['name', 'username'],
      });

      const profile: TwitterUserProfile = {
        id: me.data.id,
        username: me.data.username,
        name: me.data.name,
      };

      const tokens: OAuthTokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: new Date(Date.now() + result.expiresIn * 1000),
      };

      log.info({ twitterUserId: profile.id }, 'OAuth code exchanged successfully');

      return { tokens, profile };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw mapTwitterError(error, 'loginWithOAuth2');
    }
  }

  /** Refresh an expired (or soon-to-expire) access token */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    try {
      const result = await this.appClient.refreshOAuth2Token(refreshToken);

      if (!result.refreshToken) {
        throw new AuthenticationError(
          'Twitter did not return a new refresh token during refresh.',
        );
      }

      log.info('Twitter access token refreshed');

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: new Date(Date.now() + result.expiresIn * 1000),
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw mapTwitterError(error, 'refreshOAuth2Token');
    }
  }
}
