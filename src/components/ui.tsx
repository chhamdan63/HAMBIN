/* Shared UI primitives — badges, buttons, modal/drawer, fields, toasts,
   confirm dialog, pager, KPI tiles, print portal. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Search, X, XCircle } from "lucide-react";
import { useStore } from "../lib/store";
import type { ToastKind } from "../lib/store";

/* ---------------- status tones ---------------- */
export type Tone = "ok" | "warn" | "bad" | "info" | "muted" | "pine" | "brass";
const TONE_MAP: Record<string, Tone> = {
  Draft: "muted", Confirmed: "info", "Supplier Ordered": "info", "China Warehouse": "brass",
  "Ready for Shipment": "brass", "In Transit": "info", Customs: "warn", Delivered: "ok",
  Completed: "pine", Cancelled: "bad", Expired: "muted", Paid: "ok", "Partially Paid": "warn",
  Overdue: "bad", Unpaid: "warn", Void: "muted", Sent: "info", Viewed: "brass", Accepted: "ok",
  Rejected: "bad", "Converted to Order": "pine", New: "info", Searching: "warn",
  "Supplier Found": "info", "Quotation Received": "brass", "Client Quotation Prepared": "info",
  Approved: "ok", active: "ok", inactive: "muted", Preparing: "muted", Warehouse: "warn",
  Booked: "info", Arrived: "info", Cleared: "ok", "Out for Delivery": "info",
};
export const toneFor = (s: string): Tone => TONE_MAP[s] ?? "muted";

/* ---------------- brand mark: uploaded logo or default SVG ----------------
   Height is locked to the row's text height so the logo always balances the
   business name beside it; width flows freely with the logo's own aspect
   ratio (wide logos spread out, square logos stay compact). */
export function BrandMark({ logo, size = 36, maxWidth, className = "" }: { logo?: string; size?: number; maxWidth?: number; className?: string }) {
  if (logo) {
    return (
      <img src={logo} alt="Company logo" className={className}
        style={{ height: size, width: "auto", maxWidth: maxWidth ?? Math.round(size * 2.6), objectFit: "contain", display: "block", flexShrink: 0 }} />
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={className} style={{ width: size, height: size }}>
      <path d="M6 23 L13 8 L18 16 L25 6" stroke="#d9a93f" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="6" r="2.3" fill="#d9a93f" />
      <path d="M6 27 h20" stroke="#3d7166" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const TONE_CLS: Record<Tone, string> = {
  ok: "bg-ok-100 text-ok-600",
  warn: "bg-warn-100 text-warn-600",
  bad: "bg-bad-100 text-bad-600",
  info: "bg-info-100 text-info-600",
  muted: "bg-paper-200 text-ink-500",
  pine: "bg-brand-100 text-brand-700",
  brass: "bg-brass-100 text-brass-600",
};
const TONE_DOT: Record<Tone, string> = {
  ok: "bg-ok-600", warn: "bg-warn-600", bad: "bg-bad-600", info: "bg-info-600",
  muted: "bg-ink-400", pine: "bg-brand-600", brass: "bg-brass-500",
};

export function Pill({ label, tone, pulse }: { label: string; tone?: Tone; pulse?: boolean }) {
  const t = tone ?? toneFor(label);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold tracking-wide whitespace-nowrap ${TONE_CLS[t]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[t]} ${pulse ? "anim-blink" : ""}`} />
      {label}
    </span>
  );
}

/* ---------------- buttons ---------------- */
type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "dark" | "brass";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/30",
  dark: "bg-ink-900 text-paper-100 hover:bg-ink-800",
  brass: "bg-brass-500 text-ink-950 hover:bg-brass-400 shadow-sm shadow-brass-500/30",
  outline: "border border-paper-300 bg-white text-ink-800 hover:border-brand-500 hover:text-brand-700",
  ghost: "text-ink-600 hover:bg-paper-200 hover:text-ink-900",
  danger: "bg-bad-600 text-white hover:brightness-110",
};
export function Btn({ variant = "primary", size = "md", className = "", children, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-150 active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap ${size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]"} ${BTN[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- surfaces ---------------- */
export function Card({ title, sub, actions, children, className = "", pad = true }:
  { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-xl border border-paper-300/90 bg-white shadow-[0_1px_2px_rgba(20,40,35,.05)] ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-paper-200 px-4 py-3">
          <div>
            <h3 className="disp text-[13px] font-semibold uppercase tracking-[.1em] text-ink-700">{title}</h3>
            {sub && <p className="mt-0.5 text-[11.5px] text-ink-400">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Modal({ open, onClose, title, sub, w = "max-w-xl", children, footer }:
  { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; w?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/55 p-4 pt-[7vh] anim-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${w} anim-rise rounded-xl border border-paper-300 bg-paper-50 shadow-2xl`}>
        <header className="flex items-start justify-between gap-4 border-b border-paper-200 px-5 py-4">
          <div>
            <h2 className="disp text-[16px] font-bold text-ink-900">{title}</h2>
            {sub && <p className="mt-0.5 text-[12px] text-ink-400">{sub}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-800" aria-label="Close">
            <X className="h-4.5 w-4.5" />
          </button>
        </header>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-paper-200 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, w = "max-w-3xl", children, footer }:
  { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; w?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-ink-950/50 anim-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`absolute right-0 top-0 h-full w-full ${w} flex flex-col border-l border-paper-300 bg-paper-50 shadow-2xl`}
        style={{ animation: "hk-slide .32s cubic-bezier(.22,.9,.3,1) both" }}>
        <header className="flex items-start justify-between gap-4 border-b border-paper-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="disp truncate text-[16px] font-bold text-ink-900">{title}</h2>
            {sub && <div className="mt-0.5 text-[12px] text-ink-400">{sub}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-paper-200 bg-white px-5 py-3.5">{footer}</footer>}
      </aside>
    </div>
  );
}

/* ---------------- form fields ---------------- */
export const inp = "w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-all placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";
export function Field({ label, children, err, hint, className = "" }:
  { label: ReactNode; children: ReactNode; err?: string; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[.08em] text-ink-500">{label}</span>
      {children}
      {err ? <span className="mt-1 block text-[11.5px] font-medium text-bad-600">{err}</span>
        : hint ? <span className="mt-1 block text-[11px] text-ink-300">{hint}</span> : null}
    </label>
  );
}

/* ---------------- currency selector ---------------- */
export type CurrencyCode = "PKR" | "RMB" | "USD" | "EUR";
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = { PKR: "₨", RMB: "¥", USD: "$", EUR: "€" };
export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: "RMB", label: "RMB (¥)" },
  { value: "USD", label: "USD ($)" },
  { value: "PKR", label: "PKR (₨)" },
];

