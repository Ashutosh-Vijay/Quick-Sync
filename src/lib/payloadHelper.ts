/**
 * Wraps ciphertext.
 * Previously used for "fake telemetry" obfuscation.
 * Now simplified to a pass-through to reduce bandwidth/CPU overhead.
 */
export const wrapPayload = (cipherText: string): string => {
  // Just return the encrypted/base64 string directly.
  // No more JSON, no more UUID generation, no more larping.
  return cipherText;
};

/**
 * Extracts the actual ciphertext.
 * Handles both legacy "spy" packets (JSON) and new raw packets.
 */
export const unwrapPayload = (rawContent: string): string => {
  try {
    // Check if it's a legacy "spy" packet (JSON)
    // If we can parse it and it has the blob, extract it.
    const json = JSON.parse(rawContent);
    if (json && typeof json === 'object' && 'trace_blob' in json) {
      return json.trace_blob;
    }
    // If it's valid JSON but not our spy packet, or just a string, return raw.
    return rawContent;
  } catch {
    // If it's not JSON (e.g. raw Base64/AES string), just return it.
    return rawContent;
  }
};
