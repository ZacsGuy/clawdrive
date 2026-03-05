import { AgentDropClient } from "@agentdrop/sdk";
import { DEFAULT_API_BASE_URL } from "@agentdrop/shared";
import { loadKey } from "./keystore.js";
import { readConfig } from "./config.js";

/**
 * Create an AgentDropClient using a key from the local keystore.
 *
 * @param keyLabel - Optional key label. Falls back to the default key from config.
 * @returns A configured AgentDropClient instance
 */
export async function getClient(keyLabel?: string): Promise<AgentDropClient> {
  const config = readConfig();
  const label = keyLabel ?? config.defaultKey;

  if (!label) {
    throw new Error(
      "No key specified. Use --key <label> or set a default key with: agentdrop config set default-key <label>",
    );
  }

  const { privateKey, publicKey } = await loadKey(label);
  const baseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;

  return new AgentDropClient({
    privateKey,
    publicKey,
    baseUrl,
  });
}
