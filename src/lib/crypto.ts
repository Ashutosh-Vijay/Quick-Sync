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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const keyCache = new Map<string, CryptoKey>();

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function getAesKey(hexKey: string): Promise<CryptoKey> {
  if (keyCache.has(hexKey)) return keyCache.get(hexKey)!;
  const rawBytes = hexToBytes(hexKey);
  const key = await crypto.subtle.importKey(
    'raw',
    rawBytes.buffer as ArrayBuffer,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );
  keyCache.set(hexKey, key);
  return key;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Text encryption (used for room content + file metadata)
// ---------------------------------------------------------------------------

/**
 * HYBRID ENCRYPTION:
 * - key provided  → AES-256-GCM  (output: base64(iv[12] + ciphertext))
 * - key null      → base64 + URI encoding (obfuscation only)
 */
export const encryptData = async (text: string, key: string | null): Promise<string> => {
  if (!text) return '';
  try {
    if (key) {
      const cryptoKey = await getAesKey(key);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
      const combined = new Uint8Array(12 + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), 12);
      return bytesToBase64(combined);
    }
    return btoa(encodeURIComponent(text));
  } catch (e) {
    console.error('Encryption failed', e);
    throw e;
  }
};

/**
 * HYBRID DECRYPTION:
 * - key provided  → AES-256-GCM
 * - key null      → base64 de-obfuscation
 */
export const decryptData = async (rawContent: string, key: string | null): Promise<string> => {
  if (!rawContent) return '';
  try {
    if (key) {
      const combined = base64ToBytes(rawContent);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const cryptoKey = await getAesKey(key);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
      return new TextDecoder().decode(decrypted);
    }
    return decodeURIComponent(atob(rawContent));
  } catch (e) {
    console.warn('Decryption failed', e);
    return '';
  }
};

// ---------------------------------------------------------------------------
// Binary file encryption (used for file upload/download)
// ---------------------------------------------------------------------------

/** Encrypts a file buffer. Returns a Blob containing iv[12] + ciphertext. */
export const encryptFile = async (buffer: ArrayBuffer, key: string): Promise<Blob> => {
  const cryptoKey = await getAesKey(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, buffer);
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), 12);
  return new Blob([combined], { type: 'application/octet-stream' });
};

/** Decrypts an encrypted file buffer (iv[12] + ciphertext). */
export const decryptFile = async (buffer: ArrayBuffer, key: string): Promise<Uint8Array> => {
  const combined = new Uint8Array(buffer);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const cryptoKey = await getAesKey(key);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return new Uint8Array(decrypted);
};
