/**
 * AES-256-GCM encryption service for sensitive data (OAuth tokens).
 *
 * - Random IV per encryption prevents ciphertext pattern analysis
 * - Auth tag detects tampering
 * - Wire format: "iv:authTag:ciphertext" (hex)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CryptoError } from './errors.js';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ':';

export class CryptoService {
  private readonly key: Buffer;

  constructor(encryptionKeyHex: string) {
    this.key = Buffer.from(encryptionKeyHex, 'hex');

    if (this.key.length !== 32) {
      throw new CryptoError('ENCRYPTION_KEY must decode to exactly 32 bytes');
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   *
   * @param plaintext - Value to encrypt (e.g. OAuth access token)
   * @returns Encrypted string "iv:authTag:ciphertext"
   */
  encrypt(plaintext: string): string {
    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return [iv.toString('hex'), authTag.toString('hex'), encrypted].join(SEPARATOR);
    } catch (error) {
      throw new CryptoError(
        `Encryption failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /**
   * Decrypt a value produced by encrypt().
   *
   * @param encryptedText - String in format "iv:authTag:ciphertext"
   * @returns Decrypted plaintext
   */
  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(SEPARATOR);

    if (parts.length !== 3) {
      throw new CryptoError('Invalid encrypted data format: expected "iv:authTag:ciphertext"');
    }

    const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new CryptoError(
        `Decryption failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
