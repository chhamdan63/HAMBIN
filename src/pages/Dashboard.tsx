import { useMemo } from "react";
import { ArrowUpRight, FileText, PlaneTakeoff, Ship as ShipIcon, TrendingUp, Wallet } from "lucide-react";
import { FxStrip, PageHead } from "../components/shell";
import { Card, Kpi, Pill, Empty } from "../components/ui";
import { Donut, MonthBars, ProfitArea, RankBars } from "../components/charts";
import { dashStats, invoicePaidAmount, invoiceStatus, orderRevenue, orderTotals, useStore } from "../lib/store";
import { fc, fm, fmtCompact, fmtDate, fmtDateTime, monthKey, monthLabel } from "../lib/money";

const ORDER_PIPELINE = ["Draft", "Confirmed", "Supplier Ordered", "China Warehouse", "Ready for Shipment", "In Transit", "Customs", "Delivered", "Completed"];

export default function Dashboard() {
  const { db, user, nav, can } = useStore();
  const s = useMemo(() => dashStats(db), [db]);
  const monthData = s.months.map((m) => ({ label: monthLabel(m.key), revenue: m.revenue, cost: m.cost }));
  const profitData = s.months.map((m) => ({ label: monthLabel(m.key), profit: m.profit - Math.round(s.expenses / 6) }));

  const recent = [
    ...db.payments.filter((p) => !p.void).slice(0, 4).map((p) => ({ id: `p-${p.id}`, at: p.createdAt, icon: <Wallet className="h-3.5 w-3.5" />, text: `${p.type} · ${fc(p.currency, p.amount)}`, ref: p.number, tone: "ok" as const, page: "finance" })),
    ...db.invoices.slice(0, 3).map((i) => ({ id: `i-${i.id}`, at: i.createdAt, icon: <FileText className="h-3.5 w-3.5" />, text: `Invoice ${fc("PKR", i.grandTotalPkr)}`, ref: i.number, tone: "brass" as const, page: "invoices" })),
    ...db.shipments.slice(0, 3).map((sh) => ({ id: `s-${sh.id}`, at: sh.createdAt, icon: sh.method === "Air" ? <PlaneTakeoff className="h-3.5 w-3.5" /> : <ShipIcon className="h-3.5 w-3.5" />, text: `${sh.method} · ${sh.origin} → ${sh.destination}`, ref: sh.number, tone: "info" as const, page: "shipments" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const money = (n: number) => `PKR ${fmtCompact(n)}`;

  return (
    <div className="space-y-4">
      <PageHead
        title={`${greet}, ${user?.name.split(" ")[0]} — the trade desk is live`}
        sub={<span>{db.orders.filter((o) => !["Draft", "Cancelled"].includes(o.status)).length} open orders · {s.activeShipments} shipments moving · board rates frozen into every confirmation</span>}
        actions={can("costing", "edit") ? [
          <button key="1" onClick={() => nav("costing")} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 py-2 text-[12.5px] font-semibold text-paper-100 transition-all hover:bg-ink-800 active:scale-[.97]"><TrendingUp className="h-4 w-4 text-brass-400" />Run cost estimate</button>,
        ] : undefined}
      />

      <FxStrip />

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Total Revenue" value={s.revenue} format={money} tone="good" sub={`${s.orderCount} live orders`} onClick={() => nav("reports", undefined, { tab: "profit" })} />
        <Kpi label="Landed Cost" value={s.landed} format={money} sub="product + freight + customs" onClick={() => nav("reports", undefined, { tab: "profit" })} />
        <Kpi label="Gross Profit" value={s.gross} format={money} tone="brass" sub={`net ${money(s.netProfit)} after overhead`} onClick={() => nav("reports", undefined, { tab: "profit" })} />
        <Kpi label="Client Receivables" value={s.receivables} format={money} tone={s.receivables > 0 ? "bad" : "good"} sub={`${s.overdueInvoices.length} overdue invoice(s)`} onClick={() => nav("reports", undefined, { tab: "receivables" })} />
        <Kpi label="Supplier Payables" value={s.payables} format={money} sub="RMB / USD ledgers in PKR" onClick={() => nav("finance", undefined, { tab: "supplierledger" })} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total Orders" value={s.orderCount} format={(n) => fm(n)} onClick={() => nav("orders")} />
        <Kpi label="Pending Orders" value={s.pendingOrders} format={(n) => fm(n)} sub="draft → ready for shipment" onClick={() => nav("orders")} />
        <Kpi label="Delivered / Completed" value={s.deliveredOrders} format={(n) => fm(n)} tone="good" onClick={() => nav("orders")} />
        <Kpi label="Active Shipments" value={s.activeShipments} format={(n) => fm(n)} tone="brass" onClick={() => nav("shipments")} />
      </div>

      {/* pipeline */}
      <div className="rounded-xl border border-paper-300/90 bg-white p-3 shadow-[0_1px_2px_rgba(20,40,35,.05)]">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="disp text-[11px] font-bold uppercase tracking-[.14em] text-ink-500">Order pipeline</p>
          <button onClick={() => nav("orders")} className="text-[11.5px] font-semibold text-brand-600 hover:underline">All orders →</button>
        </div>
        <div className="grid grid-cols-3 gap-1.5 md:grid-cols-9">
          {ORDER_PIPELINE.map((st, i) => {
            const n = db.orders.filter((o) => o.status === st).length;
            return (
              <button key={st} onClick={() => nav("orders", undefined, { status: st })}
                className={`group rounded-lg border px-1.5 py-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-md ${n > 0 ? "border-ink-800 bg-ink-900" : "border-paper-200 bg-paper-100"}`}>
                <p className={`num text-[16px] font-bold leading-none ${n > 0 ? "text-brass-400" : "text-ink-300"}`}>{n}</p>
                <p className={`mt-1 text-[9px] font-semibold uppercase leading-tight tracking-wide ${n > 0 ? "text-ink-200" : "text-ink-400"}`}>{st}</p>
                <span className="mx-auto mt-1 block h-[3px] w-6 rounded-full bg-brass-400 opacity-0 transition-opacity group-hover:opacity-100" style={{ animationDelay: `${i * 40}ms` }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Revenue vs Landed Cost" sub="last 6 months · from confirmed orders" className="xl:col-span-2">
          <MonthBars data={monthData} series={[{ key: "revenue", name: "Sales revenue", color: "#0e6b5e" }, { key: "cost", name: "Landed cost", color: "#c2922e" }]} />
        </Card>
        <Card title="Shipment Status" sub="all active & historic">
          <Donut data={s.shipmentsByStatus} />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Monthly Net Profit" sub="gross profit − allocated overhead">
          <ProfitArea data={profitData} />
        </Card>
        <Card title="Client-wise Revenue & Profit" sub="top accounts">
          <RankBars data={s.topClients.map((c) => ({ name: c.name, value: c.revenue, value2: c.profit }))} />
        </Card>
        <Card title="Expense Breakdown" sub={`total ${fc("PKR", s.expenses)}`}>
          <Donut data={s.expenseByCategory} money />
        </Card>
      </div>

      {/* activity + receivables */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Recent Activity" sub="payments · invoices · shipments" pad={false}>
          <div className="divide-y divide-paper-200">
            {recent.map((r) => (
              <button key={r.id} onClick={() => nav(r.page)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper-100">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${r.tone === "ok" ? "bg-ok-100 text-ok-600" : r.tone === "brass" ? "bg-brass-100 text-brass-600" : "bg-info-100 text-info-600"}`}>{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink-800">{r.text}</p>
                  <p className="num text-[10.5px] text-ink-400">{r.ref}</p>
                </div>
                <span className="num shrink-0 text-[10.5px] text-ink-300">{fmtDateTime(r.at)}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />
              </button>
            ))}
            {recent.length === 0 && <div className="p-4"><Empty title="No activity yet" /></div>}
          </div>
        </Card>
        <Card title="Pending Receivables" sub="invoices awaiting payment" pad={false}
          actions={<button onClick={() => nav("invoices")} className="text-[11.5px] font-semibold text-brand-600 hover:underline">Invoices →</button>}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
              <tbody>
                {db.invoices.filter((i) => !i.void).slice(0, 6).map((i) => {
                  const paid = invoicePaidAmount(db, i.id);
                  const st = invoiceStatus(i, paid);
                  const c = db.clients.find((x) => x.id === i.clientId);
                  return (
                    <tr key={i.id} className="cursor-pointer" onClick={() => nav("invoices", i.id)}>
                      <td className="num font-semibold text-brand-700">{i.number}</td>
                      <td>{c?.company ?? "—"}</td>
                      <td className="num">{fmtDate(i.dueDate)}</td>
                      <td className="num text-right font-semibold">{fc("PKR", Math.max(0, i.grandTotalPkr - paid))}</td>
                      <td><Pill label={st.label} tone={st.tone} /></td>
                    </tr>
                  );
                })}
                {db.invoices.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-300">No invoices yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* recent orders strip */}
      <Card title="Recent Orders" sub="snapshot-frozen landed costs" pad={false}
        actions={<button onClick={() => nav("orders")} className="text-[11.5px] font-semibold text-brand-600 hover:underline">Orders →</button>}>
        <div className="overflow-x-auto scroll-thin">
          <table className="hk-table w-full">
            <thead><tr><th>Order</th><th>Client</th><th>Date</th><th className="text-right">Revenue</th><th className="text-right">Gross profit</th><th>Status</th></tr></thead>
            <tbody>
              {db.orders.slice(0, 6).map((o) => {
                const t = orderTotals(o);
                const c = db.clients.find((x) => x.id === o.clientId);
                return (
                  <tr key={o.id} className="cursor-pointer" onClick={() => nav("orders", o.id)}>
                    <td className="num font-semibold text-brand-700">{o.number}</td>
                    <td>{c?.company ?? "—"}</td>
                    <td className="num">{fmtDate(o.date)}</td>
                    <td className="num text-right font-semibold">{fc("PKR", orderRevenue(o))}</td>
                    <td className={`num text-right font-semibold ${t.grossProfit >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fc("PKR", t.grossProfit)}</td>
                    <td><Pill label={o.status} pulse={["In Transit", "Customs"].includes(o.status)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="num text-center text-[10px] text-ink-300">months tracked: {s.months.map((m) => monthKey(m.key)).join(" · ")}</p>
    </div>
  );
}
