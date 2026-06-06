import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect } from "react";
import type { DailyForecast, Location, WeatherAlert } from "./types";
import { useFavoriteLocations, useWeatherData } from "./hooks";
import { getPrefs } from "./preferences";
import { CommonActions } from "./components";
import { iconForSymbol } from "./utils/icons";
import {
  colorForAqi,
  colorForPrecipitation,
  colorForTemperature,
  colorForUV,
  colorForWind,
  comfortColor,
} from "./utils/colors";
import {
  buildComfortScore,
  buildDecisionTags,
  buildPersonalitySummary,
  formatIsoTimeInTimezone,
  getCurrentHour,
  locationSummary,
} from "./utils";
import { formatTemperature, formatTemperatureRange } from "./utils/temperature";
import { formatPrecipitation, formatWindSpeed } from "./utils/units";

type ComparisonData = {
  location: Location;
  today?: DailyForecast;
  currentHour?: DailyForecast["hourly"][number];
  maxUvIndex?: number;
  currentAqi?: number;
  alerts: WeatherAlert[];
  alertCount: number;
  comfortScore?: number;
  isLoading: boolean;
  updatedLabel: string;
  error?: Error;
};

function useComparisonData(location: Location): ComparisonData {
  const {
    today,
    alerts,
    alertCountForDate,
    aqiForDate,
    error,
    isLoading,
    forecastUpdatedAt,
  } = useWeatherData(location);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, {
        title: `Failed to load ${location.name}`,
      });
    }
  }, [error, location.name]);

  const maxUvIndex = today?.maxUvIndex;
  const currentAqi = today ? aqiForDate(today.dateKey) : undefined;
  const alertCount = today ? alertCountForDate(today.dateKey) : alerts.length;
  const currentHour = today ? getCurrentHour(today) : undefined;
  const comfortScore = today
    ? buildComfortScore(today, maxUvIndex, currentAqi, alertCount)
    : undefined;
  const updatedLabel = formatIsoTimeInTimezone(
    forecastUpdatedAt,
    location.timezone,
  );

  return {
    location,
    today,
    currentHour,
    maxUvIndex,
    currentAqi,
    alerts,
    alertCount,
    comfortScore,
    updatedLabel,
    error,
    isLoading,
  };
}

function betterPick(first: ComparisonData, second: ComparisonData) {
  const firstScore = first.comfortScore ?? -1;
  const secondScore = second.comfortScore ?? -1;
  if (firstScore === secondScore) return undefined;
  return firstScore > secondScore ? first : second;
}

function reasonForPick(winner: ComparisonData, other: ComparisonData): string {
  const reasons: string[] = [];
  if (winner.comfortScore !== undefined && other.comfortScore !== undefined) {
    reasons.push(
      `${winner.comfortScore - other.comfortScore} comfort points higher`,
    );
  }
  if (
    (winner.today?.precipitationMm ?? 0) < (other.today?.precipitationMm ?? 0)
  ) {
    reasons.push("less rain");
  }
  if (
    (winner.today?.avgWindSpeedMs ?? 0) < (other.today?.avgWindSpeedMs ?? 0)
  ) {
    reasons.push("lighter wind");
  }
  if (winner.alertCount < other.alertCount) {
    reasons.push("fewer alerts");
  }
  return reasons.length > 0 ? reasons.join(", ") : "better overall conditions";
}

function ComparisonRow(props: { data: ComparisonData }) {
  const { data } = props;
  const prefs = getPrefs();
  const tags = data.today
    ? buildDecisionTags(data.today, data.maxUvIndex, data.alertCount)
    : [];
  const subtitle =
    data.today && data.currentHour
      ? `${buildPersonalitySummary(data.today, data.maxUvIndex)} - ${formatTemperature(
          data.currentHour.temperatureC,
          prefs.temperatureUnit,
        )} now - updated ${data.updatedLabel}`
      : "No forecast data";

  return (
    <List.Item
      title={locationSummary(data.location)}
      subtitle={subtitle}
      icon={{
        source: data.today ? iconForSymbol(data.today.symbolCode) : Icon.Cloud,
        tintColor: data.today
          ? colorForTemperature(data.today.maxTempC)
          : Color.SecondaryText,
      }}
      accessories={[
        ...(data.comfortScore !== undefined
          ? [
              {
                tag: {
                  value: `Comfort ${data.comfortScore}`,
                  color: comfortColor(data.comfortScore),
                },
              },
            ]
          : []),
        ...tags.slice(0, 2).map((tag) => ({ tag })),
      ]}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Location Summary"
            content={`${locationSummary(data.location)}: ${subtitle}`}
          />
          <CommonActions />
        </ActionPanel>
      }
    />
  );
}

