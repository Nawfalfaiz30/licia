/** Zona waktu perangkat bila termasuk zona Licia (WIB/WITA/WIT), selain itu WIB. */
export function captureTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === "Asia/Makassar" || tz === "Asia/Jayapura" ? tz : "Asia/Jakarta";
  } catch {
    return "Asia/Jakarta";
  }
}
