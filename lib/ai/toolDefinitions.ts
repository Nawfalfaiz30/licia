import type OpenAI from "openai";

type ToolDef = OpenAI.Chat.Completions.ChatCompletionTool;

export const toolDefs: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "resolve_calendar_date",
      description:
        "Resolve tanggal/hari secara deterministik berdasarkan timezone pengguna. WAJIB digunakan sebelum membaca kalender jika pengguna menyebut hari seperti Sabtu, Minggu depan, tanggal 26, besok, atau kombinasi hari+tanggal. Tanggal eksplisit harus divalidasi terhadap nama hari agar AI tidak menampilkan hari yang salah.",
      parameters: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description:
              "Ucapan tanggal natural pengguna, misalnya 'Sabtu tanggal 26', 'Sabtu depan', 'besok', atau 'minggu ini'.",
          },
          date: { type: "string", description: "Tanggal eksplisit YYYY-MM-DD bila sudah diketahui." },
          expected_weekday: { type: "string", description: "Hari yang harus divalidasi, misalnya sabtu." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_expense",
      description:
        "Catat satu pengeluaran baru. Jika pengguna menyebut dompet/rekening (contoh: 'pakai Bank Mandiri', 'dari GoPay', 'tunai'), WAJIB isi account_name atau account_id agar saldo dompet tersebut langsung berkurang. Jika sumber dana tidak disebutkan, otomatis gunakan dompet cash / bernama Tunai; jangan meminta pengguna menyebutkan dompet untuk kasus ini.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Jumlah dalam Rupiah, angka positif." },
          category: {
            type: "string",
            description: "Kategori singkat, misal: makanan, transport, hiburan, belanja, tagihan, lainnya.",
          },
          note: { type: "string", description: "Catatan singkat opsional, misal 'kopi di kafe'." },
          account_id: { type: "string", description: "ID dompet/rekening sumber dana jika sudah diketahui." },
          account_name: {
            type: "string",
            description:
              "Nama dompet/rekening seperti 'Bank Mandiri', 'BCA', 'GoPay', atau 'Tunai'. Dipakai untuk mencari account_id secara otomatis.",
          },
          occurred_at: {
            type: "string",
            description: "Tanggal-waktu ISO 8601 kapan pengeluaran terjadi. Default sekarang jika tidak disebut.",
          },
        },
        required: ["amount", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expense_summary",
      description:
        "Baca ringkasan pengeluaran pengguna dalam rentang tanggal tertentu. WAJIB dipanggil sebelum menjawab pertanyaan tentang pengeluaran.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "Tanggal mulai ISO 8601 (YYYY-MM-DD)." },
          to_date: { type: "string", description: "Tanggal akhir ISO 8601 (YYYY-MM-DD), inklusif." },
          category: { type: "string", description: "Filter kategori opsional." },
        },
        required: ["from_date", "to_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_expense",
      description:
        "Hapus pengeluaran milik pengguna. Cari kandidat berdasarkan kata kunci/kategori/tanggal dulu: kalau kandidat lebih dari satu, JANGAN hapus — kembalikan daftarnya. Kalau nol, bilang tidak ketemu.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Kata kunci dari catatan/kategori untuk mencari kandidat." },
          from_date: { type: "string", description: "Batas tanggal mulai opsional ISO 8601 (YYYY-MM-DD)." },
          to_date: { type: "string", description: "Batas tanggal akhir opsional ISO 8601 (YYYY-MM-DD)." },
          confirm_expense_id: {
            type: "string",
            description:
              "ID pengeluaran yang SUDAH dikonfirmasi pengguna untuk dihapus (dari daftar kandidat sebelumnya). Kosongkan di percobaan pertama.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_expenses_batch",
      description:
        "Catat BANYAK pengeluaran sekaligus dalam satu panggilan — dipakai saat pengguna meminta beberapa transaksi dalam satu pesan (contoh: 47k dan burger 10k) atau dari daftar transaksi/FOTO STRUK BELANJA. Pahami akhiran nominal k/rb/ribu/jt/juta sebagai ribuan/jutaan. Untuk struk, baca tiap barang (nama + harga) dan isi satu item array per barang. Jangan gabungkan transaksi berbeda menjadi satu baris. Jika sumber dana tidak disebutkan, otomatis gunakan dompet cash/Tunai. note boleh kosong; jangan mengarang detail yang tidak tersedia. Untuk gambar non-struk, jangan gunakan tool ini kecuali pengguna memang meminta pencatatan pengeluaran dari informasi yang terlihat.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                amount: {
                  type: "number",
                  description: "Harga barang ini (setelah diskon per-item kalau ada), angka positif.",
                },
                category: { type: "string", description: "Kategori singkat, mis: makanan, belanja, transport, dll." },
                note: { type: "string", description: "Nama barang persis seperti di struk." },
              },
              required: ["amount", "category"],
            },
          },
          store_name: {
            type: "string",
            description: "Nama toko/merchant dari struk, opsional — disebut di note kalau berguna.",
          },
          account_id: { type: "string", description: "ID dompet sumber dana jika sudah diketahui." },
          account_name: {
            type: "string",
            description: "Nama dompet sumber dana, misalnya Bank Mandiri, BCA, GoPay, atau Tunai.",
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_expense",
      description:
        "Ubah jumlah/kategori/catatan/tanggal satu pengeluaran. expense_id WAJIB berupa UUID nyata dari hasil tool, BUKAN nomor urut seperti 1/2/3. Cari expense_id lewat get_expense_summary atau search_life_os bila belum tahu id-nya.",
      parameters: {
        type: "object",
        properties: {
          expense_id: { type: "string" },
          amount: { type: "number" },
          category: { type: "string" },
          note: { type: "string" },
          account_id: { type: "string", description: "ID rekening/dompet penerima jika sudah diketahui." },
          account_name: { type: "string", description: "Nama rekening/dompet penerima." },
          occurred_at: { type: "string" },
        },
        required: ["expense_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_incomes",
      description:
        "Baca daftar pemasukan pengguna dalam rentang tanggal. WAJIB dipanggil sebelum menjawab soal pemasukan.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "ISO 8601 (YYYY-MM-DD)." },
          to_date: { type: "string", description: "ISO 8601 (YYYY-MM-DD), inklusif." },
        },
        required: ["from_date", "to_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_income",
      description:
        "Ubah jumlah/sumber/catatan/tanggal/rekening satu pemasukan. Jika pengguna memindahkan rekening penerima, isi account_id atau account_name.",
      parameters: {
        type: "object",
        properties: {
          income_id: { type: "string" },
          amount: { type: "number" },
          source: { type: "string" },
          note: { type: "string" },
          account_id: { type: "string" },
          account_name: { type: "string" },
          occurred_at: { type: "string" },
        },
        required: ["income_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_account",
      description:
        "Ubah nama, jenis, saldo awal, atau status dompet utama. Cari account_id dulu lewat get_accounts kalau belum tahu id-nya.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string" },
          name: { type: "string" },
          starting_balance: { type: "number" },
          account_type: { type: "string", enum: ["bank", "cash", "ewallet", "other"] },
          is_default: { type: "boolean" },
        },
        required: ["account_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pomodoro_sessions",
      description:
        "Baca sesi pomodoro/fokus pengguna dalam rentang tanggal. WAJIB dipanggil sebelum menjawab soal riwayat fokus.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "ISO 8601 (YYYY-MM-DD)." },
          to_date: { type: "string", description: "ISO 8601 (YYYY-MM-DD), inklusif." },
        },
        required: ["from_date", "to_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_pomodoro_session",
      description: "Hapus satu sesi pomodoro. Pola cari-kandidat-dulu (cari berdasarkan tanggal).",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string" },
          to_date: { type: "string" },
          confirm_session_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_health_log",
      description:
        "Hapus satu entri kesehatan (hidrasi/kafein/makan/obat/check-in energi). Pola cari-kandidat-dulu: sebutkan 'kind' untuk tahu tabel mana yang dicari.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["hydration", "caffeine", "meal", "medication", "energy"] },
          keyword: {
            type: "string",
            description:
              "Kata kunci (untuk meal: cari di deskripsi; caffeine: cari di nama minuman; medication: cari di nama obat).",
          },
          confirm_log_id: { type: "string" },
        },
        required: ["kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_note",
      description:
        "Ubah isi, tag, atau status sematan (pin) satu catatan. Cari note_id dulu lewat get_notes kalau belum tahu id-nya. Tulis 'content' sebagai teks polos, tanpa markdown.",
      parameters: {
        type: "object",
        properties: {
          note_id: {
            type: "string",
            description: "UUID catatan dari hasil get_notes/search_life_os, bukan nomor urut daftar.",
          },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          pinned: { type: "boolean", description: "true untuk sematkan ke atas, false untuk lepas." },
        },
        required: ["note_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_habit",
      description: "Ubah nama atau target mingguan satu kebiasaan/rutinitas.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string" },
          name: { type: "string" },
          target_per_week: { type: "number" },
          icon: { type: "string" },
        },
        required: ["habit_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "uncheckin_habit",
      description:
        "Batalkan check-in kebiasaan. Secara kebijakan hanya boleh untuk tanggal hari ini di timezone pengguna.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string" },
          checkin_date: {
            type: "string",
            description: "Tanggal YYYY-MM-DD. Harus sama dengan hari ini di timezone pengguna.",
          },
        },
        required: ["habit_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_subtask",
      description:
        "Hapus satu subtugas tanpa menghapus tugas induknya. Cari subtask_id dulu lewat get_tasks kalau belum tahu id-nya.",
      parameters: {
        type: "object",
        properties: {
          subtask_id: { type: "string" },
        },
        required: ["subtask_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task_with_subtasks",
      description: "Buat tugas baru, opsional dengan deskripsi dan daftar subtugas.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul tugas." },
          description: { type: "string", description: "Deskripsi/detail tambahan, opsional." },
          due_at: { type: "string", description: "Tenggat ISO 8601 opsional." },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Prioritas opsional." },
          subtasks: {
            type: "array",
            items: { type: "string" },
            description: "Daftar judul subtugas, opsional.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task_from_schedule",
      description:
        "Jadikan satu agenda kalender menjadi tugas yang terhubung. WAJIB gunakan get_schedule dulu jika schedule_block_id belum diketahui. Secara default menyalin judul, tanggal, waktu selesai sebagai deadline, deskripsi/lokasi sebagai konteks, lalu menghubungkan schedule_blocks.task_id ke tugas baru.",
      parameters: {
        type: "object",
        properties: {
          schedule_block_id: { type: "string" },
          title: { type: "string", description: "Judul task baru, opsional; default dari agenda." },
          due_at: {
            type: "string",
            description: "Deadline task opsional; default akhir agenda dengan timezone pengguna.",
          },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          estimated_minutes: { type: "number", description: "Estimasi task dalam menit, opsional." },
        },
        required: ["schedule_block_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_life_os_data",
      description:
        "Fallback CRUD lintas Life OS untuk data yang belum memiliki tool domain khusus. Gunakan tool domain khusus bila tersedia (mis. get_tasks/update_task, checkin_habit, create_reminder). Operasi read/create/update/delete tersedia pada entity yang diizinkan. Untuk delete, confirm harus true karena tindakan destruktif. Filter hanya boleh menggunakan field yang diizinkan.",
      parameters: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["read", "create", "update", "delete"] },
          entity_type: {
            type: "string",
            enum: [
              "area",
              "expense",
              "income",
              "account",
              "budget",
              "subscription",
              "journal_entry",
              "relation",
              "interaction",
              "sleep",
              "hydration",
              "caffeine",
              "meal",
              "medication",
              "fatigue",
              "movement",
              "health_metric",
              "daily_plan",
              "reading_session",
              "milestone",
              "link",
              "notification_event",
              "smart_inbox_item",
              "memory",
              "daily_snapshot",
            ],
          },
          entity_id: { type: "string" },
          filters: { type: "object", description: "Filter sederhana key=value untuk operasi read." },
          data: {
            type: "object",
            description:
              "Field yang ingin dibuat/diubah. Field berbahaya seperti user_id, version, created_at, updated_at tidak diterima.",
          },
          limit: { type: "number", description: "Jumlah hasil read, 1-50. Default 20." },
          confirm: { type: "boolean", description: "Wajib true untuk delete." },
        },
        required: ["operation", "entity_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_notifications",
      description:
        "Baca riwayat notifikasi Licia milik pengguna. Gunakan sebelum menghapus atau menjelaskan isi notifikasi.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          unread_only: { type: "boolean" },
          limit: { type: "number", description: "1-50, default 20" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_notification",
      description:
        "Hapus satu riwayat notifikasi. Cari kandidat dulu jika ID belum diketahui; gunakan confirm_notification_id setelah target jelas.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_notification_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_all_notifications",
      description:
        "Hapus SEMUA riwayat notifikasi pengguna. Panggil tanpa confirm lebih dulu untuk memperoleh jumlah target; setelah pengguna menyetujui, panggil lagi dengan confirm=true.",
      parameters: { type: "object", properties: { confirm: { type: "boolean" } }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_notification_read",
      description: "Tandai satu notifikasi sebagai sudah dibaca.",
      parameters: {
        type: "object",
        properties: { notification_id: { type: "string" } },
        required: ["notification_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_life_graph",
      description:
        "Buka satu entity Life OS beserta relasi terdekat yang nyata, secara ringkas. Gunakan saat pengguna meminta hubungan antar task/project/goal/agenda/focus atau ingin memahami satu entity lintas modul. Wajib memakai UUID nyata.",
      parameters: {
        type: "object",
        properties: {
          entity_type: {
            type: "string",
            enum: [
              "task",
              "project",
              "goal",
              "schedule",
              "note",
              "inbox",
              "habit",
              "subscription",
              "account",
              "expense",
              "income",
              "memory",
              "decision",
              "reading",
            ],
          },
          entity_id: { type: "string", description: "UUID nyata dari hasil tool baca/search." },
          depth: {
            type: "number",
            description: "1 atau 2; default 1. Depth 2 hanya untuk relasi penting, tetap ringkas.",
          },
        },
        required: ["entity_type", "entity_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_life_module_data",
      description:
        "Baca detail modul Life OS tertentu ketika snapshot ringkas belum cukup. Gunakan hanya modul yang relevan dan tetap verifikasi hasil sebelum mengambil kesimpulan.",
      parameters: {
        type: "object",
        properties: {
          module: {
            type: "string",
            enum: [
              "inbox",
              "journal",
              "relations",
              "interactions",
              "anime",
              "reading_sessions",
              "health",
              "finance",
              "productivity",
              "habits",
            ],
          },
          keyword: { type: "string", description: "Filter kata kunci opsional untuk modul yang mendukungnya." },
          limit: { type: "number", description: "Jumlah item maksimal, 1-30. Default 12." },
        },
        required: ["module"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task_from_inbox",
      description:
        "Ubah satu item Smart Inbox menjadi tugas dan tandai Inbox sebagai processed. Gunakan get_life_module_data(module=inbox) dahulu bila ID belum diketahui.",
      parameters: {
        type: "object",
        properties: {
          inbox_id: { type: "string" },
          title: { type: "string", description: "Judul tugas opsional; default diambil dari isi Inbox." },
          due_at: { type: "string", description: "Deadline opsional ISO 8601." },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["inbox_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task_from_note",
      description:
        "Ubah satu catatan menjadi tugas baru dengan isi catatan sebagai konteks. Gunakan get_notes dahulu bila ID belum diketahui.",
      parameters: {
        type: "object",
        properties: {
          note_id: { type: "string" },
          title: { type: "string", description: "Judul tugas opsional." },
          due_at: { type: "string", description: "Deadline opsional ISO 8601." },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["note_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task_from_project",
      description:
        "Buat task dari satu project dan langsung hubungkan task.project_id ke project. Gunakan get_projects dahulu bila ID project belum diketahui.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          title: { type: "string", description: "Judul task opsional; default berupa langkah berikutnya project." },
          description: { type: "string" },
          due_at: { type: "string", description: "Deadline opsional ISO 8601." },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task_from_goal",
      description:
        "Buat task dari target aktif. Bila ada project aktif yang terhubung dengan target tersebut, task otomatis ditempelkan ke project itu; jika tidak, tetap dibuat dengan konteks target.",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          title: { type: "string", description: "Judul task opsional; default dari next_step atau judul target." },
          description: { type: "string" },
          due_at: {
            type: "string",
            description: "Deadline opsional ISO 8601; default target_date pukul 23:59 timezone pengguna bila ada.",
          },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_life_os_capabilities",
      description:
        "Peta ringkas kemampuan dan struktur Life OS. Gunakan hanya saat perlu memahami domain/entity/tool yang tersedia, terutama untuk permintaan seperti 'apa yang bisa Licia lakukan', CRUD, modul yang belum jelas, atau entity yang namanya tidak familiar. Gunakan domain untuk detail terarah agar hemat token.",
      parameters: {
        type: "object",
        properties: {
          domain: {
            type: "string",
            description:
              "Domain opsional, misalnya tasks, finance, calendar, knowledge, health, goals, atau reminders.",
          },
          include_fields: {
            type: "boolean",
            description: "Jika true, sertakan detail tambahan yang relevan untuk operasi CRUD domain tersebut.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_life_os",
      description:
        "Cari satu kata kunci di banyak modul Life OS sekaligus. Gunakan untuk menemukan task, agenda, project, target, note, Inbox, keputusan, rutinitas, langganan, memory, vault, skill, bacaan, dan data relevan lain sebelum melakukan aksi berbasis nama/kata kunci.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Kata kunci yang ingin dicari." },
          limit: { type: "number", description: "Maksimum hasil per modul, 1-10. Default 5." },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unified_life_snapshot",
      description:
        "Baca snapshot lintas seluruh Life OS: task, kalender, project, target, catatan, inbox, fokus, rutinitas, belajar, bacaan, keuangan, langganan, memory, vault, automation, keputusan, kesehatan, jurnal, dan aktivitas lain yang tersedia. Gunakan untuk permintaan lintas modul atau ketika pengguna meminta semua konteks yang relevan. Gunakan limit lebih besar bila konteks ringkas belum cukup.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Jumlah item terbaru per modul, 4-30. Default 8." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description:
        "Baca daftar tugas pengguna. WAJIB dipanggil sebelum menjawab pertanyaan apa pun tentang tugas (jangan pernah mengarang).",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done", "all"],
            description: "Filter status, default 'all' kecuali 'done'.",
          },
          due_before: {
            type: "string",
            description: "Hanya tugas dengan due_at sebelum tanggal ini (ISO 8601), opsional.",
          },
          keyword: { type: "string", description: "Cari di judul, opsional." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description:
        "Ubah status/judul/prioritas/tenggat satu tugas, atau tandai satu subtugas selesai. Cari task_id dulu lewat get_tasks kalau belum tahu id-nya.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "ID tugas yang diubah." },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          title: { type: "string" },
          description: { type: "string", description: "Deskripsi/detail tambahan." },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_at: { type: "string" },
          subtask_id: { type: "string", description: "Jika hanya menandai satu subtugas, isi ini dan subtask_status." },
          subtask_status: { type: "string", enum: ["todo", "done"] },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tasks_bulk",
      description:
        "Perbarui beberapa tugas sekaligus dengan perubahan yang sama. Gunakan hanya jika target sudah jelas melalui task_ids atau keyword; cocok untuk menandai dua atau lebih tugas selesai. Jangan gunakan tanpa target.",
      parameters: {
        type: "object",
        properties: {
          task_ids: {
            type: "array",
            items: { type: "string" },
            description: "Daftar UUID tugas dari hasil baca/search atau referensi aktif.",
          },
          keyword: { type: "string", description: "Kata kunci judul jika target belum diberikan sebagai UUID." },
          due_on: {
            type: "string",
            description:
              "Batasi target ke tugas yang deadline-nya jatuh pada tanggal lokal ini (YYYY-MM-DD). Gunakan untuk permintaan seperti hari ini atau besok.",
          },
          due_from: { type: "string", description: "Tanggal lokal awal inklusif YYYY-MM-DD untuk scope rentang." },
          due_to: { type: "string", description: "Tanggal lokal akhir inklusif YYYY-MM-DD untuk scope rentang." },
          due_after: {
            type: "string",
            description:
              "Batasi target ke tugas yang deadline-nya setelah akhir tanggal lokal ini (YYYY-MM-DD), misalnya setelah hari ini.",
          },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          due_at: { type: "string", description: "Tenggat baru yang sama untuk semua target, ISO 8601; opsional." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description:
        "Hapus tugas. Pola wajib cari-kandidat-dulu: >1 kandidat → tampilkan daftar & tanya, 0 → bilang tidak ketemu, hapus hanya setelah confirm_task_id dikirim eksplisit.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Kata kunci judul untuk mencari kandidat." },
          confirm_task_id: { type: "string", description: "ID tugas yang sudah dikonfirmasi pengguna untuk dihapus." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_tasks_bulk",
      description:
        "Hapus banyak tugas dalam SATU operasi batch. Gunakan khusus saat pengguna secara jelas meminta menghapus semua/seluruh tugas atau kumpulan tugas yang cocok. Jangan memanggil delete_task satu per satu. Untuk permintaan massal, operasi ini akan masuk review aksi massal sebelum diterapkan bila proteksi massal aktif.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done", "all"],
            description: "Status tugas yang akan dihapus. Default all.",
          },
          keyword: { type: "string", description: "Opsional. Hanya tugas yang judulnya cocok dengan kata kunci." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_pomodoro_session",
      description: "Catat satu sesi fokus/pomodoro yang baru selesai.",
      parameters: {
        type: "object",
        properties: {
          focus_minutes: { type: "number", description: "Durasi fokus dalam menit." },
          task_id: { type: "string", description: "ID tugas terkait, opsional." },
        },
        required: ["focus_minutes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_daily_schedule",
      description:
        "Buat satu atau beberapa blok jadwal (acara/janji/kegiatan dengan waktu spesifik) untuk tanggal tertentu. Gunakan ini untuk ACARA/JANJI/KEGIATAN dengan jam mulai-selesai (rapat, kelas, pelatihan, ketemuan, dsb) — BUKAN untuk tugas checklist biasa (pakai create_task_with_subtasks untuk itu). Jika mengimpor jadwal kuliah dari satu gambar untuk rentang beberapa hari, gunakan SATU pemanggilan tool dengan seluruh blok sekaligus (maksimal 20 blok), petakan nama hari ke tanggal konkret dari instruksi pengguna, dan jangan memanggil manage_life_os_data. Simpan lokasi & detail tambahan di field terpisah (location/description), JANGAN digabung ke dalam title.",
      parameters: {
        type: "object",
        properties: {
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                block_date: { type: "string", description: "Tanggal ISO 8601 (YYYY-MM-DD)." },
                weekday: {
                  type: "string",
                  description:
                    "Hari sumber opsional: senin/selasa/rabu/kamis/jumat/sabtu/minggu. Jika diisi, harus cocok dengan block_date dalam timezone pengguna.",
                },
                start_time: { type: "string", description: "Jam mulai format HH:MM (24 jam)." },
                end_time: { type: "string", description: "Jam selesai format HH:MM (24 jam)." },
                title: { type: "string", description: "Judul acara SAJA, tanpa lokasi/detail di dalamnya." },
                location: { type: "string", description: "Lokasi acara, opsional." },
                description: { type: "string", description: "Detail/catatan tambahan, opsional." },
                task_id: {
                  type: "string",
                  description: "ID tugas terkait, opsional. Isi bila blok ini dibuat untuk mengerjakan tugas tersebut.",
                },
              },
              required: ["block_date", "start_time", "end_time", "title"],
            },
          },
        },
        required: ["blocks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_schedule_block",
      description:
        "Ubah blok jadwal yang sudah ada (judul, jam, lokasi, deskripsi, atau tanggal). Cari block_id dulu lewat get_schedule kalau belum tahu id-nya.",
      parameters: {
        type: "object",
        properties: {
          block_id: { type: "string" },
          block_date: { type: "string" },
          start_time: { type: "string" },
          end_time: { type: "string" },
          title: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          task_id: { type: "string", description: "ID tugas terkait, opsional." },
        },
        required: ["block_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_schedule_from_task",
      description:
        "Jadwalkan satu tugas pada kalender dan hubungkan schedule_blocks.task_id ke tugas tersebut. Gunakan get_tasks dahulu bila ID tugas belum diketahui.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          block_date: { type: "string", description: "Tanggal YYYY-MM-DD." },
          start_time: { type: "string", description: "Jam mulai HH:MM." },
          end_time: { type: "string", description: "Jam selesai HH:MM." },
          title: { type: "string", description: "Judul agenda opsional." },
          location: { type: "string" },
          description: { type: "string" },
        },
        required: ["task_id", "block_date", "start_time", "end_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description:
        "Buat SATU pengingat pada tanggal/jam tertentu. Gunakan untuk permintaan seperti 'ingatkan saya besok jam 11 untuk berangkat'. Wajib isi remind_at sebagai ISO 8601 dengan zona waktu yang benar. Pengingat tersimpan di Reminder Center dan dapat dikirim sebagai push notification ketika server terjadwal.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul pengingat singkat." },
          body: { type: "string", description: "Konteks/alasan pengingat, opsional." },
          remind_at: { type: "string", description: "Waktu pengingat ISO 8601. Contoh: 2026-09-26T11:00:00+07:00." },
          href: {
            type: "string",
            description: "Route internal yang dibuka saat notifikasi disentuh, opsional. Contoh /calendar atau /tasks.",
          },
          target_type: {
            type: "string",
            enum: ["custom", "schedule", "task", "goal", "project", "subscription", "habit"],
          },
          target_id: { type: "string", description: "UUID entitas yang terkait, opsional." },
          offset_minutes: {
            type: "number",
            description: "Jika berasal dari agenda/task, jumlah menit sebelum waktu target, opsional.",
          },
          enabled: { type: "boolean" },
        },
        required: ["title", "remind_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reminders",
      description:
        "Baca pengingat pengguna, terutama yang aktif dan akan datang. Gunakan sebelum mengubah atau membatalkan pengingat yang sudah ada.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "sent", "cancelled", "waiting_for_device", "failed", "all"] },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_reminder",
      description: "Ubah judul, isi, waktu, atau status enabled satu pengingat. Wajib gunakan reminder_id yang jelas.",
      parameters: {
        type: "object",
        properties: {
          reminder_id: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          remind_at: { type: "string" },
          enabled: { type: "boolean" },
        },
        required: ["reminder_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_reminder",
      description:
        "Batalkan/hapus satu pengingat. Cari kandidat dulu melalui get_reminders bila ID belum diketahui, lalu gunakan confirm_reminder_id.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_reminder_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_all_reminders",
      description:
        "Hapus SEMUA pengingat milik pengguna dari Pusat Pengingat, termasuk yang pending, terkirim, dibatalkan, atau gagal. Panggil tanpa confirm terlebih dahulu untuk mendapatkan jumlah target; setelah pengguna menyetujui, panggil lagi dengan confirm=true.",
      parameters: { type: "object", properties: { confirm: { type: "boolean" } }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_schedule_reminder",
      description:
        "Buat pengingat otomatis untuk satu agenda kalender pada H-x menit melalui Automation Center. Ini membuat aturan terhubung ke agenda, bukan notifikasi jam tetap di perangkat ketika aplikasi benar-benar tertutup.",
      parameters: {
        type: "object",
        properties: {
          schedule_block_id: { type: "string" },
          minutes_before: {
            type: "number",
            description: "Berapa menit sebelum agenda pengingat dianggap aktif. Default 30.",
          },
          name: { type: "string", description: "Nama pengingat opsional." },
          enabled: { type: "boolean" },
        },
        required: ["schedule_block_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schedule",
      description:
        "Baca blok jadwal pengguna untuk rentang tanggal tertentu. WAJIB dipanggil sebelum menjawab soal jadwal.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "Tanggal mulai ISO 8601 (YYYY-MM-DD)." },
          to_date: { type: "string", description: "Tanggal akhir ISO 8601 (YYYY-MM-DD), inklusif." },
        },
        required: ["from_date", "to_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_schedule_block",
      description:
        "Hapus blok jadwal. Pola wajib cari-kandidat-dulu, sama seperti delete lain — hapus hanya setelah confirm_block_id dikirim eksplisit.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Kata kunci judul blok." },
          block_date: { type: "string", description: "Filter tanggal ISO 8601 (YYYY-MM-DD), opsional." },
          confirm_block_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_schedule_blocks_bulk",
      description:
        "Hapus banyak agenda kalender dalam SATU operasi. WAJIB gunakan untuk permintaan seperti 'hapus semua agenda/jadwal kecuali X'. Sebelum eksekusi, baca get_schedule untuk memverifikasi target. Gunakan exclude_keywords atau exclude_ids untuk agenda yang harus dipertahankan. confirm_all=true hanya boleh dikirim ketika pengguna sudah menyetujui preview batch.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "Batas tanggal mulai YYYY-MM-DD, opsional." },
          to_date: { type: "string", description: "Batas tanggal akhir YYYY-MM-DD, opsional." },
          exclude_keywords: {
            type: "array",
            items: { type: "string" },
            description: "Kata kunci judul agenda yang harus dipertahankan.",
          },
          exclude_ids: { type: "array", items: { type: "string" }, description: "ID agenda yang harus dipertahankan." },
          keyword: {
            type: "string",
            description: "Opsional. Hanya agenda yang judulnya cocok yang akan dipertimbangkan.",
          },
          confirm_all: { type: "boolean", description: "true hanya setelah pengguna mengonfirmasi preview batch." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_inbox_item",
      description:
        "Simpan pemikiran mentah ke Smart Inbox tanpa harus menentukan kategorinya dulu. Gunakan saat pengguna ingin mengingat ide/catatan/tugas untuk dibereskan nanti.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Isi yang ingin disimpan apa adanya." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_decisions",
      description: "Baca Decision Journal pengguna, termasuk keputusan yang sedang menunggu review.",
      parameters: {
        type: "object",
        properties: {
          review_only: {
            type: "boolean",
            description: "Jika true, tampilkan keputusan yang tanggal review-nya sudah tiba atau lewat.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_decision",
      description: "Catat keputusan penting ke Decision Journal agar bisa ditinjau kembali nanti.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul keputusan." },
          context: { type: "string", description: "Konteks atau masalah yang sedang diputuskan, opsional." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Alternatif yang dipertimbangkan, opsional.",
          },
          decision: { type: "string", description: "Pilihan/keputusan yang akhirnya diambil." },
          confidence: { type: "number", description: "Keyakinan 1-5, default 3." },
          review_date: { type: "string", description: "Tanggal untuk meninjau hasil, YYYY-MM-DD, opsional." },
        },
        required: ["title", "decision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_decision",
      description:
        "Perbarui keputusan yang sudah tercatat. Gunakan get_decisions terlebih dahulu jika ID belum diketahui.",
      parameters: {
        type: "object",
        properties: {
          decision_id: { type: "string" },
          title: { type: "string" },
          context: { type: "string" },
          decision: { type: "string" },
          confidence: { type: "number", description: "1-5." },
          review_date: { type: "string", description: "YYYY-MM-DD atau kosong untuk menghapus tanggal review." },
          outcome: { type: "string", description: "Hasil setelah keputusan dijalankan." },
          result_rating: { type: "number", description: "Penilaian hasil 1-5, opsional." },
        },
        required: ["decision_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_decision",
      description:
        "Hapus keputusan dari Decision Journal. Cari kandidat terlebih dahulu; jangan hapus tanpa ID yang dikonfirmasi.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_decision_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_skills",
      description: "Baca daftar skill/belajar pengguna dan progresnya. Hubungkan dengan target bila tersedia.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_skill",
      description: "Buat skill baru di modul Belajar. Hubungkan ke target bila pengguna menyebutkan target.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          goal_id: { type: "string" },
          resource_url: { type: "string" },
          learning_mode: { type: "string" },
          target_level: { type: "number", description: "0-100." },
          target_date: { type: "string" },
          next_action: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_skill",
      description: "Hapus skill. Cari kandidat terlebih dahulu dan minta konfirmasi jika ID belum diberikan.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_skill_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_skill",
      description: "Perbarui progres atau catatan satu skill. Cari skill_id lewat get_skills jika belum tahu ID.",
      parameters: {
        type: "object",
        properties: {
          skill_id: { type: "string" },
          level: { type: "number", description: "Progres 0-100." },
          category: { type: "string" },
          resource_url: { type: "string" },
          notes: { type: "string" },
        },
        required: ["skill_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_overview",
      description:
        "Baca ringkasan lengkap hari ini: tugas jatuh tempo, agenda, fokus Pomodoro, pengeluaran, Smart Inbox yang belum dipilah, dan target aktif. Panggil ini untuk pertanyaan umum seperti 'hari ini gimana?', 'apa aja agendaku', atau 'apa yang perlu aku bereskan?'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_life_snapshot",
      description:
        "Baca satu ringkasan lintas modul yang padat: tugas, agenda, fokus, Inbox, project, target, keuangan, langganan, rutinitas, dan keputusan. Gunakan untuk pertanyaan luas tentang kondisi hidup atau prioritas tanpa mengambil semua data mentah.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "log_income",
      description:
        "Catat satu pemasukan baru. Jika pengguna menyebut rekening/dompet penerima, isi account_name atau account_id agar saldo dompet tersebut langsung bertambah.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          source: { type: "string", description: "Sumber, misal: gaji, freelance, hadiah." },
          note: { type: "string" },
          occurred_at: { type: "string" },
        },
        required: ["amount", "source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_income",
      description: "Hapus pemasukan. Pola cari-kandidat-dulu sama seperti delete lain.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          confirm_income_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_budget",
      description: "Buat anggaran baru untuk satu kategori pengeluaran per periode.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string" },
          limit_amount: { type: "number" },
          period: { type: "string", enum: ["weekly", "monthly"] },
        },
        required: ["category", "limit_amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_budget",
      description: "Ubah limit anggaran kategori yang sudah ada.",
      parameters: {
        type: "object",
        properties: {
          budget_id: { type: "string" },
          limit_amount: { type: "number" },
        },
        required: ["budget_id", "limit_amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_budget",
      description: "Hapus anggaran kategori. Pola cari-kandidat-dulu.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Nama kategori." },
          confirm_budget_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budgets",
      description:
        "Baca semua anggaran beserta progres pemakaiannya di periode berjalan. WAJIB dipanggil sebelum menjawab soal anggaran/budget.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "log_health",
      description:
        "Catat satu entri kesehatan: hidrasi, kafein, makan, obat, atau check-in energi. Pilih 'kind' sesuai jenisnya. Untuk kind=meal, WAJIB isi calories_estimate, protein_g_estimate, carbs_g_estimate, fat_g_estimate berdasarkan perkiraanmu sendiri atas gizi makanan yang disebutkan (gunakan pengetahuan umummu tentang nilai gizi makanan, terutama makanan Indonesia) — boleh perkiraan kasar, lebih baik daripada kosong. Untuk kind=energy, gunakan skor energi 1-5 dan note opsional.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["hydration", "caffeine", "meal", "medication", "energy"] },
          amount_ml: { type: "number", description: "Untuk kind=hydration." },
          drink: { type: "string", description: "Untuk kind=caffeine, misal 'kopi hitam'." },
          mg_estimate: { type: "number", description: "Untuk kind=caffeine, opsional." },
          meal_type: {
            type: "string",
            enum: ["sarapan", "makan_siang", "makan_malam", "camilan"],
            description: "Untuk kind=meal.",
          },
          description: { type: "string", description: "Untuk kind=meal, deskripsi makanan." },
          calories_estimate: { type: "number", description: "Untuk kind=meal, perkiraan total kalori (kcal)." },
          protein_g_estimate: { type: "number", description: "Untuk kind=meal, perkiraan protein (gram)." },
          carbs_g_estimate: { type: "number", description: "Untuk kind=meal, perkiraan karbohidrat (gram)." },
          fat_g_estimate: { type: "number", description: "Untuk kind=meal, perkiraan lemak (gram)." },
          medication_name: { type: "string", description: "Untuk kind=medication." },
          dosage: { type: "string", description: "Untuk kind=medication, opsional." },
          energy_score: {
            type: "number",
            description: "Untuk kind=energy, skor energi/kesiapan 1 (sangat rendah) sampai 5 (sangat siap).",
          },
          note: {
            type: "string",
            description: "Untuk kind=energy, catatan singkat tentang kondisi hari ini, opsional.",
          },
        },
        required: ["kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_health_summary",
      description:
        "Baca ringkasan kesehatan hari ini (hidrasi, kafein, makan, obat, check-in energi terakhir). WAJIB dipanggil sebelum menjawab soal kesehatan.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_account",
      description: "Buat dompet/akun keuangan baru (mis. rekening bank, tunai, e-wallet), dengan saldo awal.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nama dompet, mis. 'BCA', 'Tunai', 'GoPay'." },
          starting_balance: { type: "number", description: "Saldo awal, default 0." },
          account_type: { type: "string", enum: ["bank", "cash", "ewallet", "other"], description: "Jenis akun." },
          is_default: {
            type: "boolean",
            description: "Jadikan dompet utama untuk transaksi tanpa dompet yang disebutkan secara eksplisit.",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_accounts",
      description:
        "Baca semua dompet pengguna beserta saldo berjalan (saldo awal + pemasukan - pengeluaran + transfer masuk - transfer keluar). WAJIB dipanggil sebelum menjawab soal saldo/dompet.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_account",
      description: "Hapus dompet/akun. Pola cari-kandidat-dulu, sama seperti delete lain.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Nama dompet." },
          confirm_account_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_net_worth",
      description:
        "Baca total sisa saldo/tabungan pengguna di seluruh dompet (saldo awal semua dompet + total pemasukan - total pengeluaran sepanjang waktu). WAJIB dipanggil sebelum menjawab pertanyaan seperti 'sisa uangku berapa' atau 'tabunganku berapa'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_money",
      description:
        "Pindahkan uang antar dompet/rekening milik pengguna. Gunakan untuk kasus seperti 'transfer 100 ribu dari BCA ke Mandiri'. Transfer TIDAK dihitung sebagai pengeluaran/pemasukan; saldo kedua dompet yang berubah.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Jumlah transfer dalam Rupiah, positif." },
          from_account_id: { type: "string" },
          from_account_name: { type: "string" },
          to_account_id: { type: "string" },
          to_account_name: { type: "string" },
          note: { type: "string" },
          occurred_at: { type: "string" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_transactions",
      description:
        "Baca seluruh arus satu dompet (pengeluaran, pemasukan, dan transfer) beserta saldo berjalan. Panggil ketika pengguna bertanya 'saldo Mandiri sekarang berapa', 'uang masuk/keluar dari BCA', atau meminta histori sebuah dompet.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "string" },
          account_name: { type: "string" },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal",
      description:
        "Buat target/goal baru (tujuan jangka menengah-panjang dengan progres, BUKAN tugas sekali selesai atau kebiasaan berulang). Contoh: 'nabung buat laptop baru', 'turun berat badan 5kg', 'belajar bahasa Jepang'.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "Detail tambahan, opsional." },
          target_date: { type: "string", description: "Target tanggal tercapai ISO 8601 (YYYY-MM-DD), opsional." },
          category: {
            type: "string",
            description: "Kategori, mis. 'karier', 'finansial', 'kesehatan', 'belajar', opsional.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_goals",
      description:
        "Baca daftar target/goal pengguna beserta progresnya. WAJIB dipanggil sebelum menjawab soal target/goal.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "achieved", "abandoned", "all"] },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_goal",
      description:
        "Ubah progres (0-100) atau status target yang sudah ada. Progres 100 otomatis menandai status 'achieved'.",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          progress: { type: "number" },
          status: { type: "string", enum: ["active", "achieved", "abandoned"] },
          title: { type: "string" },
          target_date: { type: "string" },
          category: { type: "string" },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_goal",
      description: "Hapus target/goal. Pola cari-kandidat-dulu (cari lewat judul).",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          confirm_goal_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description:
        "Buat catatan cepat (brain dump), opsional dengan tag. Tulis 'content' sebagai teks polos — JANGAN pakai markdown (#, ##, **, -, dst), catatan ini bukan dokumen berformat.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" }, description: "Tag opsional." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_notes",
      description: "Baca catatan cepat pengguna. WAJIB dipanggil sebelum menjawab soal catatan.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Cari di isi catatan, opsional." },
          tag: { type: "string", description: "Filter tag, opsional." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "Hapus catatan cepat. Pola cari-kandidat-dulu.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          confirm_note_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_reading",
      description: "Tambahkan buku/bacaan baru ke daftar bacaan.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          status: { type: "string", enum: ["want_to_read", "reading", "finished"] },
          genre: { type: "string", description: "Genre buku, opsional." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reading_list",
      description: "Baca daftar bacaan pengguna. WAJIB dipanggil sebelum menjawab soal bacaan.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["want_to_read", "reading", "finished", "all"] },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_reading",
      description: "Ubah progres (0-100), status, rating, atau catatan pribadi untuk bacaan yang sudah ada.",
      parameters: {
        type: "object",
        properties: {
          reading_id: { type: "string" },
          progress: { type: "number" },
          status: { type: "string", enum: ["want_to_read", "reading", "finished"] },
          rating: { type: "number", description: "Rating pribadi 1-5, biasanya diisi setelah selesai baca." },
          notes: { type: "string", description: "Catatan/ulasan pribadi tentang buku ini." },
          genre: { type: "string" },
        },
        required: ["reading_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_reading",
      description: "Hapus buku dari daftar bacaan. Pola cari-kandidat-dulu (cari lewat judul).",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          confirm_reading_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_projects",
      description: "Baca project pengguna beserta status, deadline, target yang terkait, dan ringkasan tugas terbuka.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "paused", "completed", "archived", "all"] },
          keyword: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Buat project baru. Gunakan target_date/goal_id bila pengguna memberikannya.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          target_date: { type: "string" },
          goal_id: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Ubah satu project. Cari get_projects dulu bila project_id belum diketahui.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["active", "paused", "completed", "archived"] },
          target_date: { type: "string" },
          goal_id: { type: "string" },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description:
        "Arsipkan/hapus satu project. Cari kandidat dulu. Tanpa confirm_project_id, hanya kembalikan kandidat yang membutuhkan konfirmasi.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_project_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_memories",
      description:
        "Baca memory Licia yang tersimpan. Gunakan ketika pengguna bertanya apa yang diingat atau meminta memeriksa memory.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, enabled_only: { type: "boolean" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description:
        "Hapus satu memory Licia. Cari kandidat lewat get_memories dulu. Tanpa confirm_memory_id, hanya kembalikan kandidat untuk konfirmasi.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_memory_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_vault_items",
      description:
        "Cari pengetahuan pribadi di Licia Vault. Pakai hanya ketika pertanyaan memang terkait catatan, link, snippet, atau dokumen yang disimpan pengguna.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Kata kunci judul, isi, tag, atau URL." },
          item_type: { type: "string", enum: ["note", "link", "snippet", "document", "all"] },
          limit: { type: "number", description: "Jumlah maksimal hasil, default 6." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_automation_rules",
      description: "Baca aturan Automation Center pengguna dan status pengecekan terakhirnya.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_vault_item",
      description: "Simpan pengetahuan ke Licia Vault: catatan, link, snippet, atau dokumen kecil.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          item_type: { type: "string", enum: ["note", "link", "snippet", "document"] },
          content: { type: "string" },
          source_url: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          pinned: { type: "boolean" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vault_item",
      description: "Ubah item tertentu di Licia Vault. Gunakan get_vault_items dulu bila ID belum diketahui.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          title: { type: "string" },
          item_type: { type: "string", enum: ["note", "link", "snippet", "document"] },
          content: { type: "string" },
          source_url: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          pinned: { type: "boolean" },
        },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_vault_item",
      description: "Hapus item Licia Vault. Cari kandidat dulu dan minta konfirmasi bila ID belum diberikan.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_vault_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_automation",
      description:
        "Buat aturan Automation Center yang aman: trigger overdue_task/review_due/daily_open/inactivity/schedule_soon dan action notify/suggest_focus/open_brief.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          trigger_type: {
            type: "string",
            enum: ["overdue_task", "review_due", "daily_open", "inactivity", "schedule_soon"],
          },
          action_type: { type: "string", enum: ["notify", "suggest_focus", "open_brief"] },
          days: { type: "number", description: "Ambang hari untuk inactivity; default 3." },
          minutes: { type: "number", description: "Ambang menit untuk schedule_soon; default 30." },
          schedule_block_id: { type: "string", description: "ID agenda untuk schedule_soon." },
          enabled: { type: "boolean" },
        },
        required: ["name", "trigger_type", "action_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_automation",
      description: "Ubah aturan Automation Center yang sudah ada.",
      parameters: {
        type: "object",
        properties: {
          automation_id: { type: "string" },
          name: { type: "string" },
          trigger_type: {
            type: "string",
            enum: ["overdue_task", "review_due", "daily_open", "inactivity", "schedule_soon"],
          },
          action_type: { type: "string", enum: ["notify", "suggest_focus", "open_brief"] },
          days: { type: "number" },
          minutes: { type: "number" },
          schedule_block_id: { type: "string" },
          enabled: { type: "boolean" },
        },
        required: ["automation_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_automation",
      description: "Hapus aturan Automation Center. Cari kandidat dulu dan minta konfirmasi bila ID belum diberikan.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" }, confirm_automation_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Simpan satu fakta atau preferensi yang pengguna secara eksplisit meminta Licia ingat. Jangan simpan percakapan biasa, rahasia sensitif, atau hal yang tidak diminta.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Kategori singkat seperti preferensi, proyek, belajar, kebiasaan." },
          memory_key: { type: "string", description: "Kunci ringkas dan stabil, misalnya bahasa_preferred." },
          memory_value: { type: "string", description: "Fakta/preferensi yang benar-benar ingin diingat pengguna." },
        },
        required: ["memory_key", "memory_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_habit",
      description: "Buat kebiasaan baru untuk dilacak.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          target_per_week: { type: "number", description: "Target berapa hari per minggu, 1-7, default 7." },
          icon: { type: "string", description: "Satu emoji sebagai ikon kebiasaan ini, opsional (default ✅)." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_habits",
      description:
        "Baca daftar kebiasaan pengguna beserta streak, progres minggu ini, dan beberapa tanggal check-in terbaru. WAJIB dipanggil sebelum menjawab soal kebiasaan/habit atau memilih habit_id.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "checkin_habit",
      description:
        "Tandai satu kebiasaan sudah dilakukan. Secara kebijakan check-in hanya boleh untuk tanggal hari ini menurut timezone pengguna; gunakan checkin_date untuk menyatakan tanggal secara eksplisit agar Licia dapat memvalidasi tanggalnya.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string", description: "Cari lewat get_habits dulu kalau belum tahu id-nya." },
          checkin_date: {
            type: "string",
            description: "Tanggal YYYY-MM-DD. Harus sama dengan hari ini di timezone pengguna.",
          },
        },
        required: ["habit_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_habit",
      description: "Hapus kebiasaan. Pola cari-kandidat-dulu (cari lewat nama).",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          confirm_habit_id: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_habits_bulk",
      description:
        'Hapus banyak atau semua kebiasaan/rutinitas sekaligus. Gunakan untuk permintaan seperti "hapus semua rutinitas". Percobaan pertama hanya menampilkan target untuk konfirmasi; gunakan confirm_all=true hanya setelah pengguna menyetujui daftar yang sama.',
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Opsional. Batasi ke rutinitas yang namanya mengandung kata ini." },
          habit_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "ID rutinitas yang sudah diverifikasi sebelumnya. Gunakan hanya untuk replay target yang sama.",
          },
          confirm_all: {
            type: "boolean",
            description: "true hanya setelah konfirmasi eksplisit pengguna atas daftar target.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_subscription",
      description: "Catat langganan baru (streaming, gym, aplikasi, dll) yang berulang tiap bulan/tahun.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nama layanan, mis. 'Netflix', 'Gym'." },
          amount: { type: "number", description: "Biaya per siklus tagihan." },
          billing_cycle: { type: "string", enum: ["monthly", "yearly"], description: "Default monthly." },
          next_billing_date: { type: "string", description: "Tanggal tagihan berikutnya, ISO 8601 (YYYY-MM-DD)." },
          category: { type: "string", description: "Kategori, opsional (mis. 'hiburan', 'kesehatan')." },
        },
        required: ["name", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_subscriptions",
      description:
        "Baca semua langganan aktif pengguna beserta total biaya bulanan gabungan (langganan tahunan dikonversi ke setara bulanan). WAJIB dipanggil sebelum menjawab soal langganan/biaya bulanan tetap.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "update_subscription",
      description: "Ubah data satu langganan (biaya, tanggal tagihan berikutnya, status aktif/nonaktif, dll).",
      parameters: {
        type: "object",
        properties: {
          subscription_id: { type: "string" },
          name: { type: "string" },
          amount: { type: "number" },
          billing_cycle: { type: "string", enum: ["monthly", "yearly"] },
          next_billing_date: { type: "string" },
          active: { type: "boolean", description: "false = langganan dihentikan tapi riwayatnya tetap disimpan." },
        },
        required: ["subscription_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_subscription",
      description: "Hapus langganan permanen. Pola cari-kandidat-dulu (cari lewat nama).",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          confirm_subscription_id: { type: "string" },
        },
        required: [],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "get_task_dependencies",
      description: "Baca dependency task: apa yang memblokir task dan task mana yang diblokir oleh task ini.",
      parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task_dependency",
      description:
        "Buat hubungan dependency antar task. Gunakan relation blocks untuk menyatakan task pertama menunggu task kedua selesai.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          depends_on_task_id: { type: "string" },
          relation: { type: "string", enum: ["blocks", "related"] },
        },
        required: ["task_id", "depends_on_task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task_dependency",
      description: "Hapus satu dependency task setelah target jelas.",
      parameters: {
        type: "object",
        properties: { dependency_id: { type: "string" }, confirm: { type: "boolean" } },
        required: ["dependency_id", "confirm"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_brain",
      description:
        "Baca Otak Hari Ini V35: prioritas, risiko, kapasitas, fokus, reminder gagal, inbox, dan sinyal penting. Gunakan untuk pertanyaan seperti 'apa yang paling penting hari ini?' tanpa mengarang data.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_planner",
      description:
        "Jalankan simulasi planner tanpa mengubah data asli. Cocok untuk pertanyaan 'bagaimana kalau jadwal digeser 30 menit?' atau membandingkan skenario.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Tanggal awal YYYY-MM-DD." },
          to: { type: "string", description: "Tanggal akhir YYYY-MM-DD." },
          shift_minutes: { type: "number", description: "Perubahan waktu jadwal dalam menit, boleh negatif." },
          exclude_task_keyword: {
            type: "string",
            description: "Kata kunci task yang ingin diabaikan dalam simulasi, opsional.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_watchers",
      description: "Baca aturan AI Watcher milik pengguna.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_ai_watcher",
      description:
        "Buat AI Watcher untuk memantau kondisi Life OS. Jangan gunakan sebagai pengganti reminder sederhana jika reminder cukup.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          entity_type: { type: "string" },
          condition: { type: "object" },
          action: { type: "object" },
          cooldown_minutes: { type: "number" },
        },
        required: ["name", "entity_type", "condition", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_ai_watcher",
      description: "Ubah AI Watcher yang sudah ada. Gunakan ID hasil get_ai_watchers.",
      parameters: {
        type: "object",
        properties: {
          watcher_id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          condition: { type: "object" },
          action: { type: "object" },
          enabled: { type: "boolean" },
          cooldown_minutes: { type: "number" },
        },
        required: ["watcher_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_ai_watcher",
      description: "Hapus satu AI Watcher setelah ID target jelas.",
      parameters: {
        type: "object",
        properties: { watcher_id: { type: "string" }, confirm: { type: "boolean" } },
        required: ["watcher_id", "confirm"],
      },
    },
  },
];

// ---- Handlers --------------------------------------------------------------------
