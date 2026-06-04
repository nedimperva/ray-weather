import { Action, ActionPanel, Icon } from "@raycast/api";
import type { DailyForecast } from "../types";
import { buildShouldIDecisions } from "../utils";

export function ShouldIActions(props: {
  day: DailyForecast;
  maxUvIndex?: number;
  aqi?: number;
  alertCount: number;
}) {
  const decisions = buildShouldIDecisions(
    props.day,
    props.maxUvIndex,
    props.aqi,
    props.alertCount,
  );

  return (
    <ActionPanel.Section title="Should I...">
      {decisions.map((decision) => (
        <Action.CopyToClipboard
          key={decision.id}
          title={`${decision.question} ${decision.answer}`}
          icon={Icon.QuestionMark}
          content={`${decision.question} ${decision.answer}. ${decision.reason}.`}
        />
      ))}
    </ActionPanel.Section>
  );
}
