import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { Writable } from "stream";
import * as PImage from "pureimage";
import type { Bitmap, Context } from "pureimage";

import type { Preferences } from "../preferences";
import type { DailyForecast, Location, WeatherAlert } from "../types";
import { locationSummary } from "./formatting";
import { formatTemperatureRange } from "./temperature";
import { formatPrecipitation, formatWindSpeed } from "./units";
import { buildPersonalitySummary } from "./weatherInsights";
import { reasonForPick } from "./weekendPlanner";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 760;
const CANVAS_FONT_FAMILY = "WeekendShare";
let canvasFontReady = false;

export type WeekendShareImageDay = {
  day: DailyForecast;
  maxUvIndex?: number;
  aqi?: number;
  alertCount: number;
  comfortScore: number;
};

export type WeekendShareImageInput = {
  location: Location;
  days: WeekendShareImageDay[];
  bestDay?: WeekendShareImageDay;
  otherDay?: WeekendShareImageDay;
  updatedLabel: string;
  alerts: WeatherAlert[];
  preferences: Pick<
    Preferences,
    "temperatureUnit" | "windSpeedUnit" | "precipitationUnit"
  >;
  isFallbackWeekend: boolean;
};

export type WeekendShareImageModelDay = {
  label: string;
  condition: string;
  summary: string;
  temp: string;
  rain: string;
  wind: string;
  uv: string;
  aqi: string;
  alerts: string;
  comfortScore: number;
  isBest: boolean;
  raw: DailyForecast;
};