export function CurrencySelector({ value, onChange, excludePkr = false, className = "" }: {
  value: CurrencyCode; onChange: (c: CurrencyCode) => void; excludePkr?: boolean; className?: string
}) {
  const options = excludePkr ? CURRENCY_OPTIONS.filter((o) => o.value !== "PKR") : CURRENCY_OPTIONS;
  return (
    <select className={`${inp} ${className}`} value={value} onChange={(e) => onChange(e.target.value as CurrencyCode)}>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}

export function CurrencyAmountField({ label, currency, amount, onCurrencyChange, onAmountChange, err, hint, step = 0.01, excludePkr = false, className = "" }: {
  label: string; currency: CurrencyCode; amount: number; onCurrencyChange: (c: CurrencyCode) => void;
  onAmountChange: (n: number) => void; err?: string; hint?: string; step?: number; excludePkr?: boolean; className?: string
}) {
  return (
    <div className={`grid grid-cols-[1fr_1fr] gap-2 ${className}`}>
      <Field label={`${label} — Currency`} hint={hint}>
        <CurrencySelector value={currency} onChange={onCurrencyChange} excludePkr={excludePkr} />
      </Field>
      <Field label={`${label} — Amount`} err={err}>
        <input type="number" step={step} className={`${inp} num text-right`} value={amount === 0 ? "" : amount}
          placeholder="0" onChange={(e) => onAmountChange(Number(e.target.value) || 0)} />
      </Field>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inp} pl-9`} />
    </div>
  );
}

/* ---------------- tabs ---------------- */
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-paper-300 bg-paper-200/60 p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150 ${active === t.id ? "bg-ink-900 text-paper-100 shadow-sm" : "text-ink-500 hover:bg-white hover:text-ink-800"}`}>
          {t.label}{typeof t.count === "number" && <span className={`ml-1.5 rounded px-1 text-[10.5px] ${active === t.id ? "bg-ink-700" : "bg-paper-300 text-ink-500"}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- pager ---------------- */
export function Pager({ page, pages, onPage, total, label = "records" }:
  { page: number; pages: number; onPage: (p: number) => void; total: number; label?: string }) {
  if (pages <= 1) return <div className="px-1 pt-2 text-[11.5px] text-ink-400">{total} {label}</div>;
  return (
    <div className="flex items-center justify-between px-1 pt-2">
      <span className="text-[11.5px] text-ink-400">{total} {label} · page {page}/{pages}</span>
      <div className="flex gap-1">
        <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</Btn>
        <Btn size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</Btn>
      </div>
    </div>
  );
}
export function paginate<T>(arr: T[], page: number, per = 9): { rows: T[]; pages: number } {
  const pages = Math.max(1, Math.ceil(arr.length / per));
  const p = Math.min(page, pages);
  return { rows: arr.slice((p - 1) * per, p * per), pages };
}

/* ---------------- empty state ---------------- */
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-paper-300 bg-paper-100/60 px-6 py-10 text-center">
      <svg viewBox="0 0 48 48" className="h-10 w-10 text-ink-300" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 14 L24 6 L40 14 V34 L24 42 L8 34 Z" strokeLinejoin="round" />
        <path d="M8 14 L24 22 L40 14 M24 22 V42" strokeLinejoin="round" />
      </svg>
      <p className="disp text-[14px] font-semibold text-ink-600">{title}</p>
      {body && <p className="max-w-sm text-[12.5px] text-ink-400">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------- KPI + count-up ---------------- */
export function useCountUp(target: number, dur = 750): number {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVal(target); prev.current = target; return; }
    const from = prev.current; prev.current = target;
    if (from === target) { setVal(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setVal(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

export function Kpi({ label, value, format, tone = "default", sub, onClick }:
  { label: string; value: number; format: (n: number) => string; tone?: "default" | "good" | "bad" | "brass"; sub?: ReactNode; onClick?: () => void }) {
  const v = useCountUp(value);
  const accent = tone === "good" ? "text-ok-600" : tone === "bad" ? "text-bad-600" : tone === "brass" ? "text-brass-600" : "text-ink-900";
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`group relative overflow-hidden rounded-xl border border-paper-300/90 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(20,40,35,.05)] transition-all duration-200 ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-brass-400 hover:shadow-md" : "cursor-default"}`}>
      <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-brass-400 transition-transform duration-300 group-hover:scale-x-100" />
      <p className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-ink-400">{label}</p>
      <p className={`num mt-1.5 truncate text-[19px] font-semibold leading-none ${accent}`}>{format(v)}</p>
      {sub && <div className="mt-1.5 text-[11px] text-ink-400">{sub}</div>}
    </button>
  );
}

