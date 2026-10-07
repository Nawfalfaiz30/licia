import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const errors = [];
const expect = (name, ok) => {
  if (!ok) errors.push(name);
};

const today = read("app/(app)/today/page.tsx");
expect("today schedule is filtered by exact block_date", today.includes('eq("block_date",today)'));
expect(
  "today no longer loads all schedule blocks",
  !today.includes(
    'select("id,title,start_time,end_time,location,description,project_id,task_id").eq("user_id",user.id).order("start_time")',
  ),
);

const dashboard = read("app/(app)/dashboard/page.tsx");
expect("dashboard has varied greeting pool", dashboard.includes("greetingPool"));
expect("dashboard top overview", dashboard.includes("dashboard-top-overview"));
expect("dashboard shows today's schedule", dashboard.includes("Jadwal hari ini"));
expect("dashboard shows finance", dashboard.includes("Keuangan"));
expect("dashboard shows goals & projects", dashboard.includes("Target & proyek"));
expect("dashboard no action plan center", !dashboard.includes("ActionPlanCenter"));
expect("dashboard no life copilot card", !dashboard.includes("LifeCopilotCard"));
expect("dashboard no AI mode guide", !dashboard.includes("AIModeGuide"));

const nav = read("components/layout/nav-items.ts");
expect("unified target/project nav exists", nav.includes('item("/goals-projects", "Target & Proyek"'));
expect("separate target nav removed", !nav.includes('item("/goals", "Target"'));
expect("separate project nav removed", !nav.includes('item("/projects", "Proyek"'));

const gp = read("app/(app)/goals-projects/page.tsx");
expect(
  "unified workspace has tabs",
  gp.includes('tab==="all"') && gp.includes('tab==="goals"') && gp.includes('tab==="projects"'),
);
expect("unified workspace creates goals", gp.includes('entityType:"goal",operation:"create"'));
expect("unified workspace creates projects", gp.includes('entityType:"project",operation:"create"'));

const notice = read("components/intelligence/NotificationCenter.tsx");
expect("notification panel opaque class", notice.includes("bg-surface shadow-2xl"));
const css = read("app/globals.css");
expect("notification panel solid background", css.includes("background: var(--surface) !important"));
expect("notification panel forced opacity", css.includes("opacity: 1 !important"));

if (errors.length) {
  console.error("V39 TEST FAILED");
  errors.forEach((e) => console.error("-", e));
  process.exit(1);
}
console.log("Licia V39 UX regression tests OK —", errors.length === 0 ? "all checks passed" : "issues found");
