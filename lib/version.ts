import versionMeta from "@/config/licia-version.json";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || versionMeta.appVersion;
export const SCHEMA_VERSION = Number(versionMeta.schemaVersion);
export const PWA_DB_VERSION = Number(versionMeta.pwaDbVersion);
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID?.trim() || versionMeta.buildId;
