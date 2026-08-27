import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Empty, Field, Pill, Tabs, inp } from "../components/ui";
import { RankBars } from "../components/charts";
import { allocateOverhead } from "../lib/costing";
import { clientOutstanding, invoicePaidAmount, orderRevenue, orderTotals, supplierOutstanding, useStore } from "../lib/store";
import { downloadCSV, fc, fm, fmtDate, isOverdue, monthKey, monthLabel, r2, sub, sum, todayISO } from "../lib/money";

const REPORT_TABS = [
  { id: "profit", label: "Profit" },
  { id: "sales", label: "Sales" },
  { id: "receivables", label: "Receivables" },
  { id: "payables", label: "Payables" },
  { id: "shipments", label: "Shipments" },
];

export default function Reports() {
  const { db, route, nav } = useStore();
  const [tab, setTab] = useState((route.carry as { tab?: string } | undefined)?.tab ?? "profit");
  const [subTab, setSub] = useState("orders");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clientId, setClientId] = useState("all");

  const live = useMemo(() => db.orders.filter((o) => o.status !== "Draft" && o.status !== "Cancelled")
    .filter((o) => (!from || o.date >= from) && (!to || o.date <= to))
    .filter((o) => clientId === "all" || o.clientId === clientId), [db.orders, from, to, clientId]);

  const totalRevenue = sum(live, orderRevenue);
  const totalGross = sum(live, (o) => orderTotals(o).grossProfit);
  const expenses = sum(db.expenses, (e) => e.amountPkr);

  const byOrder = live.map((o) => {
    const t = orderTotals(o);
    return { o, t, net: allocateOverhead(t.grossProfit, expenses, t.revenue, totalRevenue) };
  }).sort((a, b) => b.t.grossProfit - a.t.grossProfit);

  const byClient = db.clients.map((c) => {
    const os = live.filter((o) => o.clientId === c.id);
    const revenue = sum(os, orderRevenue);
    const gross = sum(os, (o) => orderTotals(o).grossProfit);
    return { name: c.company, id: c.id, revenue, gross, net: allocateOverhead(gross, expenses, revenue, totalRevenue), orders: os.length };
  }).filter((x) => x.orders > 0).sort((a, b) => b.revenue - a.revenue);

  const byProduct = db.products.map((p) => {
    const lines = live.flatMap((o) => o.items.filter((i) => i.productId === p.id).map((i) => ({ o, i })));
    const qty = sum(lines, ({ i }) => i.snapshot.qty);
    const revenue = sum(lines, ({ i }) => i.snapshot.sellingPricePkr);
    const landed = sum(lines, ({ i }) => i.snapshot.landedCostPkr);
    return { name: p.name, qty, revenue, gross: sub(revenue, landed), landed };
  }).filter((x) => x.revenue > 0).sort((a, b) => b.gross - a.gross);

  const byMonth = useMemo(() => {
    const map = new Map<string, { revenue: number; landed: number; gross: number; expenses: number }>();
    live.forEach((o) => {
      const k = monthKey(o.date);
      const t = orderTotals(o);
      const m = map.get(k) ?? { revenue: 0, landed: 0, gross: 0, expenses: 0 };
      m.revenue = r2(m.revenue + t.revenue); m.landed = r2(m.landed + t.landed); m.gross = r2(m.gross + t.grossProfit);
      map.set(k, m);
    });
    db.expenses.forEach((e) => {
      const k = monthKey(e.date);
      const m = map.get(k) ?? { revenue: 0, landed: 0, gross: 0, expenses: 0 };
      m.expenses = r2(m.expenses + e.amountPkr);
      map.set(k, m);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ month: k, ...v, net: sub(v.gross, v.expenses) }));
  }, [live, db.expenses]);

  const receivables = db.clients.map((c) => ({ c, out: clientOutstanding(db, c.id) })).filter((x) => x.out !== 0).sort((a, b) => b.out - a.out);
  const payables = db.suppliers.map((s) => ({ s, out: supplierOutstanding(db, s.id) })).filter((x) => x.out !== 0).sort((a, b) => b.out - a.out);
  const openInvoices = db.invoices.filter((i) => !i.void && invoicePaidAmount(db, i.id) < i.grandTotalPkr - 0.5);

  return (
    <div>
      <PageHead title="Analytics & Reports" sub={`Actual profit from frozen snapshots · overhead ${fc("PKR", expenses)} allocated pro-rata to revenue`} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Tabs tabs={REPORT_TABS} active={tab} onChange={setTab} />
          <div className="ml-auto flex flex-wrap items-end gap-2.5">
            <Field label="From"><input type="date" className={`${inp} w-auto`} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input type="date" className={`${inp} w-auto`} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Client">
              <select className={`${inp} w-auto`} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="all">All clients</option>
                {db.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </Field>
            {(from || to || clientId !== "all") && <Btn size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); setClientId("all"); }}>Clear</Btn>}
          </div>
        </div>
      </Card>

      {tab === "profit" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Sales revenue", totalRevenue, "text-ink-900"], ["Landed cost", sum(live, (o) => orderTotals(o).landed), "text-ink-900"],
              ["Gross profit", totalGross, totalGross >= 0 ? "text-ok-600" : "text-bad-600"], ["Net (after overhead)", sub(totalGross, expenses), sub(totalGross, expenses) >= 0 ? "text-ok-600" : "text-bad-600"],
            ].map(([l, v, tone]) => (
              <div key={l as string} className="rounded-xl border border-paper-300 bg-white p-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-ink-400">{l}</p>
                <p className={`num mt-1 text-[18px] font-bold ${tone}`}>{fc("PKR", v as number)}</p>
              </div>
            ))}
          </div>
          <Card pad={false} title="Profit report" sub="net profit = gross profit − overhead allocated by revenue share"
            actions={<div className="flex gap-1.5">
              {["orders", "clients", "products", "monthly"].map((s2) => (
                <button key={s2} onClick={() => setSub(s2)} className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition-all ${subTab === s2 ? "bg-ink-900 text-brass-300" : "bg-paper-200 text-ink-500 hover:bg-paper-300"}`}>{s2}</button>
              ))}
              <Btn size="sm" variant="outline" onClick={() => {
                if (subTab === "orders") downloadCSV("order-profit.csv", ["Order", "Client", "Date", "Revenue", "Landed", "Gross", "Overhead", "Net"], byOrder.map(({ o, t, net }) => [o.number, db.clients.find((c) => c.id === o.clientId)?.company ?? "", o.date, t.revenue, t.landed, t.grossProfit, r2(t.grossProfit - net), net]));
                if (subTab === "clients") downloadCSV("client-profit.csv", ["Client", "Orders", "Revenue", "Gross", "Net"], byClient.map((x) => [x.name, x.orders, x.revenue, x.gross, x.net]));
                if (subTab === "products") downloadCSV("product-profit.csv", ["Product", "Qty", "Revenue", "Landed", "Gross"], byProduct.map((x) => [x.name, x.qty, x.revenue, x.landed, x.gross]));
                if (subTab === "monthly") downloadCSV("monthly-profit.csv", ["Month", "Revenue", "Landed", "Gross", "Expenses", "Net"], byMonth.map((m) => [m.month, m.revenue, m.landed, m.gross, m.expenses, m.net]));
              }}><Download className="h-3.5 w-3.5" />CSV</Btn>
            </div>}>
            <div className="overflow-x-auto scroll-thin">
              {subTab === "orders" && (
                <table className="hk-table w-full">
                  <thead><tr><th>Order</th><th>Client</th><th>Date</th><th className="text-right">Revenue</th><th className="text-right">Landed</th><th className="text-right">Gross</th><th className="text-right">Overhead</th><th className="text-right">Net</th><th className="text-right">Margin</th></tr></thead>
                  <tbody>
                    {byOrder.map(({ o, t, net }) => (
                      <tr key={o.id} className="cursor-pointer" onClick={() => nav("orders", o.id)}>
                        <td className="num font-semibold text-brand-700">{o.number}</td>
                        <td>{db.clients.find((c) => c.id === o.clientId)?.company}</td>
                        <td className="num">{fmtDate(o.date)}</td>
                        <td className="num text-right">{fm(t.revenue)}</td>
                        <td className="num text-right text-ink-500">{fm(t.landed)}</td>
                        <td className={`num text-right font-semibold ${t.grossProfit >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fm(t.grossProfit)}</td>
                        <td className="num text-right text-bad-600">−{fm(r2(t.grossProfit - net))}</td>
                        <td className={`num text-right font-bold ${net >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fm(net)}</td>
                        <td className="num text-right">{fm(t.marginPct)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {subTab === "clients" && (
                <table className="hk-table w-full">
                  <thead><tr><th>Client</th><th className="text-right">Orders</th><th className="text-right">Revenue</th><th className="text-right">Gross</th><th className="text-right">Net</th><th className="text-right">Net %</th></tr></thead>
                  <tbody>
                    {byClient.map((x) => (
                      <tr key={x.id} className="cursor-pointer" onClick={() => nav("clients", x.id)}>
                        <td className="font-semibold text-ink-900">{x.name}</td>
                        <td className="num text-right">{x.orders}</td>
                        <td className="num text-right">{fm(x.revenue)}</td>
                        <td className="num text-right text-ok-600">{fm(x.gross)}</td>
                        <td className={`num text-right font-bold ${x.net >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fm(x.net)}</td>
                        <td className="num text-right">{x.revenue ? fm((x.net / x.revenue) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {subTab === "products" && (
                <table className="hk-table w-full">
                  <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">Revenue</th><th className="text-right">Landed</th><th className="text-right">Gross</th></tr></thead>
                  <tbody>
                    {byProduct.map((x) => (
                      <tr key={x.name}>
                        <td className="font-semibold text-ink-900">{x.name}</td>
                        <td className="num text-right">{fm(x.qty)}</td>
                        <td className="num text-right">{fm(x.revenue)}</td>
                        <td className="num text-right text-ink-500">{fm(x.landed)}</td>
                        <td className={`num text-right font-bold ${x.gross >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fm(x.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {subTab === "monthly" && (
                <table className="hk-table w-full">
                  <thead><tr><th>Month</th><th className="text-right">Revenue</th><th className="text-right">Landed</th><th className="text-right">Gross</th><th className="text-right">Expenses</th><th className="text-right">Net</th></tr></thead>
                  <tbody>
                    {byMonth.map((m) => (
                      <tr key={m.month}>
                        <td className="num font-semibold text-brand-700">{monthLabel(m.month)}</td>
                        <td className="num text-right">{fm(m.revenue)}</td>
                        <td className="num text-right text-ink-500">{fm(m.landed)}</td>
                        <td className="num text-right text-ok-600">{fm(m.gross)}</td>
                        <td className="num text-right text-bad-600">−{fm(m.expenses)}</td>
                        <td className={`num text-right font-bold ${m.net >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fm(m.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {live.length === 0 && <div className="p-6"><Empty title="No orders in range" /></div>}
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Client profitability"><RankBars data={byClient.slice(0, 6).map((x) => ({ name: x.name, value: x.revenue, value2: Math.max(0, x.net) }))} /></Card>
            <Card title="Product profitability"><RankBars data={byProduct.slice(0, 6).map((x) => ({ name: x.name, value: x.revenue, value2: Math.max(0, x.gross) }))} color="#c2922e" /></Card>
          </div>
        </div>
      )}

      {tab === "sales" && (
        <Card pad={false} title="Sales register" sub="invoice-backed revenue"
          actions={<Btn size="sm" variant="outline" onClick={() => downloadCSV("sales.csv", ["Invoice", "Client", "Date", "Due", "Total", "Paid", "Balance", "Status"], db.invoices.filter((i) => !i.void).map((i) => { const paid = invoicePaidAmount(db, i.id); return [i.number, db.clients.find((c) => c.id === i.clientId)?.company ?? "", i.date, i.dueDate, i.grandTotalPkr, paid, Math.max(0, i.grandTotalPkr - paid), paid >= i.grandTotalPkr ? "Paid" : paid > 0 ? "Partial" : isOverdue(i.dueDate) ? "Overdue" : "Unpaid"]; }))}><Download className="h-3.5 w-3.5" />CSV</Btn>}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
              <tbody>
                {db.invoices.filter((i) => !i.void).map((i) => {
                  const paid = invoicePaidAmount(db, i.id);
                  const bal = Math.max(0, i.grandTotalPkr - paid);
                  return (
                    <tr key={i.id} className="cursor-pointer" onClick={() => nav("invoices", i.id)}>
                      <td className="num font-semibold text-brand-700">{i.number}</td>
                      <td>{db.clients.find((c) => c.id === i.clientId)?.company}</td>
                      <td className="num">{fmtDate(i.date)}</td>
                      <td className="num text-right font-semibold">{fm(i.grandTotalPkr)}</td>
                      <td className="num text-right text-ok-600">{fm(paid)}</td>
                      <td className="num text-right text-bad-600">{bal ? fm(bal) : "—"}</td>
                      <td><Pill label={paid >= i.grandTotalPkr ? "Paid" : paid > 0 ? "Partially Paid" : isOverdue(i.dueDate) ? "Overdue" : "Unpaid"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "receivables" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card pad={false} title="Client balances" sub="from the live ledger"
            actions={<Btn size="sm" variant="outline" onClick={() => downloadCSV("receivables.csv", ["Client", "Balance PKR", "Credit Limit", "Utilisation %"], receivables.map(({ c, out }) => [c.company, out, c.creditLimit, c.creditLimit ? Math.round((Math.max(0, out) / c.creditLimit) * 100) : 0]))}><Download className="h-3.5 w-3.5" />CSV</Btn>}>
            <div className="overflow-x-auto scroll-thin">
              <table className="hk-table w-full">
                <thead><tr><th>Client</th><th className="text-right">Balance</th><th className="text-right">Credit limit</th><th className="text-right">Utilisation</th></tr></thead>
                <tbody>
                  {receivables.map(({ c, out }) => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => nav("clients", c.id)}>
                      <td className="font-semibold text-ink-900">{c.company}</td>
                      <td className={`num text-right font-bold ${out > 0 ? "text-bad-600" : "text-ok-600"}`}>{out > 0 ? fc("PKR", out) : `advance ${fc("PKR", -out)}`}</td>
                      <td className="num text-right">{fm(c.creditLimit)}</td>
                      <td className="num text-right">{c.creditLimit && out > 0 ? `${Math.round((out / c.creditLimit) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                  {receivables.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-ink-300">All accounts settled</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card pad={false} title="Open invoices & ageing">
            <div className="overflow-x-auto scroll-thin">
              <table className="hk-table w-full">
                <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="text-right">Balance</th><th>Ageing</th></tr></thead>
                <tbody>
                  {openInvoices.map((i) => {
                    const days = Math.max(0, Math.round((Date.parse(todayISO()) - Date.parse(i.dueDate)) / 86400000));
                    return (
                      <tr key={i.id} className="cursor-pointer" onClick={() => nav("invoices", i.id)}>
                        <td className="num font-semibold text-brand-700">{i.number}</td>
                        <td>{db.clients.find((c) => c.id === i.clientId)?.company}</td>
                        <td className="num">{fmtDate(i.dueDate)}</td>
                        <td className="num text-right font-semibold text-bad-600">{fc("PKR", i.grandTotalPkr - invoicePaidAmount(db, i.id))}</td>
                        <td><Pill label={days > 0 ? `${days}d overdue` : "not due"} tone={days > 30 ? "bad" : days > 0 ? "warn" : "muted"} /></td>
                      </tr>
                    );
                  })}
                  {openInvoices.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-300">Nothing outstanding</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "payables" && (
        <Card pad={false} title="Supplier payables" sub="foreign purchases converted at each transaction's stored rate"
          actions={<Btn size="sm" variant="outline" onClick={() => downloadCSV("payables.csv", ["Supplier", "Payable PKR", "Currency", "Terms"], payables.map(({ s, out }) => [s.name, out, s.currency, s.paymentTerms]))}><Download className="h-3.5 w-3.5" />CSV</Btn>}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Supplier</th><th>Location</th><th>Terms</th><th className="text-right">Payable (PKR)</th></tr></thead>
              <tbody>
                {payables.map(({ s, out }) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => nav("suppliers", s.id)}>
                    <td className="font-semibold text-ink-900">{s.name}</td>
                    <td className="text-[12px]">{s.city}, {s.country}</td>
                    <td className="text-[12px]">{s.paymentTerms}</td>
                    <td className="num text-right font-bold text-warn-600">{fc("PKR", out)}</td>
                  </tr>
                ))}
                {payables.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-ink-300">All suppliers settled</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "shipments" && (
        <Card pad={false} title="Shipment register" sub="freight spend and status"
          actions={<Btn size="sm" variant="outline" onClick={() => downloadCSV("shipments-report.csv", ["Shipment", "Method", "Route", "Carrier", "ETD", "ETA", "CBM/KG", "Status"], db.shipments.map((s) => [s.number, s.method, `${s.origin} → ${s.destination}`, s.forwarder, s.method === "Air" ? s.air?.departure ?? "" : s.sea?.etd ?? "", s.method === "Air" ? s.air?.arrival ?? "" : s.sea?.eta ?? "", s.method === "Air" ? `${s.air?.weightKg ?? 0} kg` : `${s.sea?.cbm ?? 0} cbm`, s.status]))}><Download className="h-3.5 w-3.5" />CSV</Btn>}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Shipment</th><th>Method</th><th>Route</th><th>Carrier</th><th>Departure</th><th>Arrival</th><th>Status</th></tr></thead>
              <tbody>
                {db.shipments.map((s) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => nav("shipments", s.id)}>
                    <td className="num font-semibold text-brand-700">{s.number}</td>
                    <td>{s.method}</td>
                    <td className="num text-[11.5px]">{s.origin} → {s.destination}</td>
                    <td className="text-[12px]">{s.method === "Air" ? s.air?.airline : s.sea?.vessel}</td>
                    <td className="num">{fmtDate(s.method === "Air" ? s.air?.departure ?? "" : s.sea?.etd ?? "")}</td>
                    <td className="num">{fmtDate(s.method === "Air" ? s.air?.arrival ?? "" : s.sea?.eta ?? "")}</td>
                    <td><Pill label={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
