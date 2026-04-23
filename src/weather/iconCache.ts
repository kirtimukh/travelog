import * as FileSystem from "expo-file-system/legacy";

const WEATHER_ICON_DIR = "weather-icons";

function inferExtension(uri: string): ".png" | ".svg" | ".jpg" {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".svg")) {
    return ".svg";
  }
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return ".jpg";
  }
  return ".png";
}

function sanitizePathComponent(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "_");
}

function stableFileNameFromUrl(url: string): string {
  const base = sanitizePathComponent(url).slice(0, 140) || "weather_icon";
  return `${base}${inferExtension(url)}`;
}

function resolveIconUrl(iconBaseUri: string): string {
  if (!iconBaseUri.trim()) {
    throw new Error("Weather icon base URI is empty.");
  }
  if (iconBaseUri.includes(".png") || iconBaseUri.includes(".svg") || iconBaseUri.includes(".jpg")) {
    return iconBaseUri;
  }
  return `${iconBaseUri}.png`;
}

async function ensureWeatherIconDirectory(): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root) {
    throw new Error("App document directory is not available.");
  }
  const dir = `${root}${WEATHER_ICON_DIR}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function cacheWeatherIcon(iconBaseUri: string): Promise<string> {
  const iconUrl = resolveIconUrl(iconBaseUri);
  const dir = await ensureWeatherIconDirectory();
  const filePath = `${dir}${stableFileNameFromUrl(iconUrl)}`;
  const existing = await FileSystem.getInfoAsync(filePath);
  if (existing.exists) {
    return filePath;
  }
  const download = await FileSystem.downloadAsync(iconUrl, filePath);
  return download.uri;
}
