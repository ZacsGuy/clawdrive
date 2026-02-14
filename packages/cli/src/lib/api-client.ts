import { ClawdriveClient } from "@clawdrive/sdk";
import { DEFAULT_API_BASE_URL } from "@clawdrive/shared";
import { loadKey } from "./keystore.js";
import { readConfig } from "./config.js";

/**
 * Create an ClawdriveClient using a key from the local keystore.
 *
 * @param keyLabel - Optional key label. Falls back to the default key from config.
 * @returns A configured ClawdriveClient instance
 */
export async function getClient(keyLabel?: string): Promise<ClawdriveClient> {
  const config = readConfig();
  const label = keyLabel ?? config.defaultKey;

  if (!label) {
    throw new Error(
      "No key specified. Use --key <label> or set a default key with: clawdrive config set default-key <label>",
    );
  }

  const { privateKey, publicKey } = await loadKey(label);
  const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;

  return new ClawdriveClient({
    privateKey,
    publicKey,
    baseUrl,
  });
}
