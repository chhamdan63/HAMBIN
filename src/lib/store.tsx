/* ------------------------------------------------------------------ */
/*  Central store — the in-browser equivalent of the Laravel service   */
/*  container: session, roles/permissions, transactional actions with  */
/*  audit trail, and pure selectors for ledgers, profit & dashboards.  */
/*  Money values flow through money.ts (DECIMAL(18,2) semantics).      */
/* ------------------------------------------------------------------ */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AuditEntry, Client, CompanySettings, Currency, DB, ExchangeRate, Expense, Invoice,
  LedgerAdjustment, Notice, Order, OrderItem, Payment, PaymentMethod, PaymentType, Product,
  Quotation, Role, Shipment, ShipmentStatus, SourcingRequest, Supplier, SupplierQuote, User, Category,
} from "./types";
import { buildSeed } from "./seed";
import { nextSeq, padSeq, r2, sub, sum, todayISO, daysAhead, uid } from "./money";
import { supabase } from "./supabase";

export const STORAGE_KEY = "";

/* ---------------- Supabase persistence layer ---------------- */

let __sbAvailable: boolean | null = null;
let __sbLastErrorMsg: string = "";
let __sbSyncTimer: number | null = null;
let __sbPendingSync = false;
let __sbLastErrorAt = 0;
let __sbLastSuccessAt = 0;
let __sbConsecutiveFailures = 0;
let __sbSavedAt = 0;

export const SUPABASE_STATE_ID = "main";

