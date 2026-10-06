# Licia v0.57.0 — Vercel TypeScript cleanup
# Jalankan dari root repository Licia yang sedang di-push ke GitHub.
$ErrorActionPreference = "Stop"

$stale = @(
  "components/intelligence/OnboardingNudge.tsx",
  "components/layout/QuickSearch.tsx",
  "components/ui/SmartHints.tsx",
  "lib/i18n/server.ts"
)

Write-Host "Membersihkan file TypeScript stale dari versi lama..." -ForegroundColor Cyan
foreach ($file in $stale) {
  if (Test-Path $file) {
    git rm -- $file
    Write-Host "  removed: $file" -ForegroundColor Green
  } else {
    Write-Host "  already absent: $file" -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "Verifikasi file pengganti v0.57..." -ForegroundColor Cyan
$required = @(
  "components/LanguageProvider.tsx",
  "components/ui/SmartCaptureHint.tsx",
  "components/ui/SmartChips.tsx",
  "lib/i18n-server.ts"
)
foreach ($file in $required) {
  if (-not (Test-Path $file)) {
    throw "File wajib tidak ditemukan: $file"
  }
  Write-Host "  OK: $file" -ForegroundColor Green
}

Write-Host ""
Write-Host "Menjalankan typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host ""
Write-Host "Commit perubahan ini lalu push ke GitHub:" -ForegroundColor Cyan
Write-Host 'git commit -m "fix: remove stale v0.57 TypeScript files"'
Write-Host 'git push origin main'
