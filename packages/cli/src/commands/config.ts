import { Command } from "commander";
import chalk from "chalk";
import { readConfig, setConfigValue, type CliConfig } from "../lib/config.js";
import { formatTable } from "../lib/output.js";

/**
 * Map user-facing config key names to internal config keys.
 */
const KEY_MAP: Record<string, keyof CliConfig> = {
  "default-key": "defaultKey",
  "default-ttl": "defaultTtl",
  "api-url": "apiBaseUrl",
};

function resolveKey(key: string): keyof CliConfig {
  const resolved = KEY_MAP[key];
  if (!resolved) {
    const validKeys = Object.keys(KEY_MAP).join(", ");
    throw new Error(
      `Unknown config key "${key}". Valid keys: ${validKeys}`,
    );
  }
  return resolved;
}

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage CLI configuration");

  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Config key (default-key, default-ttl, api-url)")
    .argument("<value>", "Config value")
    .action((key: string, value: string) => {
      try {
        const resolvedKey = resolveKey(key);

        let parsedValue: string | number = value;
        if (resolvedKey === "defaultTtl") {
          parsedValue = parseInt(value, 10);
          if (isNaN(parsedValue)) {
            throw new Error("default-ttl must be a number (seconds)");
          }
        }

        setConfigValue(resolvedKey, parsedValue);
        console.log(chalk.green(`Set ${key} = ${value}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(message));
        process.exit(1);
      }
    });

  config
    .command("get")
    .description("Get a configuration value")
    .argument("<key>", "Config key (default-key, default-ttl, api-url)")
    .action((key: string) => {
      try {
        const resolvedKey = resolveKey(key);
        const cfg = readConfig();
        const value = cfg[resolvedKey];

        if (value === undefined) {
          console.log(chalk.yellow(`${key} is not set`));
        } else {
          console.log(`${key} = ${chalk.cyan(String(value))}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(message));
        process.exit(1);
      }
    });

  config
    .command("ls")
    .description("Show all configuration values")
    .action(() => {
      const cfg = readConfig();

      const displayMap: Array<[string, keyof CliConfig]> = [
        ["default-key", "defaultKey"],
        ["default-ttl", "defaultTtl"],
        ["api-url", "apiBaseUrl"],
        ["auth-token", "authToken"],
      ];

      const rows = displayMap.map(([displayKey, cfgKey]) => {
        const value = cfg[cfgKey];
        if (cfgKey === "authToken" && value) {
          // Mask the auth token for security
          return [displayKey, chalk.dim("***" + String(value).slice(-8))];
        }
        return [displayKey, value !== undefined ? String(value) : chalk.dim("(not set)")];
      });

      const table = formatTable(["Key", "Value"], rows);
      console.log(table);
    });
}
