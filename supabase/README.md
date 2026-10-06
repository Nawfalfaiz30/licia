# Supabase migrations

The canonical schema source is the ordered migration chain in this directory.

Apply migrations in numeric order (0001 -> 0015). Do not treat the legacy
snapshot files in the parent directory as the current source of truth.

Platform metadata is defined in ../config/licia-version.json:
- schemaVersion: 41
- pwaDbVersion: 4

Before enabling PCF production paths, apply migrations 0013, 0014, and 0015
to the target database and verify RLS and policies after migration.
