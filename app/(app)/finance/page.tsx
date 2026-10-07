"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CalendarRange,
  CircleDollarSign,
  PiggyBank,
  Plus,
  Search,
  Sparkles,
  Trash2,
  WalletCards,
  TrendingDown,
  TrendingUp,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SectionTitle, TextInput } from "@/components/ui";
import { previewPlainText } from "@/lib/text";
import { mutateEntity } from "@/lib/sync/client";

import { useLanguage } from "@/components/LanguageProvider";
import { documentLocale } from "@/lib/format";
import { formatDateTimeInTimezone } from "@/lib/date";
type Expense = {
  id: string;
  amount: number;
  category: string;
  note: string | null;
  occurred_at: string;
  account_id: string | null;
  version?: number;
  updated_at?: string;
};
type Income = {
  id: string;
  amount: number;
  source: string;
  note: string | null;
  occurred_at: string;
  account_id: string | null;
  version?: number;
  updated_at?: string;
};
type Budget = {
  id: string;
  category: string;
  limit_amount: number;
  period: string;
  spent: number;
  version?: number;
  updated_at?: string;
};
type Account = {
  id: string;
  name: string;
  starting_balance: number;
  current_balance?: number;
  account_type?: "bank" | "cash" | "ewallet" | "other";
  is_default?: boolean;
  version?: number;
  updated_at?: string;
};
type FinanceSummary = {
  month_income: number;
  month_expense: number;
  month_net: number;
  total_balance: number;
  categories: Array<{ category: string; amount: number }>;
  monthly: Array<{ k: string; label: string; income: number; expense: number; net: number }>;
  budgets: Array<{ id: string; spent: number }>;
};
type Sub = {
  id: string;
  name: string;
  amount: number;
  billing_cycle: string;
  active: boolean;
  next_billing_date: string | null;
  reminder_days?: number;
  service_url?: string | null;
  notes?: string | null;
  version?: number;
  updated_at?: string;
};
type Transfer = { id: string; amount: number; from_account_id: string; to_account_id: string; occurred_at: string };
function rupiah(n: number) {
  return new Intl.NumberFormat(documentLocale(), {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthStartDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function monthLabel(d: Date) {
  return d.toLocaleDateString(documentLocale(), { month: "long", year: "numeric" });
}
export default function FinancePage() {
  const { t: trn } = useLanguage();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"overview" | "transactions" | "budgets" | "accounts" | "subscriptions">("overview");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [q, setQ] = useState("");
  const [subForm, setSubForm] = useState({
    name: "",
    amount: "",
    billing_cycle: "monthly",
    next_billing_date: "",
    reminder_days: "7",
    service_url: "",
    notes: "",
  });
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [tx, setTx] = useState({ amount: "", label: "", note: "", account_id: "" });
  const [budget, setBudget] = useState({ category: "", limit: "", period: "monthly" });
  const [account, setAccount] = useState({
    name: "",
    balance: "",
    account_type: "bank" as "bank" | "cash" | "ewallet" | "other",
    is_default: false,
  });
  const [transfer, setTransfer] = useState({ amount: "", from_account_id: "", to_account_id: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [range, setRange] = useState(6);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
      setTimezone(profile?.timezone || "Asia/Jakarta");
      const [e, i, b, a, s, tr, summaryResponse] = await Promise.all([
        supabase
          .from("expenses")
          .select("id,amount,category,note,occurred_at,account_id,version,updated_at")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(600),
        supabase
          .from("incomes")
          .select("id,amount,source,note,occurred_at,account_id,version,updated_at")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(600),
        supabase.from("budgets").select("id,category,limit_amount,period,version,updated_at").eq("user_id", user.id),
        supabase
          .from("accounts")
          .select("id,name,starting_balance,account_type,is_default,version,updated_at")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at"),
        supabase
          .from("subscriptions")
          .select(
            "id,name,amount,billing_cycle,active,next_billing_date,reminder_days,service_url,notes,version,updated_at",
          )
          .eq("user_id", user.id)
          .eq("active", true)
          .order("next_billing_date", { ascending: true }),
        supabase
          .from("account_transfers")
          .select("id,amount,from_account_id,to_account_id,occurred_at")
          .eq("user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(600),
        fetch(`/api/finance/summary?range=${range}`, { cache: "no-store", credentials: "include" }),
      ]);
      const ex = (e.data as Expense[]) || [],
        inc = (i.data as Income[]) || [];
      setExpenses(ex);
      setIncomes(inc);
      const loadedAccounts = (a.data as Account[]) || [];
      setAccounts(loadedAccounts);
      setTx((prev) =>
        prev.account_id
          ? prev
          : { ...prev, account_id: loadedAccounts.find((x) => x.is_default)?.id || loadedAccounts[0]?.id || "" },
      );
      setTransfer((prev) => ({
        ...prev,
        from_account_id:
          prev.from_account_id || loadedAccounts.find((x) => x.is_default)?.id || loadedAccounts[0]?.id || "",
        to_account_id:
          prev.to_account_id ||
          loadedAccounts.find((x) => x.id !== (loadedAccounts.find((y) => y.is_default)?.id || loadedAccounts[0]?.id))
            ?.id ||
          "",
      }));
      setSubs((s.data as Sub[]) || []);
      setTransfers((tr.data as Transfer[]) || []);
      let summary: FinanceSummary | null = null;
      try {
        if (summaryResponse.ok) summary = (await summaryResponse.json())?.summary || null;
      } catch {}
      setFinanceSummary(summary);
      const budgetSpent = new Map<string, number>(
        (summary?.budgets || []).map((x) => [String(x.id), Number(x.spent || 0)]),
      );
      const bs = ((b.data as any[]) || []).map((x) => ({ ...x, spent: budgetSpent.get(String(x.id)) ?? 0 }));
      setBudgets(bs);
      setLoading(false);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (
      requested === "subscriptions" ||
      requested === "transactions" ||
      requested === "budgets" ||
      requested === "accounts" ||
      requested === "overview"
    )
      setTab(requested as any);
    void load();
  }, [searchParams, range]);
  async function uid() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(trn("Belum masuk"));
    return user.id;
  }
  async function addTx() {
    if (!tx.amount || !tx.label) return;
    const payload: any = { amount: Number(tx.amount), note: tx.note.trim() || null, account_id: tx.account_id || null };
    if (txType === "expense") payload.category = tx.label.trim();
    else payload.source = tx.label.trim();
    await mutateEntity({ entityType: txType === "expense" ? "expense" : "income", operation: "create", payload });
    setTx((v) => ({ ...v, amount: "", label: "", note: "" }));
    load();
  }
  async function addTransfer() {
    if (
      !transfer.amount ||
      !transfer.from_account_id ||
      !transfer.to_account_id ||
      transfer.from_account_id === transfer.to_account_id
    )
      return;
    await mutateEntity({
      entityType: "accountTransfer",
      operation: "create",
      payload: {
        amount: Number(transfer.amount),
        from_account_id: transfer.from_account_id,
        to_account_id: transfer.to_account_id,
        note: transfer.note.trim() || null,
      },
    });
    setTransfer((v) => ({ ...v, amount: "", note: "" }));
    load();
  }
  async function addBudget() {
    if (!budget.category || !budget.limit) return;
    await mutateEntity({
      entityType: "budget",
      operation: "create",
      payload: { category: budget.category.trim(), limit_amount: Number(budget.limit), period: budget.period },
    });
    setBudget({ category: "", limit: "", period: "monthly" });
    load();
  }
  async function addAccount() {
    if (!account.name.trim()) return;
    await mutateEntity({
      entityType: "account",
      operation: "create",
      payload: {
        name: account.name.trim(),
        starting_balance: Number(account.balance || 0),
        account_type: account.account_type,
        is_default: account.is_default,
      },
    });
    setAccount({ name: "", balance: "", account_type: "bank", is_default: false });
    load();
  }
  async function addSubscription() {
    if (!subForm.name.trim() || !subForm.amount) return;
    await mutateEntity({
      entityType: "subscription",
      operation: "create",
      payload: {
        name: subForm.name.trim(),
        amount: Number(subForm.amount),
        billing_cycle: subForm.billing_cycle,
        next_billing_date: subForm.next_billing_date || null,
        reminder_days: Number(subForm.reminder_days || 7),
        service_url: subForm.service_url.trim() || null,
        notes: subForm.notes.trim() || null,
        active: true,
      },
    });
    setSubForm({
      name: "",
      amount: "",
      billing_cycle: "monthly",
      next_billing_date: "",
      reminder_days: "7",
      service_url: "",
      notes: "",
    });
    load();
  }
  async function toggleSubscription(sub: Sub) {
    await mutateEntity({
      entityType: "subscription",
      operation: "update",
      entityId: sub.id,
      baseVersion: sub.version ?? null,
      clientUpdatedAt: sub.updated_at ?? null,
      payload: { active: !sub.active },
    });
    load();
  }
  async function deleteSubscription(id: string) {
    await mutateEntity({ entityType: "subscription", operation: "delete", entityId: id });
    load();
  }
  async function openSubscriptions() {
    setTab("subscriptions");
    window.history.replaceState(null, "", "/finance?tab=subscriptions");
  }
  async function recordSubscriptionCharge(sub: Sub) {
    const result = await mutateEntity({
      entityType: "expense",
      operation: "create",
      payload: {
        amount: Number(sub.amount),
        category: `Langganan · ${sub.name}`,
        note: `Pembayaran ${sub.billing_cycle === "yearly" ? "tahunan" : sub.billing_cycle === "weekly" ? "mingguan" : "bulanan"}.`,
        occurred_at: new Date().toISOString(),
        account_id: tx.account_id || null,
      },
    });
    if (result.ok) load();
  }
  async function del(table: string, id: string) {
    const map: Record<string, "expense" | "income" | "budget" | "account"> = {
      expenses: "expense",
      incomes: "income",
      budgets: "budget",
      accounts: "account",
    };
    const entityType = map[table];
    if (entityType) await mutateEntity({ entityType, operation: "delete", entityId: id });
    load();
  }
  const now = new Date();
  const start = monthStartDate(now).toISOString();
  const monthIncome = financeSummary
    ? Number(financeSummary.month_income)
    : incomes.filter((x) => x.occurred_at >= start).reduce((s, x) => s + Number(x.amount), 0);
  const monthExpense = financeSummary
    ? Number(financeSummary.month_expense)
    : expenses.filter((x) => x.occurred_at >= start).reduce((s, x) => s + Number(x.amount), 0);
  const monthNet = financeSummary ? Number(financeSummary.month_net) : monthIncome - monthExpense;
  const net = financeSummary
    ? Number(financeSummary.total_balance)
    : accounts.reduce(
        (sum, a) =>
          sum +
          Number(a.starting_balance) +
          incomes.filter((x) => x.account_id === a.id).reduce((s, x) => s + Number(x.amount), 0) -
          expenses.filter((x) => x.account_id === a.id).reduce((s, x) => s + Number(x.amount), 0) +
          transfers.filter((x) => x.to_account_id === a.id).reduce((s, x) => s + Number(x.amount), 0) -
          transfers.filter((x) => x.from_account_id === a.id).reduce((s, x) => s + Number(x.amount), 0),
        0,
      );
  const recurring = subs.reduce(
    (s, x) =>
      s +
      (x.billing_cycle === "yearly"
        ? Number(x.amount) / 12
        : x.billing_cycle === "weekly"
          ? (Number(x.amount) * 52) / 12
          : Number(x.amount)),
    0,
  );
  const upcomingSubscriptions = useMemo(() => subs.filter((s) => s.next_billing_date).slice(0, 5), [subs]);
  const savingRate = monthIncome > 0 ? Math.round((monthNet / monthIncome) * 100) : 0;
  const monthBuckets = useMemo(
    () =>
      financeSummary?.monthly?.length
        ? financeSummary.monthly
        : Array.from({ length: range }, (_, idx) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (range - 1 - idx), 1);
            const k = monthKey(d);
            const inc = incomes
              .filter((x) => monthKey(new Date(x.occurred_at)) === k)
              .reduce((s, x) => s + Number(x.amount), 0);
            const exp = expenses
              .filter((x) => monthKey(new Date(x.occurred_at)) === k)
              .reduce((s, x) => s + Number(x.amount), 0);
            return {
              k,
              label: d.toLocaleDateString(documentLocale(), { month: "short" }),
              income: inc,
              expense: exp,
              net: inc - exp,
            };
          }),
    [expenses, incomes, range, financeSummary],
  );
  const cats = useMemo(
    () =>
      financeSummary?.categories?.map((x) => [x.category, Number(x.amount)] as [string, number]) ||
      (() => {
        const m: Record<string, number> = {};
        expenses
          .filter((x) => x.occurred_at >= start)
          .forEach((x) => (m[x.category] = (m[x.category] || 0) + Number(x.amount)));
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
      })(),
    [expenses, start, financeSummary],
  );
  const txs = useMemo(
    () =>
      [
        ...expenses.map((x) => ({ ...x, type: "expense" as const, label: x.category })),
        ...incomes.map((x) => ({ ...x, type: "income" as const, label: x.source })),
      ]
        .filter((x) => !q || `${x.label} ${x.note || ""}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
    [expenses, incomes, q],
  );
  const maxBar = Math.max(1, ...monthBuckets.flatMap((x) => [x.income, x.expense]));
  const previousMonth = monthBuckets.length > 1 ? monthBuckets[monthBuckets.length - 2] : null;
  const expenseDelta =
    previousMonth && previousMonth.expense > 0
      ? Math.round(((monthExpense - previousMonth.expense) / previousMonth.expense) * 100)
      : null;
  const budgetRisks = budgets.filter((b) => {
    const pct = b.limit_amount ? Math.round((b.spent / Number(b.limit_amount)) * 100) : 0;
    return pct >= 80;
  });
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next30Subs = subs.filter((x) => {
    if (!x.next_billing_date) return false;
    const diff = (new Date(`${x.next_billing_date}T12:00:00`).getTime() - todayStart.getTime()) / 86400000;
    return diff >= 0 && diff <= 30;
  });
  const topCategory = cats[0]?.[0] || null;
  const financeSignal =
    monthIncome > 0 && monthExpense > monthIncome
      ? trn("Perlu perhatian")
      : budgetRisks.length > 0
        ? trn("Ada anggaran mendekati batas")
        : "Stabil";
  return (
    <div className="finance-page space-y-7 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-accent/10 blur-3xl animate-licia-float" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              <CircleDollarSign size={14} /> {trn("UANG PRIBADI")}
            </p>
            <h1 className="font-display text-3xl text-text">{trn("Keuangan")}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-textMuted">
              {trn("Ringkasan arus kas bulan ini")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl border border-border bg-bg px-3 py-2 text-xs text-textMuted">
              {monthLabel(now)}
            </span>
            <button
              type="button"
              onClick={() => setTab("transactions")}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-3.5 text-xs font-semibold text-white"
            >
              <Plus size={14} /> {trn("Transaksi")}
            </button>
            <button
              onClick={() => setRange((v) => (v === 6 ? 12 : 6))}
              className="min-h-11 rounded-xl border border-border bg-bg px-3 py-2 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"
            >
              {trn("Tren {range} bulan", { range })}
            </button>
          </div>
        </div>
      </header>
      <div
        className="finance-tabs sticky top-2 z-30 -mx-1 flex min-w-0 items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-surface/98 p-1 shadow-lg backdrop-blur-xl no-scrollbar sm:static sm:mx-0 sm:shadow-none"
        role="navigation"
        aria-label={trn("Bagian keuangan")}
      >
        {(
          [
            ["overview", "Ringkasan"],
            ["transactions", "Transaksi"],
            ["budgets", "Anggaran"],
            ["accounts", "Dompet"],
            ["subscriptions", "Langganan & Tagihan"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-current={tab === k ? "page" : undefined}
            onClick={() => setTab(k)}
            className={clsx(
              "min-h-11 shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              tab === k ? "bg-accent text-white shadow-sm" : "text-textMuted hover:bg-bg hover:text-text",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {loading ? (
        <div role="status" aria-live="polite">
          <Card>
            <div className="h-28 animate-licia-shimmer rounded-xl bg-bg" />
            <span className="sr-only">{trn("Memuat keuangan")}</span>
          </Card>
        </div>
      ) : loadError ? (
        <div role="alert">
          <Card className="border-danger/30">
            <p className="font-semibold text-text">{trn("Keuangan tidak dapat dimuat")}</p>
            <p className="mt-1 text-sm text-textMuted">{trn("Periksa koneksi lalu coba lagi.")}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              {trn("Coba lagi")}
            </button>
          </Card>
        </div>
      ) : tab === "overview" ? (
        <div className="space-y-5">
          <div className="finance-summary-row grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <WalletCards size={16} />
                  </span>
                  <span className="truncate text-xs text-textMuted">{trn("Total saldo")}</span>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-2 py-1 text-2xs font-bold",
                    net < 0 ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent",
                  )}
                >
                  {net < 0 ? trn("Minus") : trn("Tersedia")}
                </span>
              </div>
              <p
                className={clsx(
                  "mt-3 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[clamp(1.65rem,7vw,2.25rem)] leading-none tabular-nums",
                  net < 0 ? "text-danger" : "text-text",
                )}
              >
                {rupiah(net)}
              </p>
              <p className="mt-2 text-2xs leading-relaxed text-textMuted">
                {trn("Gabungan saldo semua dompet yang terhubung ke transaksi.")}
              </p>
            </Card>
            <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                  <TrendingUp size={15} />
                </span>
                <span className="min-w-0 text-xs leading-tight text-textMuted">{trn("Pemasukan bulan ini")}</span>
              </div>
              <p className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[clamp(1.25rem,5.8vw,1.75rem)] leading-none text-success tabular-nums">
                {rupiah(monthIncome)}
              </p>
              <p className="mt-2 text-2xs text-textMuted">
                {previousMonth
                  ? trn("{delta}% vs bulan lalu", {
                      delta: Math.round(
                        ((monthIncome - (previousMonth.income || 0)) /
                          Math.max(1, Math.abs(previousMonth.income || 0))) *
                          100,
                      ),
                    })
                  : trn("Uang masuk")}
              </p>
            </Card>
            <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                  <TrendingDown size={15} />
                </span>
                <span className="min-w-0 text-xs leading-tight text-textMuted">{trn("Pengeluaran bulan ini")}</span>
              </div>
              <p className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[clamp(1.25rem,5.8vw,1.75rem)] leading-none text-danger tabular-nums">
                {rupiah(monthExpense)}
              </p>
              <p className="mt-2 text-2xs text-textMuted">
                {expenseDelta === null ? trn("Uang keluar") : trn("{delta}% vs bulan lalu", { delta: expenseDelta })}
              </p>
            </Card>
            <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <PiggyBank size={15} />
                </span>
                <span className="text-xs text-textMuted">{trn("Rasio tabungan")}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p
                  className={clsx(
                    "font-display text-[clamp(1.5rem,6vw,2rem)] leading-none tabular-nums",
                    savingRate < 0 ? "text-danger" : "text-text",
                  )}
                >
                  {savingRate}%
                </p>
                <span className="text-right text-2xs leading-tight text-textMuted">{trn("dari pemasukan")}</span>
              </div>
              <p className="mt-2 text-2xs text-textMuted">
                {previousMonth
                  ? trn("vs bulan lalu {delta} poin", {
                      delta: Math.round(
                        savingRate -
                          (previousMonth.income > 0
                            ? ((previousMonth.income - previousMonth.expense) / previousMonth.income) * 100
                            : 0),
                      ),
                    })
                  : trn("Dari pemasukan bulan ini.")}
              </p>
            </Card>
          </div>

          {upcomingSubscriptions.length > 0 ? (
            <Card className="border-accent/15 bg-gradient-to-br from-accent/10 via-surface to-surface">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="rounded-2xl bg-accent/10 p-3 text-accent">
                    <CreditCard size={17} />
                  </span>
                  <div>
                    <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">
                      {trn("Komitmen berikutnya")}
                    </p>
                    <h2 className="mt-1 font-display text-lg text-text">
                      {trn("Langganan tetap bagian dari Keuangan")}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-textMuted">
                      {trn("Biaya rutin, tanggal tagihan, pengingat, dan arus kas berada dalam satu tempat.")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void openSubscriptions()}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-2xs font-semibold text-white"
                >
                  <Plus size={13} /> {trn("Kelola langganan")}
                </button>
              </div>
              {upcomingSubscriptions.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingSubscriptions.slice(0, 3).map((s) => (
                    <div key={s.id} className="rounded-2xl border border-border bg-bg p-3">
                      <div className="flex items-start gap-2">
                        <span className="rounded-xl bg-accent/10 p-2 text-accent">
                          <CalendarClock size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-semibold text-text">{s.name}</p>
                          <p className="mt-0.5 text-2xs text-textMuted">
                            {s.next_billing_date
                              ? new Date(`${s.next_billing_date}T12:00:00`).toLocaleDateString(documentLocale(), {
                                  day: "numeric",
                                  month: "short",
                                })
                              : trn("Tanggal belum diatur")}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-semibold text-text">{rupiah(Number(s.amount))}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          onClick={() => void recordSubscriptionCharge(s)}
                          className="min-h-9 text-2xs font-semibold text-accent hover:underline"
                        >
                          {trn("Catat pembayaran")}
                        </button>
                        {s.service_url && (
                          <a
                            href={s.service_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-2xs font-semibold text-textMuted hover:text-accent"
                          >
                            {trn("Layanan")} <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-bg p-3 text-2xs text-textMuted">
                  {trn(
                    "Belum ada langganan aktif. Tambahkan layanan rutin agar biaya berulang ikut masuk ke ringkasan keuangan.",
                  )}
                </div>
              )}
            </Card>
          ) : (
            <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarClock size={15} className="shrink-0 text-accent" />
                <span className="truncate text-xs font-semibold text-text">{trn("Belum ada langganan")}</span>
              </div>
              <button
                type="button"
                onClick={() => void openSubscriptions()}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-2xs font-semibold text-white"
              >
                <Plus size={13} />
                {trn("Tambah")}
              </button>
            </div>
          )}
          <Card className="border-accent/15 bg-gradient-to-br from-accent/5 via-surface to-surface p-4 sm:p-5 animate-licia-action-burst">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="rounded-2xl bg-accent/10 p-3 text-accent">
                  <Sparkles size={18} />
                </span>
                <div>
                  <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">
                    {trn("Finance Intelligence")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-text">{financeSignal}</p>
                  <p className="mt-1 max-w-2xl text-2xs leading-relaxed text-textMuted">
                    {monthIncome > 0 && monthExpense > monthIncome
                      ? trn(
                          "Pengeluaran bulan ini melebihi pemasukan. Pertimbangkan meninjau kategori terbesar dan komitmen rutin.",
                        )
                      : budgetRisks.length
                        ? trn(
                            "{budgetRisks_length} anggaran sudah mencapai 80% atau lebih dari batasnya. Periksa sebelum transaksi berikutnya.",
                            { budgetRisks_length: budgetRisks.length },
                          )
                        : trn(
                            "Belum ada sinyal kuat. Licia tetap memantau perubahan arus kas dan anggaran yang kamu catat.",
                          )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                <a
                  href="/chat?prompt=Analisis%20keuangan%20bulan%20ini%20berdasarkan%20pengeluaran%2C%20anggaran%2C%20dan%20langganan%20serta%20jelaskan%20evidence-nya"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white"
                >
                  <Sparkles size={12} /> {trn("Tanya Licia")}
                </a>
                <button
                  onClick={() => setTab("subscriptions")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:text-accent"
                >
                  <CalendarClock size={12} /> {trn("Komitmen rutin")}
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-4">
              <div className="rounded-xl bg-bg p-3">
                <p className="text-2xs text-textMuted">{trn("vs bulan lalu")}</p>
                <p
                  className={clsx(
                    "mt-1 text-sm font-semibold",
                    expenseDelta === null || expenseDelta <= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {expenseDelta === null
                    ? "—"
                    : trn("{v}{expenseDelta}%", { v: expenseDelta > 0 ? "+" : "", expenseDelta })}{" "}
                  <span className="text-2xs font-normal text-textMuted">{trn("pengeluaran")}</span>
                </p>
              </div>
              <div className="rounded-xl bg-bg p-3">
                <p className="text-2xs text-textMuted">{trn("Anggaran rawan")}</p>
                <p className="mt-1 text-sm font-semibold text-text">{budgetRisks.length}</p>
              </div>
              <div className="rounded-xl bg-bg p-3">
                <p className="text-2xs text-textMuted">{trn("Tagihan ≤30 hari")}</p>
                <p className="mt-1 text-sm font-semibold text-text">{next30Subs.length}</p>
              </div>
              <div className="rounded-xl bg-bg p-3">
                <p className="text-2xs text-textMuted">{trn("Kategori terbesar")}</p>
                <p className="mt-1 truncate text-sm font-semibold text-text">{topCategory || trn("Belum ada")}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setTab("transactions")}
                className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
              >
                {trn("Catat transaksi")}
              </button>
              <button
                onClick={() => void openSubscriptions()}
                className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
              >
                {trn("Tambah langganan")}
              </button>
              <button
                onClick={() => setTab("budgets")}
                className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
              >
                {trn("Atur anggaran")}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-2xs text-textMuted">
              <AlertTriangle
                size={11}
                className={financeSignal === "Perlu perhatian" ? "text-danger" : "text-accentSoft"}
              />{" "}
              {trn(
                "Insight ini berasal dari transaksi, anggaran, dan langganan yang sudah tercatat; bukan prediksi saldo di luar data.",
              )}
            </div>
          </Card>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <Card className="overflow-hidden p-4 sm:p-5">
              <SectionTitle action={<span className="text-2xs text-textMuted">{trn("Masuk vs keluar")}</span>}>
                {trn("Arus kas {range} bulan", { range })}
              </SectionTitle>
              <div className="overflow-x-auto">
                <div className="min-w-[560px] space-y-4">
                  {monthBuckets.map((m, i) => (
                    <div key={m.k} className="grid grid-cols-[52px_1fr_110px] items-center gap-3">
                      <span className="text-2xs font-semibold text-textMuted">{m.label}</span>
                      <div className="space-y-1">
                        <div className="flex h-3 overflow-hidden rounded-full bg-bg">
                          <div
                            className="h-full rounded-full bg-success transition-all duration-700"
                            style={{ width: `${Math.round((m.income / maxBar) * 100)}%` }}
                          />
                          <div
                            className="h-full rounded-full bg-danger/80 transition-all duration-700"
                            style={{ width: `${Math.round((m.expense / maxBar) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-2xs text-textMuted">
                          <span>{rupiah(m.income)}</span>
                          <span>{rupiah(m.expense)}</span>
                        </div>
                      </div>
                      <span
                        className={clsx("text-right text-2xs font-semibold", m.net < 0 ? "text-danger" : "text-text")}
                      >
                        {rupiah(m.net)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card>
              <SectionTitle>{trn("Snapshot cerdas")}</SectionTitle>
              <div className="space-y-2.5">
                {monthNet < 0 && (
                  <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-xs leading-relaxed text-text">
                    {trn(
                      "Pengeluaran bulan ini lebih besar dari pemasukan. Periksa kategori terbesar sebelum menambah komitmen baru.",
                    )}
                  </div>
                )}
                {recurring > 0 && (
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs uppercase tracking-wider text-textMuted">{trn("Komitmen rutin")}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-text">
                      {trn("{rupiah}/bulan", { rupiah: rupiah(Math.round(recurring)) })}
                    </p>
                    <p className="mt-1 text-2xs text-textMuted">{trn("Langganan aktif dihitung setara bulanan.")}</p>
                  </div>
                )}
                {cats[0] && (
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs uppercase tracking-wider text-textMuted">{trn("Kategori terbesar")}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-text">{cats[0][0]}</p>
                    <p className="mt-1 text-xs text-textMuted">
                      {trn("{rupiah} bulan ini", { rupiah: rupiah(cats[0][1]) })}
                    </p>
                  </div>
                )}
                <div className="rounded-xl border border-accent/15 bg-accent/5 p-3 text-xs leading-relaxed text-textMuted">
                  {trn(
                    "Data ini juga dipakai oleh Brief dan Analitik Pribadi supaya kamu tidak perlu menghitung ulang di banyak tempat.",
                  )}
                </div>
              </div>
            </Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <SectionTitle>{trn("Pola pengeluaran bulan ini")}</SectionTitle>
              {!cats.length ? (
                <EmptyState
                  examples={["beli kopi 25k", "bayar parkir 5rb"]}
                  exampleMode="task"
                  title={trn("Belum ada transaksi keluar")}
                  description={trn("Catat pengeluaran pertama untuk mulai membangun pola.")}
                />
              ) : (
                <div className="space-y-3">
                  {cats.slice(0, 8).map(([c, v], i) => (
                    <div key={c}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-text">
                          {i + 1}. {c}
                        </span>
                        <span className="shrink-0 font-semibold text-text">{rupiah(v)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-bg">
                        <div
                          className="h-full rounded-full bg-accent animate-licia-progress"
                          style={{ width: `${Math.max(7, Math.round((v / (cats[0]?.[1] || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <SectionTitle>{trn("Langganan aktif")}</SectionTitle>
              {subs.length ? (
                <div className="space-y-2">
                  {subs.slice(0, 7).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3 licia-focus-action transition hover:-translate-y-0.5"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-text">{s.name}</p>
                        <p className="text-2xs text-textMuted">
                          {s.next_billing_date
                            ? trn("berikutnya {toLocaleDateString}", {
                                toLocaleDateString: new Date(`${s.next_billing_date}T12:00:00`).toLocaleDateString(
                                  documentLocale(),
                                  { day: "numeric", month: "short" },
                                ),
                              })
                            : trn("tanggal belum diatur")}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-text">{rupiah(Number(s.amount))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-textMuted">{trn("Belum ada langganan aktif.")}</p>
              )}
            </Card>
            <Card>
              <SectionTitle>{trn("Transaksi terbesar")}</SectionTitle>
              {txs.slice(0, 6).length ? (
                <div className="space-y-2">
                  {txs.slice(0, 6).map((x) => (
                    <div key={`largest-${x.type}-${x.id}`} className="flex items-center gap-3 rounded-xl bg-bg p-3">
                      <div
                        className={clsx(
                          "rounded-lg p-2",
                          x.type === "income" ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                        )}
                      >
                        {x.type === "income" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-text">{x.label}</p>
                        <p className="text-2xs text-textMuted">
                          {formatDateTimeInTimezone(x.occurred_at, timezone).split(" pukul ")[0]}
                        </p>
                      </div>
                      <span
                        className={clsx(
                          "shrink-0 text-xs font-semibold",
                          x.type === "income" ? "text-success" : "text-danger",
                        )}
                      >
                        {x.type === "income" ? "+" : "-"}
                        {rupiah(Number(x.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-textMuted">{trn("Belum ada data.")}</p>
              )}
            </Card>
            <Card>
              <SectionTitle>{trn("Kesehatan keuangan")}</SectionTitle>
              <div className="space-y-3">
                <div className="rounded-xl bg-bg p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-textMuted">{trn("Pengeluaran / pemasukan")}</span>
                    <span className="font-semibold text-text">
                      {monthIncome > 0 ? Math.round((monthExpense / monthIncome) * 100) : 0}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-surface">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all duration-700",
                        monthIncome > 0 && monthExpense / monthIncome > 1 ? "bg-danger" : "bg-success",
                      )}
                      style={{ width: `${Math.min(100, monthIncome > 0 ? (monthExpense / monthIncome) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-2xs uppercase tracking-wider text-textMuted">{trn("Komitmen rutin")}</p>
                  <p className="mt-1 text-sm font-semibold text-text">
                    {trn("{rupiah}/bulan", { rupiah: rupiah(Math.round(recurring)) })}
                  </p>
                </div>
                <div className="rounded-xl border border-accent/15 bg-accent/5 p-3 text-2xs leading-relaxed text-textMuted">
                  {trn(
                    "Gunakan anggaran untuk memberi batas sebelum pengeluaran membesar. Saldo tiap dompet dihitung dari saldo awal dan transaksi yang tercatat.",
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : tab === "transactions" ? (
        <div className="space-y-5">
          <Card>
            <SectionTitle>{trn("Catat transaksi")}</SectionTitle>
            <p className="mb-3 text-xs text-textMuted">
              {trn(
                "Pilih dompet agar saldo rekening/e-wallet ikut berubah. Untuk transaksi tanpa dompet, pilih opsi tanpa dompet.",
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <label className="space-y-1.5 lg:col-span-1">
                <span className="text-2xs font-semibold text-textMuted">{trn("Jenis")}</span>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as any)}
                  className="min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text"
                >
                  <option value="expense">{trn("Keluar")}</option>
                  <option value="income">{trn("Masuk")}</option>
                </select>
              </label>
              <label className="space-y-1.5 lg:col-span-1">
                <span className="text-2xs font-semibold text-textMuted">{trn("Jumlah")}</span>
                <TextInput
                  type="number"
                  value={tx.amount}
                  onChange={(e) => setTx({ ...tx, amount: e.target.value })}
                  placeholder="0"
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <span className="text-2xs font-semibold text-textMuted">
                  {txType === "expense" ? trn("Kategori") : trn("Sumber")}
                </span>
                <TextInput
                  value={tx.label}
                  onChange={(e) => setTx({ ...tx, label: e.target.value })}
                  placeholder={txType === "expense" ? trn("Makan, transport…") : trn("Gaji, freelance…")}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <span className="text-2xs font-semibold text-textMuted">{trn("Catatan")}</span>
                <TextInput
                  value={tx.note}
                  onChange={(e) => setTx({ ...tx, note: e.target.value })}
                  placeholder={trn("Opsional")}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <span className="text-2xs font-semibold text-textMuted">{trn("Dompet")}</span>
                <select
                  value={tx.account_id}
                  onChange={(e) => setTx({ ...tx, account_id: e.target.value })}
                  className="min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text"
                >
                  <option value="">{trn("Tanpa dompet (saldo tidak berubah)")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end lg:col-span-1">
                <PrimaryButton onClick={addTx} className="w-full">
                  <Plus size={15} />
                  {trn("Simpan")}
                </PrimaryButton>
              </div>
            </div>
          </Card>
          <Card>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
              <TextInput
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={trn("Cari transaksi, kategori, atau catatan…")}
              />
            </div>
          </Card>
          {txs.length ? (
            <div className="grid gap-2">
              {txs.map((x) => (
                <Card key={`${x.type}-${x.id}`} className="p-3 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                    <div
                      className={clsx(
                        "shrink-0 rounded-xl p-2.5",
                        x.type === "income" ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                      )}
                    >
                      {x.type === "income" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
                      <p className="break-words text-sm font-semibold text-text">{x.label}</p>
                      <p className="mt-0.5 break-words text-2xs text-textMuted">
                        {formatDateTimeInTimezone(x.occurred_at, timezone)}
                        {x.note
                          ? trn(" · {previewPlainText}", { previewPlainText: previewPlainText(x.note, 120) })
                          : ""}
                      </p>
                    </div>
                    <p
                      className={clsx(
                        "min-w-0 flex-1 break-words pl-12 text-left text-sm font-semibold sm:flex-none sm:pl-0 sm:text-right",
                        x.type === "income" ? "text-success" : "text-danger",
                      )}
                    >
                      {x.type === "income" ? "+" : "-"}
                      {rupiah(Number(x.amount))}
                    </p>
                    <button
                      onClick={() => del(x.type === "income" ? "incomes" : "expenses", x.id)}
                      className="touch-target flex shrink-0 items-center justify-center rounded-lg text-textMuted hover:text-danger"
                      aria-label={trn("Hapus transaksi")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              examples={["makan siang 35k", "gaji masuk Rp 5jt"]}
              exampleMode="task"
              title={trn("Belum ada transaksi")}
              description={trn("Catat transaksi pertama untuk mulai membaca pola keuangan.")}
            />
          )}
        </div>
      ) : tab === "subscriptions" ? (
        <div className="space-y-5">
          <Card className="border-accent/15 bg-accent/5">
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-accent/10 p-3 text-accent">
                <CalendarClock size={17} />
              </span>
              <div>
                <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">{trn("Komitmen rutin")}</p>
                <h2 className="mt-1 font-display text-xl text-text">{trn("Langganan & Tagihan")}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-textMuted">
                  {trn("Semua langganan berada di Keuangan agar biaya rutin, tagihan, dan arus kas dibaca bersama.")}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle>{trn("Tambah langganan")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TextInput
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                placeholder={trn("Nama layanan")}
              />
              <TextInput
                type="number"
                value={subForm.amount}
                onChange={(e) => setSubForm({ ...subForm, amount: e.target.value })}
                placeholder={trn("Biaya")}
              />
              <select
                value={subForm.billing_cycle}
                onChange={(e) => setSubForm({ ...subForm, billing_cycle: e.target.value })}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text"
              >
                <option value="monthly">{trn("Bulanan")}</option>
                <option value="yearly">{trn("Tahunan")}</option>
                <option value="weekly">{trn("Mingguan")}</option>
              </select>
              <input
                type="date"
                value={subForm.next_billing_date}
                onChange={(e) => setSubForm({ ...subForm, next_billing_date: e.target.value })}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text"
              />
              <TextInput
                value={subForm.reminder_days}
                onChange={(e) => setSubForm({ ...subForm, reminder_days: e.target.value })}
                placeholder={trn("Pengingat (hari)")}
              />
              <TextInput
                value={subForm.service_url}
                onChange={(e) => setSubForm({ ...subForm, service_url: e.target.value })}
                placeholder={trn("URL layanan (opsional)")}
              />
              <TextInput
                value={subForm.notes}
                onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                placeholder={trn("Catatan (opsional)")}
              />
              <div className="flex items-end">
                <PrimaryButton onClick={addSubscription} className="w-full">
                  <Plus size={15} />
                  {trn("Simpan langganan")}
                </PrimaryButton>
              </div>
            </div>
          </Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {subs.length ? (
              subs.map((s) => (
                <Card key={s.id} className="relative overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-text">{s.name}</p>
                      <p className="mt-1 text-2xs text-textMuted">
                        {rupiah(Number(s.amount))} ·{" "}
                        {s.billing_cycle === "yearly"
                          ? trn("tahunan")
                          : s.billing_cycle === "weekly"
                            ? trn("mingguan")
                            : trn("bulanan")}
                      </p>
                      <p className="mt-1 text-2xs text-textMuted">
                        {trn("Tagihan berikutnya:")}{" "}
                        {s.next_billing_date
                          ? new Date(`${s.next_billing_date}T12:00:00`).toLocaleDateString(documentLocale(), {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : trn("belum diatur")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <button
                        onClick={() => void recordSubscriptionCharge(s)}
                        className="min-h-10 rounded-lg bg-accent/5 px-3 py-2 text-2xs font-semibold text-accent"
                      >
                        {trn("Catat")}
                      </button>
                      <button
                        onClick={() => void toggleSubscription(s)}
                        className="touch-target rounded-lg px-2 text-textMuted hover:text-accent"
                        title={s.active ? trn("Nonaktifkan") : trn("Aktifkan")}
                      >
                        {s.active ? trn("Aktif") : trn("Nonaktif")}
                      </button>
                      <button
                        onClick={() => void deleteSubscription(s.id)}
                        className="touch-target rounded-lg text-textMuted hover:text-danger"
                        aria-label={trn("Hapus langganan")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {(s.service_url || s.notes) && (
                    <div className="mt-3 rounded-xl bg-bg p-3 text-2xs leading-relaxed text-textMuted">
                      {s.service_url && (
                        <a
                          href={s.service_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block font-semibold text-accent hover:underline"
                        >
                          {trn("Buka layanan")}
                        </a>
                      )}
                      {s.notes && <p className={s.service_url ? "mt-1" : ""}>{s.notes}</p>}
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <EmptyState
                title={trn("Belum ada langganan")}
                description={trn("Tambahkan layanan rutin agar biaya berulang masuk ke ringkasan keuangan.")}
              />
            )}
          </div>
        </div>
      ) : tab === "budgets" ? (
        <div className="space-y-5">
          <Card>
            <SectionTitle>{trn("Buat anggaran")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_180px_auto]">
              <TextInput
                value={budget.category}
                onChange={(e) => setBudget({ ...budget, category: e.target.value })}
                placeholder={trn("Kategori")}
              />
              <TextInput
                type="number"
                value={budget.limit}
                onChange={(e) => setBudget({ ...budget, limit: e.target.value })}
                placeholder={trn("Batas rupiah")}
              />
              <select
                value={budget.period}
                onChange={(e) => setBudget({ ...budget, period: e.target.value })}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text"
              >
                <option value="monthly">{trn("Bulanan")}</option>
                <option value="weekly">{trn("Mingguan")}</option>
              </select>
              <PrimaryButton onClick={addBudget}>
                <Plus size={15} />
                {trn("Tambah")}
              </PrimaryButton>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {budgets.map((b) => {
              const pct = b.limit_amount ? Math.round((b.spent / Number(b.limit_amount)) * 100) : 0;
              return (
                <Card key={b.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-text">{b.category}</p>
                      <p className="mt-1 break-words text-xs text-textMuted">
                        {trn("{rupiah} dari {rupiah2} ·", {
                          rupiah: rupiah(b.spent),
                          rupiah2: rupiah(Number(b.limit_amount)),
                        })}{" "}
                        {b.period === "weekly" ? trn("mingguan") : trn("bulanan")}
                      </p>
                    </div>
                    <button
                      onClick={() => del("budgets", b.id)}
                      className="touch-target text-textMuted hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all duration-700",
                        pct >= 100 ? "bg-danger" : "bg-accent",
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-2xs text-textMuted">
                    <span>{trn("{pct}% terpakai", { pct })}</span>
                    <span>{pct >= 100 ? trn("Melewati batas") : trn("Masih tersedia")}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <Card>
            <SectionTitle>{trn("Tambah dompet")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
              <TextInput
                value={account.name}
                onChange={(e) => setAccount({ ...account, name: e.target.value })}
                placeholder={trn("Bank Mandiri, GoPay, Tunai…")}
              />
              <TextInput
                type="number"
                value={account.balance}
                onChange={(e) => setAccount({ ...account, balance: e.target.value })}
                placeholder={trn("Saldo awal")}
              />
              <select
                value={account.account_type}
                onChange={(e) => setAccount({ ...account, account_type: e.target.value as any })}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text"
              >
                <option value="bank">{trn("Bank")}</option>
                <option value="cash">{trn("Tunai")}</option>
                <option value="ewallet">{trn("E-Wallet")}</option>
                <option value="other">{trn("Lainnya")}</option>
              </select>
              <PrimaryButton onClick={addAccount}>
                <Plus size={15} />
                {trn("Tambah")}
              </PrimaryButton>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-textMuted">
              <input
                type="checkbox"
                checked={account.is_default}
                onChange={(e) => setAccount({ ...account, is_default: e.target.checked })}
              />{" "}
              {trn("Jadikan dompet utama")}
            </label>
          </Card>
          <Card>
            <SectionTitle>{trn("Pindah saldo")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                value={transfer.from_account_id}
                onChange={(e) => setTransfer({ ...transfer, from_account_id: e.target.value })}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text"
              >
                <option value="">{trn("Dari dompet…")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={transfer.to_account_id}
                onChange={(e) => setTransfer({ ...transfer, to_account_id: e.target.value })}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text"
              >
                <option value="">{trn("Ke dompet…")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <TextInput
                type="number"
                value={transfer.amount}
                onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
                placeholder={trn("Jumlah transfer")}
              />
              <PrimaryButton onClick={addTransfer}>
                <ArrowUpRight size={15} />
                {trn("Pindahkan")}
              </PrimaryButton>
            </div>
            <TextInput
              className="mt-3"
              value={transfer.note}
              onChange={(e) => setTransfer({ ...transfer, note: e.target.value })}
              placeholder={trn("Catatan transfer (opsional)")}
            />
          </Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => {
              const bal =
                Number(a.starting_balance) +
                incomes.filter((x) => x.account_id === a.id).reduce((s, x) => s + Number(x.amount), 0) -
                expenses.filter((x) => x.account_id === a.id).reduce((s, x) => s + Number(x.amount), 0) +
                transfers.filter((x) => x.to_account_id === a.id).reduce((s, x) => s + Number(x.amount), 0) -
                transfers.filter((x) => x.from_account_id === a.id).reduce((s, x) => s + Number(x.amount), 0);
              const typeLabel = { bank: "Bank", cash: "Tunai", ewallet: "E-Wallet", other: "Lainnya" }[
                a.account_type || "other"
              ];
              return (
                <Card key={a.id} className="relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-accent/10 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold text-text">{a.name}</p>
                        {a.is_default && (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-2xs font-semibold text-accent">
                            {trn("Utama")}
                          </span>
                        )}
                        <span className="rounded-full border border-border px-2 py-0.5 text-2xs text-textMuted">
                          {typeLabel}
                        </span>
                      </div>
                      <p
                        className={clsx(
                          "mt-2 break-words font-display text-2xl",
                          bal < 0 ? "text-danger" : "text-accent",
                        )}
                      >
                        {rupiah(bal)}
                      </p>
                      <p className="mt-1 text-2xs text-textMuted">
                        {trn("Saldo akan berubah otomatis saat transaksi dikaitkan ke dompet ini.")}
                      </p>
                    </div>
                    <button
                      onClick={() => del("accounts", a.id)}
                      className="touch-target shrink-0 text-textMuted hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
          {!accounts.length && (
            <EmptyState
              title={trn("Belum ada dompet")}
              description={trn("Tambahkan rekening, e-wallet, atau uang tunai untuk memisahkan saldo.")}
            />
          )}
        </div>
      )}
    </div>
  );
}
