# V36.2.1 — Build Fix

## Fixed

`app/api/chat/route.ts`

The Vision schedule range mapping attempted to pass `block.weekday` directly to `Map.get()`, but Vision blocks allow `weekday` to be `string | null | undefined`.

The mapping now safely handles both cases:

- when `weekday` exists, resolve it through the requested range map;
- when the block already has a concrete `block_date`, preserve it;
- when neither exists, the block is filtered out as before.

This resolves TypeScript error TS2345 without weakening the `Map<string, string>` typing.
