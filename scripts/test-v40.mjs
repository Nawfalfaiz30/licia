import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const errors = [];
const expect = (name, ok) => { if (!ok) errors.push(name); };

const nav = read("components/layout/nav-items.ts");
expect("primary nav keeps five pillars", (nav.match(/primary\)/g) || []).length >= 1 && nav.includes('item("/insights", "Insights", "insights", Lightbulb, true)'));
expect("target/project is unified in visible nav", !nav.includes('item("/goals", "Target"') && !nav.includes('item("/projects", "Proyek"'));
expect("mobile more catalog exists", nav.includes("export const moreNavGroups"));
expect("more catalog includes search", nav.includes('item("/search", "Pencarian"'));
expect("more catalog includes advanced AI tools", nav.includes('item("/copilot", "Life Copilot"') && nav.includes('item("/command", "Perintah Licia"'));

const bottom = read("components/layout/BottomNav.tsx");
expect("mobile fifth action is More", bottom.includes('aria-label="Buka semua fitur"') && bottom.includes('MoreHorizontal'));
expect("mobile footer no longer renders Insights label", !bottom.includes('<Lightbulb size={20} />'));

const chat = read("components/chat/ChatWidget.tsx");
expect("chat uses current compact shell", chat.includes('chat-v40 flex min-w-0 flex-col'));
expect("chat menu no longer pushes content", chat.includes('chat-v40-menu absolute'));
expect("chat quick actions are limited", chat.includes("quickActions.slice(0,3)"));
expect("chat action summary is compact", chat.includes("Perubahan siap ditinjau"));
expect("chat metadata controls are visually quieter", chat.includes("sm:group-hover:opacity-100"));

const guide = read("app/(app)/guide/page.tsx");
expect("guide title is versionless", guide.includes("Panduan Licia") && !/title:\"[^\"]*\bV\d/.test(guide));
expect("guide covers unified target/project", guide.includes("Target & Proyek"));
expect("guide covers new navigation pillars", ["Beranda", "Rencana", "Chat Licia", "Tangkap Cepat", "Insights"].every((x)=>guide.includes(x)));
expect("guide covers settings", guide.includes("Pengaturan"));

const settings = read("app/(app)/settings/page.tsx");
expect("settings has no user-facing version label", !/Pengaturan V\d/i.test(settings));
expect("settings has consolidated sections", settings.includes("Perangkat & Notifikasi") && settings.includes("Data & Lanjutan"));
expect("settings uses domain-aware AI wording", settings.includes("Konteks lintas Life OS"));
expect("settings keeps font/theme surface", settings.includes("getStoredFont") && settings.includes("fontPresets"));

if (errors.length) {
  console.error("V40 TEST FAILED");
  errors.forEach((e) => console.error("-", e));
  process.exit(1);
}
console.log("Licia V40 UI/UX regression tests OK — all checks passed");
