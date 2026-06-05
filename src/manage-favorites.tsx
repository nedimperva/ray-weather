import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  LocalStorage,
  Toast,
  showToast,
} from "@raycast/api";
import type { Location } from "./types";
import { MENU_BAR_LOCATION_KEY } from "./constants";
import { useFavoriteLocations } from "./hooks";
import {
  displayLocationName,
  formatLocationSubtitle,
  locationSummary,
} from "./utils";
import { CommonActions } from "./components";

type FavoriteFormValues = {
  nickname: string;
  group: string;
};

function EditFavoriteForm(props: {
  location: Location;
  updateFavoriteMetadata: (
    locationId: string,
    metadata: Pick<Location, "nickname" | "group">,
  ) => void;
}) {
  const { location, updateFavoriteMetadata } = props;

  return (
    <Form
      navigationTitle={`Edit ${displayLocationName(location)}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm<FavoriteFormValues>
            title="Save Favorite"
            icon={Icon.CheckCircle}
            onSubmit={(values) => {
              updateFavoriteMetadata(location.id, {
                nickname: values.nickname,
                group: values.group,
              });
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text={locationSummary(location)} />
      <Form.TextField
        id="nickname"
        title="Nickname"
        placeholder="Home, Work, Cabin..."
        defaultValue={location.nickname ?? ""}
      />
      <Form.TextField
        id="group"
        title="Group"
        placeholder="Home, Work, Travel, Family..."
        defaultValue={location.group ?? ""}
      />
    </Form>
  );
}

function groupKey(location: Location): string {
  return location.group?.trim() || "Ungrouped";
}

export default function Command() {
  const {
    favorites,
    removeFavorite,
    moveFavorite,
    moveFavoriteToTop,
    clearFavorites,
    updateFavoriteMetadata,
  } = useFavoriteLocations();

  const groupedFavorites = favorites.reduce<Record<string, Location[]>>(
    (groups, favorite) => {
      const key = groupKey(favorite);
      groups[key] = [...(groups[key] ?? []), favorite];
      return groups;
    },
    {},
  );
  const orderedGroups = Object.keys(groupedFavorites).sort((a, b) => {
    if (a === "Ungrouped") return 1;
    if (b === "Ungrouped") return -1;
    return a.localeCompare(b);
  });

  if (favorites.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No favorites yet"
          description="Add favorites from Search Weather."
        />
      </List>
    );
  }

  return (
    <List searchBarPlaceholder="Manage favorite locations">
      {orderedGroups.map((group) => (
        <List.Section key={group} title={group}>
          {(groupedFavorites[group] ?? []).map((location, index) => (
            <List.Item
              key={location.id}
              title={displayLocationName(location)}
              subtitle={formatLocationSubtitle(location)}
              icon={Icon.Star}
              accessories={[
                ...(location.nickname ? [{ text: location.name }] : []),
                {
                  text: `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`,
                },
              ]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Edit Favorite"
                    icon={Icon.Pencil}
                    target={
                      <EditFavoriteForm
                        location={location}
                        updateFavoriteMetadata={updateFavoriteMetadata}
                      />
                    }
                  />
                  <Action
                    title="Set as Menu Bar Location"
                    icon={Icon.Pin}
                    onAction={() => {
                      void LocalStorage.setItem(
                        MENU_BAR_LOCATION_KEY,
                        JSON.stringify(location),
                      );
                      void showToast({
                        style: Toast.Style.Success,
                        title: `${displayLocationName(location)} pinned`,
                      });
                    }}
                  />
                  <Action
                    title="Move Favorite up"
                    icon={Icon.ArrowUp}
                    onAction={() => moveFavorite(location.id, "up")}
                  />
                  <Action
                    title="Move Favorite Down"
                    icon={Icon.ArrowDown}
                    onAction={() => moveFavorite(location.id, "down")}
                  />
                  {index === 0 ? null : (
                    <Action
                      title="Make First Favorite"
                      icon={Icon.ArrowUpCircle}
                      onAction={() => moveFavoriteToTop(location.id)}
                    />
                  )}
                  <Action
                    title="Remove Favorite"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => removeFavorite(location.id)}
                  />
                  <Action
                    title="Remove All Favorites"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={clearFavorites}
                  />
                  <CommonActions />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
