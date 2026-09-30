# Licia V35.2 — Batch Reliability & Timezone Fix

- Batch executor now returns per-action error details instead of a generic no-change message.
- `create_daily_schedule` is per-block, validates date/time, and falls back when optional schedule columns are absent.
- Weekly schedule screenshots without concrete dates no longer create speculative calendar mutations; Licia asks for a period/start date or recurring-weekly intent.
- Reminder tool results expose local display fields so the AI does not render UTC timestamps as local time.
- System prompt explicitly enforces timezone-aware display.
