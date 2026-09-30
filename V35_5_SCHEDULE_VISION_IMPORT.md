# Licia V35.5 — Deterministic Schedule Vision Import

V35.5 fixes the two-turn schedule-image workflow. The first turn extracts a structured, temporary schedule draft from the image. The second turn supplies the concrete date range and server-side code maps weekday → date without asking the language model to recreate the schedule.

## Safety rules

- The model may only copy titles/hours/days visibly present in the image.
- A date or year mentioned only by free-form vision prose is never treated as a calendar date.
- `create_daily_schedule` can validate an optional `weekday` against `block_date`; mismatches are rejected.
- `manage_life_os_data` remains unavailable for calendar mutations when a dedicated calendar tool exists.
- The client stores the structured schedule draft for up to 15 minutes so a follow-up like `Mulai dari Senin besok sampai Sabtu` can use the actual image data.
