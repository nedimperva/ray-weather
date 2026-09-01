#!/usr/bin/env node
// Build the extension for Vicinae.
//
// package.json is the Raycast manifest: it is the file the Raycast store
// validates, so it may only contain values Raycast understands. Vicinae needs a
// slightly different manifest -- Linux as a platform, its own schema, and no
// menu-bar command, because Vicinae has no menu bar to render one into.
//
// Rather than keeping two manifests in sync, this script runs `vici build` and
// then rewrites the manifest it copied into the output bundle.
//
// Usage: node scripts/build-vicinae.mjs [-o <dir>] [extra vici flags...]

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const VICINAE_SCHEMA =
  "https://raw.githubusercontent.com/vicinaehq/vicinae/refs/heads/main/extra/schemas/extension.json";

/** Mirrors `extensionDataDir()` in @vicinae/api, which is where vici installs. */
function defaultOutputDirectory(extensionName) {
  const dataHome =
    process.platform === "win32"
      ? join(
          process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
          "vicinae",
          "data",
        )
      : process.platform === "darwin"
        ? join(homedir(), ".local", "share", "vicinae")
        : join(
            process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
            "vicinae",
          );

  return join(dataHome, "extensions", extensionName);
}

function parseOutputFlag(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-o" || arg === "--out") return args[index + 1];
    if (arg.startsWith("--out=")) return arg.slice("--out=".length);
  }
  return undefined;
}

function toVicinaeManifest(manifest) {
  const commands = manifest.commands.filter(
    (command) => command.mode !== "menu-bar",
  );

  return {
    ...manifest,
    $schema: VICINAE_SCHEMA,
    platforms: ["Linux"],
    commands,
  };
}

const args = process.argv.slice(2);
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const outDir = parseOutputFlag(args) ?? defaultOutputDirectory(manifest.name);

const result = spawnSync("npx", ["vici", "build", ...args], {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(`Failed to run vici: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const vicinaeManifest = toVicinaeManifest(manifest);
const droppedCommands = manifest.commands
  .filter((command) => command.mode === "menu-bar")
  .map((command) => command.name);

writeFileSync(
  join(outDir, "package.json"),
  `${JSON.stringify(vicinaeManifest, null, 2)}\n`,
);

// The bundle for a command Vicinae will never load is only confusing.
for (const name of droppedCommands) {
  const bundle = join(outDir, `${name}.js`);
  if (existsSync(bundle)) rmSync(bundle);
}

console.log(`Vicinae manifest written to ${join(outDir, "package.json")}`);
if (droppedCommands.length > 0) {
  console.log(
    `Excluded menu-bar command(s): ${droppedCommands.join(", ")} (unsupported by Vicinae)`,
  );
}
