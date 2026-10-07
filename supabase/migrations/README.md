# Migration policy

The legacy numbered migrations (0001 through 0015) are frozen history. New schema work uses timestamped migrations.

## Local verification

Install the Supabase CLI, start the local stack, then run:

supabase db reset
npm run db:verify

Every migration must be replayable from a clean database. Never edit an applied migration in place; create a new migration instead.

## Production

Apply timestamped migrations through the same reviewed release process used by the application. Preview and staging must use a non-production Supabase project or branch.
