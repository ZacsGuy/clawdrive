import { CompactSign } from "jose";

export function buildCanonicalString(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodyHash: string,
): string {
  return `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
}

export async function hashBody(body: string | undefined): Promise<string> {
  const data = new TextEncoder().encode(body ?? "");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signRequest(
  privateKey: CryptoKey,
  method: string,
  path: string,
  body?: string,
): Promise<{
  timestamp: string;
  nonce: string;
  signature: string;
  bodyHash: string;
}> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = await hashBody(body);
  const canonical = buildCanonicalString(
    method,
    path,
    timestamp,
    nonce,
    bodyHash,
  );

  const encoder = new TextEncoder();
  const signature = await new CompactSign(encoder.encode(canonical))
    .setProtectedHeader({ alg: "EdDSA" })
    .sign(privateKey);

  return { timestamp, nonce, signature, bodyHash };
}
