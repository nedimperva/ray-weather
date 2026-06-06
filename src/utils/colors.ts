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

export function colorForAqi(aqi: number): Color {
  if (aqi <= 50) return Color.Green;
  if (aqi <= 100) return Color.Yellow;
  if (aqi <= 150) return Color.Orange;
  return Color.Red;
}

export function colorForProbability(probabilityPct: number): Color {
  if (probabilityPct < 20) return Color.SecondaryText;
  if (probabilityPct < 50) return Color.Blue;
  if (probabilityPct < 80) return Color.Orange;
  return Color.Red;
}

export function comfortColor(score: number | undefined): Color {
  if (score === undefined) return Color.SecondaryText;
  if (score >= 75) return Color.Green;
  if (score >= 50) return Color.Yellow;
  return Color.Red;
}
