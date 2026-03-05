/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Temperature Unit - Choose the temperature unit for display */
  "temperatureUnit": "celsius" | "fahrenheit",
  /** Wind Speed Unit - Choose the wind speed unit for display */
  "windSpeedUnit": "ms" | "kmh" | "mph" | "knots",
  /** Precipitation Unit - Choose the precipitation unit for display */
  "precipitationUnit": "mm" | "inches",
  /** Forecast Days - Number of forecast days to display */
  "forecastDays": "3" | "5" | "7" | "10"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-weather` command */
  export type SearchWeather = ExtensionPreferences & {}
  /** Preferences accessible in the `menu-bar-weather` command */
  export type MenuBarWeather = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-weather` command */
  export type SearchWeather = {}
  /** Arguments passed to the `menu-bar-weather` command */
  export type MenuBarWeather = {}
}

