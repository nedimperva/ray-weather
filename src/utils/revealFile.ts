import * as hostApi from "@raycast/api";
import { open } from "@raycast/api";
import { dirname } from "path";

type RevealFn = (path: string) => Promise<void>;

// Raycast reveals a file with showInFinder. Vicinae, which serves the same
// module on Linux, exposes showInFileBrowser instead and has no showInFinder.
// Pick whichever the host provides, and fall back to opening the containing
// folder so the action never silently does nothing.
export async function revealFile(filePath: string): Promise<void> {
  const api = hostApi as unknown as {
    showInFinder?: RevealFn;
    showInFileBrowser?: RevealFn;
  };
  const reveal = api.showInFinder ?? api.showInFileBrowser;

  if (reveal) {
    await reveal(filePath);
    return;
  }

  await open(dirname(filePath));
}
