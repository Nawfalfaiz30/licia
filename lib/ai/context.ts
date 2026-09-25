import type { SupabaseClient } from "@supabase/supabase-js";
import { dateStrInTimezone } from "@/lib/date";
import type { AiDomain } from "@/lib/ai/toolRouting";


export async function buildUnifiedContext(supabase: SupabaseClient, userId: string, timezone = "Asia/Jakarta") {
  const today = dateStrInTimezone(new Date(), timezone);
  const safe = async (table: string, select: string, order = "", limit = 6) => {
    try {
      let query: any = supabase.from(table).select(select).eq("user_id", userId).limit(limit);
      if (order) query = query.order(order, { ascending: false });
      const result = await query;
      return result.data ?? [];
    } catch {
      return [];
    }
  };

  const [
    tasks, schedule, projects, goals, notes, inbox, focus, habits, skills, reading, expenses, incomes,
    subscriptions, memories, vault, automations, decisions, areas, milestones, dailyPlans, journal,
    relations, interactions, anime, accounts, budgets, sleep, hydration, caffeine, meals, medications,
    fatigue, movement, healthMetrics, readingSessions, reminders, notificationEvents,
  ] = await Promise.all([
    safe("tasks", "id,title,status,priority,due_at,estimated_minutes,project_id,area_id", "due_at", 10),
    safe("schedule_blocks", "id,title,block_date,start_time,end_time,location,description,task_id,project_id", "block_date", 10),
    safe("projects", "id,name,status,target_date,goal_id", "updated_at", 8),
    safe("goals", "id,title,progress,status,target_date,next_step", "updated_at", 8),
    safe("brain_dump_notes", "id,title,content,tags,pinned,updated_at", "updated_at", 6),
    safe("smart_inbox_items", "id,content,kind,status,created_at", "created_at", 6),
    safe("pomodoro_sessions", "id,task_id,focus_minutes,started_at,completed", "started_at", 6),
    safe("habits", "id,name,target_per_week,icon,goal_id", "created_at", 6),
    safe("skills", "id,name,level,next_action,target_date", "updated_at", 6),
    safe("reading_logs", "id,title,status,progress,rating", "updated_at", 6),
    safe("expenses", "id,amount,category,note,occurred_at,account_id", "occurred_at", 8),
    safe("incomes", "id,amount,source,note,occurred_at,account_id", "occurred_at", 6),
    safe("subscriptions", "id,name,amount,billing_cycle,next_billing_date,active,reminder_days", "next_billing_date", 6),
    safe("user_memories", "id,category,memory_key,memory_value,enabled,updated_at", "updated_at", 8),
    safe("vault_items", "id,title,item_type,content,tags,pinned,updated_at", "updated_at", 6),
    safe("automations", "id,name,trigger_type,action_type,enabled,last_run_at,last_result", "created_at", 6),
    safe("decisions", "id,title,decision,review_date,outcome,updated_at", "updated_at", 6),
    safe("areas", "id,name,icon", "created_at", 8),
    safe("goal_milestones", "id,goal_id,title,status,target_date,position", "created_at", 8),
    safe("daily_plans", "id,week_start,plan,updated_at", "updated_at", 3),
    safe("journal_entries", "id,mood_score,content,created_at", "created_at", 5),
    safe("social_relations", "id,contact_name,importance,contact_frequency_days,birthday,notes", "created_at", 6),
    safe("social_interactions", "id,relation_id,note,occurred_at", "occurred_at", 6),
    safe("anime_watchlist", "id,title,status,watched_episodes,total_episodes,score,updated_at", "updated_at", 6),
    safe("accounts", "id,name,starting_balance,created_at", "created_at", 6),
    safe("budgets", "id,category,limit_amount,period,created_at", "created_at", 6),
    safe("sleep_logs", "id,sleep_start,sleep_end,quality,created_at", "sleep_end", 4),
    safe("hydration_logs", "id,amount_ml,logged_at", "logged_at", 6),
    safe("caffeine_logs", "id,drink,mg_estimate,logged_at", "logged_at", 6),
    safe("meal_logs", "id,meal_type,description,logged_at", "logged_at", 6),
    safe("medication_logs", "id,medication_name,dosage,logged_at", "logged_at", 6),
    safe("fatigue_logs", "id,fatigue_score,note,logged_at", "logged_at", 6),
    safe("movement_logs", "id,activity,duration_minutes,intensity,note,logged_at", "logged_at", 6),
    safe("health_metrics", "id,weight_kg,systolic,diastolic,resting_hr,note,measured_at", "measured_at", 4),
    safe("reading_sessions", "id,reading_id,minutes,pages_read,note,started_at", "started_at", 6),
    safe("reminders", "id,title,body,remind_at,target_type,target_id,offset_minutes,enabled,status", "remind_at", 8),
    safe("notification_events", "id,title,body,href,source_type,scheduled_at,delivered_at,read_at,created_at", "created_at", 6),
  ]);

  const openTasks = tasks.filter((x: any) => x.status !== "done");
  const upcoming = schedule.filter((x: any) => String(x.block_date) >= today);
  const activeProjects = projects.filter((x: any) => !["archived", "completed"].includes(String(x.status)));
  const activeGoals = goals.filter((x: any) => x.status === "active");
  const financeOut = expenses.reduce((n: number, x: any) => n + Number(x.amount || 0), 0);
  const financeIn = incomes.reduce((n: number, x: any) => n + Number(x.amount || 0), 0);
  const focusMinutes = focus.reduce((n: number, x: any) => n + Number(x.focus_minutes || 0), 0);
  const hydrationMl = hydration.reduce((n: number, x: any) => n + Number(x.amount_ml || 0), 0);
  const caffeineMg = caffeine.reduce((n: number, x: any) => n + Number(x.mg_estimate || 0), 0);
  const movementMinutes = movement.reduce((n: number, x: any) => n + Number(x.duration_minutes || 0), 0);
  const readingMinutes = readingSessions.reduce((n: number, x: any) => n + Number(x.minutes || 0), 0);
  const linkedAgenda = upcoming.filter((x: any) => x.task_id).length;
  const unlinkedAgenda = upcoming.filter((x: any) => !x.task_id).length;

  const lines = [
    `TODAY=${today} TZ=${timezone}`,
    `LIFE_OS_COUNTS openTasks=${openTasks.length}; upcomingAgenda=${upcoming.length}; linkedAgenda=${linkedAgenda}; unlinkedAgenda=${unlinkedAgenda}; activeProjects=${activeProjects.length}; activeGoals=${activeGoals.length}; focusRecentMinutes=${focusMinutes}; inboxOpen=${inbox.filter((x: any) => x.status === "open").length}; remindersPending=${reminders.filter((x: any) => x.enabled !== false && ["pending","waiting_for_device","failed"].includes(x.status)).length}; notificationsUnread=${notificationEvents.filter((x: any) => !x.read_at).length}`,
    `FINANCE_RECENT incoming=${financeIn}; outgoing=${financeOut}; accounts=${accounts.length}; budgets=${budgets.length}; activeSubscriptions=${subscriptions.filter((x: any) => x.active !== false).length}`,
    `HEALTH_RECENT hydrationMl=${hydrationMl}; caffeineMg=${caffeineMg}; movementMinutes=${movementMinutes}; readingMinutes=${readingMinutes}; medicationLogs=${medications.length}; fatigueLogs=${fatigue.length}; sleepLogs=${sleep.length}; healthMetrics=${healthMetrics.length}`,
    `TASKS: ${openTasks.slice(0, 10).map((x: any) => `${x.id}|${x.title}|${x.status}|${x.priority}|${x.due_at || "none"}|project:${x.project_id || "none"}|area:${x.area_id || "none"}`).join(" || ") || "none"}`,
    `SCHEDULE: ${upcoming.slice(0, 10).map((x: any) => `${x.id}|${x.block_date}|${String(x.start_time).slice(0, 5)}-${String(x.end_time).slice(0, 5)}|${x.title}|task:${x.task_id || "none"}|project:${x.project_id || "none"}|${x.location || ""}`).join(" || ") || "none"}`,
    `PROJECTS: ${activeProjects.slice(0, 8).map((x: any) => `${x.id}|${x.name}|${x.status}|target:${x.target_date || "none"}|goal:${x.goal_id || "none"}`).join(" || ") || "none"}`,
    `GOALS: ${activeGoals.slice(0, 8).map((x: any) => `${x.id}|${x.title}|${x.progress}%|target:${x.target_date || "none"}|next:${x.next_step || "none"}`).join(" || ") || "none"}`,
    `MILESTONES: ${milestones.slice(0, 8).map((x: any) => `${x.id}|goal:${x.goal_id}|${x.title}|${x.status}|target:${x.target_date || "none"}`).join(" || ") || "none"}`,
    `AREAS: ${areas.slice(0, 8).map((x: any) => `${x.id}|${x.name}|${x.icon || ""}`).join(" || ") || "none"}`,
    `NOTES: ${notes.slice(0, 6).map((x: any) => `${x.id}|${x.title || "Catatan"}|${String(x.content || "").slice(0, 180)}`).join(" || ") || "none"}`,
    `INBOX: ${inbox.slice(0, 6).map((x: any) => `${x.id}|${x.kind}|${String(x.content || "").slice(0, 160)}|${x.status}`).join(" || ") || "none"}`,
    `HABITS: ${habits.slice(0, 6).map((x: any) => `${x.id}|${x.name}|target:${x.target_per_week}|goal:${x.goal_id || "none"}`).join(" || ") || "none"}`,
    `SKILLS: ${skills.slice(0, 6).map((x: any) => `${x.id}|${x.name}|${x.level || ""}|next:${x.next_action || "none"}`).join(" || ") || "none"}`,
    `READING: ${reading.slice(0, 6).map((x: any) => `${x.id}|${x.title}|${x.status}|${x.progress || 0}%|rating:${x.rating || "-"}`).join(" || ") || "none"}`,
    `READING_SESSIONS: ${readingSessions.slice(0, 6).map((x: any) => `${x.id}|reading:${x.reading_id}|${x.minutes}m|${x.pages_read}p|${String(x.note || "").slice(0, 80)}`).join(" || ") || "none"}`,
    `MEMORIES: ${memories.filter((x: any) => x.enabled !== false).slice(0, 8).map((x: any) => `${x.category}|${x.memory_key}|${String(x.memory_value || "").slice(0, 200)}`).join(" || ") || "none"}`,
    `VAULT: ${vault.slice(0, 6).map((x: any) => `${x.id}|${x.title}|${x.item_type}|${String(x.content || "").slice(0, 160)}`).join(" || ") || "none"}`,
    `AUTOMATIONS: ${automations.slice(0, 6).map((x: any) => `${x.name}|${x.trigger_type}|${x.action_type}|${x.enabled ? "on" : "off"}|${String(x.last_result || "").slice(0, 80)}`).join(" || ") || "none"}`,
    `REMINDERS: ${reminders.filter((x: any) => x.enabled !== false && ["pending","waiting_for_device","failed"].includes(x.status)).slice(0, 8).map((x: any) => `${x.id}|${x.title}|${x.remind_at}|${x.status}|target:${x.target_type}:${x.target_id || "none"}|offset:${x.offset_minutes || "none"}`).join(" || ") || "none"}`,
    `NOTIFICATIONS: ${notificationEvents.slice(0, 8).map((x: any) => `${x.id}|${x.title}|${x.source_type}|${x.read_at ? "read" : "unread"}|${x.created_at}`).join(" || ") || "none"}`,
    `DECISIONS: ${decisions.slice(0, 6).map((x: any) => `${x.id}|${x.title}|review:${x.review_date || "none"}|${String(x.outcome || "").slice(0, 120)}`).join(" || ") || "none"}`,
    `JOURNAL: ${journal.slice(0, 5).map((x: any) => `${x.id}|mood:${x.mood_score}|${String(x.content || "").slice(0, 160)}`).join(" || ") || "none"}`,
    `RELATIONS: ${relations.slice(0, 6).map((x: any) => `${x.id}|${x.contact_name}|importance:${x.importance}|freq:${x.contact_frequency_days}d|birthday:${x.birthday || "none"}`).join(" || ") || "none"}`,
    `INTERACTIONS: ${interactions.slice(0, 6).map((x: any) => `${x.relation_id}|${String(x.note || "").slice(0, 120)}|${x.occurred_at}`).join(" || ") || "none"}`,
    `WATCHLIST: ${anime.slice(0, 6).map((x: any) => `${x.title}|${x.status}|${x.watched_episodes}/${x.total_episodes || "?"}|score:${x.score || "-"}`).join(" || ") || "none"}`,
    `ACCOUNTS: ${accounts.slice(0, 6).map((x: any) => `${x.id}|${x.name}|starting:${x.starting_balance}`).join(" || ") || "none"}`,
    `BUDGETS: ${budgets.slice(0, 6).map((x: any) => `${x.category}|${x.limit_amount}|${x.period}`).join(" || ") || "none"}`,
    `SUBSCRIPTIONS: ${subscriptions.filter((x: any) => x.active !== false).slice(0, 6).map((x: any) => `${x.id}|${x.name}|${x.amount}|${x.billing_cycle}|next:${x.next_billing_date || "none"}|reminder:${x.reminder_days ?? "-"}`).join(" || ") || "none"}`,
    `SLEEP: ${sleep.slice(0, 4).map((x: any) => `${x.id}|${x.sleep_start}|${x.sleep_end}|quality:${x.quality ?? "-"}`).join(" || ") || "none"}`,
    `HYDRATION: ${hydration.slice(0, 6).map((x: any) => `${x.id}|${x.amount_ml}ml|${x.logged_at}`).join(" || ") || "none"}`,
    `CAFFEINE: ${caffeine.slice(0, 6).map((x: any) => `${x.id}|${x.drink}|${x.mg_estimate ?? "-"}mg|${x.logged_at}`).join(" || ") || "none"}`,
    `MEALS: ${meals.slice(0, 6).map((x: any) => `${x.meal_type || "meal"}|${String(x.description || "").slice(0, 120)}|${x.logged_at}`).join(" || ") || "none"}`,
    `MEDICATIONS: ${medications.slice(0, 6).map((x: any) => `${x.medication_name}|${x.dosage || ""}|${x.logged_at}`).join(" || ") || "none"}`,
    `FATIGUE: ${fatigue.slice(0, 6).map((x: any) => `${x.fatigue_score}|${String(x.note || "").slice(0, 100)}|${x.logged_at}`).join(" || ") || "none"}`,
    `MOVEMENT: ${movement.slice(0, 6).map((x: any) => `${x.activity}|${x.duration_minutes}m|${x.intensity}|${String(x.note || "").slice(0, 90)}|${x.logged_at}`).join(" || ") || "none"}`,
    `HEALTH_METRICS: ${healthMetrics.slice(0, 4).map((x: any) => `${x.measured_at}|weight:${x.weight_kg ?? "-"}|bp:${x.systolic ?? "-"}/${x.diastolic ?? "-"}|hr:${x.resting_hr ?? "-"}`).join(" || ") || "none"}`,
    `REMINDERS: ${reminders.filter((x:any)=>x.enabled!==false && ["pending","waiting_for_device","failed"].includes(String(x.status))).slice(0, 8).map((x:any)=>`${x.id}|${x.title}|${x.remind_at}|target:${x.target_type}:${x.target_id||"none"}|offset:${x.offset_minutes??"-"}|${x.status}`).join(" || ") || "none"}`,
    `NOTIFICATIONS: ${notificationEvents.slice(0, 6).map((x:any)=>`${x.created_at}|${x.title}|${x.read_at?"read":"unread"}`).join(" || ") || "none"}`,
    `DAILY_PLANS: ${dailyPlans.slice(0, 3).map((x: any) => `${x.week_start}|${JSON.stringify(x.plan).slice(0, 260)}`).join(" || ") || "none"}`,
  ];

  return lines.join("\n").slice(0, 7800);
}

