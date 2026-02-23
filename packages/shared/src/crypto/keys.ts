import * as jose from "jose";

export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const { publicKey, privateKey } = await jose.generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });
  return { publicKey, privateKey };
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await jose.exportJWK(key);
  return JSON.stringify(jwk);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await jose.exportJWK(key);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return (await jose.importJWK(jwk, "EdDSA")) as CryptoKey;
}

export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return (await jose.importJWK(jwk, "EdDSA")) as CryptoKey;
}

export async function hashPublicKey(publicKey: CryptoKey): Promise<string> {
  const jwk = await jose.exportJWK(publicKey);
  const thumbprint = await jose.calculateJwkThumbprint(jwk, "sha256");
  return thumbprint;
}
