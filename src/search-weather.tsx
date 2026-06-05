import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useState, useCallback } from "react";
import type { Location } from "./types";
import { MENU_BAR_LOCATION_KEY } from "./constants";
import {
  useFavoriteLocations,
  useSearchHistory,
  usePlaceSearch,
} from "./hooks";
import {
  displayLocationName,
  formatLocationSubtitle,
} from "./utils/formatting";
import { ForecastView } from "./components";
import { CommonActions } from "./components";

export default function Command() {
  const {
    favorites,
    addFavorite,
    removeFavorite,
    moveFavorite,
    moveFavoriteToTop,
    clearFavorites,
    isFavorite,
  } = useFavoriteLocations();
  const { history, addToHistory, clearHistory } = useSearchHistory();
  const [searchText, setSearchText] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const query = searchText.trim();
  const { data: places = [], isLoading, error } = usePlaceSearch(query);

  useEffect(() => {
    if (error) {
      void showFailureToast(error, { title: "Failed to find places" });
    }
  }, [error]);

  const shouldShowHint = query.length === 0;
  const needsMoreCharacters =
    hasInteracted && query.length > 0 && query.length < 2;

  const pinToMenuBar = useCallback((place: Location) => {
    void LocalStorage.setItem(MENU_BAR_LOCATION_KEY, JSON.stringify(place));
    void showToast({
      style: Toast.Style.Success,
      title: `${place.name} pinned to menu bar`,
    });
  }, []);

  const renderLocationItem = useCallback(
    (
      place: Location,
      _sectionTitle: string,
      extraActions?: React.ReactNode,
    ) => (
      <List.Item
        key={place.id}
        icon={{ source: Icon.Pin, tintColor: Color.Orange }}
        title={displayLocationName(place)}
        subtitle={formatLocationSubtitle(place)}
        accessories={[
          {
            text: `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`,
          },
        ]}
        actions={
          <ActionPanel>
            <Action.Push
              title="Show Forecast"
              icon={Icon.Cloud}
              target={
                <ForecastView
                  location={place}
                  addFavorite={addFavorite}
                  removeFavorite={removeFavorite}
                  isFavorite={isFavorite}
                  addToHistory={addToHistory}
                />
              }
            />
            <Action.CopyToClipboard
              title="Copy Coordinates"
              content={`${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
            />
            {isFavorite(place.id) ? (
              <Action
                title="Remove from Favorites"
                icon={Icon.StarDisabled}
                onAction={() => removeFavorite(place.id)}
              />
            ) : (
              <Action
                title="Add to Favorites"
                icon={Icon.Star}
                onAction={() => addFavorite(place)}
              />
            )}
            <Action
              title="Set as Menu Bar Location"
              icon={Icon.Pin}
              onAction={() => pinToMenuBar(place)}
            />
            {extraActions}
            <CommonActions />
          </ActionPanel>
        }
      />
    ),
    [addFavorite, removeFavorite, isFavorite, pinToMenuBar, addToHistory],
  );

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={(text) => {
        setHasInteracted(true);
        setSearchText(text);
      }}
      searchText={searchText}
      searchBarPlaceholder="Type a place (e.g. Oslo, Berlin, New York)"
    >
      {shouldShowHint || needsMoreCharacters ? (
        <List.Section title="Search">
          <List.Item
            icon={Icon.Map}
            title={shouldShowHint ? "Search by place name" : "Keep typing"}
            subtitle={
              shouldShowHint
                ? "Type at least 2 characters."
                : "Enter at least 2 characters to search places."
            }
            actions={
              <ActionPanel>
                <CommonActions />
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {!shouldShowHint &&
      !needsMoreCharacters &&
      hasInteracted &&
      places.length === 0 &&
      !isLoading ? (
        <List.Section title="Search">
          <List.Item
            icon={Icon.XMarkCircle}
            title="No matching places"
            subtitle="Try city + country, for example: Paris France"
            actions={
              <ActionPanel>
                <CommonActions />
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {!query && favorites.length > 0 ? (
        <List.Section title="Favorite Places">
          {favorites.map((place, index) =>
            renderLocationItem(
              place,
              "Favorites",
              <>
                <Action
                  title="Move Favorite up"
                  icon={Icon.ArrowUp}
                  shortcut={{ modifiers: ["cmd"], key: "arrowUp" }}
                  onAction={() => moveFavorite(place.id, "up")}
                />
                <Action
                  title="Move Favorite Down"
                  icon={Icon.ArrowDown}
                  shortcut={{ modifiers: ["cmd"], key: "arrowDown" }}
                  onAction={() => moveFavorite(place.id, "down")}
                />
                {index === 0 ? null : (
                  <Action
                    title="Make First Favorite"
                    icon={Icon.ArrowUpCircle}
                    onAction={() => moveFavoriteToTop(place.id)}
                  />
                )}
                <Action
                  title="Remove All Favorites"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={clearFavorites}
                />
              </>,
            ),
          )}
        </List.Section>
      ) : null}
      {!query && history.length > 0 ? (
        <List.Section title="Recent Searches">
          {history.map((place) =>
            renderLocationItem(
              place,
              "Recent Searches",
              <Action
                title="Clear History"
                icon={Icon.Trash}
                onAction={clearHistory}
              />,
            ),
          )}
        </List.Section>
      ) : null}
      {places.length > 0 ? (
        <List.Section title="Matching Places">
          {places.map((place) => renderLocationItem(place, "Matching Places"))}
        </List.Section>
      ) : null}
    </List>
  );
}
