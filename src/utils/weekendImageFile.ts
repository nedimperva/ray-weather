import { environment } from "@raycast/api";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import {
  buildWeekendShareImageFilename,
  renderWeekendSharePng,
  type WeekendShareImageInput,
} from "./weekendShareImage";

/**
 * Render the weekend card to a file inside the extension support directory and
 * return its path. Shared by the clipboard and wallpaper actions so both write
 * to the same place instead of scattering PNGs.
 */
export async function writeWeekendShareImage(
  input: WeekendShareImageInput,
): Promise<string> {
  const directory = join(environment.supportPath, "shared-images");
  await mkdir(directory, { recursive: true });

  const filePath = join(directory, buildWeekendShareImageFilename(input));
  await writeFile(filePath, await renderWeekendSharePng(input));

  return filePath;
}
