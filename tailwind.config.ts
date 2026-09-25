import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surfaceRaised: "var(--surface-raised)",
        border: "var(--border)",
        text: "var(--text)",
        textMuted: "var(--text-muted)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        accentSoft: "rgb(var(--accent-soft-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
