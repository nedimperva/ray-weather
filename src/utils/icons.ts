import { Icon } from "@raycast/api";

export function iconForSymbol(symbolCode: string): Icon {
  if (symbolCode.includes("thunder")) return Icon.Bolt;
  if (symbolCode.includes("snow")) return Icon.Snowflake;
  if (
    symbolCode.includes("rain") ||
    symbolCode.includes("sleet") ||
    symbolCode.includes("shower")
  )
    return Icon.CloudRain;
  if (symbolCode.includes("drizzle")) return Icon.CloudRain;
  if (symbolCode.includes("fog") || symbolCode.includes("mist"))
    return Icon.Cloud;
  if (symbolCode.includes("partlycloudy")) return Icon.CloudSun;
  if (symbolCode.includes("fair")) return Icon.Sun;
  if (symbolCode.includes("clearsky")) return Icon.Sun;
  if (symbolCode.includes("overcast")) return Icon.Cloud;
  return Icon.Cloud;
}

export function iconForAqi(aqi: number): Icon {
  if (aqi >= 4) return Icon.Warning;
  if (aqi >= 2) return Icon.ExclamationMark;
  return Icon.CheckCircle;
}
