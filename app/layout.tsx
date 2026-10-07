import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { LanguageProvider } from "@/components/LanguageProvider";
import { getServerLanguage } from "@/lib/i18n-server";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { WebVitals } from "@/components/WebVitals";

// Keep typography deterministic at build time. The app exposes the same
// six font choices as system-first stacks, so production builds never need
// to download Google Fonts during the Next.js build step.
const fontStyles = {
  "--font-fraunces": 'Georgia, "Times New Roman", serif',
  "--font-playfair": 'Georgia, "Times New Roman", serif',
  "--font-poppins": '"Century Gothic", "Trebuchet MS", Arial, sans-serif',
  "--font-jakarta": '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  "--font-inter": 'Inter, "Segoe UI", Arial, sans-serif',
  "--font-nunito": '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
} as React.CSSProperties;

export const viewport: Viewport = {
  themeColor: "#3d5fd9",
  colorScheme: "light dark",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Licia",
  description: "Asisten pribadi AI untuk kehidupan sehari-harimu",
  icons: { icon: "/licia-avatar.png" },
  manifest: "/manifest.webmanifest",
};

// Inline script runs before React hydrates, so there's no flash of the wrong
// theme, accent color, background color (per mode!), or chosen fonts.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('licia-theme');
    var theme = stored;
    var isDark = false;
    if (!theme || theme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = theme === 'dark';
    }
    if (isDark) document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = (!theme || theme === 'system' || theme === 'light' || theme === 'dark') ? (theme || 'system') : 'system';

    var accentTokens = localStorage.getItem('licia-accent-tokens');
    if (accentTokens) {
      var tokens = JSON.parse(accentTokens);
      for (var tk in tokens) { if (/^--accent-(fill|ink)-(light|dark)-rgb$/.test(tk) && /^\\d{1,3} \\d{1,3} \\d{1,3}$/.test(tokens[tk])) document.documentElement.style.setProperty(tk, tokens[tk]); }
    }

    // Latar disimpan terpisah per mode — pakai yang sesuai mode aktif sekarang.
    var bgKey = isDark ? 'licia-bg-dark-hex' : 'licia-bg-light-hex';
    var bgHex = localStorage.getItem(bgKey);
    if (bgHex && /^#[0-9a-fA-F]{6}$/.test(bgHex.trim())) {
      document.documentElement.style.setProperty('--bg', bgHex.trim());
    }

    var language = localStorage.getItem('licia-language') === 'en' ? 'en' : 'id';
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;

    var density = localStorage.getItem('licia-density') || 'comfortable';
    if (density === 'compact' || density === 'comfortable' || density === 'spacious') document.documentElement.dataset.density = density;
    var reducedMotion = localStorage.getItem('licia-reduced-motion');
    if (reducedMotion === 'true' || reducedMotion === 'false') document.documentElement.dataset.reducedMotion = reducedMotion;
    var compactSidebar = localStorage.getItem('licia-compact-sidebar');
    if (compactSidebar === 'true' || compactSidebar === 'false') document.documentElement.dataset.compactSidebar = compactSidebar;
    var quickSearchMobile = localStorage.getItem('licia-quick-search-mobile');
    if (quickSearchMobile === 'true' || quickSearchMobile === 'false') document.documentElement.dataset.quickSearchMobile = quickSearchMobile;

    var motion = localStorage.getItem('licia-motion-intensity') || 'full';
    if (motion === 'full' || motion === 'subtle' || motion === 'off') document.documentElement.dataset.motion = motion;
    var showIntelligence = localStorage.getItem('licia-show-daily-brief') || localStorage.getItem('licia-show-daily-intelligence');
    if (showIntelligence === 'true' || showIntelligence === 'false') document.documentElement.dataset.showDailyIntelligence = showIntelligence;
    var chatStyle = localStorage.getItem('licia-chat-style') || 'soft';
    if (chatStyle === 'soft' || chatStyle === 'minimal' || chatStyle === 'glass') document.documentElement.dataset.chatStyle = chatStyle;
    var textScale = localStorage.getItem('licia-text-scale') || 'normal';
    if (textScale === 'small' || textScale === 'normal' || textScale === 'large' || textScale === 'xlarge') document.documentElement.dataset.textScale = textScale;
    var animations = localStorage.getItem('licia-page-animations');
    document.documentElement.dataset.pageAnimations = animations === 'false' ? 'false' : 'true';
    var aiMode = localStorage.getItem('licia-default-ai-mode');
    if (aiMode) document.documentElement.dataset.defaultAiMode = aiMode;
    var aiStyle = localStorage.getItem('licia-ai-response-style');
    if (aiStyle) document.documentElement.dataset.aiResponseStyle = aiStyle;

    var font = localStorage.getItem('licia-font') || localStorage.getItem('licia-font-body') || localStorage.getItem('licia-font-display');
    var allowedFonts = ['--font-fraunces','--font-playfair','--font-poppins','--font-jakarta','--font-inter','--font-nunito'];
    if (font && allowedFonts.indexOf(font) !== -1) {
      document.documentElement.style.setProperty('--font-display', 'var(' + font + ')');
      document.documentElement.style.setProperty('--font-body', 'var(' + font + ')');
    }

  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = await getServerLanguage();
  return (
    <html lang={language} data-language={language} style={fontStyles} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body min-h-screen">
        <LanguageProvider initialLanguage={language}>
          <ToastProvider />
          <ThemeSync />
          <WebVitals />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
