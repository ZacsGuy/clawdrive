import Table from "cli-table3";
import ora, { type Ora } from "ora";

/**
 * Format data as a CLI table.
 *
 * @param headers - Column header labels
 * @param rows - Array of row data (arrays of strings)
 * @returns Formatted table string
 */
export function formatTable(
  headers: string[],
  rows: string[][],
): string {
  const table = new Table({
    head: headers,
    style: {
      head: ["cyan"],
      border: ["gray"],
    },
  });

  for (const row of rows) {
    table.push(row);
  }

  return table.toString();
}

/**
 * Pretty-print JSON data.
 *
 * @param data - Any JSON-serializable data
 * @returns Pretty-printed JSON string
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Create and start an ora spinner.
 *
 * @param text - The spinner message
 * @returns The ora spinner instance
 */
export function spinner(text: string): Ora {
  return ora({ text, spinner: "dots" }).start();
}
