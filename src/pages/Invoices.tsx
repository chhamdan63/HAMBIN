import { useMemo, useState } from "react";
import { Ban, Printer, Wallet } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Pager, paginate, Pill, SearchBox, inp, PrintPortal, doPrint } from "../components/ui";
import { InvoiceDoc } from "../components/docs";
import { invoicePaidAmount, invoiceStatus, useStore } from "../lib/store";
import { downloadCSV, fc, fm, fmtDate, isOverdue, r2 } from "../lib/money";
import { downloadPdf } from "../lib/pdf";
import { Download } from "lucide-react";

export default function Invoices() {
  const { db, route, nav, can, voidInvoice, confirm } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(route.id ?? null);
  const [printing, setPrinting] = useState(false);

  const editable = can("invoices", "edit");
  const inv = db.invoices.find((i) => i.id === detailId) ?? null;

  const list = useMemo(() => db.invoices
    .map((i) => ({ i, paid: invoicePaidAmount(db, i.id) }))
    .map(({ i, paid }) => ({ i, paid, st: invoiceStatus(i, paid) }))
    .filter(({ st }) => status === "all" || st.label === status)
    .filter(({ i }) => {
      const c = db.clients.find((x) => x.id === i.clientId);
      return `${i.number} ${c?.company ?? ""}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => b.i.createdAt.localeCompare(a.i.createdAt)), [db, q, status]);
  const pg = paginate(list, page, 9);

  const print = () => { setPrinting(true); window.setTimeout(doPrint, 120); window.setTimeout(() => setPrinting(false), 1500); };
  const pdf = async (i: typeof inv) => {
    if (!i) return;
    await downloadPdf(InvoiceDoc, {
      invoice: i,
      client: db.clients.find((c) => c.id === i.clientId),
      company: db.settings,
      paid: invoicePaidAmount(db, i.id),
      orderNo: db.orders.find((o) => o.id === i.orderId)?.number,
    }, `${i.number}.pdf`);
  };

  return (
    <div>
      <PageHead title="Invoices" sub="Raised from delivered orders — posting debits the client khata instantly"
        actions={<button onClick={() => downloadCSV("invoices.csv", ["Number", "Client", "Order", "Date", "Due", "Total", "Paid", "Balance", "Status"], list.map(({ i, paid, st }) => [i.number, db.clients.find((c) => c.id === i.clientId)?.company ?? "", db.orders.find((o) => o.id === i.orderId)?.number ?? "", i.date, i.dueDate, i.grandTotalPkr, paid, Math.max(0, i.grandTotalPkr - paid), st.label]))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-700">Export CSV</button>} />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search invoice, client…" /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inp} w-auto`}>
            <option value="all">All statuses</option>
            {["Unpaid", "Partially Paid", "Paid", "Overdue", "Void"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="hk-table w-full">
            <thead><tr><th>Invoice</th><th>Client</th><th>Order</th><th>Issued</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {pg.rows.map(({ i, paid, st }) => {
                const c = db.clients.find((x) => x.id === i.clientId);
                const o = db.orders.find((x) => x.id === i.orderId);
                const bal = Math.max(0, i.grandTotalPkr - paid);
                return (
                  <tr key={i.id} className={`cursor-pointer ${i.void ? "opacity-45" : ""}`} onClick={() => setDetailId(i.id)}>
                    <td className="num font-semibold text-brand-700">{i.number}</td>
                    <td>{c?.company}</td>
                    <td className="num text-[11.5px]">{o?.number ?? "—"}</td>
                    <td className="num">{fmtDate(i.date)}</td>
                    <td className={`num ${bal > 0 && isOverdue(i.dueDate) && !i.void ? "font-bold text-bad-600" : ""}`}>{fmtDate(i.dueDate)}</td>
                    <td className="num text-right font-semibold">{fc("PKR", i.grandTotalPkr)}</td>
                    <td className="num text-right text-ok-600">{fc("PKR", paid)}</td>
                    <td className={`num text-right font-semibold ${bal > 0 ? "text-bad-600" : "text-ok-600"}`}>{bal > 0 ? fc("PKR", bal) : "—"}</td>
                    <td><Pill label={st.label} tone={st.tone} pulse={st.label === "Overdue"} /></td>
                  </tr>
                );
              })}
              {pg.rows.length === 0 && <tr><td colSpan={9} className="py-8"><Empty title="No invoices match" body="Raise one from a delivered order's detail page." /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={list.length} label="invoices" /></div>
      </Card>

      <Drawer open={!!inv} onClose={() => setDetailId(null)} w="max-w-2xl"
        title={inv?.number ?? ""} sub={inv ? <span>{db.clients.find((c) => c.id === inv.clientId)?.company} · due <b className="num">{fmtDate(inv.dueDate)}</b> · <Pill label={invoiceStatus(inv, invoicePaidAmount(db, inv.id)).label} tone={invoiceStatus(inv, invoicePaidAmount(db, inv.id)).tone} /></span> : null}
        footer={inv && !inv.void ? <>
          {editable && <Btn variant="ghost" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Void invoice?", message: `${inv.number} will be voided and reversed out of the client ledger. The record is retained for audit — invoices are never hard-deleted.`, danger: true, confirmLabel: "Void invoice" }); if (ok) voidInvoice(inv.id); }}><Ban className="h-4 w-4" />Void</Btn>}
          {editable && invoiceStatus(inv, invoicePaidAmount(db, inv.id)).label !== "Paid" && (
            <Btn variant="outline" onClick={() => nav("finance", undefined, { tab: "payments", partyKind: "client", partyId: inv.clientId, orderId: inv.orderId, invoiceId: inv.id, amount: Math.max(0, r2(inv.grandTotalPkr - invoicePaidAmount(db, inv.id))), type: "Client Partial" })}><Wallet className="h-4 w-4" />Record payment</Btn>
          )}
          <Btn variant="dark" onClick={print}><Printer className="h-4 w-4" />Print</Btn>
          <Btn variant="dark" onClick={() => pdf(inv)}><Download className="h-4 w-4" />Download PDF</Btn>
        </> : inv ? <><Btn variant="dark" onClick={print}><Printer className="h-4 w-4" />Print</Btn><Btn variant="dark" onClick={() => pdf(inv)}><Download className="h-4 w-4" />Download PDF</Btn></> : undefined}>
        {inv && (() => {
          const paid = invoicePaidAmount(db, inv.id);
          const c = db.clients.find((x) => x.id === inv.clientId);
          return (
            <div className="p-5">
              <div className="num mb-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-paper-200/70 p-3 text-[11.5px] text-ink-600 sm:grid-cols-3">
                <span><b>Issued:</b> {fmtDate(inv.date)}</span>
                <span><b>Due:</b> {fmtDate(inv.dueDate)}</span>
                <span><b>Created by:</b> {inv.createdBy}</span>
                <span><b>Client terms:</b> {c?.paymentTerms}</span>
                <span><b>Order:</b> {db.orders.find((o) => o.id === inv.orderId)?.number}</span>
                <span><b>Currency:</b> PKR</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                <table className="hk-table w-full">
                  <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit Price</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {inv.items.map((it, i2) => (
                      <tr key={i2}>
                        <td>{it.description}</td>
                        <td className="num text-right">{fm(it.qty)}</td>
                        <td className="num text-right">{fm(it.unitPrice)}</td>
                        <td className="num text-right font-semibold">{fm(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end">
                <div className="num w-64 space-y-1 text-[12.5px]">
                  <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span className="font-semibold">{fc("PKR", inv.subtotalPkr)}</span></div>
                  {inv.freightPkr > 0 && <div className="flex justify-between"><span className="text-ink-500">Freight</span><span>{fc("PKR", inv.freightPkr)}</span></div>}
                  {inv.customsPkr > 0 && <div className="flex justify-between"><span className="text-ink-500">Customs</span><span>{fc("PKR", inv.customsPkr)}</span></div>}
                  {inv.taxPkr > 0 && <div className="flex justify-between"><span className="text-ink-500">Taxes</span><span>{fc("PKR", inv.taxPkr)}</span></div>}
                  {inv.discountPkr > 0 && <div className="flex justify-between text-ok-600"><span>Discount</span><span>− {fc("PKR", inv.discountPkr)}</span></div>}
                  <div className="flex justify-between border-t-2 border-brass-400 pt-1.5 text-[14px] font-bold text-ink-900"><span>Grand Total</span><span>{fc("PKR", inv.grandTotalPkr)}</span></div>
                  <div className="flex justify-between text-ok-600"><span>Paid to date</span><span>− {fc("PKR", paid)}</span></div>
                  <div className="flex justify-between font-bold text-bad-600"><span>Balance due</span><span>{fc("PKR", Math.max(0, inv.grandTotalPkr - paid))}</span></div>
                </div>
              </div>
              {inv.notes && <p className="mt-3 rounded-lg border border-brass-100 bg-brass-100/40 px-3 py-2 text-[12px] text-ink-600"><b>Note:</b> {inv.notes}</p>}
              <p className="mt-4 text-[11px] text-ink-400">Payments posted against this invoice:</p>
              <div className="mt-1.5 space-y-1">
                {db.payments.filter((p) => p.invoiceId === inv.id && !p.void).map((p) => (
                  <div key={p.id} className="num flex justify-between rounded-lg bg-paper-200/60 px-3 py-1.5 text-[11.5px]">
                    <span>{p.number} · {fmtDate(p.date)} · {p.method}</span><span className="font-bold text-ok-600">{fc("PKR", p.amountPkr)}</span>
                  </div>
                ))}
                {db.payments.filter((p) => p.invoiceId === inv.id && !p.void).length === 0 && <p className="text-[11.5px] text-ink-300">None yet.</p>}
              </div>
            </div>
          );
        })()}
      </Drawer>

      {printing && inv && <PrintPortal><InvoiceDoc invoice={inv} client={db.clients.find((c) => c.id === inv.clientId)} company={db.settings} paid={invoicePaidAmount(db, inv.id)} orderNo={db.orders.find((o) => o.id === inv.orderId)?.number} /></PrintPortal>}
    </div>
  );
}
