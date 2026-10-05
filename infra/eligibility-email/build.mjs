import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(new URL(".", import.meta.url));
await mkdir(new URL("dist/", import.meta.url), { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL("handler.mjs", import.meta.url))],
  outfile: fileURLToPath(new URL("dist/index.cjs", import.meta.url)),
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  minify: true,
});
execFileSync("zip", ["-j", "dist/bridge.zip", "dist/index.cjs"], {
  cwd: directory,
  stdio: "inherit",
});