/* ---------------- toasts & confirm hosts ---------------- */
const TOAST_META: Record<ToastKind, { cls: string; icon: ReactNode }> = {
  success: { cls: "border-ok-600/30 text-ok-600", icon: <CheckCircle2 className="h-4.5 w-4.5 shrink-0" /> },
  error: { cls: "border-bad-600/30 text-bad-600", icon: <XCircle className="h-4.5 w-4.5 shrink-0" /> },
  warning: { cls: "border-warn-600/30 text-warn-600", icon: <AlertTriangle className="h-4.5 w-4.5 shrink-0" /> },
  info: { cls: "border-info-600/30 text-info-600", icon: <Info className="h-4.5 w-4.5 shrink-0" /> },
};
export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-white px-3.5 py-3 shadow-lg ${TOAST_META[t.kind].cls}`}
          style={{ animation: "hk-slide .3s cubic-bezier(.22,.9,.3,1) both" }}>
          {TOAST_META[t.kind].icon}
          <p className="flex-1 text-[12.5px] font-medium leading-snug text-ink-800">{t.msg}</p>
          <button onClick={() => dismissToast(t.id)} className="text-ink-300 hover:text-ink-700" aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmHost() {
  const { confirmState, resolveConfirm } = useStore();
  if (!confirmState.open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/55 p-4 anim-fade" onMouseDown={(e) => e.target === e.currentTarget && resolveConfirm(false)}>
      <div className="w-full max-w-sm anim-rise rounded-xl border border-paper-300 bg-paper-50 p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`rounded-lg p-2 ${confirmState.danger ? "bg-bad-100 text-bad-600" : "bg-warn-100 text-warn-600"}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="disp text-[15px] font-bold text-ink-900">{confirmState.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{confirmState.message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="outline" onClick={() => resolveConfirm(false)}>Cancel</Btn>
          <Btn variant={confirmState.danger ? "danger" : "primary"} onClick={() => resolveConfirm(true)}>
            {confirmState.confirmLabel ?? "Confirm"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- print portal ---------------- */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [el] = useState(() => {
    const d = document.createElement("div");
    d.className = "print-area";
    document.body.appendChild(d);
    return d;
  });
  useEffect(() => () => { el.remove(); }, [el]);
  return createPortal(children, el);
}
export const doPrint = () => window.setTimeout(() => window.print(), 80);

/* ---------------- misc ---------------- */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-5 first:mt-0 text-[10.5px] font-bold uppercase tracking-[.14em] text-brass-600">{children}</p>;
}
export function MiniStat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-paper-200 bg-paper-100/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-ink-400">{label}</p>
      <p className={`num mt-0.5 truncate text-[14.5px] font-semibold ${tone ?? "text-ink-800"}`}>{value}</p>
    </div>
  );
}