export async function buildConnectedContext(
  supabase: SupabaseClient,
  userId: string,
  timezone = "Asia/Jakarta",
  domains: AiDomain[] = ["overview"],
) {
  const today = dateStrInTimezone(new Date(), timezone);
  const set = new Set(domains);
  if (set.has("all")) return (await buildUnifiedContext(supabase, userId, timezone)) + "\nDETAIL RETRIEVAL: Untuk angka/detail/modul yang tidak ada di snapshot ringkas, gunakan get_life_module_data/search_life_os atau tool modul yang sesuai.";
  const need = (d: AiDomain) => set.has(d) || set.has("overview");
  const memoryJob = set.has("memory") ? supabase.from("user_memories").select("category,memory_key,memory_value").eq("user_id", userId).eq("enabled", true).order("updated_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] });
  const projectJob = (set.has("tasks") || set.has("goals") || set.has("overview")) ? supabase.from("projects").select("id,name,status,target_date,goal_id").eq("user_id", userId).in("status", ["active", "paused"]).order("updated_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] });
  const taskJob = need("tasks") ? supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id").eq("user_id", userId).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(4) : Promise.resolve({ data: [] });
  const agendaJob = need("calendar") ? supabase.from("schedule_blocks").select("title,block_date,start_time,end_time,location,task_id,project_id").eq("user_id", userId).gte("block_date", today).order("block_date", { ascending: true }).order("start_time", { ascending: true }).limit(4) : Promise.resolve({ data: [] });
  const goalJob = need("goals") ? supabase.from("goals").select("id,title,progress,status,target_date,next_step").eq("user_id", userId).eq("status", "active").order("updated_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] });
  const financeJob = need("finance") ? Promise.all([
    supabase.from("expenses").select("amount,category,occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(8),
    supabase.from("incomes").select("amount,source,occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(5),
    supabase.from("subscriptions").select("name,amount,billing_cycle,next_billing_date,active").eq("user_id", userId).eq("active", true).order("next_billing_date", { ascending: true }).limit(5),
  ]) : Promise.resolve([{ data: [] }, { data: [] }, { data: [] }]);

  const vaultJob = set.has("vault") ? supabase.from("vault_items").select("title,item_type,content,tags,pinned,updated_at").eq("user_id", userId).order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] });
  const automationJob = set.has("automations") ? supabase.from("automations").select("name,trigger_type,trigger_config,action_type,enabled,last_run_at,last_result").eq("user_id", userId).order("created_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] });
  const decisionJob = need("decisions") ? supabase.from("decisions").select("title,review_date,outcome,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] });
  const habitJob = need("habits") ? Promise.all([
    supabase.from("habits").select("name,target_per_week").eq("user_id", userId).limit(6),
    supabase.from("habit_checkins").select("habit_id,checkin_date").eq("user_id", userId).gte("checkin_date", today)
  ]) : Promise.resolve([{ data: [] }, { data: [] }]);
  const snapshotJob = set.has("overview") ? Promise.all([
    supabase.from("pomodoro_sessions").select("focus_minutes").eq("user_id", userId).gte("started_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from("smart_inbox_items").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open"),
    supabase.from("habit_checkins").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("checkin_date", today),
  ]) : Promise.resolve([{ data: [] }, { count: 0 }, { count: 0 }]);

  const [memoryRes, projectRes, taskRes, agendaRes, goalRes, financeRes, vaultRes, automationRes, decisionRes, habitRes, snapshotRes] = await Promise.all([
    memoryJob,
    projectJob,
    taskJob,
    agendaJob,
    goalJob,
    financeJob,
    vaultJob,
    automationJob,
    decisionJob,
    habitJob,
    snapshotJob,
  ]);
  const lines: string[] = [];
  const memories = memoryRes.data ?? [];
  const projects = projectRes.data ?? [];
  const tasks = taskRes.data ?? [];
  const agenda = agendaRes.data ?? [];
  const goals = goalRes.data ?? [];

  if (memories.length) {
    lines.push("Memory aktif yang sengaja disimpan pengguna:");
    for (const m of memories) lines.push(`- ${m.memory_key}: ${m.memory_value}`);
  }
  if (projects.length) {
    lines.push("Project aktif:");
    for (const p of projects) lines.push(`- ${p.name} (${p.status})${p.target_date ? ` · target ${p.target_date}` : ""}`);
  }
  if (goals.length) {
    lines.push("Target aktif:");
    for (const g of goals) lines.push(`- ${g.title}: ${g.progress}%${g.target_date ? ` · target ${g.target_date}` : ""}${g.next_step ? ` · berikutnya: ${g.next_step}` : ""}`);
  }
  if (tasks.length) {
    lines.push("Tugas terbuka terdekat:");
    for (const t of tasks) lines.push(`- ${t.title}${t.due_at ? ` · ${t.due_at}` : ""}${t.priority ? ` · ${t.priority}` : ""}`);
  }
  if (agenda.length) {
    lines.push("Agenda terdekat:");
    for (const a of agenda) lines.push(`- ${a.block_date} ${String(a.start_time).slice(0,5)}-${String(a.end_time).slice(0,5)} · ${a.title}${a.location ? ` · ${a.location}` : ""}`);
  }
  if (set.has("vault") && (vaultRes.data ?? []).length) {
    lines.push("Vault relevan:");
    for (const v of vaultRes.data ?? []) lines.push(`- ${v.title} [${v.item_type}]${v.tags?.length ? ` · #${v.tags.join(" #")}` : ""}: ${(v.content || "").slice(0, 450)}`);
  }
  if (set.has("automations") && (automationRes.data ?? []).length) {
    lines.push("Automation aktif/tersimpan:");
    for (const a of automationRes.data ?? []) lines.push(`- ${a.name}: ${a.trigger_type} -> ${a.action_type} · ${a.enabled ? "aktif" : "mati"}${a.last_result ? ` · ${a.last_result}` : ""}`);
  }
  if (set.has("decisions") && (decisionRes.data ?? []).length) {
    lines.push("Jurnal keputusan terbaru:");
    for (const d of decisionRes.data ?? []) lines.push(`- ${d.title}${d.review_date ? ` · tinjau ${d.review_date}` : ""}${d.outcome ? ` · hasil: ${d.outcome}` : ""}`);
  }
  if (set.has("habits") && habitRes) {
    const [habits, checks] = habitRes as any[];
    if ((habits?.data ?? []).length) lines.push(`Rutinitas: ${(habits.data ?? []).slice(0,5).map((h:any)=>h.name).join(", ")} · check-in hari ini ${checks?.data?.length ?? 0}.`);
  }
  if (set.has("overview") && snapshotRes) {
    const [snapshotFocus, openInbox, checkedHabits] = snapshotRes as any[];
    const focus7d = (snapshotFocus?.data ?? []).reduce((sum: number, x: any) => sum + Number(x.focus_minutes || 0), 0);
    lines.push(`Snapshot lintas modul: fokus 7 hari ${focus7d} menit · ${openInbox?.count ?? 0} Inbox terbuka · ${(checkedHabits?.count ?? 0)} check-in rutinitas hari ini.`);
  }
  if (need("finance") && financeRes) {
    const [expenses, incomes, subscriptions] = financeRes;
    const expenseTotal = (expenses.data ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
    const incomeTotal = (incomes.data ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
    lines.push(`Keuangan (snapshot transaksi terbaru): masuk ${incomeTotal}, keluar ${expenseTotal}.`);
    if ((subscriptions.data ?? []).length) lines.push(`Langganan aktif terdekat: ${(subscriptions.data ?? []).map((s: any) => `${s.name} ${s.next_billing_date ?? ""}`).join("; ")}`);
  }
  return lines.length ? lines.join("\n").slice(0, 5200) : "Belum ada konteks terhubung yang relevan.";
}