async function supabaseAvailable(forceCheck = false): Promise<boolean> {
  if (!forceCheck && __sbAvailable !== null) return __sbAvailable;
  try {
    if (!supabase) {
      __sbLastErrorMsg = "Supabase client is not initialized — check .env URL and key";
      __sbAvailable = false;
      return false;
    }
    const sbUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL ?? "";
    const sbKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ?? "";
    if (!sbUrl || !sbKey) {
      __sbLastErrorMsg = "Missing .env — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY";
      __sbAvailable = false;
      return false;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const { data, error } = await supabase
      .from("hambin_state")
      .select("id")
      .eq("id", SUPABASE_STATE_ID)
      .limit(1)
      .abortSignal(ctrl.signal);
    clearTimeout(t);
    if (error) {
      const code = (error as any)?.code;
      const hint = (error as any)?.hint;
      const detail = (error as any)?.details || (error as any)?.message || String(error);
      let human = detail;
      if (code === "42501" || /policy|permission|row level/i.test(detail + hint || "")) human = "Row Level Security blocks this query — add an RLS policy in Supabase → Authentication → Policies.";
      else if (code === "42P01" || /relation.*does not exist/i.test(detail || "")) human = "Table 'hambin_state' not found in Supabase. Run the CREATE TABLE SQL from Step 2 in the setup guide.";
      else if (/Invalid|JWT|API key|signature/i.test(detail + sbKey || "")) human = "VITE_SUPABASE_ANON_KEY is invalid. Copy the 'anon public' JWT from Supabase → Project Settings → API (do NOT use service_role or sb_publishable_ keys).";
      else if (/Failed to fetch|NetworkError|ECONNREFUSED|aborted|timeout/i.test(detail || "")) human = "Network error — check internet / firewall / Supabase project URL is correct & reachable.";
      __sbLastErrorMsg = `${code ? code + ": " : ""}${human}${hint ? " — " + hint : ""}`;
      console.warn("[supabase] available() failed:", error, "human:", __sbLastErrorMsg);
      __sbAvailable = false;
      return false;
    }
    if (!data) {
      __sbLastErrorMsg = "Unexpected empty response from Supabase";
      __sbAvailable = false;
      return false;
    }
    __sbLastErrorMsg = "";
    __sbAvailable = true;
    return true;
  } catch (e: any) {
    const msg = String(e?.message || e?.name || e || "Unknown error");
    let human = msg;
    if (/aborted|timeout/i.test(msg)) human = "Network timed out — internet slow or Supabase not reachable";
    else if (/fetch|network/i.test(msg)) human = "Network error — cannot reach Supabase (check URL, internet, CORS)";
    __sbLastErrorMsg = human;
    console.warn("[supabase] available() threw:", msg);
    __sbAvailable = false;
    return false;
  }
}

function supabaseLastError(): string { return __sbLastErrorMsg; }

async function supabaseLoad(): Promise<DB | null> {
  if (!(await supabaseAvailable(true))) return null;
  try {
    const { data, error } = await supabase
      .from("hambin_state")
      .select("data, schema_version")
      .eq("id", SUPABASE_STATE_ID)
      .limit(1)
      .maybeSingle();
    if (error) { console.warn("[supabase] load error:", error); return null; }
    if (!data) { /* row missing — we'll create it on first save */ return null; }
    const rawData: any = (data as any)?.data;
    if (!rawData || typeof rawData !== "object") return null;
    if (Array.isArray(rawData.clients)) {
      const seed = buildSeed();
      return normalizeDb(rawData as Partial<DB>, seed);
    }
    return null;
  } catch (e: any) {
    console.warn("[supabase] load threw:", e);
    return null;
  }
}

function scheduleSupabaseSync(db: DB, toastFn?: (m: string, k?: any) => void) {
  __sbPendingSync = true;
  if (__sbSyncTimer) window.clearTimeout(__sbSyncTimer);
  __sbSyncTimer = window.setTimeout(() => {
    __sbPendingSync = false;
    (async () => {
      if (!(await supabaseAvailable())) {
        if (toastFn) {
          const now = Date.now();
          if (now - __sbLastErrorAt > 20000) {
            __sbLastErrorAt = now;
            const extra = supabaseLastError() ? ` · ${supabaseLastError()}` : "";
            toastFn(
              `Cannot save to Supabase — changes queued in memory only (will retry in seconds).${extra}`,
              "warning"
            );
          }
        }
        __sbConsecutiveFailures++;
        return;
      }
      try {
        const clean = JSON.parse(JSON.stringify(db));
        const { error } = await supabase
          .from("hambin_state")
          .upsert(
            { id: SUPABASE_STATE_ID, data: clean, schema_version: 4 },
            { onConflict: "id" }
          );
        if (error) throw error;
        __sbConsecutiveFailures = 0;
        __sbLastSuccessAt = Date.now();
        __sbSavedAt = __sbLastSuccessAt;
      } catch (e: any) {
        __sbConsecutiveFailures++;
        const now = Date.now();
        const msg = String(e?.message ?? e ?? "Unknown error");
        console.warn("[supabase] sync failed:", msg);
        if (toastFn && (now - __sbLastErrorAt > 8000 || __sbConsecutiveFailures <= 2)) {
          __sbLastErrorAt = now;
          toastFn(`Could not save to Supabase. ${msg}`, "error");
        }
      }
    })();
  }, 900);
}

export async function initDatabaseFromAPI(): Promise<void> {
  if (!(await supabaseAvailable(true))) return;
  const seed = buildSeed();
  const { data } = await supabase
    .from("hambin_state")
    .select("id")
    .eq("id", SUPABASE_STATE_ID)
    .limit(1)
    .maybeSingle();
  if (!data) {
    await supabase
      .from("hambin_state")
      .insert({ id: SUPABASE_STATE_ID, data: seed as any, schema_version: 4 });
  }
}
export type ToastKind = "success" | "error" | "info" | "warning";
export interface Toast { id: string; kind: ToastKind; msg: string; }
export interface Route { page: string; id?: string; carry?: unknown; }

/* ---------------- permissions ---------------- */
type Level = "full" | "view" | "none";
const ACCESS: Record<Role, Record<string, Level>> = {
  superadmin: { dashboard: "full", clients: "full", suppliers: "full", products: "full", sourcing: "full", costing: "full", quotations: "full", orders: "full", shipments: "full", invoices: "full", finance: "full", reports: "full", settings: "full" },
  admin:      { dashboard: "full", clients: "full", suppliers: "full", products: "full", sourcing: "full", costing: "full", quotations: "full", orders: "full", shipments: "full", invoices: "full", finance: "full", reports: "full", settings: "full" },
  sales:      { dashboard: "full", clients: "full", suppliers: "full", products: "full", sourcing: "full", costing: "full", quotations: "full", orders: "full", shipments: "view", invoices: "view", finance: "none", reports: "view", settings: "none" },
  finance:    { dashboard: "full", clients: "view", suppliers: "view", products: "view", sourcing: "none", costing: "view", quotations: "view", orders: "view", shipments: "view", invoices: "full", finance: "full", reports: "full", settings: "none" },
  viewer:     { dashboard: "view", clients: "view", suppliers: "view", products: "view", sourcing: "view", costing: "view", quotations: "view", orders: "view", shipments: "view", invoices: "view", finance: "view", reports: "view", settings: "view" },
};
export const ROLE_LABEL: Record<Role, string> = { superadmin: "Super Admin", admin: "Admin", sales: "Sales / Sourcing", finance: "Finance", viewer: "Viewer" };

/* ---------------- pure selectors ---------------- */
export const currentRate = (db: DB, ccy: Currency): number => {
  if (ccy === "PKR") return 1;
  const list = db.exchangeRates.filter((x) => x.currency === ccy).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  const eff = list.find((x) => x.effectiveDate <= todayISO());
  return (eff ?? list[0])?.rateToPkr ?? 0;
};

export interface LedgerRow {
  id: string; date: string; ref: string; description: string;
  debit: number; credit: number; balance: number; kind: string;
  foreign?: { amount: number; currency: string };
}

export function clientLedgerRows(db: DB, clientId: string): LedgerRow[] {
  const c = db.clients.find((x) => x.id === clientId);
  const rows: Omit<LedgerRow, "balance">[] = [];
  if (c && c.openingBalance !== 0) rows.push({ id: `op-${clientId}`, date: c.createdAt.slice(0, 10), ref: "OPENING", description: "Opening balance", debit: Math.max(0, c.openingBalance), credit: Math.max(0, -c.openingBalance), kind: "opening" });
  db.invoices.filter((i) => i.clientId === clientId && !i.void).forEach((i) =>
    rows.push({ id: `inv-${i.id}`, date: i.date, ref: i.number, description: `Invoice raised`, debit: i.grandTotalPkr, credit: 0, kind: "invoice" }));
  db.payments.filter((p) => p.partyKind === "client" && p.partyId === clientId && !p.void).forEach((p) => {
    const refund = p.type === "Refund";
    rows.push({ id: `pay-${p.id}`, date: p.date, ref: p.number, description: `${p.type}${p.reference ? ` · ${p.reference}` : ""}`, debit: refund ? p.amountPkr : 0, credit: refund ? 0 : p.amountPkr, kind: "payment" });
  });
  db.adjustments.filter((a) => a.partyKind === "client" && a.partyId === clientId).forEach((a) =>
    rows.push({ id: `adj-${a.id}`, date: a.date, ref: "ADJUSTMENT", description: a.description, debit: a.debitPkr, credit: a.creditPkr, kind: "adjustment" }));
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let bal = 0;
  return rows.map((r) => { bal = r2(bal + r.debit - r.credit); return { ...r, balance: bal }; });
}
export const clientOutstanding = (db: DB, clientId: string): number => {
  const rows = clientLedgerRows(db, clientId);
  return rows.length ? rows[rows.length - 1].balance : 0;
};

export function supplierLedgerRows(db: DB, supplierId: string): LedgerRow[] {
  const rows: Omit<LedgerRow, "balance">[] = [];
  db.orders.filter((o) => o.status !== "Draft" && o.status !== "Cancelled").forEach((o) => {
    const items = o.items.filter((i) => i.supplierId === supplierId);
    if (!items.length) return;
    const byCcy = new Map<Currency, number>();
    items.forEach((i) => byCcy.set(i.snapshot.currency, r2((byCcy.get(i.snapshot.currency) ?? 0) + i.snapshot.qty * i.snapshot.unitPrice)));
    const pkr = r2(items.reduce((a, i) => a + i.snapshot.productCostPkr, 0));
    const foreignDesc = [...byCcy.entries()].map(([c, v]) => `${c} ${v.toLocaleString()}`).join(" + ");
    rows.push({ id: `po-${o.id}-${supplierId}`, date: o.date, ref: o.number, description: `Purchase order · ${foreignDesc}`, debit: pkr, credit: 0, kind: "purchase", foreign: { amount: [...byCcy.values()][0] ?? 0, currency: [...byCcy.keys()][0] ?? "" } });
  });
  db.payments.filter((p) => p.partyKind === "supplier" && p.partyId === supplierId && !p.void).forEach((p) =>
    rows.push({ id: `pay-${p.id}`, date: p.date, ref: p.number, description: `${p.type}${p.reference ? ` · ${p.reference}` : ""}`, debit: 0, credit: p.amountPkr, kind: "payment", foreign: p.currency !== "PKR" ? { amount: p.amount, currency: p.currency } : undefined }));
  db.adjustments.filter((a) => a.partyKind === "supplier" && a.partyId === supplierId).forEach((a) =>
    rows.push({ id: `adj-${a.id}`, date: a.date, ref: "ADJUSTMENT", description: a.description, debit: a.debitPkr, credit: a.creditPkr, kind: "adjustment" }));
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let bal = 0;
  return rows.map((r) => { bal = r2(bal + r.debit - r.credit); return { ...r, balance: bal }; });
};
export const supplierOutstanding = (db: DB, supplierId: string): number => {
  const rows = supplierLedgerRows(db, supplierId);
  return rows.length ? rows[rows.length - 1].balance : 0;
};

/* ---------------- order / invoice math ---------------- */
export const orderRevenue = (o: Order): number => sum(o.items, (i) => i.snapshot.sellingPricePkr);
export interface OrderTotals {
  revenue: number; productCost: number; china: number; freight: number; customs: number;
  clearance: number; local: number; other: number; landed: number; grossProfit: number;
  marginPct: number; weightKg: number; cbm: number;
}
export function orderTotals(o: Order): OrderTotals {
  const s = (f: (i: OrderItem) => number) => sum(o.items, f);
  const revenue = s((i) => i.snapshot.sellingPricePkr);
  const landed = s((i) => i.snapshot.landedCostPkr);
  const grossProfit = sub(revenue, landed);
  return {
    revenue,
    productCost: s((i) => i.snapshot.productCostPkr),
    china: s((i) => i.snapshot.chinaTotal),
    freight: s((i) => i.snapshot.intlFreightPkr),
    customs: s((i) => i.snapshot.customsTotal),
    clearance: s((i) => i.snapshot.clearanceTotal + i.snapshot.localTotal),
    local: s((i) => i.snapshot.localTotal),
    other: s((i) => i.snapshot.otherTotal),
    landed, grossProfit,
    marginPct: revenue > 0 ? r2((grossProfit / revenue) * 100) : 0,
    weightKg: s((i) => i.snapshot.weightKg), cbm: s((i) => i.snapshot.cbm),
  };
}
export const invoicePaidAmount = (db: DB, invoiceId: string): number =>
  sum(db.payments.filter((p) => p.invoiceId === invoiceId && !p.void), (p) => p.amountPkr);
export const invoiceStatus = (inv: Invoice, paid: number): { label: string; tone: "ok" | "warn" | "bad" | "muted" } => {
  if (inv.void) return { label: "Void", tone: "muted" };
  if (paid >= inv.grandTotalPkr - 0.5) return { label: "Paid", tone: "ok" };
  if (paid > 0) return { label: "Partially Paid", tone: "warn" };
  if (inv.dueDate < todayISO()) return { label: "Overdue", tone: "bad" };
  return { label: "Unpaid", tone: "warn" };
};
export const orderPaidPkr = (db: DB, orderId: string): number =>
  sum(db.payments.filter((p) => p.partyKind === "client" && p.orderId === orderId && !p.void && p.type !== "Refund"), (p) => p.amountPkr);

/* ---------------- dashboard aggregates ---------------- */
export interface DashStats {
  revenue: number; landed: number; gross: number; expenses: number; netProfit: number;
  receivables: number; payables: number;
  orderCount: number; pendingOrders: number; deliveredOrders: number; activeShipments: number;
  months: { key: string; revenue: number; cost: number; profit: number }[];
  topClients: { name: string; revenue: number; profit: number }[];
  shipmentsByStatus: { name: string; value: number }[];
  expenseByCategory: { name: string; value: number }[];
  overdueInvoices: Invoice[];
}
export function dashStats(db: DB): DashStats {
  const live = db.orders.filter((o) => o.status !== "Draft" && o.status !== "Cancelled");
  const revenue = sum(live, orderRevenue);
  const landed = sum(live, (o) => orderTotals(o).landed);
  const gross = sub(revenue, landed);
  const expenses = sum(db.expenses, (e) => e.amountPkr);
  const receivables = r2(db.clients.reduce((a, c) => a + Math.max(0, clientOutstanding(db, c.id)), 0));
  const payables = r2(db.suppliers.reduce((a, s) => a + Math.max(0, supplierOutstanding(db, s.id)), 0));

  const keys: string[] = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); keys.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); }
  const months = keys.map((key) => {
    const os = live.filter((o) => o.date.slice(0, 7) === key);
    return { key, revenue: sum(os, orderRevenue), cost: sum(os, (o) => orderTotals(o).landed), profit: sum(os, (o) => orderTotals(o).grossProfit) };
  });
  const topClients = db.clients.map((c) => {
    const os = live.filter((o) => o.clientId === c.id);
    return { name: c.company, revenue: sum(os, orderRevenue), profit: sum(os, (o) => orderTotals(o).grossProfit) };
  }).filter((x) => x.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const shipCount = new Map<string, number>();
  db.shipments.forEach((s) => shipCount.set(s.status, (shipCount.get(s.status) ?? 0) + 1));
  const expCat = new Map<string, number>();
  db.expenses.forEach((e) => expCat.set(e.category, r2((expCat.get(e.category) ?? 0) + e.amountPkr)));
  return {
    revenue, landed, gross, expenses, netProfit: sub(gross, expenses), receivables, payables,
    orderCount: live.length,
    pendingOrders: db.orders.filter((o) => ["Draft", "Confirmed", "Supplier Ordered", "China Warehouse", "Ready for Shipment"].includes(o.status)).length,
    deliveredOrders: db.orders.filter((o) => ["Delivered", "Completed"].includes(o.status)).length,
    activeShipments: db.shipments.filter((s) => s.status !== "Delivered").length,
    months, topClients,
    shipmentsByStatus: [...shipCount.entries()].map(([name, value]) => ({ name, value })),
    expenseByCategory: [...expCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    overdueInvoices: db.invoices.filter((i) => !i.void && i.dueDate < todayISO() && invoicePaidAmount(db, i.id) < i.grandTotalPkr - 0.5),
  };
}

/* ---------------- context ---------------- */
export interface ConfirmOpts { title: string; message: string; danger?: boolean; confirmLabel?: string; }
interface StoreCtx {
  db: DB; user: User | null; route: Route;
  toasts: Toast[]; toast: (msg: string, kind?: ToastKind) => void; dismissToast: (id: string) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  confirmState: (ConfirmOpts & { open: boolean }) ; resolveConfirm: (ok: boolean) => void;
  nav: (page: string, id?: string, carry?: unknown) => void;
  can: (module: string, action?: "view" | "edit") => boolean;
  login: (email: string, password: string) => boolean; logout: () => void;
  resetDemo: () => void;
  replaceDb: (d: DB) => void;
  saveClient: (c: Client) => string; deleteClient: (id: string) => void;
  saveSupplier: (s: Supplier) => string; deleteSupplier: (id: string) => void;
  saveCategory: (c: Category) => void; deleteCategory: (id: string) => void;
  saveProduct: (p: Product) => string; deleteProduct: (id: string) => void;
  saveRate: (r: ExchangeRate) => void; deleteRate: (id: string) => void;
  saveSourcing: (s: SourcingRequest) => void; deleteSourcing: (id: string) => void;
  saveQuote: (q: SupplierQuote) => void; deleteQuote: (id: string) => void;
  saveQuotation: (q: Quotation) => string; setQuotationStatus: (id: string, st: Quotation["status"]) => void;
  convertQuotationToOrder: (qtId: string) => string | null;
  saveOrder: (o: Order) => string; setOrderStatus: (id: string, st: Order["status"]) => void; cancelOrder: (id: string) => void;
  addShipment: (s: Shipment) => string; setShipmentStatus: (id: string, st: ShipmentStatus, note?: string) => void; addShipmentDoc: (id: string, docName: string, docKind: string) => void;
  postPayment: (p: Omit<Payment, "id" | "number" | "amountPkr" | "void" | "createdAt" | "createdBy">) => boolean;
  voidPayment: (id: string) => void;
  saveExpense: (e: Expense) => void; deleteExpense: (id: string) => void;
  addAdjustment: (a: Omit<LedgerAdjustment, "id" | "createdAt" | "createdBy">) => void;
  createInvoice: (orderId: string) => string | null; voidInvoice: (id: string) => void;
  saveSettings: (s: CompanySettings) => void;
  saveUser: (u: User) => void; setUserActive: (id: string, active: boolean) => void;
  markNotice: (id: string) => void; markAllNotices: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);
export const useStore = (): StoreCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("store missing");
  return v;
};

