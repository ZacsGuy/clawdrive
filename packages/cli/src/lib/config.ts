import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface CliConfig {
  defaultKey?: string;
  defaultTtl?: number;
  apiBaseUrl?: string;
  authToken?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".agentdrop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Read the CLI configuration from ~/.agentdrop/config.json
 */
export function readConfig(): CliConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(data) as CliConfig;
  } catch {
    return {};
  }
}

/**
 * Write the full CLI configuration to disk.
 */
export function writeConfig(config: CliConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Get a single config value by key.
 */
export function getConfigValue(key: keyof CliConfig): string | number | undefined {
  const config = readConfig();
  return config[key];
}

/**
 * Set a single config value by key.
 */
export function setConfigValue(key: keyof CliConfig, value: string | number | undefined): void {
  const config = readConfig();

  if (key === "defaultTtl") {
    config[key] = typeof value === "number" ? value : Number(value);
  } else {
    (config as Record<string, unknown>)[key] = value;
  }

  writeConfig(config);
}

/**
 * Returns the config directory path.
 */
export function getConfigDir(): string {
  ensureConfigDir();
  return CONFIG_DIR;
}
