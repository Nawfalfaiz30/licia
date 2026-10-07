import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routing = readFileSync("lib/ai/toolRouting.ts", "utf8");
const intelligence = readFileSync("lib/ai/conversationIntelligence.ts", "utf8");
const tools = readFileSync("lib/ai/tools.ts", "utf8");
const toolDefinitions = readFileSync("lib/ai/toolDefinitions.ts", "utf8");
const toolSource = tools + "\n" + toolDefinitions;
const settings = readFileSync("app/(app)/settings/page.tsx", "utf8");
const preferences = readFileSync("lib/preferences.ts", "utf8");
const theme = readFileSync("lib/theme.ts", "utf8");
const themePicker = readFileSync("components/settings/ThemeModeControl.tsx", "utf8");

assert.match(routing, /"belanja"/);
assert.match(routing, /"beli"/);
assert.match(routing, /log_expenses_batch/);
assert.match(routing, /moneyTokens\.length >= 2/);
assert.match(routing, /financeIntent/);
assert.match(intelligence, /belanja.*beli.*jajan.*habis/);
assert.match(toolDefinitions, /export const toolDefs/);
assert.match(
  toolDefinitions,
  /entity_type: \{ type: "string", enum: \["area","expense","income","account","budget","subscription"/,
);
assert.match(tools, /function normalizeAiCrudEntityType/);
assert.match(tools, /entity_id harus berupa UUID nyata/);
assert.match(tools, /function normalizeMoneyAmount/);
assert.match(tools, /amount: normalizeMoneyAmount\(item\.amount\)/);
assert.match(settings, /theme: ThemeMode/);
assert.match(settings, /Mode tampilan/);
assert.match(settings, /ThemeModeControl/);
assert.match(preferences, /theme: "licia-theme"/);
assert.match(preferences, /applyThemePreference/);
assert.match(theme, /export type ThemeMode/);
assert.match(theme, /export function applyThemePreference/);
assert.match(themePicker, /Terang/);
assert.match(themePicker, /Gelap/);
assert.match(themePicker, /Sesuai sistem/);

console.log("Licia v0.53.0 AI/UX regression checks OK");