function n(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function coerceFields<T extends Record<string, any>>(obj: T | undefined | null, fields: string[], asBools = false): T | null & { [k: string]: any } {
  if (!obj) return obj as any;
  for (const f of fields) {
    if (f in obj) {
      (obj as any)[f] = asBools ? Boolean((obj as any)[f]) : n((obj as any)[f]);
    }
  }
  return obj as any;
}

function normalizeDb(d: Partial<DB>, seed: DB): DB {
  const base = {
    ...seed, ...d,
    sessionId: null,
    settings: { ...seed.settings, ...(d.settings ?? {}) },
    seq: { ...seed.seq, ...(d.seq ?? {}) },
    clients: d.clients ?? [], suppliers: d.suppliers ?? [], categories: d.categories ?? seed.categories,
    products: d.products ?? [], sourcingRequests: d.sourcingRequests ?? [], supplierQuotes: d.supplierQuotes ?? [],
    exchangeRates: d.exchangeRates ?? seed.exchangeRates, quotations: d.quotations ?? [], orders: d.orders ?? [],
    shipments: d.shipments ?? [], payments: d.payments ?? [], expenses: d.expenses ?? [],
    invoices: d.invoices ?? [], adjustments: d.adjustments ?? [], audit: d.audit ?? [], notices: d.notices ?? [],
  };
  base.users = (base.users ?? []).map((u) => coerceFields(u, ["active"], true));
  base.clients = base.clients.map((c) => coerceFields(c, ["creditLimit", "balance", "openingBalance"]));
  base.suppliers = base.suppliers.map((s) => {
    const ss = coerceFields(s, ["minOrder", "creditLimit", "balance"]);
    return coerceFields(ss, ["active"], true);
  });
  base.products = base.products.map((p) => {
    const pp = coerceFields(p, ["defaultPrice", "weightKg", "volumeCbm", "defaultUnitPkr", "stockQty", "reorderLevel"]);
    coerceFields(pp, ["active", "trackStock"], true);
    if (pp.priceHistory && Array.isArray(pp.priceHistory)) {
      pp.priceHistory = pp.priceHistory.map((h: any) => coerceFields(h, ["price", "rateToPkr"]));
    }
    return pp;
  });
  base.exchangeRates = base.exchangeRates.map((r) => coerceFields(r, ["rateToPkr"]));
  base.sourcingRequests = base.sourcingRequests.map((s) => coerceFields(s, ["qty", "targetUnitPrice"]));
  base.supplierQuotes = base.supplierQuotes.map((s) => coerceFields(s, ["qty", "unitPrice", "leadTimeDays", "minOrderQty"]));
  const snapNumFields = ["unitPrice", "rateToPkr", "airRatePerKg", "seaRatePerCbm", "landedUnitPkr", "weightKg", "volumeCbm", "unitPricePkr", "qty", "freightPkr", "insurancePkr", "chinaTotal", "intlFreightPkr", "customsTotal", "clearanceTotal", "localTotal", "otherTotal", "productCostPkr", "landedCostPkr", "sellingPricePkr", "profitPkr", "marginPct", "cbm"];
  base.quotations = base.quotations.map((q) => {
    const qq = coerceFields(q, ["subTotal", "discount", "tax", "shipping", "grandTotal", "commissionPct", "commissionAmt", "marginAmt", "marginPct", "revisionNo", "validDays"]);
    qq.items = qq.items.map((it: any) => {
      if (it.snapshot && typeof it.snapshot === "object") it.snapshot = coerceFields(it.snapshot, snapNumFields);
      return coerceFields(it, ["qty", "sortOrder"]);
    });
    return qq;
  });
  base.orders = base.orders.map((o) => {
    const oo = coerceFields(o, ["productSubtotal", "freightPkr", "insurancePkr", "landingPkr", "bankFeesPkr", "otherPkr", "grandTotalPkr", "paidPkr", "balancePkr", "fxGainLossPkr", "actualLandedPkr", "marginPkr", "marginPct", "percentPaid", "revisionNo", "piSent", "prodConfirmed", "shipReady", "docsReceived"]);
    coerceFields(oo, ["archived"], true);
    if (oo.rateSnapshot && typeof oo.rateSnapshot === "object") {
      for (const k of Object.keys(oo.rateSnapshot)) (oo.rateSnapshot as any)[k] = n((oo.rateSnapshot as any)[k]);
    }
    oo.items = oo.items.map((it: any) => {
      if (it.snapshot && typeof it.snapshot === "object") it.snapshot = coerceFields(it.snapshot, snapNumFields);
      return coerceFields(it, ["sortOrder"]);
    });
    return oo;
  });
  base.shipments = base.shipments.map((sh) => {
    const s = coerceFields(sh, ["estimatedFreight", "actualFreight", "insuranceUsd", "grossKg", "volCbm", "cbmCharged", "invoiceUsd", "customsPkr", "landedPkrTotal", "percentComplete", "delayDays", "containers", "cartons", "pallets", "pieces"]);
    coerceFields(s, ["arrived", "released", "closed"], true);
    s.docs = (s.docs ?? []).map((d: any) => coerceFields(d, ["size", "sortOrder"]));
    s.timeline = (s.timeline ?? []).map((t: any) => coerceFields(t, ["sortOrder"]));
    if (s.air && typeof s.air === "object") s.air = coerceFields(s.air, ["grossKg", "volCbm", "chargeableKg", "ratePerKg", "totalPkr"]);
    if (s.sea && typeof s.sea === "object") s.sea = coerceFields(s.sea, ["containers", "cbm", "ratePerCbm", "freightUsd", "totalPkr"]);
    return s;
  });
  base.payments = base.payments.map((p) => {
    const pp = coerceFields(p, ["amount", "amountPkr", "rateToPkr", "fxFeePkr", "bankFeePkr"]);
    return coerceFields(pp, ["void"], true);
  });
  base.expenses = base.expenses.map((e) => coerceFields(e, ["amount", "amountPkr", "rateToPkr"]));
  base.invoices = base.invoices.map((inv) => {
    const ii = coerceFields(inv, ["subTotal", "discount", "tax", "shipping", "grandTotal", "paidPkr", "balancePkr", "withholdingPkr", "percentPaid", "daysOverdue", "revisionNo", "grandTotalPkr"]);
    coerceFields(ii, ["void"], true);
    ii.items = ii.items.map((it: any) => coerceFields(it, ["qty", "unitPrice", "amount", "sortOrder"]));
    return ii;
  });
  base.adjustments = base.adjustments.map((a) => coerceFields(a, ["amount", "debitPkr", "creditPkr"]));
  base.notices = base.notices.map((n2) => coerceFields(n2, ["read"], true));
  return base as DB;
}

function loadDb(): DB {
  return buildSeed();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDb);
  const [route, setRoute] = useState<Route>({ page: "dashboard" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOpts & { open: boolean }>({ open: false, title: "", message: "" });
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const apiTriedRef = useRef(false);
  const toastRef = useRef<(m: string, k?: ToastKind) => void>(() => {});

  useEffect(() => { scheduleSupabaseSync(db, toastRef.current); }, [db]);

  const toast = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = uid("t");
    setToasts((ts) => [...ts.slice(-3), { id, kind, msg }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4200);
  }, []);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  useEffect(() => {
    if (apiTriedRef.current) return;
    apiTriedRef.current = true;
    (async () => {
      const t = (m: string, k: ToastKind = "info") => toastRef.current(m, k);
      try {
        await initDatabaseFromAPI();
      } catch (e: any) { /* ignore */ console.warn("[supabase] initDatabaseFromAPI failed:", e); }

      const sbOk = await supabaseAvailable(true);
      if (!sbOk) {
        const extra = supabaseLastError() ? ` · ${supabaseLastError()}` : "";
        t(
          `Supabase could not be reached on startup.${extra}`,
          "warning"
        );
        return;
      }

      try {
        const remote = await supabaseLoad();
        if (remote) {
          setDb((prev) => ({
            ...remote,
            sessionId: prev.sessionId,
            seq: { ...remote.seq, ...prev.seq },
            notices: [...remote.notices, ...prev.notices.filter((pn) => !pn.read)].slice(0, 60),
          }));
          t("Loaded live data from Supabase.", "success");
        } else {
          const emptyData = await supabase
            .from("hambin_state")
            .select("id")
            .eq("id", SUPABASE_STATE_ID)
            .limit(1)
            .maybeSingle();
          if (emptyData.data) {
            t("Supabase connected — waiting for first change to be saved.", "info");
          } else {
            t("Connected to Supabase — seed written automatically on first save.", "info");
          }
        }
      } catch (e: any) {
        const detail = String(e?.message || e);
        t(`Supabase load failed: ${detail}. Memory state will save on next mutation.`, "warning");
      }
    })();
  }, []);

  const user = useMemo(() => db.users.find((u) => u.id === db.sessionId) ?? null, [db]);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => { resolver.current = resolve; setConfirmState({ ...opts, open: true }); }), []);
  const resolveConfirm = useCallback((ok: boolean) => { resolver.current?.(ok); resolver.current = null; setConfirmState((s) => ({ ...s, open: false })); }, []);

  const nav = useCallback((page: string, id?: string, carry?: unknown) => { setRoute({ page, id, carry }); window.scrollTo({ top: 0 }); }, []);

  const can = useCallback((module: string, action: "view" | "edit" = "view"): boolean => {
    if (!user) return false;
    const lvl = ACCESS[user.role][module] ?? "none";
    if (lvl === "full") return true;
    if (lvl === "view") return action === "view";
    return false;
  }, [user]);

  /* mutation core: audit + optional notice */
  const mutate = useCallback((fn: (d: DB) => DB, audit?: Omit<AuditEntry, "id" | "at" | "userId" | "userName" | "ip">, notice?: Omit<Notice, "id" | "at" | "read">) => {
    setDb((d) => {
      let next = fn(d);
      if (audit) {
        const entry: AuditEntry = { id: uid("a"), at: new Date().toISOString(), userId: user?.id ?? "sys", userName: user?.name ?? "System", ip: "10.0.4.21", ...audit };
        next = { ...next, audit: [entry, ...next.audit].slice(0, 400) };
      }
      if (notice) {
        const n: Notice = { id: uid("n"), at: new Date().toISOString(), read: false, ...notice };
        next = { ...next, notices: [n, ...next.notices].slice(0, 60) };
      }
      return next;
    });
  }, [user]);

  const guard = useCallback((module: string): boolean => {
    if (can(module, "edit")) return true;
    toast(`Your role (${user ? ROLE_LABEL[user.role] : "guest"}) is not permitted to change ${module}.`, "error");
    return false;
  }, [can, toast, user]);

  const year = () => String(new Date().getFullYear());

  /* ---------------- auth ---------------- */
  const login = useCallback((email: string, password: string): boolean => {
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) return false;
    if (!u.active) return false;
    setDb((d) => ({ ...d, sessionId: u.id, users: d.users.map((x) => x.id === u.id ? { ...x, lastLogin: new Date().toISOString() } : x) }));
    setRoute({ page: "dashboard" });
    toast(`Welcome back, ${u.name.split(" ")[0]}.`, "success");
    return true;
  }, [db.users, toast]);
  const logout = useCallback(() => { setDb((d) => ({ ...d, sessionId: null })); setRoute({ page: "dashboard" }); }, []);
  const resetDemo = useCallback(() => { const seed = buildSeed(); seed.sessionId = db.sessionId; setDb(seed); toast("Demo data regenerated.", "info"); }, [db.sessionId, toast]);
  const replaceDb = useCallback((d: DB) => { setDb(d); }, []);

  /* ---------------- CRM ---------------- */
  const saveClient = useCallback((c: Client): string => {
    if (!guard("clients")) return c.id;
    const exists = db.clients.some((x) => x.id === c.id);
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? c : { ...c, id: c.id || uid("c"), code: c.code || `CL-${padSeq(nextSeq(seq, "client"), 3)}`, createdAt: c.createdAt || new Date().toISOString() };
      return { ...d, seq, clients: exists ? d.clients.map((x) => (x.id === c.id ? rec : x)) : [rec, ...d.clients] };
    }, { action: exists ? "Client updated" : "Client created", module: "Clients", refId: c.code || "new", detail: c.company });
    toast(exists ? "Client updated." : "Client added.", "success");
    return c.id;
  }, [db.clients, guard, mutate, toast]);

  const deleteClient = useCallback((id: string) => {
    if (!guard("clients")) return;
    if (db.orders.some((o) => o.clientId === id) || db.invoices.some((i) => i.clientId === id)) {
      toast("Cannot delete — this client has orders or invoices. Mark inactive instead.", "error");
      return;
    }
    const c = db.clients.find((x) => x.id === id);
    mutate((d) => ({ ...d, clients: d.clients.filter((x) => x.id !== id) }), { action: "Client deleted", module: "Clients", refId: c?.code ?? id, detail: c?.company ?? "" });
    toast("Client deleted.", "info");
  }, [db, guard, mutate, toast]);

  const saveSupplier = useCallback((s: Supplier): string => {
    if (!guard("suppliers")) return s.id;
    const exists = db.suppliers.some((x) => x.id === s.id);
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? s : { ...s, id: s.id || uid("s"), code: s.code || `SUP-${padSeq(nextSeq(seq, "supplier"), 3)}`, createdAt: s.createdAt || new Date().toISOString() };
      return { ...d, seq, suppliers: exists ? d.suppliers.map((x) => (x.id === s.id ? rec : x)) : [rec, ...d.suppliers] };
    }, { action: exists ? "Supplier updated" : "Supplier created", module: "Suppliers", refId: s.code || "new", detail: s.name });
    toast(exists ? "Supplier updated." : "Supplier added.", "success");
    return s.id;
  }, [db.suppliers, guard, mutate, toast]);

  const deleteSupplier = useCallback((id: string) => {
    if (!guard("suppliers")) return;
    if (db.orders.some((o) => o.items.some((i) => i.supplierId === id))) {
      toast("Cannot delete — this supplier is linked to purchase orders.", "error");
      return;
    }
    const s = db.suppliers.find((x) => x.id === id);
    mutate((d) => ({ ...d, suppliers: d.suppliers.filter((x) => x.id !== id) }), { action: "Supplier deleted", module: "Suppliers", refId: s?.code ?? id, detail: s?.name ?? "" });
    toast("Supplier deleted.", "info");
  }, [db, guard, mutate, toast]);

  const saveCategory = useCallback((c: Category) => {
    if (!guard("products")) return;
    mutate((d) => ({ ...d, categories: d.categories.some((x) => x.id === c.id) ? d.categories.map((x) => (x.id === c.id ? c : x)) : [...d.categories, c] }));
    toast("Category saved.", "success");
  }, [guard, mutate, toast]);
  const deleteCategory = useCallback((id: string) => {
    if (!guard("products")) return;
    if (db.products.some((p) => p.category === (db.categories.find((c) => c.id === id)?.name ?? "§"))) { toast("Category in use by products.", "error"); return; }
    mutate((d) => ({ ...d, categories: d.categories.filter((x) => x.id !== id) }));
    toast("Category removed.", "info");
  }, [db, guard, mutate, toast]);

  const saveProduct = useCallback((p: Product): string => {
    if (!guard("products")) return p.id;
    const exists = db.products.some((x) => x.id === p.id);
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? p : { ...p, id: p.id || uid("p"), sku: p.sku || `HITC-${padSeq(nextSeq(seq, "product"), 4)}`, createdAt: p.createdAt || new Date().toISOString() };
      return { ...d, seq, products: exists ? d.products.map((x) => (x.id === p.id ? rec : x)) : [rec, ...d.products] };
    }, { action: exists ? "Product updated" : "Product created", module: "Products", refId: p.sku || "new", detail: p.name });
    toast(exists ? "Product updated." : "Product added to master.", "success");
    return p.id;
  }, [db.products, guard, mutate, toast]);

  const deleteProduct = useCallback((id: string) => {
    if (!guard("products")) return;
    if (db.orders.some((o) => o.items.some((i) => i.productId === id))) { toast("Cannot delete — product appears on orders. Mark inactive instead.", "error"); return; }
    const p = db.products.find((x) => x.id === id);
    mutate((d) => ({ ...d, products: d.products.filter((x) => x.id !== id) }), { action: "Product deleted", module: "Products", refId: p?.sku ?? id, detail: p?.name ?? "" });
    toast("Product deleted.", "info");
  }, [db, guard, mutate, toast]);

  /* ---------------- FX ---------------- */
  const saveRate = useCallback((r: ExchangeRate) => {
    if (!guard("settings")) return;
    const exists = db.exchangeRates.some((x) => x.id === r.id);
    const prev = db.exchangeRates.find((x) => x.currency === r.currency && x.effectiveDate <= todayISO());
    mutate((d) => ({ ...d, exchangeRates: exists ? d.exchangeRates.map((x) => (x.id === r.id ? r : x)) : [...d.exchangeRates, r].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)) }),
      { action: exists ? "Exchange rate updated" : "Exchange rate published", module: "Exchange Rates", refId: r.currency, detail: `1 ${r.currency} = PKR ${r.rateToPkr}${prev ? ` (was ${prev.rateToPkr})` : ""} · historical orders keep their snapshots` });
    toast(`${r.currency} rate saved — existing order snapshots are unaffected.`, "success");
  }, [db.exchangeRates, guard, mutate, toast]);
  const deleteRate = useCallback((id: string) => {
    if (!guard("settings")) return;
    mutate((d) => ({ ...d, exchangeRates: d.exchangeRates.filter((x) => x.id !== id) }), { action: "Exchange rate removed", module: "Exchange Rates", refId: id, detail: "Rate row deleted (order snapshots untouched)" });
    toast("Rate entry removed.", "info");
  }, [guard, mutate, toast]);

  /* ---------------- sourcing ---------------- */
  const saveSourcing = useCallback((s: SourcingRequest) => {
    if (!guard("sourcing")) return;
    const exists = db.sourcingRequests.some((x) => x.id === s.id);
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? s : { ...s, id: s.id || uid("sr"), number: s.number || `SRC-${year()}-${padSeq(nextSeq(seq, "sourcing"), 3)}`, createdAt: s.createdAt || new Date().toISOString() };
      return { ...d, seq, sourcingRequests: exists ? d.sourcingRequests.map((x) => (x.id === s.id ? rec : x)) : [rec, ...d.sourcingRequests] };
    }, { action: exists ? "Sourcing request updated" : "Sourcing request created", module: "Sourcing", refId: s.number || "new", detail: `Qty ${s.qty}` },
      exists ? undefined : { kind: "sourcing", title: "New sourcing request", body: `${s.number} raised — qty ${s.qty}.` });
    toast(exists ? "Sourcing request updated." : "Sourcing request created.", "success");
  }, [db.sourcingRequests, guard, mutate, toast]);
  const deleteSourcing = useCallback((id: string) => {
    if (!guard("sourcing")) return;
    mutate((d) => ({ ...d, sourcingRequests: d.sourcingRequests.filter((x) => x.id !== id), supplierQuotes: d.supplierQuotes.filter((q) => q.requestId !== id) }));
    toast("Sourcing request removed with its quotes.", "info");
  }, [guard, mutate, toast]);

  const saveQuote = useCallback((q: SupplierQuote) => {
    if (!guard("sourcing")) return;
    const exists = db.supplierQuotes.some((x) => x.id === q.id);
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? q : { ...q, id: q.id || uid("sq"), number: q.number || `SQ-${year()}-${padSeq(nextSeq(seq, "quote"), 3)}`, createdAt: q.createdAt || new Date().toISOString() };
      return { ...d, seq, supplierQuotes: exists ? d.supplierQuotes.map((x) => (x.id === q.id ? rec : x)) : [rec, ...d.supplierQuotes] };
    }, { action: exists ? "Supplier quote updated" : "Supplier quote received", module: "Supplier Quotes", refId: q.number || "new", detail: `${q.currency} ${q.unitPrice} × ${q.qty}` },
      { kind: "sourcing", title: "Supplier quote received", body: `${q.number}: ${q.currency} ${q.unitPrice} per unit (MOQ ${q.moq}).` });
    toast(exists ? "Quote updated." : "Quote recorded & comparison refreshed.", "success");
  }, [db.supplierQuotes, guard, mutate, toast]);
  const deleteQuote = useCallback((id: string) => {
    if (!guard("sourcing")) return;
    mutate((d) => ({ ...d, supplierQuotes: d.supplierQuotes.filter((x) => x.id !== id) }));
    toast("Quote removed.", "info");
  }, [guard, mutate, toast]);

  /* ---------------- quotations & orders ---------------- */
  const saveQuotation = useCallback((q: Quotation): string => {
    if (!guard("quotations")) return q.id;
    const exists = db.quotations.some((x) => x.id === q.id);
    const id = q.id || uid("q");
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? q : { ...q, id, number: q.number || `${d.settings.quotationPrefix}-${year()}-${padSeq(nextSeq(seq, "quotation"), 5)}`, createdAt: q.createdAt || new Date().toISOString() };
      return { ...d, seq, quotations: exists ? d.quotations.map((x) => (x.id === q.id ? rec : x)) : [rec, ...d.quotations] };
    }, { action: exists ? "Quotation updated" : "Quotation created", module: "Quotations", refId: q.number || "new", detail: `${q.items.length} line(s)` });
    toast(exists ? "Quotation updated." : "Quotation created.", "success");
    return id;
  }, [db.quotations, guard, mutate, toast]);

  const setQuotationStatus = useCallback((id: string, st: Quotation["status"]) => {
    if (!guard("quotations")) return;
    const q = db.quotations.find((x) => x.id === id);
    mutate((d) => ({ ...d, quotations: d.quotations.map((x) => (x.id === id ? { ...x, status: st } : x)) }),
      { action: "Quotation status changed", module: "Quotations", refId: q?.number ?? id, detail: `→ ${st}` },
      st === "Accepted" && q ? { kind: "order", title: "Quotation accepted 🎯".replace(" 🎯", ""), body: `${q.number} accepted — convert to order when ready.` } : undefined);
    toast(`Quotation marked ${st}.`, "info");
  }, [db.quotations, guard, mutate, toast]);

  const convertQuotationToOrder = useCallback((qtId: string): string | null => {
    if (!guard("orders")) return null;
    const q = db.quotations.find((x) => x.id === qtId);
    if (!q) return null;
    const id = uid("o");
    mutate((d) => {
      const seq = { ...d.seq };
      const number = `${d.settings.orderPrefix}-${year()}-${padSeq(nextSeq(seq, "order"), 5)}`;
      const items: OrderItem[] = q.items.map((qi) => {
        const p = d.products.find((x) => x.id === qi.productId);
        return { id: uid("oi"), productId: qi.productId, supplierId: p?.defaultSupplierId ?? "", hsCode: p?.hsCode ?? "", snapshot: qi.snapshot };
      });
      const order: Order = { id, number, clientId: q.clientId, quotationId: q.id, date: todayISO(), currency: items[0]?.snapshot.currency ?? "RMB", rateSnapshot: { rmb: currentRate(d, "RMB"), usd: currentRate(d, "USD"), eur: currentRate(d, "EUR") }, paymentTerms: q.paymentTerms, advanceRequiredPct: 30, status: "Draft", items, notes: `Converted from ${q.number}`, createdAt: new Date().toISOString() };
      return { ...d, seq, orders: [order, ...d.orders], quotations: d.quotations.map((x) => (x.id === q.id ? { ...x, status: "Converted to Order" } : x)) };
    }, { action: "Quotation converted to order", module: "Orders", refId: q.number, detail: "Rate snapshot captured at today's board rate" });
    toast(`Order draft created from ${q.number}.`, "success");
    return id;
  }, [db.quotations, guard, mutate, toast]);

  const saveOrder = useCallback((o: Order): string => {
    if (!guard("orders")) return o.id;
    const exists = db.orders.some((x) => x.id === o.id);
    const id = o.id || uid("o");
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? o : { ...o, id, number: o.number || `${d.settings.orderPrefix}-${year()}-${padSeq(nextSeq(seq, "order"), 5)}`, createdAt: o.createdAt || new Date().toISOString() };
      return { ...d, seq, orders: exists ? d.orders.map((x) => (x.id === o.id ? rec : x)) : [rec, ...d.orders] };
    }, { action: exists ? "Order updated" : "Order draft created", module: "Orders", refId: o.number || "new", detail: `${o.items.length} line(s) · ${o.status}` });
    toast(exists ? "Order updated." : "Order draft saved.", "success");
    return id;
  }, [db.orders, guard, mutate, toast]);

  const setOrderStatus = useCallback((id: string, st: Order["status"]) => {
    if (!guard("orders")) return;
    const o = db.orders.find((x) => x.id === id);
    const milestones: Partial<Record<Order["status"], string>> = { "In Transit": "Order shipped — cargo in transit.", "Customs": "Order arrived — customs clearance in progress.", "Delivered": "Order delivered to client." };
    mutate((d) => ({ ...d, orders: d.orders.map((x) => (x.id === id ? { ...x, status: st } : x)) }),
      { action: "Order status changed", module: "Orders", refId: o?.number ?? id, detail: `${o?.status ?? ""} → ${st}` },
      o && milestones[st] ? { kind: "order", title: milestones[st]!, body: `${o.number} is now “${st}”.` } : undefined);
    toast(`Order moved to “${st}”.`, "info");
  }, [db.orders, guard, mutate, toast]);

  const cancelOrder = useCallback((id: string) => {
    if (!guard("orders")) return;
    const o = db.orders.find((x) => x.id === id);
    mutate((d) => ({ ...d, orders: d.orders.map((x) => (x.id === id ? { ...x, status: "Cancelled" } : x)) }),
      { action: "Order cancelled", module: "Orders", refId: o?.number ?? id, detail: "Cancelled — ledger entries retained for audit" },
      { kind: "order", title: "Order cancelled", body: `${o?.number ?? id} was cancelled.` });
    toast("Order cancelled (record retained for audit).", "warning");
  }, [db.orders, guard, mutate, toast]);

  /* ---------------- shipments ---------------- */
  const addShipment = useCallback((s: Shipment): string => {
    if (!guard("shipments")) return s.id;
    const exists = db.shipments.some((x) => x.id === s.id);
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? s : { ...s, id: s.id || uid("sh"), number: s.number || `${d.settings.shipmentPrefix}-${year()}-${padSeq(nextSeq(seq, "shipment"), 5)}`, createdAt: s.createdAt || new Date().toISOString(), timeline: s.timeline.length ? s.timeline : [{ at: new Date().toISOString(), label: s.status }] };
      return { ...d, seq, shipments: exists ? d.shipments.map((x) => (x.id === s.id ? rec : x)) : [rec, ...d.shipments] };
    }, { action: exists ? "Shipment updated" : "Shipment created", module: "Shipments", refId: s.number || "new", detail: `${s.method} · ${s.origin} → ${s.destination}` },
      exists ? undefined : { kind: "shipment", title: "Shipment booked", body: `${s.number}: ${s.method} ${s.origin} → ${s.destination}.` });
    toast(exists ? "Shipment updated." : "Shipment created.", "success");
    return s.id;
  }, [db.shipments, guard, mutate, toast]);

  const setShipmentStatus = useCallback((id: string, st: ShipmentStatus, note?: string) => {
    if (!guard("shipments")) return;
    const s = db.shipments.find((x) => x.id === id);
    mutate((d) => ({ ...d, shipments: d.shipments.map((x) => (x.id === id ? { ...x, status: st, currentLocation: note ? x.currentLocation : x.currentLocation, timeline: [...x.timeline, { at: new Date().toISOString(), label: st, note }] } : x)) }),
      { action: "Shipment milestone", module: "Shipments", refId: s?.number ?? id, detail: `→ ${st}${note ? ` · ${note}` : ""}` },
      { kind: "shipment", title: `Shipment ${st.toLowerCase()}`, body: `${s?.number ?? ""} ${st === "Arrived" ? "has arrived at destination port" : st === "Customs" ? "is under customs clearance" : `status → ${st}`}.` });
    toast(`Shipment updated: ${st}.`, "info");
  }, [db.shipments, guard, mutate, toast]);

  const addShipmentDoc = useCallback((id: string, docName: string, docKind: string) => {
    if (!guard("shipments")) return;
    const s = db.shipments.find((x) => x.id === id);
    mutate((d) => ({ ...d, shipments: d.shipments.map((x) => (x.id === id ? { ...x, docs: [...x.docs, { id: uid("doc"), name: docName, kind: docKind, size: `${Math.floor(80 + Math.random() * 320)} KB`, uploadedAt: new Date().toISOString(), by: user?.name ?? "—" }] } : x)) }),
      { action: "Document uploaded", module: "Shipments", refId: s?.number ?? id, detail: docName });
    toast("Document attached.", "success");
  }, [db.shipments, guard, mutate, toast, user]);

  /* ---------------- money ---------------- */
  const postPayment = useCallback((p: Omit<Payment, "id" | "number" | "amountPkr" | "void" | "createdAt" | "createdBy">): boolean => {
    if (!guard("finance")) return false;
    if (p.amount <= 0) { toast("Payment amount must be greater than zero.", "error"); return false; }
    /* server-side rule: a payment against an invoice cannot exceed the outstanding balance */
    if (p.partyKind === "client" && p.invoiceId && p.type !== "Client Advance" && p.type !== "Refund") {
      const inv = db.invoices.find((i) => i.id === p.invoiceId);
      if (inv) {
        const out = r2(inv.grandTotalPkr - invoicePaidAmount(db, inv.id));
        if (r2(p.amount * p.rateToPkr) > out + 0.5) {
          toast(`Amount exceeds outstanding balance (PKR ${out.toLocaleString()}). Use “Client Advance” to accept extra funds.`, "error");
          return false;
        }
      }
    }
    const amountPkr = r2(p.amount * p.rateToPkr);
    let number = "";
    mutate((d) => {
      const seq = { ...d.seq };
      number = `PAY-${year()}-${padSeq(nextSeq(seq, "payment"), 4)}`;
      const rec: Payment = { ...p, id: uid("pay"), number, amountPkr, void: false, createdAt: new Date().toISOString(), createdBy: user?.name ?? "—" };
      return { ...d, seq, payments: [rec, ...d.payments] };
    }, { action: "Payment posted", module: "Payments", refId: "new", detail: `${p.type} · ${p.currency} ${p.amount.toLocaleString()} @ ${p.rateToPkr} → PKR ${amountPkr.toLocaleString()}` },
      { kind: "payment", title: p.partyKind === "client" ? "Client payment received" : "Supplier payment sent", body: `${p.type} of ${p.currency} ${p.amount.toLocaleString()} posted.` });
    toast("Payment posted to ledger.", "success");
    return true;
  }, [db, guard, mutate, toast, user]);

  const voidPayment = useCallback((id: string) => {
    if (!guard("finance")) return;
    const p = db.payments.find((x) => x.id === id);
    mutate((d) => ({ ...d, payments: d.payments.map((x) => (x.id === id ? { ...x, void: true } : x)) }),
      { action: "Payment voided", module: "Payments", refId: p?.number ?? id, detail: "Voided — reversing entry retained (no hard delete)" });
    toast("Payment voided (reversal retained in ledger).", "warning");
  }, [db.payments, guard, mutate, toast]);

  const saveExpense = useCallback((e: Expense) => {
    if (!guard("finance")) return;
    const exists = db.expenses.some((x) => x.id === e.id);
    mutate((d) => {
      const seq = { ...d.seq };
      const rec = exists ? e : { ...e, id: e.id || uid("e"), number: e.number || `EXP-${nextSeq(seq, "expense")}`, createdAt: e.createdAt || new Date().toISOString() };
      return { ...d, seq, expenses: exists ? d.expenses.map((x) => (x.id === e.id ? rec : x)) : [rec, ...d.expenses] };
    }, { action: exists ? "Expense updated" : "Expense recorded", module: "Expenses", refId: e.number || "new", detail: `${e.category} · PKR ${e.amountPkr.toLocaleString()}` });
    toast(exists ? "Expense updated." : "Expense recorded.", "success");
  }, [db.expenses, guard, mutate, toast]);
  const deleteExpense = useCallback((id: string) => {
    if (!guard("finance")) return;
    const e = db.expenses.find((x) => x.id === id);
    mutate((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }), { action: "Expense removed", module: "Expenses", refId: e?.number ?? id, detail: e?.description ?? "" });
    toast("Expense removed.", "info");
  }, [db.expenses, guard, mutate, toast]);

  const addAdjustment = useCallback((a: Omit<LedgerAdjustment, "id" | "createdAt" | "createdBy">) => {
    if (!guard("finance")) return;
    mutate((d) => ({ ...d, adjustments: [...d.adjustments, { ...a, id: uid("adj"), createdAt: new Date().toISOString(), createdBy: user?.name ?? "—" }] }),
      { action: "Ledger adjustment", module: "Ledgers", refId: a.partyId, detail: `${a.description} · Dr ${a.debitPkr.toLocaleString()} / Cr ${a.creditPkr.toLocaleString()}` });
    toast("Adjustment posted to ledger.", "success");
  }, [guard, mutate, toast, user]);

  const createInvoice = useCallback((orderId: string): string | null => {
    if (!guard("invoices")) return null;
    if (db.invoices.some((i) => i.orderId === orderId && !i.void)) { toast("An active invoice already exists for this order.", "warning"); return null; }
    const o = db.orders.find((x) => x.id === orderId);
    if (!o) return null;
    const id = uid("inv");
    mutate((d) => {
      const seq = { ...d.seq };
      const number = `${d.settings.invoicePrefix}-${year()}-${padSeq(nextSeq(seq, "invoice"), 5)}`;
      const items = o.items.map((i) => {
        const p = d.products.find((x) => x.id === i.productId);
        return { description: `${p?.name ?? "Item"} — ${p?.spec ?? ""}`, qty: i.snapshot.qty, unitPrice: i.snapshot.unitSellingPkr, amount: i.snapshot.sellingPricePkr };
      });
      const subtotalPkr = r2(items.reduce((a, x) => a + x.amount, 0));
      const rec: Invoice = { id, number, orderId, clientId: o.clientId, date: todayISO(), dueDate: daysAhead(14), items, subtotalPkr, freightPkr: 0, customsPkr: 0, taxPkr: 0, discountPkr: 0, grandTotalPkr: subtotalPkr, notes: "Freight, customs & clearing are built into unit rates.", void: false, createdAt: new Date().toISOString(), createdBy: user?.name ?? "—" };
      return { ...d, seq, invoices: [rec, ...d.invoices] };
    }, { action: "Invoice created", module: "Invoices", refId: o.number, detail: `From order ${o.number}` },
      { kind: "invoice", title: "Invoice raised", body: `New invoice issued to client for ${o.number}.` });
    toast("Invoice created & posted to client ledger (debit).", "success");
    return id;
  }, [db, guard, mutate, toast, user]);

  const voidInvoice = useCallback((id: string) => {
    if (!guard("invoices")) return;
    const inv = db.invoices.find((x) => x.id === id);
    mutate((d) => ({ ...d, invoices: d.invoices.map((x) => (x.id === id ? { ...x, void: true } : x)) }),
      { action: "Invoice voided", module: "Invoices", refId: inv?.number ?? id, detail: "Voided — reversal retained (no hard delete)" });
    toast("Invoice voided (retained for audit).", "warning");
  }, [db.invoices, guard, mutate, toast]);

  /* ---------------- settings / users ---------------- */
  const saveSettings = useCallback((s: CompanySettings) => {
    if (!guard("settings")) return;
    mutate((d) => ({ ...d, settings: s }), { action: "Company settings updated", module: "Settings", refId: "company", detail: s.name });
    toast("Company settings saved.", "success");
  }, [guard, mutate, toast]);
  const saveUser = useCallback((u: User) => {
    if (!guard("settings")) return;
    const exists = db.users.some((x) => x.id === u.id);
    mutate((d) => ({ ...d, users: exists ? d.users.map((x) => (x.id === u.id ? u : x)) : [...d.users, { ...u, id: u.id || uid("u") }] }),
      { action: exists ? "User updated" : "User created", module: "Users", refId: u.email, detail: `${u.name} · ${ROLE_LABEL[u.role]}` });
    toast(exists ? "User updated." : "User added.", "success");
  }, [db.users, guard, mutate, toast]);
  const setUserActive = useCallback((id: string, active: boolean) => {
    if (!guard("settings")) return;
    const u = db.users.find((x) => x.id === id);
    mutate((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, active } : x)) }),
      { action: active ? "User activated" : "User deactivated", module: "Users", refId: u?.email ?? id, detail: u?.name ?? "" });
    toast(`User ${active ? "activated" : "deactivated"}.`, "info");
  }, [db.users, guard, mutate, toast]);

  const markNotice = useCallback((id: string) => setDb((d) => ({ ...d, notices: d.notices.map((n) => (n.id === id ? { ...n, read: true } : n)) })), []);
  const markAllNotices = useCallback(() => setDb((d) => ({ ...d, notices: d.notices.map((n) => ({ ...n, read: true })) })), []);

  const value: StoreCtx = {
    db, user, route, toasts, toast, dismissToast, confirm, confirmState, resolveConfirm, nav, can,
    login, logout, resetDemo, replaceDb,
    saveClient, deleteClient, saveSupplier, deleteSupplier, saveCategory, deleteCategory, saveProduct, deleteProduct,
    saveRate, deleteRate, saveSourcing, deleteSourcing, saveQuote, deleteQuote,
    saveQuotation, setQuotationStatus, convertQuotationToOrder,
    saveOrder, setOrderStatus, cancelOrder,
    addShipment, setShipmentStatus, addShipmentDoc,
    postPayment, voidPayment, saveExpense, deleteExpense, addAdjustment,
    createInvoice, voidInvoice, saveSettings, saveUser, setUserActive, markNotice, markAllNotices,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