export type WeekendShareImageModel = {
  location: string;
  eyebrow: string;
  updatedLabel: string;
  recommendationTitle: string;
  recommendationReason: string;
  alertSummary: string;
  days: WeekendShareImageModelDay[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${singular}s`;
}

function alertSummary(alerts: WeatherAlert[]): string {
  if (alerts.length === 0) return "No weather alerts";

  const names = [
    ...new Set(alerts.map((alert) => alert.event).filter(Boolean)),
  ];
  const visible = names.slice(0, 2).join(", ");
  const remaining = names.length - 2;
  return remaining > 0
    ? `Alerts: ${visible} +${remaining} more`
    : `Alerts: ${visible}`;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#15803d";
  if (score >= 50) return "#b7791f";
  return "#c2410c";
}

function scoreBackground(score: number): string {
  if (score >= 75) return "#dcfce7";
  if (score >= 50) return "#fef3c7";
  return "#ffedd5";
}

function metricColor(
  day: DailyForecast,
  metric: "rain" | "wind" | "uv",
): string {
  if (metric === "rain") {
    if (day.precipitationMm === 0) return "#64748b";
    if (day.precipitationMm < 2) return "#2563eb";
    if (day.precipitationMm < 8) return "#b7791f";
    return "#c2410c";
  }
  if (metric === "wind") {
    const wind = day.avgWindSpeedMs;
    if (wind === undefined) return "#64748b";
    if (wind < 5) return "#15803d";
    if (wind < 10) return "#b7791f";
    return "#c2410c";
  }

  const uv = day.maxUvIndex ?? 0;
  if (uv <= 2) return "#15803d";
  if (uv <= 5) return "#b7791f";
  if (uv <= 7) return "#c2410c";
  return "#9f1239";
}

function splitLines(
  text: string,
  maxChars: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines[lines.length - 1];
    if (!current) {
      lines.push(word);
    } else if (`${current} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current}...`;
      break;
    }
  }

  if (lines.length > maxLines) return lines.slice(0, maxLines);
  const last = lines[lines.length - 1];
  if (last && last.length > maxChars) {
    lines[lines.length - 1] = `${last.slice(0, Math.max(0, maxChars - 3))}...`;
  }

  return lines;
}

function textBlock(options: {
  text: string;
  x: number;
  y: number;
  maxChars: number;
  maxLines: number;
  lineHeight: number;
  size: number;
  weight?: number;
  fill: string;
}): string {
  const lines = splitLines(options.text, options.maxChars, options.maxLines);
  return [
    `<text x="${options.x}" y="${options.y}" font-size="${options.size}" font-weight="${options.weight ?? 500}" fill="${options.fill}">`,
    ...lines.map(
      (line, index) =>
        `<tspan x="${options.x}" dy="${index === 0 ? 0 : options.lineHeight}">${escapeXml(line)}</tspan>`,
    ),
    "</text>",
  ].join("");
}

function metricBlock(options: {
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
  valueColor?: string;
}): string {
  return `
    <rect x="${options.x}" y="${options.y}" width="${options.width}" height="58" rx="16" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="${options.x + 18}" y="${options.y + 22}" font-size="15" font-weight="700" fill="#64748b">${escapeXml(options.label)}</text>
    <text x="${options.x + 18}" y="${options.y + 45}" font-size="19" font-weight="800" fill="${options.valueColor ?? "#102a43"}">${escapeXml(options.value)}</text>
  `;
}

function dayPanel(
  modelDay: WeekendShareImageModelDay,
  x: number,
  y: number,
  width: number,
): string {
  const accent = scoreColor(modelDay.comfortScore);
  const metricWidth = (width - 80 - 16) / 2;
  const left = x + 32;
  const right = left + metricWidth + 16;

  return `
    <rect x="${x}" y="${y}" width="${width}" height="360" rx="28" fill="#ffffff" stroke="#dbe6df"/>
    <rect x="${x}" y="${y}" width="${width}" height="9" rx="4.5" fill="${accent}"/>
    <text x="${left}" y="${y + 54}" font-size="30" font-weight="850" fill="#102a43">${escapeXml(modelDay.label)}</text>
    <text x="${left}" y="${y + 84}" font-size="18" font-weight="650" fill="#475569">${escapeXml(modelDay.condition)}</text>
    ${
      modelDay.isBest
        ? `<rect x="${x + width - 138}" y="${y + 30}" width="106" height="34" rx="17" fill="${scoreBackground(modelDay.comfortScore)}"/>
           <text x="${x + width - 85}" y="${y + 53}" text-anchor="middle" font-size="16" font-weight="800" fill="${accent}">Best day</text>`
        : ""
    }
    <circle cx="${x + width - 72}" cy="${y + 104}" r="44" fill="${scoreBackground(modelDay.comfortScore)}" stroke="${accent}" stroke-width="3"/>
    <text x="${x + width - 72}" y="${y + 104}" text-anchor="middle" dominant-baseline="central" font-size="30" font-weight="900" fill="${accent}">${modelDay.comfortScore}</text>
    <text x="${x + width - 72}" y="${y + 139}" text-anchor="middle" font-size="13" font-weight="800" fill="#475569">Comfort</text>
    ${textBlock({
      text: modelDay.summary,
      x: left,
      y: y + 123,
      maxChars: width > 700 ? 76 : 42,
      maxLines: 2,
      lineHeight: 25,
      size: 20,
      weight: 650,
      fill: "#102a43",
    })}
    ${metricBlock({
      x: left,
      y: y + 186,
      width: metricWidth,
      label: "Temp",
      value: modelDay.temp,
      valueColor: "#be4b0b",
    })}
    ${metricBlock({
      x: right,
      y: y + 186,
      width: metricWidth,
      label: "Rain",
      value: modelDay.rain,
      valueColor: metricColor(modelDay.raw, "rain"),
    })}
    ${metricBlock({
      x: left,
      y: y + 258,
      width: metricWidth,
      label: "Wind",
      value: modelDay.wind,
      valueColor: metricColor(modelDay.raw, "wind"),
    })}
    ${metricBlock({
      x: right,
      y: y + 258,
      width: metricWidth,
      label: "UV / AQI",
      value: `${modelDay.uv} / ${modelDay.aqi}`,
      valueColor: metricColor(modelDay.raw, "uv"),
    })}
    <text x="${left}" y="${y + 338}" font-size="16" font-weight="700" fill="#64748b">Alerts: ${escapeXml(modelDay.alerts)}</text>
  `;
}

export function buildWeekendShareImageModel(
  input: WeekendShareImageInput,
): WeekendShareImageModel {
  const bestDay = input.bestDay ?? input.days[0];
  const otherDay = input.otherDay ?? input.days.find((day) => day !== bestDay);
  const recommendationTitle = bestDay
    ? `${bestDay.day.label} looks best`
    : "Weekend forecast";
  const recommendationReason =
    bestDay && otherDay
      ? reasonForPick(
          bestDay.day,
          otherDay.day,
          bestDay.comfortScore,
          otherDay.comfortScore,
        )
      : bestDay
        ? buildPersonalitySummary(bestDay.day, bestDay.maxUvIndex)
        : "No weekend forecast data available";

  return {
    location: locationSummary(input.location),
    eyebrow: input.isFallbackWeekend
      ? "Next available days"
      : "Weekend planner",
    updatedLabel: `Updated ${input.updatedLabel}`,
    recommendationTitle,
    recommendationReason,
    alertSummary: alertSummary(input.alerts),
    days: input.days.slice(0, 2).map((day) => ({
      label: day.day.dayAndDate,
      condition: day.day.condition,
      summary: buildPersonalitySummary(day.day, day.maxUvIndex),
      temp: formatTemperatureRange(
        day.day.minTempC,
        day.day.maxTempC,
        input.preferences.temperatureUnit,
      ),
      rain: formatPrecipitation(
        day.day.precipitationMm,
        input.preferences.precipitationUnit,
      ),
      wind: formatWindSpeed(
        day.day.avgWindSpeedMs,
        input.preferences.windSpeedUnit,
      ),
      uv: day.maxUvIndex !== undefined ? day.maxUvIndex.toFixed(0) : "No data",
      aqi: day.aqi !== undefined ? day.aqi.toFixed(0) : "No data",
      alerts: day.alertCount > 0 ? pluralize(day.alertCount, "alert") : "None",
      comfortScore: day.comfortScore,
      isBest: day === bestDay,
      raw: day.day,
    })),
  };
}

export function buildWeekendShareSvg(input: WeekendShareImageInput): string {
  const model = buildWeekendShareImageModel(input);
  const days = model.days.length > 0 ? model.days : [];
  const panelWidth = days.length === 1 ? 1072 : 520;
  const panels = days
    .map((day, index) =>
      dayPanel(day, days.length === 1 ? 64 : 64 + index * 552, 322, panelWidth),
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg" font-family="Inter, 'Segoe UI', Arial, sans-serif">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7fbf5"/>
      <stop offset="58%" stop-color="#eef7fb"/>
      <stop offset="100%" stop-color="#fff8ed"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#background)"/>
  <rect x="40" y="34" width="1120" height="692" rx="34" fill="#ffffff" fill-opacity="0.68" filter="url(#softShadow)"/>
  <text x="64" y="78" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="22" font-weight="850" fill="#0f766e">${escapeXml(model.eyebrow)}</text>
  ${textBlock({
    text: model.location,
    x: 64,
    y: 126,
    maxChars: 40,
    maxLines: 1,
    lineHeight: 0,
    size: 42,
    weight: 900,
    fill: "#102a43",
  })}
  <text x="64" y="163" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="19" font-weight="650" fill="#64748b">${escapeXml(model.updatedLabel)} - met.no forecast</text>
  <rect x="830" y="64" width="306" height="42" rx="21" fill="#f8fafc" stroke="#dbe6df"/>
  <text x="983" y="91" text-anchor="middle" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="16" font-weight="800" fill="#475569">${escapeXml(model.alertSummary)}</text>
  <rect x="64" y="196" width="1072" height="98" rx="28" fill="#14342b"/>
  <rect x="64" y="196" width="12" height="98" rx="6" fill="${scoreColor(input.bestDay?.comfortScore ?? 60)}"/>
  <text x="96" y="231" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="17" font-weight="850" fill="#a7f3d0">Recommendation</text>
  <text x="96" y="267" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff">${escapeXml(model.recommendationTitle)}</text>
  ${textBlock({
    text: model.recommendationReason,
    x: 520,
    y: 251,
    maxChars: 56,
    maxLines: 2,
    lineHeight: 24,
    size: 19,
    weight: 650,
    fill: "#d1fae5",
  })}
  ${panels}
  ${
    days.length === 0
      ? `<text x="600" y="500" text-anchor="middle" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="26" font-weight="800" fill="#475569">No weekend forecast data available</text>`
      : ""
  }
  <text x="64" y="712" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="16" font-weight="650" fill="#64748b">Source: met.no Locationforecast and MetAlerts. Air quality: Open-Meteo.</text>
  <text x="1136" y="712" text-anchor="end" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="16" font-weight="800" fill="#0f766e">Forecast Pilot</text>
</svg>`;
}

