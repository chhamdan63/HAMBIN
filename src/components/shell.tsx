/* App shell: ink sidebar with grouped module navigation, topbar with
   live FX chips, notifications and user menu. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Anchor, Bell, Boxes, Calculator, ChevronDown, Factory, FileText,
  Gauge, LogOut, Menu, PackageSearch, Receipt,
  Settings, Ship, ShoppingCart, Users2, Wallet,
} from "lucide-react";
import { currentRate, useStore } from "../lib/store";
import { fmtDateTime } from "../lib/money";
import { BrandMark, Pill } from "./ui";
import { ROLE_LABEL } from "../lib/store";

interface NavLeaf { label: string; page: string; tab?: string; icon: ReactNode; }
interface NavGroup { label: string; items: NavLeaf[]; }

const icon = (n: ReactNode) => n;

const NAV: NavGroup[] = [
  { label: "Overview", items: [
    { label: "Dashboard", page: "dashboard", icon: icon(<Gauge className="h-4 w-4" />) },
  ]},
  { label: "CRM", items: [
    { label: "Clients", page: "clients", icon: icon(<Users2 className="h-4 w-4" />) },
    { label: "Suppliers", page: "suppliers", icon: icon(<Factory className="h-4 w-4" />) },
  ]},
  { label: "Products", items: [
    { label: "Product Master", page: "products", icon: icon(<Boxes className="h-4 w-4" />) },
  ]},
  { label: "Sourcing", items: [
    { label: "Sourcing Requests", page: "sourcing", tab: "requests", icon: icon(<PackageSearch className="h-4 w-4" />) },
    { label: "Cost Calculator", page: "costing", icon: icon(<Calculator className="h-4 w-4" />) },
  ]},
  { label: "Sales", items: [
    { label: "Quotations", page: "quotations", icon: icon(<FileText className="h-4 w-4" />) },
    { label: "Orders", page: "orders", icon: icon(<ShoppingCart className="h-4 w-4" />) },
    { label: "Invoices", page: "invoices", icon: icon(<Receipt className="h-4 w-4" />) },
  ]},
  { label: "Logistics", items: [
    { label: "Shipments", page: "shipments", icon: icon(<Ship className="h-4 w-4" />) },
  ]},
  { label: "Finance", items: [
    { label: "Payments", page: "finance", tab: "payments", icon: icon(<Wallet className="h-4 w-4" />) },
  ]},
  { label: "Reports", items: [
    { label: "Profit & Sales", page: "reports", tab: "profit", icon: icon(<Anchor className="h-4 w-4" />) },
  ]},
  { label: "Settings", items: [
    { label: "Company & Users", page: "settings", tab: "company", icon: icon(<Settings className="h-4 w-4" />) },
  ]},
];

const PAGE_TITLE: Record<string, { group: string; title: string }> = {
  dashboard: { group: "Overview", title: "Command Deck" },
  clients: { group: "CRM", title: "Clients" },
  suppliers: { group: "CRM", title: "Suppliers" },
  products: { group: "Products", title: "Product Master" },
  sourcing: { group: "Sourcing", title: "Sourcing Desk" },
  costing: { group: "Sourcing", title: "Product Cost Estimator" },
  quotations: { group: "Sales", title: "Client Quotations" },
  orders: { group: "Sales", title: "Orders" },
  invoices: { group: "Sales", title: "Invoices" },
  shipments: { group: "Logistics", title: "Shipments & Freight" },
  finance: { group: "Finance", title: "Finance & Ledgers" },
  reports: { group: "Reports", title: "Analytics & Reports" },
  settings: { group: "Settings", title: "System Settings" },
};

function Brand({ logo }: { logo?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
      <span className="flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brass-400/15 px-1 ring-1 ring-brass-400/40">
        <BrandMark logo={logo} size={30} maxWidth={88} />
      </span>
      <div className="leading-tight">
        <p className="disp text-[14.5px] font-bold tracking-wide text-paper-100">HAMBIN</p>
        <p className="text-[9.5px] font-semibold uppercase tracking-[.18em] text-ink-400">Intl Trading · ERP</p>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { db, user, route, nav, can, logout, markNotice, markAllNotices } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  /* hover-driven submenus: at most ONE group is open at any moment */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  /* touch devices (tablets/phones) have no hover — click becomes the fallback */
  const [isTouch] = useState(() => window.matchMedia("(hover: none), (pointer: coarse)").matches);
  const bellRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = window.setInterval(() => setClock(new Date()), 30000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { setMobileOpen(false); setBellOpen(false); setUserOpen(false); }, [route]);

  /* keep the section that owns the current page open after navigation */
  useEffect(() => {
    const owner = NAV.find((gr) => gr.items.some((i) => i.page === route.page));
    if (owner) setOpenGroup(owner.label);
  }, [route.page]);

  const unread = db.notices.filter((n) => !n.read).length;
  const rmb = currentRate(db, "RMB");
  const usd = currentRate(db, "USD");
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.page, "view")) })).filter((g) => g.items.length > 0);
  const meta = PAGE_TITLE[route.page] ?? { group: "", title: "" };

  const sidebar = (
    <div className="ink-topo flex h-full flex-col bg-ink-900">
      <Brand logo={db.settings.logo} />
      {/* leaving the nav closes every submenu; hovering a group opens it (and only it) */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4 scroll-thin" onMouseLeave={() => setOpenGroup(null)}>
        {groups.map((g) => {
          const open = openGroup === g.label;
          const groupActive = g.items.some((i) => i.page === route.page);
          return (
            <div key={g.label} className="mb-1" onMouseEnter={() => setOpenGroup(g.label)}>
              {/* section header — hover opens on desktop, tap toggles on touch */}
              <button
                onClick={() => { if (isTouch) setOpenGroup(open ? null : g.label); }}
                onFocus={() => setOpenGroup(g.label)}
                aria-expanded={open}
                className="group mb-0.5 flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-ink-850/70">
                <span className={`flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[.2em] transition-colors ${groupActive && open ? "text-brass-400" : "text-ink-500 group-hover:text-ink-300"}`}>
                  {!open && groupActive && <span className="h-1 w-1 rounded-full bg-brass-400" />}
                  {g.label}
                </span>
                <span className="flex items-center gap-1">
                  <span className={`num text-[9px] font-semibold text-ink-600 transition-opacity ${open ? "opacity-0" : "opacity-100"}`}>{g.items.length}</span>
                  <ChevronDown className={`h-3 w-3 text-ink-500 transition-transform duration-200 ease-out ${open ? "" : "-rotate-90"} ${groupActive ? "text-brass-400/70" : ""}`} />
                </span>
              </button>
              {/* animated body — grid-rows trick gives a real height transition */}
              <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  {g.items.map((i) => {
                    const isExact = i.page === route.page && (i.tab ? (route.carry as { tab?: string } | undefined)?.tab === i.tab : !(route.carry as { tab?: string } | undefined)?.tab);
                    return (
                      <button key={i.label} onClick={() => nav(i.page, undefined, i.tab ? { tab: i.tab } : undefined)}
                        className={`group relative mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7.5px] text-left text-[12.5px] font-medium transition-all duration-150 ${isExact ? "bg-ink-800 text-brass-300" : "text-ink-300 hover:bg-ink-850 hover:text-paper-100"}`}>
                        <span className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-brass-400 transition-all ${isExact ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`} />
                        <span className={isExact ? "text-brass-400" : "text-ink-400 group-hover:text-ink-200"}>{i.icon}</span>
                        {i.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-ink-800 p-3.5">
        <div className="flex items-center gap-2.5 rounded-lg bg-ink-850 px-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-[12px] font-bold text-white">
            {user?.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[12px] font-semibold text-paper-100">{user?.name}</p>
            <p className="text-[10px] text-ink-400">{user ? ROLE_LABEL[user.role] : ""}</p>
          </div>
          <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-bad-600">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2.5 text-center text-[9.5px] text-ink-600">Hambin ERP v2.4 · audit trail on</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] lg:block">{sidebar}</aside>
      {/* mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60 anim-fade" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[248px] anim-slide">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[228px]">
        {/* topbar */}
        <header className="sticky top-0 z-20 border-b border-paper-300 bg-paper-100/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
            <button className="rounded-md p-1.5 text-ink-500 hover:bg-paper-200 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-brass-600">{meta.group}</p>
              <h1 className="disp truncate text-[16px] font-bold leading-tight text-ink-900">{meta.title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* FX chips */}
              <div className="hidden items-center gap-1.5 md:flex">
                <span className="num rounded-md border border-paper-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-600">RMB <b className="text-brand-700">{rmb.toFixed(2)}</b></span>
                <span className="num rounded-md border border-paper-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-600">USD <b className="text-brand-700">{usd.toFixed(2)}</b></span>
              </div>
              <span className="num hidden text-[11px] text-ink-400 xl:block">
                {clock.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })} · {clock.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>

              {/* notifications */}
              <div className="relative" ref={bellRef}>
                <button onClick={() => setBellOpen((v) => !v)} className="relative rounded-lg border border-paper-300 bg-white p-2 text-ink-500 transition-colors hover:border-brass-400 hover:text-brass-600" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad-600 px-1 text-[9.5px] font-bold text-white">{unread}</span>}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-[330px] anim-rise rounded-xl border border-paper-300 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-paper-200 px-3.5 py-2.5">
                      <p className="disp text-[12px] font-bold uppercase tracking-wider text-ink-600">Notifications</p>
                      <button onClick={markAllNotices} className="text-[11px] font-semibold text-brand-600 hover:underline">Mark all read</button>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto scroll-thin">
                      {db.notices.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-ink-300">All quiet on the trade route.</p>}
                      {db.notices.slice(0, 12).map((n) => (
                        <button key={n.id} onClick={() => markNotice(n.id)} className={`block w-full border-b border-paper-100 px-3.5 py-2.5 text-left transition-colors hover:bg-paper-100 ${n.read ? "opacity-60" : ""}`}>
                          <div className="flex items-center gap-2">
                            {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass-500" />}
                            <p className="text-[12px] font-semibold text-ink-800">{n.title}</p>
                            <span className="num ml-auto shrink-0 text-[10px] text-ink-300">{fmtDateTime(n.at)}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-500">{n.body}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* user */}
              <div className="relative" ref={userRef}>
                <button onClick={() => setUserOpen((v) => !v)} className="flex items-center gap-2 rounded-lg border border-paper-300 bg-white py-1 pl-1 pr-2 transition-colors hover:border-brass-400">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-ink-900 text-[11px] font-bold text-brass-300">
                    {user?.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
                </button>
                {userOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-56 anim-rise rounded-xl border border-paper-300 bg-white p-1.5 shadow-xl">
                    <div className="border-b border-paper-100 px-2.5 py-2">
                      <p className="text-[12.5px] font-semibold text-ink-900">{user?.name}</p>
                      <p className="text-[11px] text-ink-400">{user?.email}</p>
                      <div className="mt-1.5"><Pill label={user ? ROLE_LABEL[user.role] : ""} tone="brass" /></div>
                    </div>
                    <button onClick={() => { nav("settings", undefined, { tab: "users" }); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-ink-600 hover:bg-paper-100">
                      <Settings className="h-4 w-4" /> Preferences & users
                    </button>
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-bad-600 hover:bg-bad-100">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-5 lg:px-6">{children}</main>
        <footer className="border-t border-paper-300 px-6 py-3 text-center text-[10.5px] text-ink-300">
          Hambin International Trading &amp; Consultancy — import lifecycle ERP · every confirmation stores an immutable rate &amp; cost snapshot
        </footer>
      </div>
    </div>
  );
}

export function FxStrip() {
  const { db } = useStore();
  const items = useMemo(() => {
    const list: string[] = [];
    (["RMB", "USD", "EUR"] as const).forEach((c) => {
      const sorted = db.exchangeRates.filter((x) => x.currency === c).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
      sorted.slice(0, 2).forEach((r, i) => list.push(`${i === 0 ? "●" : "○"} 1 ${c} = PKR ${r.rateToPkr.toFixed(2)} · ${r.effectiveDate}`));
    });
    return list;
  }, [db.exchangeRates]);
  return (
    <div className="overflow-hidden rounded-lg border border-ink-800 bg-ink-900 py-1.5">
      <div className="anim-marquee flex w-max gap-10 whitespace-nowrap">
        {[0, 1].map((k) => (
          <div key={k} className="flex gap-10">
            {items.map((t, i) => (
              <span key={i} className="num text-[11px] font-medium text-ink-300">
                <span className={t.startsWith("●") ? "text-brass-400" : "text-ink-500"}>{t.slice(0, 1)}</span> {t.slice(3)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="disp text-[21px] font-bold leading-tight text-ink-900">{title}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-ink-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