function CompareWeatherView(props: { first: Location; second: Location }) {
  const { first, second } = props;
  const prefs = getPrefs();
  const firstData = useComparisonData(first);
  const secondData = useComparisonData(second);
  const winner = betterPick(firstData, secondData);
  const loser =
    winner?.location.id === firstData.location.id ? secondData : firstData;
  const isLoading = firstData.isLoading || secondData.isLoading;
  const copyComparison = winner
    ? `${locationSummary(winner.location)} looks better than ${locationSummary(
        loser.location,
      )}: ${reasonForPick(winner, loser)}.`
    : `${locationSummary(first)} and ${locationSummary(second)} look similar today.`;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`${first.name} vs ${second.name}`}
    >
      <List.Section title="Recommendation">
        <List.Item
          title={
            winner
              ? `${winner.location.name} looks better`
              : "Locations look similar"
          }
          subtitle={
            winner
              ? reasonForPick(winner, loser)
              : "Comfort scores are currently tied."
          }
          icon={winner ? Icon.CheckCircle : Icon.MinusCircle}
          accessories={[
            ...(winner?.comfortScore !== undefined
              ? [
                  {
                    tag: {
                      value: `Comfort ${winner.comfortScore}`,
                      color: comfortColor(winner.comfortScore),
                    },
                  },
                ]
              : []),
          ]}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy Comparison"
                content={copyComparison}
              />
              <CommonActions />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Locations">
        <ComparisonRow data={firstData} />
        <ComparisonRow data={secondData} />
      </List.Section>
      <List.Section title="Metrics">
        {[firstData, secondData].map((data) => (
          <List.Item
            key={data.location.id}
            title={data.location.name}
            subtitle={
              data.today?.rainWindowSummary ?? "No meaningful rain window"
            }
            icon={Icon.BarChart}
            accessories={[
              ...(data.today
                ? [
                    {
                      tag: {
                        value: formatTemperatureRange(
                          data.today.minTempC,
                          data.today.maxTempC,
                          prefs.temperatureUnit,
                        ),
                        color: colorForTemperature(data.today.maxTempC),
                      },
                    },
                    {
                      tag: {
                        value: formatPrecipitation(
                          data.today.precipitationMm,
                          prefs.precipitationUnit,
                        ),
                        color: colorForPrecipitation(
                          data.today.precipitationMm,
                        ),
                      },
                    },
                    {
                      tag: {
                        value: formatWindSpeed(
                          data.today.avgWindSpeedMs,
                          prefs.windSpeedUnit,
                        ),
                        color: colorForWind(data.today.avgWindSpeedMs),
                      },
                    },
                  ]
                : []),
              ...(data.currentAqi !== undefined
                ? [
                    {
                      tag: {
                        value: `AQI ${data.currentAqi}`,
                        color: colorForAqi(data.currentAqi),
                      },
                    },
                  ]
                : []),
              ...(data.maxUvIndex !== undefined && data.maxUvIndex >= 0.5
                ? [
                    {
                      tag: {
                        value: `UV ${data.maxUvIndex.toFixed(0)}`,
                        color: colorForUV(data.maxUvIndex),
                      },
                    },
                  ]
                : []),
              ...(data.alertCount > 0
                ? [
                    {
                      tag: {
                        value:
                          data.alertCount === 1
                            ? "1 alert"
                            : `${data.alertCount} alerts`,
                        color: Color.Red,
                      },
                    },
                  ]
                : []),
            ]}
          />
        ))}
      </List.Section>
    </List>
  );
}

function SecondLocationPicker(props: {
  first: Location;
  favorites: Location[];
}) {
  const options = props.favorites.filter(
    (place) => place.id !== props.first.id,
  );

  return (
    <List searchBarPlaceholder="Choose second location">
      <List.Section title={`Compare ${props.first.name} With`}>
        {options.map((place) => (
          <List.Item
            key={place.id}
            title={place.name}
            subtitle={locationSummary(place)}
            icon={Icon.Pin}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Compare Weather"
                  icon={Icon.BarChart}
                  target={
                    <CompareWeatherView first={props.first} second={place} />
                  }
                />
                <CommonActions />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

export default function Command() {
  const { favorites } = useFavoriteLocations();

  if (favorites.length < 2) {
    return (
      <List>
        <List.EmptyView
          title="Add at least two favorites"
          description="Compare Weather uses your favorite locations."
        />
      </List>
    );
  }

  return (
    <List searchBarPlaceholder="Choose first location">
      <List.Section title="First Location">
        {favorites.map((place) => (
          <List.Item
            key={place.id}
            title={place.name}
            subtitle={locationSummary(place)}
            icon={Icon.Pin}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Choose Second Location"
                  icon={Icon.ArrowRight}
                  target={
                    <SecondLocationPicker first={place} favorites={favorites} />
                  }
                />
                <CommonActions />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
