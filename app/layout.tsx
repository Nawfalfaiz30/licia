import type { Metadata, Viewport } from "next";
import { Fraunces, Playfair_Display, Poppins, Plus_Jakarta_Sans, Inter, Nunito } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { LanguageProvider } from "@/components/LanguageProvider";

// Semua kandidat font dimuat sekaligus (masing-masing dapat CSS variable
// sendiri), supaya pilihan font di Pengaturan bisa langsung berpindah tanpa
// perlu reload halaman untuk memuat font baru.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["400", "500", "600", "700"], style: ["normal", "italic"], preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ["400", "500", "600", "700"], preload: false });
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", weight: ["400", "500", "600", "700"], preload: false });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700"], preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"], preload: false });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["400", "500", "600", "700"], preload: false });

const fontVariables = [fraunces, playfair, poppins, jakarta, inter, nunito].map((f) => f.variable).join(" ");

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

    var accentHex = localStorage.getItem('licia-accent-hex');
    if (accentHex) {
      var m = /^#?([0-9a-fA-F]{6})$/.exec(accentHex.trim());
      if (m) {
        var h = m[1];
        var r = parseInt(h.slice(0, 2), 16);
        var g = parseInt(h.slice(2, 4), 16);
        var b = parseInt(h.slice(4, 6), 16);
        document.documentElement.style.setProperty('--accent-rgb', r + ' ' + g + ' ' + b);
      }
    }

    // Latar disimpan terpisah per mode — pakai yang sesuai mode aktif sekarang.
    var bgKey = isDark ? 'licia-bg-dark-hex' : 'licia-bg-light-hex';
    var bgHex = localStorage.getItem(bgKey);
    if (bgHex && /^#[0-9a-fA-F]{6}$/.test(bgHex.trim())) {
      document.documentElement.style.setProperty('--bg', bgHex.trim());
    }

    document.documentElement.lang = 'id';
    document.documentElement.dataset.language = 'id';
    localStorage.setItem('licia-language','id');

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
    var showIntelligence = localStorage.getItem('licia-show-daily-intelligence');
    if (showIntelligence === 'true' || showIntelligence === 'false') document.documentElement.dataset.showDailyIntelligence = showIntelligence;
    var chatStyle = localStorage.getItem('licia-chat-style') || 'soft';
    if (chatStyle === 'soft' || chatStyle === 'minimal' || chatStyle === 'glass') document.documentElement.dataset.chatStyle = chatStyle;
    var textScale = localStorage.getItem('licia-text-scale') || 'normal';
    if (textScale === 'small' || textScale === 'normal' || textScale === 'large') document.documentElement.dataset.textScale = textScale;
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={fontVariables}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body min-h-screen"><ToastProvider /><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
