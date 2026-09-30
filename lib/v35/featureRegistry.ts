export type V35Feature = {
  id: string;
  title: string;
  description: string;
  category: "AI" | "Life OS" | "Sync" | "UX" | "Performance" | "Automation" | "Security";
  status: "ready" | "enhanced" | "foundation";
  href?: string;
};

export const V35_FEATURES: V35Feature[] = [
  { id: "ai-agent", title: "AI Agent multi-langkah", description: "Cari → pahami → rencanakan → jalankan → verifikasi dalam satu workflow.", category: "AI", status: "enhanced", href: "/chat" },
  { id: "ai-plan-preview", title: "Pratinjau rencana AI", description: "Aksi massal ditampilkan sebelum commit.", category: "AI", status: "ready", href: "/chat" },
  { id: "ai-explain", title: "Alasan tindakan AI", description: "Setiap aksi penting dapat dijelaskan secara operasional tanpa membuka detail internal model.", category: "AI", status: "enhanced", href: "/ai-history" },
  { id: "ai-confidence", title: "Confidence & ambiguitas", description: "Licia membedakan data jelas, ambigu, dan perlu konfirmasi.", category: "AI", status: "enhanced", href: "/chat" },
  { id: "ai-verify", title: "Verifikasi pasca-aksi", description: "Perubahan yang dibuat AI diverifikasi dengan pembacaan ulang state.", category: "AI", status: "enhanced", href: "/chat" },
  { id: "ai-undo-batch", title: "Undo batch", description: "Perubahan multi-langkah dapat dibatalkan melalui riwayat tindakan.", category: "AI", status: "enhanced", href: "/ai-history" },
  { id: "ai-watcher", title: "AI Watcher", description: "Licia memantau kondisi yang Anda minta dan menghasilkan sinyal saat terpenuhi.", category: "Automation", status: "ready", href: "/automations" },
  { id: "ai-context-freshness", title: "Context freshness", description: "AI mengetahui konteks mana yang segar, lama, atau tidak tersedia.", category: "AI", status: "enhanced", href: "/chat" },
  { id: "ai-read-all", title: "Akses lintas Life OS", description: "AI dapat membaca domain Life OS secara luas ketika diizinkan pengguna.", category: "AI", status: "enhanced", href: "/settings" },
  { id: "ai-full-crud", title: "Full CRUD Life OS", description: "Create, read, update, delete melalui tool domain dan fallback terkontrol.", category: "AI", status: "enhanced", href: "/chat" },
  { id: "daily-brain", title: "Otak Hari Ini", description: "Tiga prioritas, risiko, kapasitas, fokus, dan sinyal penting hari ini.", category: "Life OS", status: "ready", href: "/dashboard" },
  { id: "evening-review", title: "Review Malam", description: "Ringkasan pekerjaan, agenda, fokus, dan hal yang belum selesai.", category: "Life OS", status: "ready", href: "/brief" },
  { id: "weekly-review", title: "Review Mingguan", description: "Pola pekerjaan, fokus, target, rutinitas, kesehatan, dan keuangan.", category: "Life OS", status: "enhanced", href: "/review" },
  { id: "capacity-planner", title: "Capacity Planner", description: "Membandingkan beban pekerjaan dengan waktu yang tersedia.", category: "Life OS", status: "enhanced", href: "/planner" },
  { id: "what-if", title: "What-if Planner", description: "Simulasi perubahan jadwal tanpa menyentuh data asli.", category: "Life OS", status: "ready", href: "/planner" },
  { id: "adaptive-dashboard", title: "Dashboard adaptif", description: "Prioritas dashboard mengikuti keadaan hari ini.", category: "UX", status: "enhanced", href: "/dashboard" },
  { id: "contextual-actions", title: "Aksi kontekstual", description: "Shortcut menyesuaikan modul yang sedang dibuka.", category: "UX", status: "ready", href: "/command" },
  { id: "ask-this", title: "Tanya tentang item", description: "Bawa konteks entity saat bertanya ke Licia.", category: "AI", status: "ready", href: "/chat" },
  { id: "life-graph-2", title: "Life Graph 2.0", description: "Relasi entity menjadi context yang dapat dipakai AI.", category: "Life OS", status: "enhanced", href: "/life-graph" },
  { id: "memory-freshness", title: "Memory freshness", description: "Memory mempunyai confidence, importance, konfirmasi terakhir, dan kedaluwarsa.", category: "AI", status: "ready", href: "/memory" },
  { id: "universal-inbox", title: "Universal Capture", description: "Satu input dapat diarahkan menjadi task, note, inbox, agenda, atau reminder.", category: "UX", status: "enhanced", href: "/capture" },
  { id: "voice-actions", title: "Voice action", description: "Ucapan dapat diproses menjadi intent dan aksi Life OS.", category: "UX", status: "enhanced", href: "/capture" },
  { id: "vision-workflows", title: "Vision workflow", description: "Jadwal, struk, screenshot, dan dokumen dapat diekstraksi menjadi data terstruktur.", category: "AI", status: "enhanced", href: "/chat" },
  { id: "motion-system", title: "Motion System", description: "Durasi dan perilaku animasi dipusatkan agar konsisten dan ringan.", category: "UX", status: "enhanced", href: "/settings" },
  { id: "bottom-sheet", title: "Bottom Sheet", description: "Interaksi mobile penting menggunakan sheet yang nyaman disentuh.", category: "UX", status: "ready", href: "/settings" },
  { id: "command-palette", title: "Command Palette", description: "Ctrl/Cmd+K untuk pencarian dan aksi cepat.", category: "UX", status: "ready", href: "/command" },
  { id: "gesture-feedback", title: "Gesture feedback", description: "Tekan dan gesture mendapatkan umpan balik visual/haptic yang konsisten.", category: "UX", status: "enhanced", href: "/settings" },
  { id: "haptic-sound", title: "Haptic & sound", description: "Feedback perangkat dapat dikendalikan sesuai preferensi.", category: "UX", status: "enhanced", href: "/settings" },
  { id: "ambient-ai", title: "Ambient AI", description: "Status idle, berpikir, sinkron, dan selesai mempunyai bahasa visual yang konsisten.", category: "UX", status: "ready", href: "/chat" },
  { id: "sync-center-2", title: "Sync Center 2.0", description: "Status device, cursor, queue, realtime, dan conflict terlihat dalam satu layar.", category: "Sync", status: "enhanced", href: "/sync" },
  { id: "smart-conflict", title: "Smart Conflict Resolver", description: "Field berbeda dapat digabung, field yang bertabrakan tetap meminta keputusan.", category: "Sync", status: "enhanced", href: "/sync" },
  { id: "offline-first", title: "Offline-first", description: "Mutation queue dapat menahan perubahan sampai koneksi tersedia.", category: "Sync", status: "enhanced", href: "/sync" },
  { id: "realtime", title: "Realtime invalidation", description: "Device lain menerima sinyal perubahan dengan cepat.", category: "Sync", status: "enhanced", href: "/sync" },
  { id: "device-registry", title: "Device registry", description: "Perangkat aktif dan waktu sinkron terakhir dapat diperiksa.", category: "Sync", status: "enhanced", href: "/sync" },
  { id: "resync-recovery", title: "Resync recovery", description: "Kesenjangan event memicu resync alih-alih data diam-diam tertinggal.", category: "Sync", status: "enhanced", href: "/sync" },
  { id: "push-diagnostics", title: "Push Diagnostics", description: "VAPID, subscription, service role, dan worker dipisahkan statusnya.", category: "Sync", status: "enhanced", href: "/system" },
  { id: "worker-health", title: "Worker health", description: "Heartbeat worker dan umur heartbeat ditampilkan.", category: "Performance", status: "enhanced", href: "/system" },
  { id: "queue-center", title: "Queue Center", description: "Antrean offline dan konflik lokal dapat dipantau serta dipicu sinkron ulang.", category: "Sync", status: "ready", href: "/sync" },
  { id: "performance-cache", title: "User cache", description: "Query berulang menggunakan cache user-scoped dengan invalidation.", category: "Performance", status: "enhanced", href: "/system" },
  { id: "query-batching", title: "Query batching", description: "Dashboard dan intelligence mengambil data secara paralel.", category: "Performance", status: "enhanced", href: "/dashboard" },
  { id: "search-universal", title: "Universal Search", description: "Cari lintas entity dan modul tanpa pindah halaman.", category: "Life OS", status: "enhanced", href: "/search" },
  { id: "calendar-conflicts", title: "Calendar conflict detector", description: "Agenda yang bertabrakan ditandai sebagai sinyal actionable.", category: "Life OS", status: "enhanced", href: "/calendar" },
  { id: "task-dependencies", title: "Task dependencies", description: "Pekerjaan dapat membentuk rantai ketergantungan untuk planning dan AI.", category: "Life OS", status: "enhanced", href: "/tasks" },
  { id: "finance-insights", title: "Finance insights", description: "Kategori, delta, dan pola pengeluaran dapat dijelaskan oleh AI.", category: "Life OS", status: "enhanced", href: "/finance" },
  { id: "health-insights", title: "Health trends", description: "Data kesehatan dapat dibaca sebagai tren, bukan hanya angka harian.", category: "Life OS", status: "enhanced", href: "/health" },
  { id: "focus-rhythm", title: "Focus rhythm", description: "Ritme fokus menjadi sinyal perencanaan dan review.", category: "Life OS", status: "enhanced", href: "/focus" },
  { id: "subscription-risk", title: "Subscription watch", description: "Langganan yang mendekati billing menjadi sinyal proaktif.", category: "Automation", status: "enhanced", href: "/subscriptions" },
  { id: "natural-automation", title: "Natural-language automation", description: "Aturan Automation Center dapat dibuat dan dikelola melalui bahasa natural dengan tool AI.", category: "Automation", status: "enhanced", href: "/automations" },
  { id: "system-health-score", title: "System Health Score", description: "Database, AI, push, worker, sync, dan schema diringkas menjadi score.", category: "Security", status: "ready", href: "/system" },
  { id: "backup-recovery", title: "Backup & recovery", description: "Cadangan, restore merge, dan audit tetap terhubung dengan Life OS.", category: "Security", status: "enhanced", href: "/settings" },
  { id: "privacy-controls", title: "Privacy controls", description: "Akses AI dan data sensitif dapat dikendalikan dari pengaturan.", category: "Security", status: "enhanced", href: "/settings" },
  { id: "observability", title: "AI & system observability", description: "Action log, usage event, worker heartbeat, dan delivery telemetry dapat ditelusuri.", category: "Performance", status: "enhanced", href: "/system" },
];

export function getV35Feature(id: string) { return V35_FEATURES.find((feature) => feature.id === id) ?? null; }
export const V35_FEATURE_COUNT = V35_FEATURES.length;
