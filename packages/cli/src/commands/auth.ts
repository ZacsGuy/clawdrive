import { Command } from "commander";
import http from "node:http";
import chalk from "chalk";
import open from "open";
import { readConfig, writeConfig } from "../lib/config.js";
import { spinner } from "../lib/output.js";

/**
 * Find a random available port by listening on port 0.
 */
function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Could not determine port")));
      }
    });
    server.on("error", reject);
  });
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("login")
    .description("Log in to AgentDrop via browser-based authentication")
    .action(async () => {
      const config = readConfig();
      const baseUrl = config.apiBaseUrl ?? "https://api.agentdrop.dev";

      try {
        const port = await getRandomPort();
        const callbackUrl = `http://localhost:${port}/callback`;

        // Build the login URL
        const loginUrl = `${baseUrl}/auth/login?redirect_uri=${encodeURIComponent(callbackUrl)}`;

        console.log(chalk.bold("\nAgentDrop Login\n"));
        console.log(`Open this URL in your browser to authenticate:\n`);
        console.log(chalk.cyan(loginUrl));
        console.log();

        const spin = spinner("Waiting for authentication callback...");

        // Start local HTTP server to receive the callback
        const token = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            server.close();
            reject(new Error("Authentication timed out after 5 minutes"));
          }, 5 * 60 * 1000);

          const server = http.createServer((req, res) => {
            const url = new URL(req.url ?? "/", `http://localhost:${port}`);

            if (url.pathname === "/callback") {
              const receivedToken = url.searchParams.get("token");

              if (receivedToken) {
                res.writeHead(200, { "content-type": "text/html" });
                res.end(`
                  <html>
                    <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                      <div style="text-align: center;">
                        <h1>Authenticated!</h1>
                        <p>You can close this window and return to your terminal.</p>
                      </div>
                    </body>
                  </html>
                `);
                clearTimeout(timeout);
                server.close(() => resolve(receivedToken));
              } else {
                res.writeHead(400, { "content-type": "text/html" });
                res.end(`
                  <html>
                    <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                      <div style="text-align: center;">
                        <h1>Authentication Failed</h1>
                        <p>No token received. Please try again.</p>
                      </div>
                    </body>
                  </html>
                `);
                clearTimeout(timeout);
                server.close(() => reject(new Error("No token received in callback")));
              }
            } else {
              res.writeHead(404);
              res.end("Not found");
            }
          });

          server.listen(port, () => {
            // Try to open the browser automatically
            open(loginUrl).catch(() => {
              // Browser open failed; user can open the URL manually
            });
          });

          server.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        spin.succeed("Authenticated successfully!");

        // Save the token to config
        config.authToken = token;
        writeConfig(config);

        console.log(chalk.green("\nAuth token saved. You are now logged in."));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\nLogin failed: ${message}`));
        process.exit(1);
      }
    });

  auth
    .command("logout")
    .description("Log out and clear stored authentication token")
    .action(() => {
      const config = readConfig();
      delete config.authToken;
      writeConfig(config);
      console.log(chalk.green("Logged out successfully. Auth token cleared."));
    });

  auth
    .command("whoami")
    .description("Show current authentication status")
    .action(() => {
      const config = readConfig();

      if (config.authToken) {
        // Decode the JWT payload to show user info (without verification)
        try {
          const parts = config.authToken.split(".");
          if (parts.length >= 2) {
            const payload = JSON.parse(
              Buffer.from(parts[1]!, "base64url").toString("utf-8"),
            );
            console.log(chalk.bold("Logged in"));
            if (payload.sub) {
              console.log(`  User ID: ${chalk.cyan(payload.sub)}`);
            }
            if (payload.email) {
              console.log(`  Email:   ${chalk.cyan(payload.email)}`);
            }
            if (payload.exp) {
              const expiresAt = new Date(payload.exp * 1000);
              console.log(`  Expires: ${chalk.cyan(expiresAt.toISOString())}`);
            }
          } else {
            console.log(chalk.bold("Logged in"));
            console.log("  (Could not decode token details)");
          }
        } catch {
          console.log(chalk.bold("Logged in"));
          console.log("  (Could not decode token details)");
        }
      } else {
        console.log(chalk.yellow("Not logged in."));
        console.log(`Run ${chalk.cyan("agentdrop auth login")} to authenticate.`);
      }
    });
}
