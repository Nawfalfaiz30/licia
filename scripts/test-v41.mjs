import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const nav = read("components/layout/nav-items.ts");
const more = read("components/layout/MoreSheet.tsx");
const bottom = read("components/layout/BottomNav.tsx");
const tasks = read("app/(app)/tasks/page.tsx");
const finance = read("app/(app)/finance/page.tsx");
const guide = read("app/(app)/guide/page.tsx");
const settings = read("app/(app)/settings/page.tsx");
const chat = read("components/chat/ChatWidget.tsx");

function assert(condition, message) { if (!condition) throw new Error(message); }

assert(nav.includes('item("/goals-projects", "Target & Proyek"'), "Target & Proyek harus menjadi tujuan tunggal.");
const navCanonical = nav.split("export const moreNavGroups")[0];
const navHrefs = [...navCanonical.matchAll(/item\(\"([^\"]+)\"/g)].map((match) => match[1]);
assert(new Set(navHrefs).size === navHrefs.length, "Navigasi desktop memiliki tujuan duplikat.");
assert(!nav.includes('item("/goals", "Target"'), "Menu Target lama masih terlihat.");
assert(!nav.includes('item("/projects", "Proyek"'), "Menu Proyek lama masih terlihat.");
assert(!nav.includes('item("/subscriptions",'), "Menu Langganan lama masih terlihat.");
assert(!nav.includes('item("/notes",'), "Menu Notes lama masih terlihat.");
assert(!nav.includes('item("/life-map",'), "Menu Life Map lama masih terlihat.");
assert(more.includes('Menu yang sudah digabung hanya muncul di satu tempat'), "MoreSheet belum menjelaskan struktur canonical.");
assert(bottom.includes('Lainnya'), "Footer mobile harus menampilkan Lainnya.");
assert(tasks.includes('runPriorityPlan') && tasks.includes('/api/v38/daily-plan?refresh=1'), "Prioritas Licia belum dieksekusi langsung.");
assert(tasks.includes('Agenda → Tugas') && tasks.includes('convertAgendaToTasks'), "Agenda → Tugas belum langsung diproses.");
assert(tasks.includes('Tugas → Agenda') && tasks.includes('scheduleOpenTasks'), "Tugas → Agenda belum langsung diproses.");
assert(tasks.includes('Agenda → Pengingat') && tasks.includes('createAgendaReminders'), "Agenda → Pengingat belum langsung diproses.");
assert(!tasks.includes('/chat?prompt=Lihat agenda kalender saya hari ini'), "Bridge tugas masih membuka Chat.");
assert(finance.includes("['subscriptions','Langganan']"), "Tab Langganan belum ada di Finance.");
assert(finance.includes('async function addSubscription'), "Form tambah langganan belum ada.");
assert(guide.includes('Target & Proyek') && guide.includes('Keuangan'), "Guide belum mengikuti workspace gabungan.");
assert(!/\bV\d+(?:\.\d+)*\b/.test(guide), "Guide masih menyebut nomor versi internal.");
assert(!/\bV\d+(?:\.\d+)*\b/.test(settings), "Settings masih menyebut nomor versi internal.");
assert(chat.includes('chat-v41') && chat.includes('quickActions.slice(0,2)'), "Chat UX v41 belum diterapkan.");
console.log("Licia V41 UX regression tests OK — all checks passed");
