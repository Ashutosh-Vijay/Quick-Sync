import * as CryptoJS from 'crypto-js';

/**
 * Generates a cryptographically strong random key for E2E rooms.
 */
export const generateKey = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Gets the encryption key from the current window location hash.
 */
export const getKeyFromHash = (): string | null => {
  const hash = window.location.hash.slice(1);
  return hash.length > 0 ? hash : null;
};

/**
 * HYBRID ENCRYPTION:
 * - If key is provided: AES-256 (Secure)
 * - If key is null: Base64 Obfuscation (Public/Camouflage)
 */
export const encryptData = (text: string, key: string | null): string => {
  if (!text) return '';
  try {
    if (key) {
      return CryptoJS.AES.encrypt(text, key).toString();
    }
    // Obfuscation only
    return btoa(encodeURIComponent(text));
  } catch (e) {
    console.error('Encryption failed', e);
    return text;
  }
};

/**
 * HYBRID DECRYPTION:
 * - If key is provided: AES-256 (Secure)
 * - If key is null: Base64 Obfuscation (Public/Camouflage)
 */
export const decryptData = (rawContent: string, key: string | null): string => {
  if (!rawContent) return '';

  try {
    if (key) {
      const bytes = CryptoJS.AES.decrypt(rawContent, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      // If AES decryption produces empty string (invalid key), return raw or handle error
      return decrypted;
    }
    // De-obfuscation
    return decodeURIComponent(atob(rawContent));
  } catch (e) {
    // If decryption fails (e.g. trying to read AES data without a key), return garbage or raw
    console.warn('Decryption failed', e);
    return rawContent;
  }
};
