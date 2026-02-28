/**
 * Generate an Ed25519 keypair for Clawdrive grant JWT signing.
 * Run: npx tsx packages/shared/src/scripts/generate-signing-keys.ts
 *
 * Copy the output into your .env / Vercel env vars:
 *   CLAWDRIVE_SIGNING_PRIVATE_KEY=...
 *   CLAWDRIVE_SIGNING_PUBLIC_KEY=...
 */
import { generateKeyPair, exportPrivateKey, exportPublicKey } from "../crypto/keys.js";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair();

  const privStr = await exportPrivateKey(privateKey);
  const pubStr = await exportPublicKey(publicKey);

  console.log("# Add these to your .env or Vercel environment variables:\n");
  console.log(`CLAWDRIVE_SIGNING_PRIVATE_KEY='${privStr}'`);
  console.log(`CLAWDRIVE_SIGNING_PUBLIC_KEY='${pubStr}'`);
}

main().catch(console.error);
