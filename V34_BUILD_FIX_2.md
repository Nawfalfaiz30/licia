# Licia V34 Build Fix 2 — AnimatedNumber Server/Client Boundary

## Symptom

Next.js production runtime reported:

`Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".`

The failing props were `value` plus `formatter: function` passed from the server-rendered dashboard into the client component `AnimatedNumber`.

## Root cause

`app/(app)/dashboard/page.tsx` is a Server Component and passed the `rupiah` function into `components/ui/AnimatedNumber.tsx`, a Client Component.

Function props are not serializable across the Next.js Server → Client boundary.

## Fix

`AnimatedNumber` now accepts only a serializable `format` option:

- `integer`
- `number`
- `idr`

Formatting functions live inside the Client Component itself.

Dashboard now uses:

```tsx
<AnimatedNumber value={monthIncome} format="idr" />
```

This keeps the currency animation while removing the non-serializable function prop.

## Verification

No remaining `formatter={rupiah}` or function formatter props were found for `AnimatedNumber`.

A full typecheck/build still requires the project's dependencies (`npm ci`) in the target environment.
