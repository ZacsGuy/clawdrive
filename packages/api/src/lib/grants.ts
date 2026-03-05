import { db } from "@/db";
import { grants, files } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  createGrantJWT,
  verifyGrantJWT,
  importPrivateKey,
  importPublicKey,
} from "@agentdrop/shared";

/**
 * Load the AgentDrop grant signing private key from environment.
 */
async function getSigningKey(): Promise<CryptoKey> {
  const keyStr = process.env.AGENTDROP_SIGNING_PRIVATE_KEY;
  if (!keyStr) {
    throw new Error("AGENTDROP_SIGNING_PRIVATE_KEY is not configured");
  }
  return importPrivateKey(keyStr);
}

/**
 * Load the AgentDrop grant signing public key from environment.
 */
export async function getSigningPublicKey(): Promise<CryptoKey> {
  const keyStr = process.env.AGENTDROP_SIGNING_PUBLIC_KEY;
  if (!keyStr) {
    throw new Error("AGENTDROP_SIGNING_PUBLIC_KEY is not configured");
  }
  return importPublicKey(keyStr);
}

/**
 * Create a grant JWT for a file access grant.
 */
export async function issueGrantToken(grantId: string, fileId: string, granteeKeyHash: string, permissions: string[], ttlSeconds: number): Promise<string> {
  const signingKey = await getSigningKey();
  return createGrantJWT(signingKey, {
    fileId,
    granteeKeyHash,
    grantId,
    permissions,
    ttlSeconds,
  });
}

/**
 * Verify a grant token against the 5 conditions:
 * 1. JWT signature valid (verified by jose against AgentDrop's public key)
 * 2. JWT not expired (jose handles this)
 * 3. Grant not revoked in DB (check grants table by jti/grantId)
 * 4. File not deleted (check files table)
 * 5. `aud` matches requesting agent's keyHash
 */
export async function verifyGrant(
  token: string,
  requestingKeyHash: string,
): Promise<{
  valid: true;
  fileId: string;
  grantId: string;
  permissions: string[];
} | {
  valid: false;
  reason: string;
}> {
  // Condition 1 & 2: JWT signature + expiration
  let jwtPayload: Awaited<ReturnType<typeof verifyGrantJWT>>;
  try {
    const publicKey = await getSigningPublicKey();
    jwtPayload = await verifyGrantJWT(publicKey, token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return { valid: false, reason: `JWT verification failed: ${message}` };
  }

  // Condition 5: aud matches requesting agent's keyHash
  if (jwtPayload.granteeKeyHash !== requestingKeyHash) {
    return {
      valid: false,
      reason: "Token audience does not match requesting agent",
    };
  }

  // Condition 3: Grant not revoked in DB
  const grant = await db
    .select({
      id: grants.id,
      revokedAt: grants.revokedAt,
      fileId: grants.fileId,
    })
    .from(grants)
    .where(eq(grants.id, jwtPayload.grantId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!grant) {
    return { valid: false, reason: "Grant not found" };
  }

  if (grant.revokedAt !== null) {
    return { valid: false, reason: "Grant has been revoked" };
  }

  // Condition 4: File not deleted
  const file = await db
    .select({ id: files.id, deletedAt: files.deletedAt })
    .from(files)
    .where(and(eq(files.id, jwtPayload.fileId), isNull(files.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!file) {
    return { valid: false, reason: "File not found or has been deleted" };
  }

  return {
    valid: true,
    fileId: jwtPayload.fileId,
    grantId: jwtPayload.grantId,
    permissions: jwtPayload.permissions,
  };
}
