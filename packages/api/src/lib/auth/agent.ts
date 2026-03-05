import { db } from "@/db";
import { agentKeys } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  HEADER_KEY_HASH,
  HEADER_TIMESTAMP,
  HEADER_NONCE,
  HEADER_SIGNATURE,
  verifySignature,
  isTimestampValid,
  importPublicKey,
} from "@agentdrop/shared";
import type { AgentAuth } from "@agentdrop/shared";
import { consumeNonce } from "@/lib/nonce";

/**
 * Verify agent authentication from request headers.
 * Checks:
 *  1. All required headers present
 *  2. Timestamp within tolerance window
 *  3. Public key lookup by keyHash in DB (key must not be revoked)
 *  4. Ed25519 signature verification
 *  5. Nonce uniqueness (replay protection)
 *
 * Returns AgentAuth context if valid, or null.
 */
export async function verifyAgentAuth(
  headers: Headers,
  method: string,
  path: string,
  body?: string,
): Promise<AgentAuth | null> {
  const keyHash = headers.get(HEADER_KEY_HASH);
  const timestamp = headers.get(HEADER_TIMESTAMP);
  const nonce = headers.get(HEADER_NONCE);
  const signature = headers.get(HEADER_SIGNATURE);

  // All four headers are required
  if (!keyHash || !timestamp || !nonce || !signature) {
    return null;
  }

  // Check timestamp is within tolerance
  if (!isTimestampValid(timestamp)) {
    return null;
  }

  // Look up the public key by keyHash, ensuring the key is not revoked
  const keyRow = await db
    .select({
      publicKey: agentKeys.publicKey,
      keyHash: agentKeys.keyHash,
    })
    .from(agentKeys)
    .where(and(eq(agentKeys.keyHash, keyHash), isNull(agentKeys.revokedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!keyRow) {
    return null;
  }

  // Import the public key
  let publicKey: CryptoKey;
  try {
    publicKey = await importPublicKey(keyRow.publicKey);
  } catch {
    return null;
  }

  // Verify the Ed25519 signature
  const valid = await verifySignature(
    publicKey,
    signature,
    method,
    path,
    timestamp,
    nonce,
    body,
  );

  if (!valid) {
    return null;
  }

  // Consume nonce to prevent replay attacks
  const nonceIsNew = await consumeNonce(nonce, keyHash);
  if (!nonceIsNew) {
    return null;
  }

  return {
    type: "agent",
    keyHash: keyRow.keyHash,
    publicKey,
  };
}
