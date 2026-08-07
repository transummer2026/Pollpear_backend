/**
 * Serializes a payload for a log line, capped in size: max_payload
 * allows messages up to ~1MB, logging them whole would let any client
 * flood the logs at will.
 * @param value payload to serialize
 * @param max maximum number of serialized characters kept
 * @returns {string} the serialized payload, truncated when oversized
 */
export function payloadPreview(value: unknown, max = 200): string {
  let json: string;
  try {
    json = JSON.stringify(value) ?? String(value);
  } catch {
    json = String(value);
  }
  return json.length > max
    ? `${json.slice(0, max)}... (${json.length} chars)`
    : json;
}
