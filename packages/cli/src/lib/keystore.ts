import fs from "node:fs";
import path from "node:path";
import { importPrivateKey, importPublicKey } from "@agentdrop/shared";
import { getConfigDir } from "./config.js";

export interface StoredKey {
  label: string;
  privateKeyJwk: string;
  publicKeyJwk: string;
  keyHash: string;
  remoteKeyId: string;
}

export interface LoadedKey {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  keyHash: string;
  remoteKeyId: string;
}

function getKeysDir(): string {
  const keysDir = path.join(getConfigDir(), "keys");
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  return keysDir;
}

function keyFilePath(label: string): string {
  return path.join(getKeysDir(), `${label}.json`);
}

/**
 * Save an Ed25519 key pair to the local keystore.
 *
 * @param label - Human-readable label for the key
 * @param privateKeyJwk - JSON-serialized private key JWK
 * @param publicKeyJwk - JSON-serialized public key JWK
 * @param keyHash - SHA-256 thumbprint of the public key
 * @param remoteKeyId - Server-assigned key ID after registration
 */
export function saveKey(
  label: string,
  privateKeyJwk: string,
  publicKeyJwk: string,
  keyHash: string,
  remoteKeyId: string,
): void {
  const stored: StoredKey = {
    label,
    privateKeyJwk,
    publicKeyJwk,
    keyHash,
    remoteKeyId,
  };
  fs.writeFileSync(keyFilePath(label), JSON.stringify(stored, null, 2), "utf-8");
}

/**
 * Load a key from the local keystore and import it as CryptoKey objects.
 *
 * @param label - The key label to load
 * @returns The loaded key with CryptoKey objects, hash, and remote ID
 */
export async function loadKey(label: string): Promise<LoadedKey> {
  const filePath = keyFilePath(label);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Key "${label}" not found in keystore`);
  }

  const data = fs.readFileSync(filePath, "utf-8");
  const stored = JSON.parse(data) as StoredKey;

  const privateKey = await importPrivateKey(stored.privateKeyJwk);
  const publicKey = await importPublicKey(stored.publicKeyJwk);

  return {
    privateKey,
    publicKey,
    keyHash: stored.keyHash,
    remoteKeyId: stored.remoteKeyId,
  };
}

/**
 * List all stored key labels with their metadata (without loading CryptoKeys).
 */
export function listKeys(): StoredKey[] {
  const keysDir = getKeysDir();
  const entries = fs.readdirSync(keysDir).filter((f) => f.endsWith(".json"));

  return entries.map((file) => {
    const data = fs.readFileSync(path.join(keysDir, file), "utf-8");
    return JSON.parse(data) as StoredKey;
  });
}

/**
 * Delete a key from the local keystore.
 *
 * @param label - The key label to delete
 */
export function deleteKey(label: string): void {
  const filePath = keyFilePath(label);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Key "${label}" not found in keystore`);
  }
  fs.unlinkSync(filePath);
}
