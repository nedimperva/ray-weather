import {
  Action,
  ActionPanel,
  Icon,
  openExtensionPreferences,
} from "@raycast/api";

export function CommonActions() {
  return (
    <>
      <ActionPanel.Section title="Settings">
        <Action
          title="Open Extension Preferences"
          icon={Icon.Gear}
          onAction={openExtensionPreferences}
        />
      </ActionPanel.Section>
      <ActionPanel.Section title="About">
        <Action.OpenInBrowser
          title="Met.no Forecast Docs"
          url="https://api.met.no/weatherapi/locationforecast/2.0/documentation"
        />
        <Action.OpenInBrowser
          title="Met.no Alerts Docs"
          url="https://api.met.no/weatherapi/metalerts/2.0/documentation"
        />
        <Action.OpenInBrowser
          title="Open-Meteo Geocoding Docs"
          url="https://open-meteo.com/en/docs/geocoding-api"
        />
        <Action.OpenInBrowser
          title="Open-Meteo Air Quality Docs"
          url="https://open-meteo.com/en/docs/air-quality-api"
        />
      </ActionPanel.Section>
    </>
  );
}
