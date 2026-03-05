import { db } from "@/db";
import { nonces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TIMESTAMP_TOLERANCE_SECONDS } from "@agentdrop/shared";

/**
 * Check that a nonce has not been used before for the given keyHash,
 * and store it to prevent replay attacks.
 * Returns true if the nonce is fresh (unused), false if it has been seen.
 */
export async function consumeNonce(
  nonce: string,
  keyHash: string,
): Promise<boolean> {
  // Check for existing nonce
  const existing = await db
    .select({ nonce: nonces.nonce })
    .from(nonces)
    .where(eq(nonces.nonce, nonce))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    return false;
  }

  // Nonce expires after the timestamp tolerance window (doubled for safety)
  const expiresAt = new Date(
    Date.now() + TIMESTAMP_TOLERANCE_SECONDS * 2 * 1000,
  );

  try {
    await db.insert(nonces).values({
      nonce,
      keyHash,
      expiresAt,
    });
    return true;
  } catch {
    // Unique constraint violation means race condition; treat as duplicate
    return false;
  }
}
