/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption for sensitive data like Plaid access tokens.
 * Uses environment variable for encryption key with fallback to derived key.
 */

import crypto from 'crypto';

export class EncryptionService {
  private static ALGORITHM = 'aes-256-gcm';
  private static KEY_LENGTH = 32; // 256 bits
  private static IV_LENGTH = 16; // 128 bits
  private static AUTH_TAG_LENGTH = 16; // 128 bits

  /**
   * Get the encryption key from environment or derive from secret
   */
  private static getEncryptionKey(): Buffer {
    const envKey = process.env.ENCRYPTION_KEY;

    if (!envKey) {
            throw new Error("⚠️  ENCRYPTION_KEY not set in production. ");
    }

    return Buffer.from(envKey, 'base64');
  }

  /**
   * Encrypt a string value using AES-256-GCM
   *
   * Format: IV (16 bytes) + Auth Tag (16 bytes) + Encrypted Data
   * Returns: Base64 encoded string
   *
   * @param plaintext - The value to encrypt
   * @returns Base64 encoded encrypted value
   */
  public static encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty value');
    }

    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv) as crypto.CipherGCM;

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Combine IV + Auth Tag + Encrypted Data
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
  }

  /**
   * Decrypt a string value encrypted with AES-256-GCM
   *
   * @param encryptedValue - Base64 encoded encrypted value
   * @returns Decrypted plaintext
   */
  public static decrypt(encryptedValue: string): string {
    if (!encryptedValue) {
      throw new Error('Cannot decrypt empty value');
    }

    try {
      const key = this.getEncryptionKey();
      const combined = Buffer.from(encryptedValue, 'base64');

      // Extract IV, Auth Tag, and Encrypted Data
      const iv = combined.subarray(0, this.IV_LENGTH);
      const authTag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt value. The encryption key may have changed.');
    }
  }

  /**
   * Generate a new encryption key (for initial setup)
   * Run this once and save to ENCRYPTION_KEY environment variable
   *
   * @returns Base64 encoded 32-byte key
   */
  public static generateKey(): string {
    const key = crypto.randomBytes(this.KEY_LENGTH);
    return key.toString('base64');
  }

  /**
   * Test encryption/decryption to verify key is working
   *
   * @returns true if encryption is working correctly
   */
  public static testEncryption(): boolean {
    try {
      const testValue = 'test-plaid-token-12345';
      const encrypted = this.encrypt(testValue);
      const decrypted = this.decrypt(encrypted);
      return decrypted === testValue;
    } catch (error) {
      console.error('Encryption test failed:', error);
      return false;
    }
  }
}

// Run encryption test on module load in ALL environments
// This catches misconfigured encryption keys before they cause runtime failures
const testResult = EncryptionService.testEncryption();
if (!testResult) {
  const errorMsg = '❌ Encryption service failed self-test! Check ENCRYPTION_KEY configuration.';
  console.error(errorMsg);
  if (process.env.NODE_ENV === 'production') {
    // Fatal error in production
    throw new Error(errorMsg);
  }
}
