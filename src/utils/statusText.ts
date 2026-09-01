import type {
  MenuBarDisplayMode,
  PrecipitationUnit,
  TemperatureUnit,
} from "../preferences";
import { formatTemperature } from "./temperature";
import { formatPrecipitation } from "./units";

export type StatusUnits = {
  temperatureUnit: TemperatureUnit;
  precipitationUnit: PrecipitationUnit;
};

export type StatusConditions = {
  locationName: string;
  tempC: number;
  feelsLikeC: number;
  condition: string;
  precipMm: number;
};

/**
 * The one-line summary shown in the macOS/Windows menu bar and written to the
 * Linux status file, so both surfaces honour the same display preference.
 * `undefined` means "icon only".
 */
export function buildStatusText(
  conditions: StatusConditions,
  mode: MenuBarDisplayMode,
  units: StatusUnits,
): string | undefined {
  const temperature = formatTemperature(
    conditions.tempC,
    units.temperatureUnit,
  );

  switch (mode) {
    case "temp-only":
      return temperature;
    case "temp-rain":
      return `${temperature} ${formatPrecipitation(
        conditions.precipMm,
        units.precipitationUnit,
      )}`;
    case "feels-like":
      return `Feels ${formatTemperature(
        conditions.feelsLikeC,
        units.temperatureUnit,
      )}`;
    case "location-temp":
      return `${conditions.locationName} ${temperature}`;
    case "compact":
      return undefined;
    case "temp-condition":
    default:
      return `${temperature} ${conditions.condition}`;
  }
}
