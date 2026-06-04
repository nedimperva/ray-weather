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
  "forecastDays": "3" | "5" | "7" | "10",
  /** Menu Bar Display - Choose what appears in the menu bar title */
  "menuBarDisplayMode": "temp-only" | "temp-condition" | "temp-rain" | "feels-like" | "location-temp" | "compact",
  /** Morning Commute Start - Start hour for morning commute forecast */
  "morningCommuteStart": "5" | "6" | "7" | "8" | "9" | "10",
  /** Morning Commute End - End hour for morning commute forecast */
  "morningCommuteEnd": "6" | "7" | "8" | "9" | "10" | "11",
  /** Evening Commute Start - Start hour for evening commute forecast */
  "eveningCommuteStart": "14" | "15" | "16" | "17" | "18" | "19",
  /** Evening Commute End - End hour for evening commute forecast */
  "eveningCommuteEnd": "15" | "16" | "17" | "18" | "19" | "20"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-weather` command */
  export type SearchWeather = ExtensionPreferences & {}
  /** Preferences accessible in the `today-weather-brief` command */
  export type TodayWeatherBrief = ExtensionPreferences & {}
  /** Preferences accessible in the `compare-weather` command */
  export type CompareWeather = ExtensionPreferences & {}
  /** Preferences accessible in the `weekend-planner` command */
  export type WeekendPlanner = ExtensionPreferences & {}
  /** Preferences accessible in the `commute-forecast` command */
  export type CommuteForecast = ExtensionPreferences & {}
  /** Preferences accessible in the `severe-weather-alerts` command */
  export type SevereWeatherAlerts = ExtensionPreferences & {}
  /** Preferences accessible in the `menu-bar-weather` command */
  export type MenuBarWeather = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-weather` command */
  export type SearchWeather = {}
  /** Arguments passed to the `today-weather-brief` command */
  export type TodayWeatherBrief = {}
  /** Arguments passed to the `compare-weather` command */
  export type CompareWeather = {}
  /** Arguments passed to the `weekend-planner` command */
  export type WeekendPlanner = {}
  /** Arguments passed to the `commute-forecast` command */
  export type CommuteForecast = {}
  /** Arguments passed to the `severe-weather-alerts` command */
  export type SevereWeatherAlerts = {}
  /** Arguments passed to the `menu-bar-weather` command */
  export type MenuBarWeather = {}
}

