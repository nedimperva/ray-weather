import { environment } from "@raycast/api";
import { mkdir, rename, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

import type { StatusSnapshot } from "./weatherWatch";

export const STATUS_FILE_NAME = "current.json";

/**
 * Where the status snapshot lives. On Linux this is a documented, stable path
 * under XDG_STATE_HOME so bar widgets and scripts can poll it without knowing
 * anything about the launcher. Elsewhere the extension support directory is the
 * right home for it, since nothing external consumes it there.
 */
export function statusFileDirectory(): string {
  if (process.platform === "linux") {
    const stateHome =
      process.env.XDG_STATE_HOME?.trim() || join(homedir(), ".local", "state");
    return join(stateHome, "forecast-pilot");
  }

  return environment.supportPath;
}

export function statusFilePath(): string {
  return join(statusFileDirectory(), STATUS_FILE_NAME);
}

/**
 * Write the snapshot atomically. A bar polling this file every few seconds must
 * never observe a partial write, so the JSON lands in a sibling temp file and is
 * renamed over the target.
 */
export async function writeStatusFile(
  snapshot: StatusSnapshot,
): Promise<string> {
  const directory = statusFileDirectory();
  await mkdir(directory, { recursive: true });

  const target = join(directory, STATUS_FILE_NAME);
  const temporary = `${target}.${process.pid}.tmp`;

  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await rename(temporary, target);

  return target;
}
