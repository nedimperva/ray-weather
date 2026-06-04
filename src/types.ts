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
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  timezone: string;
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
      };
    };
    next_1_hours?: {
      summary?: {
        symbol_code?: string;
      };
      details?: {
        precipitation_amount?: number;
      };
    };
    next_6_hours?: {
      summary?: {
        symbol_code?: string;
      };
      details?: {
        precipitation_amount?: number;
      };
    };
    next_12_hours?: {
      summary?: {
        symbol_code?: string;
      };
      details?: {
        precipitation_amount?: number;
      };
    };
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

export type MetNoAlertsResponse = {
  productDefinition?: {
    alert?: MetNoAlert[];
  }[];
};

export type MetNoAlert = {
  area?: {
    areaDesc?: string;
  };
  info?: {
    event?: string;
    headline?: string;
    description?: string;
    severity?: string;
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
  uvIndex?: number;
};

export type SymbolCandidate = {
  symbol: string;
  hour: number;
};

export type DailyAccumulator = {
  minTempC: number;
  maxTempC: number;
  minFeelsLikeC: number;
  maxFeelsLikeC: number;
  precipitationMm: number;
  symbolCandidates: SymbolCandidate[];
  windSpeedTotal: number;
  windSpeedCount: number;
  humidityTotal: number;
  humidityCount: number;
  pressureTotal: number;
  pressureCount: number;
  fogCoverageTotal: number;
  fogCoverageCount: number;
  uvIndexTotal: number;
  uvIndexCount: number;
  hourly: HourlyForecast[];
  pressures: number[];
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
};
