import { Command } from "commander";
import chalk from "chalk";
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  hashPublicKey,
} from "@agentdrop/shared";
import { readConfig } from "../lib/config.js";
import { saveKey, listKeys as listLocalKeys, loadKey } from "../lib/keystore.js";
import { formatTable, spinner } from "../lib/output.js";

/**
 * Make an authenticated HTTP request using the stored auth token.
 */
async function authedFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const config = readConfig();
  if (!config.authToken) {
    throw new Error(
      "Not logged in. Run `agentdrop auth login` first.",
    );
  }

  const baseUrl = config.apiBaseUrl ?? "https://api.agentdrop.dev";
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${config.authToken}`,
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (options.body && typeof options.body === "string") {
    headers["content-type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export function registerKeysCommands(program: Command): void {
  const keys = program.command("keys").description("Manage Ed25519 agent keys");

  keys
    .command("create")
    .description("Generate a new Ed25519 keypair and register it with the server")
    .requiredOption("--label <name>", "Human-readable label for the key")
    .action(async (opts: { label: string }) => {
      const spin = spinner(`Generating Ed25519 keypair "${opts.label}"...`);

      try {
        // Generate keypair locally
        const { publicKey, privateKey } = await generateKeyPair();

        // Export keys to JWK format
        const publicKeyJwk = await exportPublicKey(publicKey);
        const privateKeyJwk = await exportPrivateKey(privateKey);
        const keyHash = await hashPublicKey(publicKey);

        spin.text = "Registering public key with server...";

        // Register the public key with the API
        const response = await authedFetch("/api/keys", {
          method: "POST",
          body: JSON.stringify({
            label: opts.label,
            publicKey: publicKeyJwk,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const msg = (errorBody as Record<string, string>).error ?? response.statusText;
          throw new Error(`Server returned ${response.status}: ${msg}`);
        }

        const result = (await response.json()) as { key: { id: string } };
        const remoteKeyId = result.key.id;

        // Save to local keystore
        saveKey(opts.label, privateKeyJwk, publicKeyJwk, keyHash, remoteKeyId);

        spin.succeed(`Key "${opts.label}" created and registered successfully.`);
        console.log(`  Key ID:   ${chalk.cyan(remoteKeyId)}`);
        console.log(`  Key Hash: ${chalk.cyan(keyHash)}`);
        console.log(
          `\n  ${chalk.dim("Private key stored locally at ~/.agentdrop/keys/" + opts.label + ".json")}`,
        );
      } catch (error) {
        spin.fail("Failed to create key");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });

  keys
    .command("ls")
    .description("List registered keys from the server")
    .action(async () => {
      const spin = spinner("Fetching keys...");

      try {
        const response = await authedFetch("/api/keys");
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          keys: Array<{
            id: string;
            label: string;
            keyHash: string;
            createdAt: string;
            revokedAt: string | null;
          }>;
        };

        spin.stop();

        if (data.keys.length === 0) {
          console.log(chalk.yellow("No keys found."));
          return;
        }

        // Cross-reference with local keys
        const localKeys = listLocalKeys();
        const localLabels = new Set(localKeys.map((k) => k.label));

        const table = formatTable(
          ["ID", "Label", "Key Hash", "Created", "Status", "Local"],
          data.keys.map((k) => [
            k.id.slice(0, 8) + "...",
            k.label,
            k.keyHash.slice(0, 16) + "...",
            new Date(k.createdAt).toLocaleDateString(),
            k.revokedAt ? chalk.red("revoked") : chalk.green("active"),
            localLabels.has(k.label) ? chalk.green("yes") : chalk.dim("no"),
          ]),
        );

        console.log(table);
      } catch (error) {
        spin.fail("Failed to list keys");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });

  keys
    .command("revoke")
    .description("Revoke a registered key on the server")
    .argument("<id>", "The key ID to revoke")
    .action(async (id: string) => {
      const spin = spinner(`Revoking key ${id}...`);

      try {
        const response = await authedFetch(`/api/keys/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const msg = (errorBody as Record<string, string>).error ?? response.statusText;
          throw new Error(`Server returned ${response.status}: ${msg}`);
        }

        spin.succeed(`Key ${id} revoked successfully.`);
      } catch (error) {
        spin.fail("Failed to revoke key");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });

  keys
    .command("export")
    .description("Print the public key JWK from the local keystore")
    .argument("<label>", "The key label to export")
    .action(async (label: string) => {
      try {
        const stored = listLocalKeys().find((k) => k.label === label);
        if (!stored) {
          console.error(chalk.red(`Key "${label}" not found in local keystore.`));
          process.exit(1);
        }

        console.log(chalk.bold(`Public key for "${label}":\n`));
        console.log(stored.publicKeyJwk);
        console.log(`\n  Key Hash: ${chalk.cyan(stored.keyHash)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Failed to export key: ${message}`));
        process.exit(1);
      }
    });
}
