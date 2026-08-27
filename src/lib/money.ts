/* ------------------------------------------------------------------ */
/*  Financial precision helpers.                                       */
/*  All money math is rounded to 2 decimals at every operation         */
/*  (DECIMAL(18,2) semantics — never raw floats downstream).           */
/* ------------------------------------------------------------------ */

const num = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    if (v.trim() === "") return 0;
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
};

export const r2 = (n: number): number => Math.round((num(n) + Number.EPSILON) * 100) / 100;
export const r4 = (n: number): number => Math.round((num(n) + Number.EPSILON) * 10000) / 10000;

export const add = (...ns: number[]): number => r2(ns.reduce((a, b) => a + num(b), 0));
export const sub = (a: number, b: number): number => r2(num(a) - num(b));
export const mul = (a: number, b: number): number => r2(num(a) * num(b));
export const sum = <T,>(arr: T[], f: (t: T) => number): number => r2(arr.reduce((a, t) => a + num(f(t)), 0));

export const divSafe = (a: number, b: number): number => {
  const bb = num(b);
  return bb === 0 ? 0 : r4(num(a) / bb);
};

/* ---------------- formatting ---------------- */

export const fmt = (n: number, dec = 0): string => {
  const v = num(n);
  if (!isFinite(v)) return "0";
  return v.toLocaleString("en-PK", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

/** Smart money format: no decimals for whole amounts, 2 otherwise */
export const fm = (n: number): string => (Number.isInteger(r2(n)) ? fmt(n, 0) : fmt(n, 2));

export const fc = (currency: string, n: number): string => `${currency} ${fm(n)}`;

export const fmtCompact = (n: number): string => {
  const v = num(n);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fm(v);
};

export const pct = (n: number, dec = 1): string => `${fmt(n, dec)}%`;

/* ---------------- dates ---------------- */

export const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayISO = (): string => toISO(new Date());

export const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
};

export const daysAhead = (n: number): string => daysAgo(-n);

export const fmtDate = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export const monthKey = (iso: string): string => iso.slice(0, 7);

export const monthLabel = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }).replace(" ", " '");
};

export const isOverdue = (dueIso: string): boolean => dueIso < todayISO();

/* ---------------- ids & sequence ---------------- */

let uidCounter = 0;
export const uid = (prefix = "id"): string =>
  `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const nextSeq = (seq: Record<string, number>, key: string): number => {
  const n = (seq[key] || 0) + 1;
  seq[key] = n;
  return n;
};

export const padSeq = (n: number, w = 5): string => String(n).padStart(w, "0");

/* ---------------- CSV export ---------------- */

export const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
