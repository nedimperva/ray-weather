import { Action, Icon, Toast, showToast } from "@raycast/api";

import { canSetWallpaper, setWallpaper } from "../utils/hostApi";
import { revealFile } from "../utils/revealFile";
import { writeWeekendShareImage } from "../utils/weekendImageFile";
import type { WeekendShareImageInput } from "../utils/weekendShareImage";

async function applyWeekendWallpaper(input: WeekendShareImageInput) {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Setting weekend wallpaper",
  });

  try {
    const filePath = await writeWeekendShareImage(input);
    // The card is a 1200x760 landscape sheet, so contain it rather than let a
    // Cover fit crop the forecast off the edges.
    await setWallpaper(filePath, "Contain");

    toast.style = Toast.Style.Success;
    toast.title = "Weekend plan set as wallpaper";
    toast.primaryAction = {
      title: "Show Image",
      onAction: () => {
        void revealFile(filePath);
      },
    };
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to set wallpaper";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}

/**
 * Vicinae-only: renders nothing on Raycast, and nothing on a Vicinae install
 * whose desktop has no wallpaper backend available.
 */
export function SetWeekendWallpaperAction(props: {
  input: WeekendShareImageInput;
}) {
  if (!canSetWallpaper()) return null;

  return (
    <Action
      title="Set Weekend Plan as Wallpaper"
      icon={Icon.Desktop}
      onAction={() => {
        void applyWeekendWallpaper(props.input);
      }}
    />
  );
}
