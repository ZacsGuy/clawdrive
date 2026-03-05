import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getClient } from "../lib/api-client.js";
import { formatTable, formatJson, spinner } from "../lib/output.js";

export function registerFilesCommands(program: Command): void {
  program
    .command("upload")
    .description("Upload a file to AgentDrop")
    .argument("<file>", "Path to the file to upload")
    .option("--key <label>", "Key label to use for signing")
    .action(async (filePath: string, opts: { key?: string }) => {
      const spin = spinner("Uploading file...");

      try {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${resolvedPath}`);
        }

        const client = await getClient(opts.key);
        const filename = path.basename(resolvedPath);
        const fileBuffer = fs.readFileSync(resolvedPath);

        // Determine content type from extension
        const contentType = getContentType(filename);

        spin.text = `Uploading ${filename} (${formatBytes(fileBuffer.byteLength)})...`;

        const file = await client.upload(fileBuffer, filename, contentType);

        spin.succeed(`File uploaded successfully.`);
        console.log(`  File ID:      ${chalk.cyan(file.id)}`);
        console.log(`  Filename:     ${file.filename}`);
        console.log(`  Size:         ${formatBytes(file.sizeBytes)}`);
        console.log(`  Content-Type: ${file.contentType}`);
        console.log(`  SHA-256:      ${chalk.dim(file.sha256)}`);
      } catch (error) {
        spin.fail("Upload failed");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });

  program
    .command("download")
    .description("Download a file from AgentDrop")
    .argument("<id>", "File ID to download")
    .option("--output <path>", "Output file path (defaults to original filename)")
    .option("--token <grant-jwt>", "Grant token for accessing shared files")
    .option("--key <label>", "Key label to use for signing")
    .action(
      async (
        id: string,
        opts: { output?: string; token?: string; key?: string },
      ) => {
        const spin = spinner("Downloading file...");

        try {
          const client = await getClient(opts.key);

          // Get file info first to determine output filename if not specified
          let outputPath = opts.output;
          if (!outputPath) {
            try {
              const fileInfo = await client.getFile(id);
              outputPath = fileInfo.filename;
            } catch {
              outputPath = id;
            }
          }

          spin.text = `Downloading to ${outputPath}...`;

          const body = await client.download(id, opts.token);

          // Convert the web ReadableStream to a Node readable stream and pipe to file
          const nodeReadable = Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>);
          const writeStream = fs.createWriteStream(path.resolve(outputPath));
          await pipeline(nodeReadable, writeStream);

          spin.succeed(`Downloaded to ${chalk.cyan(outputPath)}`);
        } catch (error) {
          spin.fail("Download failed");
          const message = error instanceof Error ? error.message : String(error);
          console.error(chalk.red(`  ${message}`));
          process.exit(1);
        }
      },
    );

  program
    .command("ls")
    .description("List your files")
    .option("--key <label>", "Key label to use for signing")
    .option("--json", "Output as JSON")
    .action(async (opts: { key?: string; json?: boolean }) => {
      const spin = spinner("Fetching files...");

      try {
        const client = await getClient(opts.key);
        const data = await client.listFiles();

        spin.stop();

        if (data.files.length === 0) {
          console.log(chalk.yellow("No files found."));
          return;
        }

        if (opts.json) {
          console.log(formatJson(data.files));
          return;
        }

        const table = formatTable(
          ["ID", "Filename", "Content-Type", "Size", "Created"],
          data.files.map((f) => [
            f.id.slice(0, 8) + "...",
            f.filename,
            f.contentType,
            formatBytes(f.sizeBytes),
            new Date(f.createdAt).toLocaleDateString(),
          ]),
        );

        console.log(table);
      } catch (error) {
        spin.fail("Failed to list files");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });

  program
    .command("rm")
    .description("Delete a file")
    .argument("<id>", "File ID to delete")
    .option("--key <label>", "Key label to use for signing")
    .action(async (id: string, opts: { key?: string }) => {
      const spin = spinner(`Deleting file ${id}...`);

      try {
        const client = await getClient(opts.key);
        await client.deleteFile(id);
        spin.succeed(`File ${id} deleted successfully.`);
      } catch (error) {
        spin.fail("Delete failed");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });

  program
    .command("info")
    .description("Show details for a file")
    .argument("<id>", "File ID")
    .option("--key <label>", "Key label to use for signing")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { key?: string; json?: boolean }) => {
      const spin = spinner(`Fetching file info...`);

      try {
        const client = await getClient(opts.key);
        const file = await client.getFile(id);

        spin.stop();

        if (opts.json) {
          console.log(formatJson(file));
          return;
        }

        console.log(chalk.bold("File Details\n"));
        console.log(`  ID:           ${chalk.cyan(file.id)}`);
        console.log(`  Filename:     ${file.filename}`);
        console.log(`  Content-Type: ${file.contentType}`);
        console.log(`  Size:         ${formatBytes(file.sizeBytes)}`);
        console.log(`  Owner:        ${file.ownerId} (${file.ownerType})`);
        console.log(`  SHA-256:      ${chalk.dim(file.sha256)}`);
        console.log(`  Created:      ${new Date(file.createdAt).toISOString()}`);
        if (file.deletedAt) {
          console.log(`  Deleted:      ${chalk.red(new Date(file.deletedAt).toISOString())}`);
        }
      } catch (error) {
        spin.fail("Failed to fetch file info");
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    });
}

/**
 * Simple content type detection based on file extension.
 */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    ".txt": "text/plain",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".gz": "application/gzip",
    ".tar": "application/x-tar",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".csv": "text/csv",
    ".md": "text/markdown",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
  };
  return types[ext] ?? "application/octet-stream";
}

/**
 * Format byte count as a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
