export type TemperatureUnit = "celsius" | "fahrenheit";

export type GeocodeApiResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

export type GeocodeApiResponse = {
  results?: GeocodeApiResult[];
};

export type Location = {
  id: string;
  name: string;
  nickname?: string;
  group?: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  timezone: string;
};

type ForecastWindow = {
  summary?: {
    symbol_code?: string;
  };
  details?: {
    precipitation_amount?: number;
    probability_of_precipitation?: number;
  };
};

export type ForecastEntry = {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature: number;
        wind_speed?: number;
        relative_humidity?: number;
        air_pressure_at_sea_level?: number;
        fog_area_fraction?: number;
        fog_liquid_water_content?: number;
        wind_from_direction?: number;
        wind_speed_of_gust?: number;
        cloud_area_fraction?: number;
        dew_point_temperature?: number;
        ultraviolet_index_clear_sky?: number;
      };
    };
    next_1_hours?: ForecastWindow;
    next_6_hours?: ForecastWindow;
    next_12_hours?: ForecastWindow;
  };
};

export type MetNoForecastResponse = {
  properties?: {
    meta?: {
      updated_at?: string;
    };
    timeseries?: ForecastEntry[];
  };
};

export type MetNoSunResponse = {
  properties?: {
    sunrise?: {
      time?: string;
    };
    sunset?: {
      time?: string;
    };
  };
};

export type DailyForecast = {
  dateKey: string;
  label: string;
  shortDate: string;
  dayAndDate: string;
  minTempC: number;
  maxTempC: number;
  minTempTimeLabel?: string;
  maxTempTimeLabel?: string;
  minFeelsLikeC: number;
  maxFeelsLikeC: number;
  minTempF: number;
  maxTempF: number;
  precipitationMm: number;
  symbolCode: string;
  condition: string;
  avgWindSpeedMs?: number;
  avgHumidityPct?: number;
  avgPressureHpa?: number;
  pressureTrend?: "rising" | "falling" | "stable";
  avgFogCoveragePct?: number;
  maxUvIndex?: number;
  maxPrecipitationProbabilityPct?: number;
  rainWindowSummary?: string;
  decisionTags?: string[];
  comfortScore?: number;
  personalitySummary?: string;
  trendSummary?: string;
  hourly: HourlyForecast[];
};

export type HourlyForecast = {
  id: string;
  localTimeLabel: string;
  hour: number;
  temperatureC: number;
  precipitationMm: number;
  precipitationProbabilityPct?: number;
  precipitationWindowHours: 1 | 6 | 12;
  windSpeedMs?: number;
  windDirectionDeg?: number;
  windGustMs?: number;
  humidityPct?: number;
  pressureHpa?: number;
  feelsLikeC: number;
  symbolCode: string;
  condition: string;
  fogCoveragePct?: number;
  cloudCoveragePct?: number;
  dewPointC?: number;
  uvIndex?: number;
};

export type AirQualityData = {
  aqi?: number;
  pm25?: number;
  pm10?: number;
  o3?: number;
  no2?: number;
  co?: number;
};

export type WeatherAlert = {
  area: string;
  event: string;
  headline: string;
  description: string;
  severity: "extreme" | "severe" | "moderate" | "minor" | "unknown";
  onsetISO?: string;
  expiresISO?: string;
};
