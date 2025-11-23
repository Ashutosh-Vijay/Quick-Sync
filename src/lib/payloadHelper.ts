/**
 * Wraps ciphertext in a fake telemetry object to confuse packet sniffers.
 * Look busy, Jesus is coming.
 */
export const wrapPayload = (cipherText: string): string => {
  return JSON.stringify({
    v: 2,
    level: 'INFO',
    service: 'mule-diagnostic-agent',
    trace_id: crypto.randomUUID(),
    span_id: Math.floor(Math.random() * 1000000).toString(),
    timestamp: new Date().toISOString(),
    trace_blob: cipherText,
  });
};

/**
 * Extracts the actual ciphertext from the fake telemetry object.
 * Returns the raw string if it wasn't valid JSON (backward compatibility).
 */
export const unwrapPayload = (rawContent: string): string => {
  try {
    const json = JSON.parse(rawContent);
    // If it has our specific key, it's ours. Otherwise, assume raw text.
    return json.trace_blob || rawContent;
  } catch {
    return rawContent;
  }
};
