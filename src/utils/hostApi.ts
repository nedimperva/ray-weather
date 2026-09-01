import { environment } from "@raycast/api";

// Vicinae serves its own module when an extension imports `@raycast/api`, but
// that compatibility layer deliberately exposes only the Raycast surface. APIs
// that have no Raycast counterpart -- desktop notifications, wallpapers, window
// management, file search -- live in `@vicinae/api` and can only be reached
// from there.
//
// Two rules follow from how Vicinae wires this up:
//
//   1. Never feature-detect on `@raycast/api`. Vicinae proxies unknown
//      properties to a stub that throws when called, so a missing symbol is
//      truthy rather than undefined and `a ?? b` silently picks the wrong one.
//   2. Never `import` from `@vicinae/api` at module scope. Raycast's bundler
//      would inline the whole package into the macOS/Windows build, where it
//      cannot work. Vicinae marks it external and its patched `require`
//      resolves it at runtime, so an indirect require is both correct there and
//      harmless everywhere else.
type VicinaeApi = typeof import("@vicinae/api");

let cachedApi: VicinaeApi | null | undefined;

/** True when the extension is running inside Vicinae rather than Raycast. */
export function isVicinae(): boolean {
  return Boolean(
    (environment as { vicinaeVersion?: { tag?: string } }).vicinaeVersion,
  );
}

/**
 * The Vicinae SDK, or `undefined` on Raycast and on any Vicinae build that no
 * longer resolves the module. Callers must treat it as optional.
 */
export function getVicinaeApi(): VicinaeApi | undefined {
  if (cachedApi !== undefined) return cachedApi ?? undefined;

  cachedApi = null;

  if (!isVicinae()) return undefined;

  try {
    const moduleId = "@vicinae/api";
    const load =
      typeof require === "function"
        ? (require as (id: string) => unknown)
        : undefined;
    if (load) cachedApi = load(moduleId) as VicinaeApi;
  } catch {
    // Running somewhere the module is not resolvable; stay on the Raycast path.
  }

  return cachedApi ?? undefined;
}

/**
 * Whether the host grants access to one of the Vicinae-only namespaces. The
 * launcher can refuse a capability at runtime (no wallpaper backend for the
 * running desktop, for instance), so this is a real check and not just a
 * version test.
 */
function canAccess(pick: (api: VicinaeApi) => unknown): boolean {
  const api = getVicinaeApi();
  if (!api) return false;

  try {
    const namespace = pick(api);
    if (!namespace) return false;
    return api.environment.canAccess(namespace as never);
  } catch {
    return false;
  }
}

/** Desktop notifications: Vicinae only, Raycast has no equivalent API. */
export type DesktopNotification = {
  title: string;
  body: string;
  urgency?: "Low" | "Normal" | "High";
  icon?: { source: string; tintColor?: string } | string;
};

export function canSendDesktopNotifications(): boolean {
  return typeof getVicinaeApi()?.sendDesktopNotification === "function";
}

export async function sendDesktopNotification(
  notification: DesktopNotification,
): Promise<boolean> {
  const api = getVicinaeApi();
  if (!api?.sendDesktopNotification) return false;

  try {
    await api.sendDesktopNotification(
      notification as Parameters<typeof api.sendDesktopNotification>[0],
    );
    return true;
  } catch {
    return false;
  }
}

/** Desktop wallpaper: Vicinae only. */
export function canSetWallpaper(): boolean {
  return canAccess((api) => api.Wallpaper);
}

export async function setWallpaper(
  filePath: string,
  fit: "Cover" | "Contain" | "Stretch" | "Center" | "Tile" = "Contain",
): Promise<void> {
  const api = getVicinaeApi();
  if (!api?.Wallpaper) throw new Error("Wallpapers are not supported here");
  await api.Wallpaper.set(filePath, { fit });
}
