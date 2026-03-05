import { Color } from "@raycast/api";

export function colorForTemperature(tempC: number): Color {
  if (tempC <= 0) return Color.Blue;
  if (tempC <= 10) return Color.Magenta;
  if (tempC <= 20) return Color.Green;
  if (tempC <= 28) return Color.Orange;
  return Color.Red;
}

export function colorForPrecipitation(mm: number): Color {
  if (mm === 0) return Color.SecondaryText;
  if (mm < 1) return Color.Blue;
  if (mm < 5) return Color.Orange;
  return Color.Red;
}

export function colorForWind(speedMs?: number): Color {
  if (speedMs === undefined) return Color.SecondaryText;
  if (speedMs < 5) return Color.Green;
  if (speedMs < 10) return Color.Orange;
  return Color.Red;
}

export function colorForUV(uvIndex: number): Color {
  if (uvIndex <= 2) return Color.Green;
  if (uvIndex <= 5) return Color.Yellow;
  if (uvIndex <= 7) return Color.Orange;
  if (uvIndex <= 10) return Color.Red;
  return Color.Purple;
}
