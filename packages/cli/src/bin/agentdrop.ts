import { Command } from "commander";
import chalk from "chalk";
import { registerAuthCommands } from "../commands/auth.js";
import { registerKeysCommands } from "../commands/keys.js";
import { registerFilesCommands } from "../commands/files.js";
import { registerGrantsCommands } from "../commands/grants.js";
import { registerConfigCommands } from "../commands/config.js";

const program = new Command();

program
  .name("agentdrop")
  .description("AgentDrop CLI — Manage files, keys, and grants for agent-to-agent file sharing")
  .version("0.0.1");

// Register all command groups
registerAuthCommands(program);
registerKeysCommands(program);
registerFilesCommands(program);
registerGrantsCommands(program);
registerConfigCommands(program);

// Global error handler
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  // Commander throws on --help and --version, which is expected
  if (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "commander.helpDisplayed"
  ) {
    process.exit(0);
  }
  if (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "commander.version"
  ) {
    process.exit(0);
  }

  // Unexpected errors
  if (error instanceof Error) {
    console.error(chalk.red(`\nError: ${error.message}`));
  }
  process.exit(1);
}
