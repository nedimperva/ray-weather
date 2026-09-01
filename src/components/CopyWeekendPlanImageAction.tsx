import { Action, Clipboard, Icon, Toast, showToast } from "@raycast/api";

import { revealFile } from "../utils/revealFile";
import { writeWeekendShareImage } from "../utils/weekendImageFile";
import type { WeekendShareImageInput } from "../utils/weekendShareImage";

async function copyWeekendPlanImage(input: WeekendShareImageInput) {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Rendering weekend plan image",
  });

  try {
    const filePath = await writeWeekendShareImage(input);
    await Clipboard.copy({ file: filePath });

    toast.style = Toast.Style.Success;
    toast.title = "Weekend plan image copied";
    toast.message = "Paste it into a chat, note, or document.";
    toast.primaryAction = {
      title: "Show Image",
      onAction: () => {
        void revealFile(filePath);
      },
    };
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to copy weekend image";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}

export function CopyWeekendPlanImageAction(props: {
  input: WeekendShareImageInput;
}) {
  return (
    <Action
      title="Copy Weekend Plan Image"
      icon={Icon.Image}
      onAction={() => {
        void copyWeekendPlanImage(props.input);
      }}
    />
  );
}
