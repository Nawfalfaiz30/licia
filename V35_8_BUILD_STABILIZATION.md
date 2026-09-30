# Licia 0.35.8 — Production Build Stabilization

## Issue fixed

On some Windows/Node environments, `next build` under Next.js 16.3.6 could exit immediately after `next.config.js` with:

```text
Error: The destination stream closed early.
```

This is a low-level build-stream failure that can occur before application compilation.

## Change

`npm run build` now invokes:

```text
next build --webpack
```

The application source, AI CRUD behavior, Supabase integration, and runtime routes are unchanged. This only changes the production bundler used by the build command.

## Recommended clean build

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm ci
npm run preflight
npm run build
```

## Verification

The build launcher was syntax-checked in the release workspace. A full production build was not executed in the packaging environment because project `node_modules` are not installed there.
