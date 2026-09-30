export type GreetingPeriod = "morning" | "day" | "afternoon" | "night";

const GREETINGS: Record<GreetingPeriod, string[]> = {
  morning: ["Selamat pagi", "Pagi yang tenang", "Pagi yang cerah", "Mari mulai hari"],
  day: ["Selamat siang", "Siang yang produktif", "Hari masih berjalan", "Mari lanjutkan hari"],
  afternoon: ["Selamat sore", "Sore yang tenang", "Sore yang santai", "Mari rapikan sisa hari"],
  night: ["Selamat malam", "Malam yang tenang", "Hari mulai melambat", "Saatnya merapikan sisa hari"],
};

export function getGreetingPeriod(hour: number): GreetingPeriod {
  if (hour < 11) return "morning";
  if (hour < 15) return "day";
  if (hour < 19) return "afternoon";
  return "night";
}

export function getGreeting(hour: number, seed = new Date().getDate()): string {
  const period = getGreetingPeriod(hour);
  const variants = GREETINGS[period];
  return variants[Math.abs(seed) % variants.length];
}
