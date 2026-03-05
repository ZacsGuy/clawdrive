/**
 * Generate an Ed25519 keypair for AgentDrop grant JWT signing.
 * Run: npx tsx packages/shared/src/scripts/generate-signing-keys.ts
 *
 * Copy the output into your .env / Vercel env vars:
 *   AGENTDROP_SIGNING_PRIVATE_KEY=...
 *   AGENTDROP_SIGNING_PUBLIC_KEY=...
 */
import { generateKeyPair, exportPrivateKey, exportPublicKey } from "../crypto/keys.js";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair();

  const privStr = await exportPrivateKey(privateKey);
  const pubStr = await exportPublicKey(publicKey);

  console.log("# Add these to your .env or Vercel environment variables:\n");
  console.log(`AGENTDROP_SIGNING_PRIVATE_KEY='${privStr}'`);
  console.log(`AGENTDROP_SIGNING_PUBLIC_KEY='${pubStr}'`);
}

main().catch(console.error);