// Families to ask fontconfig for, in order of preference. The resolved file
// must be TrueType because that is all pureimage can parse.
const FONTCONFIG_FAMILIES = [
  "DejaVu Sans",
  "Noto Sans",
  "Liberation Sans",
  "Arial",
  "sans-serif",
];

// Linux font layouts differ per distribution, so a hardcoded list can never
// cover them all. Ask fontconfig, which every desktop Linux ships.
function findFontsViaFontconfig(): string[] {
  if (process.platform === "win32" || process.platform === "darwin") return [];

  const found: string[] = [];

  for (const family of FONTCONFIG_FAMILIES) {
    try {
      const file = execFileSync("fc-match", ["-f", "%{file}", family], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (file.toLowerCase().endsWith(".ttf") && existsSync(file))
        found.push(file);
    } catch {
      // fontconfig is not guaranteed to be present; try the next family.
    }
  }

  return found;
}

function collectCanvasFontCandidates(): string[] {
  const windowsFonts = process.env.WINDIR
    ? join(process.env.WINDIR, "Fonts")
    : "C:\\Windows\\Fonts";
  const candidates = [
    join(windowsFonts, "segoeui.ttf"),
    join(windowsFonts, "arial.ttf"),
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttf",
    "/Library/Fonts/Arial.ttf",
    // Debian/Ubuntu
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    // Arch
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
    // Fedora
    "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
    "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
  ];

  return [...candidates.filter(existsSync), ...findFontsViaFontconfig()];
}

// Having a font file is not enough: pureimage's kerning reader throws on some
// otherwise valid TrueType fonts (Liberation and Adwaita among them), and it
// only fails once text is actually drawn. Draw a throwaway glyph to find out.
function canRenderWith(fontPath: string): boolean {
  try {
    PImage.registerFont(fontPath, CANVAS_FONT_FAMILY).loadSync();

    const probe = PImage.make(8, 8);
    const ctx = probe.getContext("2d");
    ctx.font = `10pt ${CANVAS_FONT_FAMILY}`;
    ctx.fillText("Ag 1", 0, 6);

    return true;
  } catch {
    return false;
  }
}

function ensureCanvasFont() {
  if (canvasFontReady) return;

  for (const candidate of collectCanvasFontCandidates()) {
    if (canRenderWith(candidate)) {
      canvasFontReady = true;
      return;
    }
  }

  throw new Error("No usable system font found for image export");
}

function drawRoundRect(
  ctx: Context,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = stroke ?? fill;
  ctx.fill();

  if (stroke) {
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, Math.max(0, radius - 1));
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function setCanvasText(
  ctx: Context,
  size: number,
  color: string,
  align: "left" | "center" | "right" = "left",
) {
  ctx.font = `${size} ${CANVAS_FONT_FAMILY}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
}

function measureCanvasText(ctx: Context, text: string): number {
  return ctx.measureText(text).width;
}

function fitCanvasText(ctx: Context, text: string, maxWidth: number): string {
  if (measureCanvasText(ctx, text) <= maxWidth) return text;

  let clipped = text;
  while (
    clipped.length > 0 &&
    measureCanvasText(ctx, `${clipped}...`) > maxWidth
  ) {
    clipped = clipped.slice(0, -1);
  }

  return clipped.length > 0 ? `${clipped}...` : text.slice(0, 1);
}

function drawCanvasText(
  ctx: Context,
  text: string,
  x: number,
  y: number,
  options: {
    size: number;
    color: string;
    maxWidth?: number;
    align?: "left" | "center" | "right";
    strong?: boolean;
  },
) {
  setCanvasText(ctx, options.size, options.color, options.align);
  const fitted = options.maxWidth
    ? fitCanvasText(ctx, text, options.maxWidth)
    : text;
  ctx.fillText(fitted, x, y);
  if (options.strong) ctx.fillText(fitted, x + 0.65, y);
}

function canvasTextLines(
  ctx: Context,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines[lines.length - 1];
    const candidate = current ? `${current} ${word}` : word;
    if (measureCanvasText(ctx, candidate) <= maxWidth || !current) {
      if (current) {
        lines[lines.length - 1] = candidate;
      } else {
        lines.push(candidate);
      }
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = fitCanvasText(
        ctx,
        `${current} ${word}`,
        maxWidth,
      );
      break;
    }
  }

  return lines.slice(0, maxLines);
}

function drawCanvasTextBlock(
  ctx: Context,
  text: string,
  x: number,
  y: number,
  options: {
    size: number;
    color: string;
    maxWidth: number;
    maxLines: number;
    lineHeight: number;
    strong?: boolean;
  },
) {
  setCanvasText(ctx, options.size, options.color);
  const lines = canvasTextLines(ctx, text, options.maxWidth, options.maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * options.lineHeight);
    if (options.strong)
      ctx.fillText(line, x + 0.65, y + index * options.lineHeight);
  });
}

function drawMetricBlock(
  ctx: Context,
  options: {
    x: number;
    y: number;
    width: number;
    label: string;
    value: string;
    valueColor: string;
  },
) {
  drawRoundRect(
    ctx,
    options.x,
    options.y,
    options.width,
    58,
    16,
    "#f8fafc",
    "#e2e8f0",
  );
  drawCanvasText(ctx, options.label, options.x + 18, options.y + 22, {
    size: 15,
    color: "#64748b",
    strong: true,
    maxWidth: options.width - 36,
  });
  drawCanvasText(ctx, options.value, options.x + 18, options.y + 45, {
    size: 19,
    color: options.valueColor,
    strong: true,
    maxWidth: options.width - 36,
  });
}

function drawCanvasDayPanel(
  ctx: Context,
  modelDay: WeekendShareImageModelDay,
  x: number,
  y: number,
  width: number,
) {
  const accent = scoreColor(modelDay.comfortScore);
  const metricWidth = (width - 80 - 16) / 2;
  const left = x + 32;
  const right = left + metricWidth + 16;

  drawRoundRect(ctx, x, y, width, 360, 28, "#ffffff", "#dbe6df");
  drawRoundRect(ctx, x, y, width, 9, 4.5, accent);
  drawCanvasText(ctx, modelDay.label, left, y + 54, {
    size: 30,
    color: "#102a43",
    strong: true,
    maxWidth: width - 210,
  });
  drawCanvasText(ctx, modelDay.condition, left, y + 84, {
    size: 18,
    color: "#475569",
    strong: true,
    maxWidth: width - 210,
  });

  if (modelDay.isBest) {
    drawRoundRect(
      ctx,
      x + width - 138,
      y + 30,
      106,
      34,
      17,
      scoreBackground(modelDay.comfortScore),
    );
    drawCanvasText(ctx, "Best day", x + width - 85, y + 53, {
      size: 16,
      color: accent,
      align: "center",
      strong: true,
      maxWidth: 90,
    });
  }

  ctx.beginPath();
  ctx.arc(x + width - 72, y + 104, 47, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + width - 72, y + 104, 43, 0, Math.PI * 2);
  ctx.fillStyle = scoreBackground(modelDay.comfortScore);
  ctx.fill();
  drawCanvasText(ctx, `${modelDay.comfortScore}`, x + width - 72, y + 113, {
    size: 30,
    color: accent,
    align: "center",
    strong: true,
  });
  drawCanvasText(ctx, "Comfort", x + width - 72, y + 139, {
    size: 13,
    color: "#475569",
    align: "center",
    strong: true,
  });

  drawCanvasTextBlock(ctx, modelDay.summary, left, y + 123, {
    size: 20,
    color: "#102a43",
    maxWidth: width - 152,
    maxLines: 2,
    lineHeight: 25,
    strong: true,
  });
  drawMetricBlock(ctx, {
    x: left,
    y: y + 186,
    width: metricWidth,
    label: "Temp",
    value: modelDay.temp,
    valueColor: "#be4b0b",
  });
  drawMetricBlock(ctx, {
    x: right,
    y: y + 186,
    width: metricWidth,
    label: "Rain",
    value: modelDay.rain,
    valueColor: metricColor(modelDay.raw, "rain"),
  });
  drawMetricBlock(ctx, {
    x: left,
    y: y + 258,
    width: metricWidth,
    label: "Wind",
    value: modelDay.wind,
    valueColor: metricColor(modelDay.raw, "wind"),
  });
  drawMetricBlock(ctx, {
    x: right,
    y: y + 258,
    width: metricWidth,
    label: "UV / AQI",
    value: `${modelDay.uv} / ${modelDay.aqi}`,
    valueColor: metricColor(modelDay.raw, "uv"),
  });
  drawCanvasText(ctx, `Alerts: ${modelDay.alerts}`, left, y + 338, {
    size: 16,
    color: "#64748b",
    strong: true,
    maxWidth: width - 64,
  });
}

function encodePngToBuffer(bitmap: Bitmap): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });

  return PImage.encodePNGToStream(bitmap, stream).then(() =>
    Buffer.concat(chunks),
  );
}

export async function renderWeekendSharePng(
  input: WeekendShareImageInput,
): Promise<Buffer> {
  ensureCanvasFont();

  const model = buildWeekendShareImageModel(input);
  const bitmap = PImage.make(CARD_WIDTH, CARD_HEIGHT);
  const ctx = bitmap.getContext("2d");
  ctx.fillStyle = "#f7fbf5";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = "rgba(238, 247, 251, 0.74)";
  ctx.fillRect(360, 0, 840, CARD_HEIGHT);
  ctx.fillStyle = "rgba(255, 248, 237, 0.82)";
  ctx.fillRect(780, 0, 420, CARD_HEIGHT);
  drawRoundRect(ctx, 46, 42, 1120, 692, 34, "rgba(15, 23, 42, 0.10)");
  drawRoundRect(ctx, 40, 34, 1120, 692, 34, "rgba(255, 255, 255, 0.78)");

  drawCanvasText(ctx, model.eyebrow, 64, 78, {
    size: 22,
    color: "#0f766e",
    strong: true,
    maxWidth: 420,
  });
  drawCanvasText(ctx, model.location, 64, 126, {
    size: 42,
    color: "#102a43",
    strong: true,
    maxWidth: 720,
  });
  drawCanvasText(ctx, `${model.updatedLabel} - met.no forecast`, 64, 163, {
    size: 19,
    color: "#64748b",
    strong: true,
    maxWidth: 700,
  });
  drawRoundRect(ctx, 830, 64, 306, 42, 21, "#f8fafc", "#dbe6df");
  drawCanvasText(ctx, model.alertSummary, 983, 91, {
    size: 16,
    color: "#475569",
    align: "center",
    strong: true,
    maxWidth: 270,
  });

  drawRoundRect(ctx, 64, 196, 1072, 98, 28, "#14342b");
  drawRoundRect(
    ctx,
    64,
    196,
    12,
    98,
    6,
    scoreColor(input.bestDay?.comfortScore ?? 60),
  );
  drawCanvasText(ctx, "Recommendation", 96, 231, {
    size: 17,
    color: "#a7f3d0",
    strong: true,
    maxWidth: 360,
  });
  drawCanvasText(ctx, model.recommendationTitle, 96, 267, {
    size: 34,
    color: "#ffffff",
    strong: true,
    maxWidth: 390,
  });
  drawCanvasTextBlock(ctx, model.recommendationReason, 520, 251, {
    size: 19,
    color: "#d1fae5",
    maxWidth: 560,
    maxLines: 2,
    lineHeight: 24,
    strong: true,
  });

  const days = model.days.length > 0 ? model.days : [];
  const panelWidth = days.length === 1 ? 1072 : 520;
  days.forEach((day, index) => {
    drawCanvasDayPanel(
      ctx,
      day,
      days.length === 1 ? 64 : 64 + index * 552,
      322,
      panelWidth,
    );
  });
  if (days.length === 0) {
    drawCanvasText(ctx, "No weekend forecast data available", 600, 500, {
      size: 26,
      color: "#475569",
      align: "center",
      strong: true,
      maxWidth: 600,
    });
  }

  drawCanvasText(
    ctx,
    "Source: met.no Locationforecast and MetAlerts. Air quality: Open-Meteo.",
    64,
    712,
    {
      size: 16,
      color: "#64748b",
      strong: true,
      maxWidth: 760,
    },
  );
  drawCanvasText(ctx, "Forecast Pilot", 1136, 712, {
    size: 16,
    color: "#0f766e",
    align: "right",
    strong: true,
    maxWidth: 220,
  });

  return encodePngToBuffer(bitmap);
}

export function buildWeekendShareImageFilename(
  input: WeekendShareImageInput,
  now = new Date(),
): string {
  const locationSlug =
    input.location.nickname ?? input.location.name ?? input.location.id;
  const safeLocation = locationSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  return `weekend-plan-${safeLocation || "location"}-${timestamp}.png`;
}
