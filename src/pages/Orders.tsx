import { useMemo, useState } from "react";
import { BadgeCheck, ChevronDown, Lock, Receipt, ShoppingCart, Wallet, XOctagon } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Field, MiniStat, Pager, paginate, Pill, SearchBox, inp } from "../components/ui";
import { invoicePaidAmount, orderPaidPkr, orderRevenue, orderTotals, useStore } from "../lib/store";
import { downloadCSV, fc, fm, fmtDate, r2, todayISO } from "../lib/money";

const FLOW = ["Draft", "Confirmed", "Supplier Ordered", "China Warehouse", "Ready for Shipment", "In Transit", "Customs", "Delivered", "Completed"];

export default function Orders() {
  const { db, route, nav, can, setOrderStatus, cancelOrder, createInvoice, confirm, toast } = useStore();
  const carry = route.carry as { status?: string } | undefined;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(carry?.status ?? "all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(route.id ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const editable = can("orders", "edit");
  const order = db.orders.find((o) => o.id === detailId) ?? null;

  const list = useMemo(() => db.orders
    .filter((o) => status === "all" || o.status === status)
    .filter((o) => {
      const c = db.clients.find((x) => x.id === o.clientId);
      return `${o.number} ${c?.company ?? ""} ${o.status}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db, q, status]);
  const pg = paginate(list, page, 9);

  const advanceOf = (o: (typeof db.orders)[number]) => r2((orderRevenue(o) * o.advanceRequiredPct) / 100);

  const onInvoice = async (oid: string) => {
    const ok = await confirm({ title: "Raise invoice?", message: "An invoice will be created from the order's frozen selling prices and posted as a debit to the client ledger.", confirmLabel: "Create invoice" });
    if (!ok) return;
    const id = createInvoice(oid);
    if (id) nav("invoices", id);
  };

  const onCancel = async (o: (typeof db.orders)[number]) => {
    const ok = await confirm({ title: "Cancel order?", message: `${o.number} will be cancelled. Ledger entries and the audit trail are retained — nothing is hard-deleted.`, danger: true, confirmLabel: "Cancel order" });
    if (ok) cancelOrder(o.id);
  };

  return (
    <div>
      <PageHead title="Orders" sub="Confirmed orders freeze exchange rate + every cost into an immutable snapshot"
        actions={<button onClick={() => downloadCSV("orders.csv", ["Number", "Client", "Date", "Status", "Revenue PKR", "Landed PKR", "Profit PKR"], list.map((o) => [o.number, db.clients.find((c) => c.id === o.clientId)?.company ?? "", o.date, o.status, orderRevenue(o), orderTotals(o).landed, orderTotals(o).grossProfit]))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700">Export CSV</button>} />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search order, client…" /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inp} w-auto`}>
            <option value="all">All statuses</option>{[...FLOW, "Cancelled"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="hk-table w-full">
            <thead><tr><th>Order</th><th>Client</th><th>Date</th><th className="text-right">Revenue</th><th className="text-right">Profit</th><th className="text-right">Advance</th><th>Status</th></tr></thead>
            <tbody>
              {pg.rows.map((o) => {
                const t = orderTotals(o);
                const paid = orderPaidPkr(db, o.id);
                const adv = advanceOf(o);
                return (
                  <tr key={o.id} className="cursor-pointer" onClick={() => { setDetailId(o.id); setExpanded(null); }}>
                    <td className="num font-semibold text-brand-700">{o.number}<p className="text-[10px] font-normal text-ink-400">{o.items.length} line(s) · 1 {o.currency} = {fm(o.rateSnapshot.rmb)}</p></td>
                    <td>{db.clients.find((c) => c.id === o.clientId)?.company}</td>
                    <td className="num">{fmtDate(o.date)}</td>
                    <td className="num text-right font-semibold">{fc("PKR", t.revenue)}</td>
                    <td className={`num text-right font-semibold ${t.grossProfit >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fc("PKR", t.grossProfit)}</td>
                    <td className="num text-right text-[11.5px]">{o.status === "Draft" ? "—" : <span className={paid >= adv ? "text-ok-600" : "text-warn-600"}>{fm(paid)} / {fm(adv)}</span>}</td>
                    <td><Pill label={o.status} pulse={["In Transit", "Customs"].includes(o.status)} /></td>
                  </tr>
                );
              })}
              {pg.rows.length === 0 && <tr><td colSpan={7} className="py-8"><Empty title="No orders match" body="Convert an accepted quotation to create an order." /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={list.length} label="orders" /></div>
      </Card>

      <Drawer open={!!order} onClose={() => setDetailId(null)} w="max-w-4xl"
        title={order?.number ?? ""}
        sub={order ? <span>{db.clients.find((c) => c.id === order.clientId)?.company} · {fmtDate(order.date)} · <Pill label={order.status} pulse={["In Transit", "Customs"].includes(order.status)} /></span> : null}
        footer={order && editable ? <>
          {order.status === "Draft" && <Btn variant="brass" onClick={async () => { const ok = await confirm({ title: "Confirm order?", message: `Rates (RMB ${fm(order.rateSnapshot.rmb)} / USD ${fm(order.rateSnapshot.usd)}) and all costs freeze into the snapshot. A purchase entry posts to the supplier ledger.`, confirmLabel: "Confirm & freeze" }); if (ok) { setOrderStatus(order.id, "Confirmed"); toast("Supplier ledger debited for the purchase.", "info"); } }}><BadgeCheck className="h-4 w-4" />Confirm order</Btn>}
          {["Delivered", "Completed"].includes(order.status) && !db.invoices.some((i) => i.orderId === order.id && !i.void) && (
            <Btn onClick={() => onInvoice(order.id)}><Receipt className="h-4 w-4" />Create invoice</Btn>
          )}
          {!["Cancelled", "Completed"].includes(order.status) && <Btn variant="outline" onClick={() => nav("finance", undefined, { tab: "payments", partyKind: "client", partyId: order.clientId, orderId: order.id })}><Wallet className="h-4 w-4" />Record payment</Btn>}
          {!["Cancelled", "Completed"].includes(order.status) && <Btn variant="ghost" className="hover:text-bad-600" onClick={() => onCancel(order)}><XOctagon className="h-4 w-4" />Cancel</Btn>}
        </> : undefined}>
        {order && (() => {
          const t = orderTotals(order);
          const paid = orderPaidPkr(db, order.id);
          const adv = advanceOf(order);
          const inv = db.invoices.find((x) => x.orderId === order.id && !x.void);
          return (
            <div className="p-5">
              {/* snapshot banner */}
              <div className="num mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 text-[12px] text-ink-200">
                <span className="inline-flex items-center gap-1.5 font-bold text-brass-300"><Lock className="h-3.5 w-3.5" />FROZEN SNAPSHOT</span>
                <span>1 RMB = <b className="text-paper-100">{fm(order.rateSnapshot.rmb)}</b></span>
                <span>1 USD = <b className="text-paper-100">{fm(order.rateSnapshot.usd)}</b></span>
                <span>1 EUR = <b className="text-paper-100">{fm(order.rateSnapshot.eur)}</b></span>
                <span className="text-ink-400">· master rates can change — this order never will</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <MiniStat label="Revenue" value={fc("PKR", t.revenue)} />
                <MiniStat label="Total Landed Cost" value={fc("PKR", t.landed)} />
                <MiniStat label="Gross Profit" value={fc("PKR", t.grossProfit)} tone={t.grossProfit >= 0 ? "text-ok-600" : "text-bad-600"} />
                <MiniStat label="Margin on sales" value={`${fm(t.marginPct)}%`} tone="text-brass-600" />
              </div>

              <p className="disp mt-5 mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-brass-600">Order items — click a row for its full cost breakdown</p>
              <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                <table className="hk-table w-full">
                  <thead><tr><th>Product / Supplier</th><th className="text-right">Qty</th><th className="text-right">Purchase</th><th className="text-right">Landed / u</th><th className="text-right">Selling / u</th><th className="text-right">Profit</th><th></th></tr></thead>
                  <tbody>
                    {order.items.map((it) => {
                      const p = db.products.find((x) => x.id === it.productId);
                      const s = db.suppliers.find((x) => x.id === it.supplierId);
                      const open = expanded === it.id;
                      return [
                        <tr key={it.id} className={`cursor-pointer ${open ? "bg-paper-100" : ""}`} onClick={() => setExpanded(open ? null : it.id)}>
                          <td><p className="font-semibold text-ink-900">{p?.name}</p><p className="num text-[10.5px] text-ink-400">{s?.name} · HS {it.hsCode}</p></td>
                          <td className="num text-right">{fm(it.snapshot.qty)}</td>
                          <td className="num text-right">{it.snapshot.currency} {fm(it.snapshot.unitPrice)} <span className="text-[10px] text-ink-400">@ {fm(it.snapshot.rateToPkr)}</span></td>
                          <td className="num text-right">{fm(it.snapshot.unitLandedPkr)}</td>
                          <td className="num text-right font-semibold">{fm(it.snapshot.unitSellingPkr)}</td>
                          <td className="num text-right font-semibold text-ok-600">{fc("PKR", it.snapshot.grossProfitPkr)}</td>
                          <td><ChevronDown className={`h-4 w-4 text-ink-300 transition-transform ${open ? "rotate-180" : ""}`} /></td>
                        </tr>,
                        open ? (
                          <tr key={`${it.id}-x`} className="bg-paper-100/80">
                            <td colSpan={7} className="!py-3">
                              <div className="num grid grid-cols-2 gap-x-5 gap-y-1 px-2 text-[11.5px] text-ink-600 sm:grid-cols-4">
                                <span>Product cost <b className="text-ink-900">{fm(it.snapshot.productCostPkr)}</b></span>
                                <span>China costs <b className="text-ink-900">{fm(it.snapshot.chinaTotal)}</b></span>
                                <span>{it.snapshot.freightMode === "air" ? `Air ${fm(it.snapshot.weightKg)}kg × ${fm(it.snapshot.airRatePerKg)}` : `Sea ${fm(it.snapshot.cbm)}cbm × ${fm(it.snapshot.seaRatePerCbm)}`} <b className="text-ink-900">{fm(it.snapshot.intlFreightPkr)}</b></span>
                                <span>Customs & taxes <b className="text-ink-900">{fm(it.snapshot.customsTotal)}</b></span>
                                <span>Clearance & port <b className="text-ink-900">{fm(it.snapshot.clearanceTotal)}</b></span>
                                <span>Local & delivery <b className="text-ink-900">{fm(it.snapshot.localTotal)}</b></span>
                                <span>Insurance / bank / misc <b className="text-ink-900">{fm(it.snapshot.otherTotal)}</b></span>
                                <span>Pricing <b className="text-ink-900">{it.snapshot.pricingMethod === "margin" ? `${fm(it.snapshot.pricingValue)}% margin` : `fixed +${fm(it.snapshot.pricingValue)}`}</b></span>
                              </div>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              {/* cost structure */}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-paper-200 bg-white p-4">
                  <p className="disp text-[11px] font-bold uppercase tracking-[.14em] text-ink-500">Cost structure</p>
                  {[
                    ["Product purchase", t.productCost], ["China logistics", t.china], ["International freight", t.freight],
                    ["Customs & taxes", t.customs], ["Clearance + local", t.clearance], ["Other direct costs", t.other],
                  ].map(([l, v]) => (
                    <div key={l as string} className="mt-2">
                      <div className="flex justify-between text-[11.5px]"><span className="text-ink-500">{l}</span><span className="num font-semibold text-ink-800">{fm(v as number)}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-200"><div className="anim-grow-x h-full rounded-full bg-brand-600" style={{ width: `${((v as number) / Math.max(t.landed, 1)) * 100}%` }} /></div>
                    </div>
                  ))}
                  <div className="mt-3 flex justify-between border-t border-paper-200 pt-2 text-[12.5px] font-bold"><span>Total landed</span><span className="num">{fc("PKR", t.landed)}</span></div>
                </div>
                <div className="rounded-xl border border-paper-200 bg-white p-4">
                  <p className="disp text-[11px] font-bold uppercase tracking-[.14em] text-ink-500">Payments & invoice</p>
                  <div className="mt-2 space-y-1.5 text-[12.5px]">
                    <div className="flex justify-between"><span className="text-ink-500">Advance required ({order.advanceRequiredPct}%)</span><span className="num font-semibold">{fc("PKR", adv)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-500">Received from client</span><span className={`num font-semibold ${paid >= adv ? "text-ok-600" : "text-warn-600"}`}>{fc("PKR", paid)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-500">Invoice</span><span className="num font-semibold">{inv ? inv.number : "not raised"}</span></div>
                    {inv && <div className="flex justify-between"><span className="text-ink-500">Invoice balance</span><span className="num font-semibold text-bad-600">{fc("PKR", Math.max(0, inv.grandTotalPkr - invoicePaidAmount(db, inv.id)))}</span></div>}
                  </div>
                  {order.status !== "Draft" && order.status !== "Cancelled" && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-ink-400"><span>Advance cover</span><span className="num">{adv > 0 ? fm(Math.min(100, (paid / adv) * 100)) : 100}%</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-200">
                        <div className="anim-grow-x h-full rounded-full" style={{ width: `${adv > 0 ? Math.min(100, (paid / adv) * 100) : 100}%`, background: paid >= adv ? "#22703f" : "#c2922e" }} />
                      </div>
                    </div>
                  )}
                  <p className="num mt-3 rounded-lg bg-paper-100 px-2.5 py-1.5 text-[10.5px] text-ink-400">Cargo: {fm(t.weightKg)} kg · {fm(t.cbm)} CBM · terms: {order.paymentTerms}</p>
                </div>
              </div>

              {/* pipeline */}
              <p className="disp mt-5 mb-2 text-[11px] font-bold uppercase tracking-[.14em] text-brass-600">Progress</p>
              {order.status === "Cancelled" ? (
                <p className="rounded-lg border border-bad-100 bg-bad-100/50 px-3 py-2.5 text-[12.5px] font-semibold text-bad-600">This order was cancelled — retained for audit.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {FLOW.map((s) => {
                    const idx = FLOW.indexOf(order.status);
                    const sIdx = FLOW.indexOf(s);
                    return (
                      <button key={s} disabled={!editable || sIdx <= idx}
                        onClick={() => setOrderStatus(order.id, s as typeof order.status)}
                        className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-all ${sIdx < idx ? "border-ok-600/30 bg-ok-100 text-ok-600" : sIdx === idx ? "border-ink-900 bg-ink-900 text-brass-300" : "border-paper-300 bg-white text-ink-400 hover:border-brass-400 hover:text-brass-600 disabled:opacity-45 disabled:hover:border-paper-300 disabled:hover:text-ink-400"}`}>{s}</button>
                    );
                  })}
                </div>
              )}
              {order.notes && <p className="mt-4 text-[12px] text-ink-400"><b>Notes:</b> {order.notes}</p>}
              <p className="num mt-3 text-[10.5px] text-ink-300">Created {fmtDate(order.createdAt.slice(0, 10) || todayISO())}{order.quotationId ? ` · from quotation ${db.quotations.find((x) => x.id === order.quotationId)?.number ?? ""}` : ""}</p>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
