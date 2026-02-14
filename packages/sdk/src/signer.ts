import {
  signRequest,
  hashPublicKey,
  type SignedHeaders,
} from "@clawdrive/shared";

/**
 * Creates signed headers for an authenticated Clawdrive API request.
 *
 * @param privateKey - The Ed25519 private CryptoKey used for signing
 * @param publicKey - The Ed25519 public CryptoKey used for key hash computation
 * @param method - HTTP method (GET, POST, DELETE, etc.)
 * @param path - The request path (e.g. /api/files)
 * @param body - Optional stringified request body
 * @returns An object containing the four X-Clawdrive-* headers
 */
export async function createSignedHeaders(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  method: string,
  path: string,
  body?: string,
): Promise<SignedHeaders> {
  const keyHash = await hashPublicKey(publicKey);
  const { timestamp, nonce, signature } = await signRequest(
    privateKey,
    method,
    path,
    body,
  );

  return {
    "x-clawdrive-keyhash": keyHash,
    "x-clawdrive-timestamp": timestamp,
    "x-clawdrive-nonce": nonce,
    "x-clawdrive-signature": signature,
  };
}
