import { compactVerify } from "jose";
import { TIMESTAMP_TOLERANCE_SECONDS } from "../constants.js";
import { buildCanonicalString, hashBody } from "./sign.js";

export async function verifySignature(
  publicKey: CryptoKey,
  signature: string,
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body?: string,
): Promise<boolean> {
  try {
    const bodyHash = await hashBody(body);
    const canonical = buildCanonicalString(
      method,
      path,
      timestamp,
      nonce,
      bodyHash,
    );

    const result = await compactVerify(signature, publicKey);
    const decoded = new TextDecoder().decode(result.payload);
    return decoded === canonical;
  } catch {
    return false;
  }
}

export function isTimestampValid(
  timestamp: string,
  toleranceSeconds: number = TIMESTAMP_TOLERANCE_SECONDS,
): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= toleranceSeconds;
}
