import { Command } from "commander";
import chalk from "chalk";
import { getClient } from "../lib/api-client.js";
import { readConfig } from "../lib/config.js";
import { GRANT_DEFAULT_TTL_SECONDS } from "@agentdrop/shared";
import { formatTable, formatJson, spinner } from "../lib/output.js";

/**
 * Parse a duration string (e.g. "1h", "30m", "7d", "300s") into seconds.
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) {
    throw new Error(
      `Invalid duration "${duration}". Use format: 300, 300s, 5m, 1h, 7d`,
    );
  }

  const value = parseInt(match[1]!, 10);
  const unit = (match[2] ?? "s").toLowerCase();

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return value;
  }
}

export function registerGrantsCommands(program: Command): void {
  program
    .command("grant")
    .description("Create a file access grant for another agent")
    .argument("<file_id>", "The file ID to grant access to")
    .requiredOption("--to <key_hash>", "Public key hash of the grantee")
    .option(
      "--ttl <duration>",
      "Grant duration (e.g. 300s, 5m, 1h, 7d)",
      `${GRANT_DEFAULT_TTL_SECONDS}s`,
    )
    .option("--key <label>", "Key label to use for signing")
    .action(
      async (
        fileId: string,
        opts: { to: string; ttl: string; key?: string },
      ) => {
        const spin = spinner("Creating grant...");

        try {
          const ttlSeconds = parseDuration(opts.ttl);
          const client = await getClient(opts.key);

          const result = await client.createGrant(
            fileId,
            opts.to,
            ["download"],
            ttlSeconds,
          );

          spin.succeed("Grant created successfully.");

          console.log(`  Grant ID:  ${chalk.cyan(result.grant.id)}`);
          console.log(`  File ID:   ${result.grant.fileId}`);
          console.log(`  Grantee:   ${result.grant.granteeKeyHash}`);
          console.log(
            `  Expires:   ${new Date(result.grant.expiresAt).toISOString()}`,
          );

          console.log(chalk.bold("\n  Grant Token:\n"));
          console.log(`  ${result.token}`);
          console.log(
            chalk.dim(
              "\n  Share this token with the grantee to allow file access.",
            ),
          );
        } catch (error) {
          spin.fail("Failed to create grant");
          const message = error instanceof Error ? error.message : String(error);
          console.error(chalk.red(`  ${message}`));
          process.exit(1);
        }
      },
    );

  program
    .command("revoke-grant")
    .description("Revoke an existing file access grant")
    .argument("<id>", "The grant ID to revoke")
    .option("--key <label>", "Key label to use for signing")
    .action(async (id: string, opts: { key?: string }) => {
      const spin = spinner(`Revoking grant ${id}...`);

      try {
        const client = await getClient(opts.key);
        await client.revokeGrant(id);
        spin.succeed(`Grant ${id} revoked successfully.`);
      } catch (error) {
        spin.fail("Failed to revoke grant");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });

  program
    .command("grants")
    .description("List grants for a file")
    .argument("<file_id>", "The file ID to list grants for")
    .option("--key <label>", "Key label to use for signing")
    .option("--json", "Output as JSON")
    .action(
      async (fileId: string, opts: { key?: string; json?: boolean }) => {
        const spin = spinner("Fetching grants...");

        try {
          const client = await getClient(opts.key);
          const data = await client.listGrantsForFile(fileId);

          spin.stop();

          if (data.grants.length === 0) {
            console.log(chalk.yellow("No grants found for this file."));
            return;
          }

          if (opts.json) {
            console.log(formatJson(data.grants));
            return;
          }

          const table = formatTable(
            ["ID", "Grantee", "Permissions", "Expires", "Status"],
            data.grants.map((g) => [
              g.id.slice(0, 8) + "...",
              g.granteeKeyHash.slice(0, 16) + "...",
              g.permissions.join(", "),
              new Date(g.expiresAt).toISOString(),
              g.revokedAt
                ? chalk.red("revoked")
                : new Date(g.expiresAt) < new Date()
                  ? chalk.yellow("expired")
                  : chalk.green("active"),
            ]),
          );

          console.log(table);
        } catch (error) {
          spin.fail("Failed to list grants");
          const message = error instanceof Error ? error.message : String(error);
          console.error(chalk.red(`  ${message}`));
          process.exit(1);
        }
      },
    );
}
