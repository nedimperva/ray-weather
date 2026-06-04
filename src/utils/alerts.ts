import type { WeatherAlert } from "../types";

export type WeatherAlertsPayload = {
  features?: Array<{
    properties?: {
      event?: string;
      headline?: string;
      description?: string;
      severity?: string;
      area?: string;
    };
  }>;
};

export function parseWeatherAlerts(
  alertsData: WeatherAlertsPayload | undefined,
): WeatherAlert[] {
  const result: WeatherAlert[] = [];
  const features = alertsData?.features ?? [];

  for (const feature of features) {
    const properties = feature.properties;
    if (!properties?.event) continue;

    result.push({
      area: properties.area ?? "",
      event: properties.event,
      headline: properties.headline ?? "",
      description: properties.description ?? "",
      severity:
        (properties.severity?.toLowerCase() as WeatherAlert["severity"]) ??
        "unknown",
    });
  }

  return result;
}

export function severityRank(severity: WeatherAlert["severity"]): number {
  switch (severity) {
    case "extreme":
      return 5;
    case "severe":
      return 4;
    case "moderate":
      return 3;
    case "minor":
      return 2;
    case "unknown":
    default:
      return 1;
  }
}
