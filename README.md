# YR.NO Weather (Raycast Extension for Windows)

Simple and fast weather lookup by place name, powered by:
- Forecast data: `yr.no` / `met.no` Locationforecast API
- Place search: Open-Meteo Geocoding API

## Features
- Type a place name in Raycast.
- Pick a matching location.
- See daily forecast for today + up to 10 days:
  - Condition
  - Min/Max temperature (single unit display)
  - Precipitation in mm
- Open a specific day for detailed hourly breakdown.
- Day details include feels-like temperature and sunrise/sunset time.
- Quick actions to copy forecast text or coordinates.
- Temperature unit defaults to `Celsius`, switchable to `Fahrenheit` from the `Ctrl+K` action panel.

## Run on Windows
1. Install dependencies:
   ```powershell
   npm install
   ```
2. Start extension development:
   ```powershell
   npm run dev
   ```
3. In Raycast for Windows, open the extension and run `Search Weather`.

## Important
- `met.no` requires a custom `User-Agent` with app identity and contact info.
- Update `APP_USER_AGENT` in `src/search-weather.tsx` before sharing this extension.

## Command
- `Search Weather`: Search by place name and open a clean daily forecast view.
