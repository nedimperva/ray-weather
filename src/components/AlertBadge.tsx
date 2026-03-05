import { Color, Icon, List, ActionPanel } from "@raycast/api";
import type { WeatherAlert } from "../types";
import { CommonActions } from "./CommonActions";

const severityColors: Record<string, Color> = {
  extreme: Color.Red,
  severe: Color.Orange,
  moderate: Color.Yellow,
  minor: Color.Green,
};

export function AlertBadge(props: { alerts: WeatherAlert[] }) {
  if (props.alerts.length === 0) return null;

  return (
    <List.Section title="Weather Alerts">
      {props.alerts.map((alert, index) => (
        <List.Item
          key={index}
          title={alert.event}
          subtitle={alert.headline}
          icon={{
            source: Icon.Warning,
            tintColor: severityColors[alert.severity] ?? Color.Yellow,
          }}
          actions={
            <ActionPanel>
              <CommonActions />
            </ActionPanel>
          }
        />
      ))}
    </List.Section>
  );
}
