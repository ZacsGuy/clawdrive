import { SignJWT, jwtVerify, exportJWK } from "jose";
import { GRANT_ISSUER } from "../constants.js";

export async function createGrantJWT(
  signingKey: CryptoKey,
  payload: {
    fileId: string;
    granteeKeyHash: string;
    grantId: string;
    permissions: string[];
    ttlSeconds: number;
  },
): Promise<string> {
  return new SignJWT({ permissions: payload.permissions })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(GRANT_ISSUER)
    .setSubject(payload.fileId)
    .setAudience(payload.granteeKeyHash)
    .setJti(payload.grantId)
    .setIssuedAt()
    .setExpirationTime(`${payload.ttlSeconds}s`)
    .sign(signingKey);
}

export async function verifyGrantJWT(
  publicKey: CryptoKey,
  token: string,
): Promise<{
  fileId: string;
  granteeKeyHash: string;
  grantId: string;
  permissions: string[];
}> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: GRANT_ISSUER,
  });

  return {
    fileId: payload.sub!,
    granteeKeyHash: Array.isArray(payload.aud)
      ? payload.aud[0]!
      : payload.aud!,
    grantId: payload.jti!,
    permissions: payload.permissions as string[],
  };
}

export async function exportJWKS(
  publicKey: CryptoKey,
): Promise<{ keys: object[] }> {
  const jwk = await exportJWK(publicKey);
  jwk.kid = "agentdrop-signing-key-1";
  jwk.use = "sig";
  jwk.alg = "EdDSA";
  return { keys: [jwk] };
}
