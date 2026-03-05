export function ensureValidTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

export function dateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function localHourInTimezone(date: Date, timeZone: string): number {
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
  return Number.parseInt(hourFormatter.format(date), 10);
}

export function formatIsoTimeInTimezone(
  isoTime: string | undefined,
  timeZone: string,
): string {
  if (!isoTime) return "No data";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: ensureValidTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoTime));
}

export function dateFromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  if (!year || !month || !day) return new Date();

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function normalizeLocationId(
  location: Pick<
    { name: string; latitude: number; longitude: number },
    "name" | "latitude" | "longitude"
  >,
): string {
  return `${location.name.toLowerCase()}-${location.latitude.toFixed(4)}-${location.longitude.toFixed(4)}`;
}
