import {
  signRequest,
  hashPublicKey,
  type SignedHeaders,
} from "@agentdrop/shared";

/**
 * Creates signed headers for an authenticated AgentDrop API request.
 *
 * @param privateKey - The Ed25519 private CryptoKey used for signing
 * @param publicKey - The Ed25519 public CryptoKey used for key hash computation
 * @param method - HTTP method (GET, POST, DELETE, etc.)
 * @param path - The request path (e.g. /api/files)
 * @param body - Optional stringified request body
 * @returns An object containing the four X-AgentDrop-* headers
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
    "x-agentdrop-keyhash": keyHash,
    "x-agentdrop-timestamp": timestamp,
    "x-agentdrop-nonce": nonce,
    "x-agentdrop-signature": signature,
  };
}
