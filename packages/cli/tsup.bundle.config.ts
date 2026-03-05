import { defineConfig } from "tsup";
import { builtinModules } from "node:module";

const builtinSet = new Set(
  builtinModules.flatMap((m) => [m, `node:${m}`])
);

export default defineConfig({
  entry: ["src/bin/agentdrop.ts"],
  format: ["esm"],
  platform: "node",
  target: "node18",
  clean: true,
  sourcemap: false,
  noExternal: [/^(?!node:)/],
  external: [...builtinSet],
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
});
