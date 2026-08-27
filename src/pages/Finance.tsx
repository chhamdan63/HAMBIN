import { useMemo, useState } from "react";
import { Ban, Download, Printer, Scale, Wallet } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Empty, Field, Modal, Pager, paginate, Pill, SearchBox, Tabs, inp, PrintPortal, doPrint } from "../components/ui";
import { StatementDoc } from "../components/docs";
import { clientLedgerRows, currentRate, invoicePaidAmount, supplierLedgerRows, useStore } from "../lib/store";
import { EXPENSE_CATEGORIES } from "../lib/seed";
import { downloadCSV, fc, fm, fmtDate, r2, todayISO } from "../lib/money";
import type { Expense, Payment, PaymentMethod } from "../lib/types";

const TABS = [
  { id: "payments", label: "Payments" },
  { id: "expenses", label: "Expenses" },
  { id: "clientledger", label: "Client Ledger" },
  { id: "supplierledger", label: "Supplier Ledger" },
  { id: "adjustments", label: "Adjustments" },
];

export default function Finance() {
  const { db, route, can, postPayment, voidPayment, saveExpense, deleteExpense, addAdjustment, confirm, toast } = useStore();
  const carry = route.carry as { tab?: string; partyKind?: "client" | "supplier"; partyId?: string; orderId?: string; invoiceId?: string; amount?: number; type?: Payment["type"] } | undefined;
  const [tab, setTab] = useState(carry?.tab ?? "payments");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const editable = can("finance", "edit");

  /* payment form */
  const [payOpen, setPayOpen] = useState(!!carry?.partyId || !!carry?.invoiceId);
  const [pay, setPay] = useState(() => ({
    date: todayISO(),
    type: (carry?.type ?? (carry?.partyKind === "supplier" ? "Supplier Payment" : "Client Advance")) as Payment["type"],
    partyKind: carry?.partyKind ?? "client" as "client" | "supplier",
    partyId: carry?.partyId ?? db.clients[0]?.id ?? "", orderId: carry?.orderId ?? "",
    invoiceId: carry?.invoiceId ?? "",
    amount: carry?.amount ?? 0, currency: "PKR" as Payment["currency"], rateToPkr: 1, method: "Bank Transfer" as PaymentMethod, reference: "", notes: "",
  }));
  const [expForm, setExpForm] = useState<Expense | null>(null);
  const [ledgerClient, setLedgerClient] = useState(db.clients[0]?.id ?? "");
  const [ledgerSupplier, setLedgerSupplier] = useState(db.suppliers[0]?.id ?? "");
  const [adjOpen, setAdjOpen] = useState(false);
  const [adj, setAdj] = useState({ partyKind: "client" as "client" | "supplier", partyId: db.clients[0]?.id ?? "", date: todayISO(), description: "", debitPkr: 0, creditPkr: 0 });
  const [printing, setPrinting] = useState<null | "client" | "supplier">(null);

  const payments = useMemo(() => db.payments.filter((p) => {
    const party = p.partyKind === "client" ? db.clients.find((c) => c.id === p.partyId)?.company : db.suppliers.find((s) => s.id === p.partyId)?.name;
    return `${p.number} ${p.type} ${party ?? ""} ${p.reference ?? ""}`.toLowerCase().includes(q.toLowerCase());
  }), [db, q]);
  const pg = paginate(payments, page, 9);

  const setPayPartyKind = (k: "client" | "supplier") => setPay((p) => {
    const newId = k === "client" ? db.clients[0]?.id ?? "" : db.suppliers[0]?.id ?? "";
    const sup = db.suppliers.find((s) => s.id === newId);
    return { ...p, partyKind: k, partyId: newId, type: k === "client" ? "Client Advance" : "Supplier Payment", currency: k === "supplier" ? sup?.currency ?? "RMB" : "PKR", rateToPkr: k === "supplier" && sup ? currentRate(db, sup.currency) : 1, invoiceId: "" };
  });

  const submitPay = () => {
    const rate = pay.currency === "PKR" ? 1 : pay.rateToPkr || currentRate(db, pay.currency);
    const ok = postPayment({
      date: pay.date, type: pay.type, partyKind: pay.partyKind, partyId: pay.partyId,
      invoiceId: pay.invoiceId || undefined, orderId: pay.orderId || undefined,
      amount: pay.amount, currency: pay.currency, rateToPkr: rate, method: pay.method,
      reference: pay.reference || undefined, notes: pay.notes || undefined,
    });
    if (ok) setPayOpen(false);
  };

  const submitExp = () => {
    if (!expForm) return;
    if (!expForm.description.trim()) { toast("Enter a description for the expense.", "error"); return; }
    if (expForm.amount <= 0) { toast("Expense amount must be greater than zero.", "error"); return; }
    saveExpense({ ...expForm, amountPkr: r2(expForm.amount * expForm.rateToPkr) });
    setExpForm(null);
  };

  const submitAdj = () => {
    if (!adj.description.trim()) { toast("Enter a reason / description for the adjustment.", "error"); return; }
    if (adj.debitPkr <= 0 && adj.creditPkr <= 0) { toast("Enter a debit or credit amount greater than zero.", "error"); return; }
    addAdjustment({ ...adj, debitPkr: r2(adj.debitPkr), creditPkr: r2(adj.creditPkr) });
    setAdjOpen(false);
    setAdj({ ...adj, description: "", debitPkr: 0, creditPkr: 0 });
  };

  const cRows = clientLedgerRows(db, ledgerClient);
  const sRows = supplierLedgerRows(db, ledgerSupplier);
  const lClient = db.clients.find((c) => c.id === ledgerClient);
  const lSupplier = db.suppliers.find((s) => s.id === ledgerSupplier);

  const print = (kind: "client" | "supplier") => { setPrinting(kind); window.setTimeout(doPrint, 120); window.setTimeout(() => setPrinting(null), 1500); };

  const clientInvoices = db.invoices.filter((i) => i.clientId === pay.partyId && !i.void);

  return (
    <div>
      <PageHead title="Finance & Ledgers" sub="Payments post straight into the double-entry khata — voids are reversals, never deletions"
        actions={editable ? <>
          <Btn variant="outline" onClick={() => setAdjOpen(true)}><Scale className="h-4 w-4" />Ledger adjustment</Btn>
          <Btn onClick={() => setPayOpen(true)}><Wallet className="h-4 w-4" />Record Payment</Btn>
        </> : undefined} />

      <div className="mb-4"><Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === "payments" ? db.payments.filter((p) => !p.void).length : t.id === "expenses" ? db.expenses.length : undefined }))} active={tab} onChange={(id) => { setTab(id); setPage(1); }} /></div>

      {tab === "payments" && (
        <Card pad={false}>
          <div className="border-b border-paper-200 px-4 py-3"><div className="w-full sm:w-72"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search number, party, reference…" /></div></div>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Number</th><th>Date</th><th>Type</th><th>Party</th><th>Against</th><th>Method</th><th className="text-right">Amount</th><th className="text-right">PKR</th><th></th></tr></thead>
              <tbody>
                {pg.rows.map((p) => {
                  const party = p.partyKind === "client" ? db.clients.find((c) => c.id === p.partyId)?.company : db.suppliers.find((s) => s.id === p.partyId)?.name;
                  const inv = p.invoiceId ? db.invoices.find((i) => i.id === p.invoiceId) : undefined;
                  return (
                    <tr key={p.id} className={p.void ? "opacity-45" : ""}>
                      <td className="num font-semibold text-brand-700">{p.number}{p.void && <span className="ml-1.5 rounded bg-paper-200 px-1.5 text-[9.5px] font-bold text-ink-500">VOID</span>}</td>
                      <td className="num">{fmtDate(p.date)}</td>
                      <td><Pill label={p.type} tone={p.partyKind === "client" ? "ok" : "brass"} /></td>
                      <td>{party}</td>
                      <td className="num text-[11px]">{inv?.number ?? (p.orderId ? db.orders.find((o) => o.id === p.orderId)?.number ?? "" : "—")}</td>
                      <td className="text-[12px]">{p.method}</td>
                      <td className="num text-right">{fc(p.currency, p.amount)}{p.currency !== "PKR" && <span className="text-[10px] text-ink-400"> @ {fm(p.rateToPkr)}</span>}</td>
                      <td className="num text-right font-semibold">{fc("PKR", p.amountPkr)}</td>
                      <td>{editable && !p.void && <Btn size="sm" variant="ghost" title="Void payment" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Void payment?", message: `${p.number} will be voided. The reversal stays in the ledger and audit log — payments are never hard-deleted.`, danger: true, confirmLabel: "Void" }); if (ok) voidPayment(p.id); }}><Ban className="h-3.5 w-3.5" /></Btn>}</td>
                    </tr>
                  );
                })}
                {pg.rows.length === 0 && <tr><td colSpan={9} className="py-8"><Empty title="No payments match" /></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={payments.length} label="payments" /></div>
        </Card>
      )}

      {tab === "expenses" && (
        <Card pad={false} title="Operating Expenses" sub="feeds the overhead allocation in net-profit reports"
          actions={editable ? <Btn size="sm" onClick={() => setExpForm({ id: "", number: "", date: todayISO(), category: "Office Rent", description: "", amount: 0, currency: "PKR", rateToPkr: 1, amountPkr: 0, method: "Bank Transfer", notes: "", createdAt: "" })}>+ Expense</Btn> : undefined}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Number</th><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th className="text-right">Amount (PKR)</th><th></th></tr></thead>
              <tbody>
                {db.expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                  <tr key={e.id}>
                    <td className="num font-semibold text-brand-700">{e.number}</td>
                    <td className="num">{fmtDate(e.date)}</td>
                    <td><span className="rounded bg-paper-200 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-500">{e.category}</span></td>
                    <td>{e.description}</td>
                    <td className="text-[12px]">{e.method}</td>
                    <td className="num text-right font-semibold">{fc("PKR", e.amountPkr)}</td>
                    <td>{editable && <Btn size="sm" variant="ghost" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Remove expense?", message: `${e.number} will be removed from the expense book.`, danger: true, confirmLabel: "Remove" }); if (ok) deleteExpense(e.id); }}><Ban className="h-3.5 w-3.5" /></Btn>}</td>
                  </tr>
                ))}
                {db.expenses.length === 0 && <tr><td colSpan={7} className="py-8"><Empty title="No expenses recorded" /></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(tab === "clientledger" || tab === "supplierledger") && (
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
            <select className={`${inp} w-auto min-w-[220px]`} value={tab === "clientledger" ? ledgerClient : ledgerSupplier} onChange={(e) => (tab === "clientledger" ? setLedgerClient(e.target.value) : setLedgerSupplier(e.target.value))}>
              {(tab === "clientledger" ? db.clients.map((c) => ({ id: c.id, name: c.company })) : db.suppliers.map((s) => ({ id: s.id, name: s.name }))).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button onClick={() => downloadCSV(`${tab}-statement.csv`, ["Date", "Ref", "Particulars", "Debit", "Credit", "Balance"], (tab === "clientledger" ? cRows : sRows).map((r) => [r.date, r.ref, r.description, r.debit, r.credit, r.balance]))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-700"><Download className="h-3.5 w-3.5" />CSV</button>
            <Btn size="sm" variant="dark" className="ml-auto" onClick={() => print(tab === "clientledger" ? "client" : "supplier")}><Printer className="h-3.5 w-3.5" />Statement PDF</Btn>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Date</th><th>Reference</th><th>Particulars</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Running Balance</th></tr></thead>
              <tbody>
                {(tab === "clientledger" ? cRows : sRows).map((r) => (
                  <tr key={r.id}>
                    <td className="num">{fmtDate(r.date)}</td>
                    <td className="num font-semibold text-brass-600">{r.ref}</td>
                    <td>{r.description}{r.foreign && <span className="num ml-1.5 text-[10.5px] text-ink-400">({r.foreign.currency} {fm(r.foreign.amount)})</span>}</td>
                    <td className="num text-right">{r.debit ? fm(r.debit) : "—"}</td>
                    <td className="num text-right">{r.credit ? fm(r.credit) : "—"}</td>
                    <td className={`num text-right font-bold ${r.balance > 0 ? (tab === "clientledger" ? "text-bad-600" : "text-warn-600") : "text-ok-600"}`}>{fm(r.balance)}</td>
                  </tr>
                ))}
                {(tab === "clientledger" ? cRows : sRows).length === 0 && <tr><td colSpan={6} className="py-8"><Empty title="Ledger is empty" /></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-paper-200 px-4 py-3">
            <p className="text-[11.5px] text-ink-400">{tab === "clientledger" ? "Debit balance = receivable from client · negative = advance held" : "Debit balance = payable to supplier (PKR equivalent of foreign purchases)"}</p>
            <p className="num text-[13px] font-bold text-ink-900">Closing: {fc("PKR", (() => { const r = tab === "clientledger" ? cRows : sRows; return r.length ? r[r.length - 1].balance : 0; })())}</p>
          </div>
        </Card>
      )}

      {tab === "adjustments" && (
        <Card title="Manual Ledger Adjustments" sub="debit/credit entries with reason — fully audited" pad={false}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Date</th><th>Party</th><th>Description</th><th>By</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
              <tbody>
                {db.adjustments.map((a) => {
                  const party = a.partyKind === "client" ? db.clients.find((c) => c.id === a.partyId)?.company : db.suppliers.find((s) => s.id === a.partyId)?.name;
                  return (
                    <tr key={a.id}>
                      <td className="num">{fmtDate(a.date)}</td>
                      <td>{party} <Pill label={a.partyKind} tone="muted" /></td>
                      <td>{a.description}</td>
                      <td className="text-[12px]">{a.createdBy}</td>
                      <td className="num text-right">{a.debitPkr ? fm(a.debitPkr) : "—"}</td>
                      <td className="num text-right">{a.creditPkr ? fm(a.creditPkr) : "—"}</td>
                    </tr>
                  );
                })}
                {db.adjustments.length === 0 && <tr><td colSpan={6} className="py-8"><Empty title="No adjustments" body="Use “Ledger adjustment” for write-offs, rounding or dispute settlements." /></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* payment modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment" sub="Validated against outstanding balances before posting to the ledger"
        footer={<><Btn variant="outline" onClick={() => setPayOpen(false)}>Cancel</Btn><Btn onClick={submitPay}>Post payment</Btn></>}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Party type">
            <div className="flex gap-1.5">
              {(["client", "supplier"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setPayPartyKind(k)} className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-bold capitalize transition-all ${pay.partyKind === k ? "border-ink-900 bg-ink-900 text-brass-300" : "border-paper-300 bg-white text-ink-500"}`}>{k}</button>
              ))}
            </div>
          </Field>
          <Field label="Payment type">
            <select className={inp} value={pay.type} onChange={(e) => setPay({ ...pay, type: e.target.value as Payment["type"] })}>
              {pay.partyKind === "client"
                ? ["Client Advance", "Client Partial", "Client Final", "Refund"].map((t) => <option key={t}>{t}</option>)
                : ["Supplier Payment"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label={pay.partyKind === "client" ? "Client" : "Supplier"}>
            <select className={inp} value={pay.partyId} onChange={(e) => {
              const s = db.suppliers.find((x) => x.id === e.target.value);
              setPay({ ...pay, partyId: e.target.value, invoiceId: "", currency: pay.partyKind === "supplier" ? (s?.currency ?? "RMB") : pay.currency, rateToPkr: pay.partyKind === "supplier" && s ? currentRate(db, s.currency) : pay.rateToPkr });
            }}>
              {(pay.partyKind === "client" ? db.clients.map((c) => ({ id: c.id, name: c.company })) : db.suppliers.map((s) => ({ id: s.id, name: s.name }))).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className={inp} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
          {pay.partyKind === "client" && (
            <Field label="Against invoice (optional)" hint={pay.invoiceId ? "amount auto-fills with the invoice balance" : undefined}>
              <select className={inp} value={pay.invoiceId} onChange={(e) => {
                const id = e.target.value;
                const inv = db.invoices.find((i) => i.id === id);
                const bal = inv ? Math.max(0, r2(inv.grandTotalPkr - invoicePaidAmount(db, inv.id))) : 0;
                setPay({ ...pay, invoiceId: id, amount: id ? bal : pay.amount, type: id ? (pay.type === "Refund" ? pay.type : "Client Partial") : pay.type });
              }}>
                <option value="">— general / advance —</option>
                {clientInvoices.map((i) => <option key={i.id} value={i.id}>{i.number} · bal {fm(Math.max(0, i.grandTotalPkr - invoicePaidAmount(db, i.id)))}</option>)}
              </select>
            </Field>
          )}
          <Field label="Against order (optional)">
            <select className={inp} value={pay.orderId} onChange={(e) => setPay({ ...pay, orderId: e.target.value })}>
              <option value="">—</option>
              {db.orders.filter((o) => o.clientId === pay.partyId || pay.partyKind === "supplier").map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
            </select>
          </Field>
          <Field label={`Amount (${pay.currency})`}><input type="number" step="0.01" className={`${inp} num text-right`} value={pay.amount || ""} placeholder="0" onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) || 0 })} /></Field>
          <Field label="Currency">
            <select className={inp} value={pay.currency} onChange={(e) => { const c = e.target.value as Payment["currency"]; setPay({ ...pay, currency: c, rateToPkr: c === "PKR" ? 1 : currentRate(db, c) }); }}>
              <option>PKR</option><option>RMB</option><option>USD</option><option>EUR</option>
            </select>
          </Field>
          {pay.currency !== "PKR" && <Field label={`Rate (${pay.currency} → PKR)`} hint="stored with the transaction"><input type="number" step="0.01" className={`${inp} num text-right`} value={pay.rateToPkr} onChange={(e) => setPay({ ...pay, rateToPkr: Number(e.target.value) || 0 })} /></Field>}
          <Field label="Method">
            <select className={inp} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
              {["Cash", "Bank Transfer", "Online Transfer", "Other"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Reference / TID"><input className={inp} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="MEEZAN-TRF-…" /></Field>
          <Field label="Notes" className="sm:col-span-2"><input className={inp} value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></Field>
        </div>
        <div className="num mt-3 flex items-center justify-between rounded-lg bg-ink-900 px-4 py-2.5 text-[13px] text-paper-100">
          <span className="text-ink-300">Ledger impact</span>
          <span className="font-bold text-brass-300">{pay.partyKind === "client" ? (pay.type === "Refund" ? "Debit" : "Credit") : "Credit"} · {fc("PKR", r2(pay.amount * (pay.currency === "PKR" ? 1 : pay.rateToPkr)))}</span>
        </div>
      </Modal>

      {/* expense modal */}
      <Modal open={!!expForm} onClose={() => setExpForm(null)} title="Record Expense" footer={<><Btn variant="outline" onClick={() => setExpForm(null)}>Cancel</Btn><Btn onClick={submitExp}>Save expense</Btn></>}>
        {expForm && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Category"><select className={inp} value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Date"><input type="date" className={inp} value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} /></Field>
            <Field label="Description" className="sm:col-span-2"><input className={inp} value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} /></Field>
            <Field label={`Amount (${expForm.currency})`}><input type="number" className={`${inp} num text-right`} value={expForm.amount || ""} onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) || 0 })} /></Field>
            <Field label="Currency"><select className={inp} value={expForm.currency} onChange={(e) => { const c = e.target.value as Expense["currency"]; setExpForm({ ...expForm, currency: c, rateToPkr: c === "PKR" ? 1 : currentRate(db, c) }); }}><option>PKR</option><option>RMB</option><option>USD</option></select></Field>
            {expForm.currency !== "PKR" && <Field label="Rate → PKR"><input type="number" step="0.01" className={`${inp} num text-right`} value={expForm.rateToPkr} onChange={(e) => setExpForm({ ...expForm, rateToPkr: Number(e.target.value) || 0 })} /></Field>}
            <Field label="Method"><select className={inp} value={expForm.method} onChange={(e) => setExpForm({ ...expForm, method: e.target.value as PaymentMethod })}>{["Cash", "Bank Transfer", "Online Transfer", "Other"].map((m) => <option key={m}>{m}</option>)}</select></Field>
          </div>
        )}
      </Modal>

      {/* adjustment modal */}
      <Modal open={adjOpen} onClose={() => setAdjOpen(false)} title="Ledger Adjustment" sub="Post a manual debit or credit with a reason"
        footer={<><Btn variant="outline" onClick={() => setAdjOpen(false)}>Cancel</Btn><Btn onClick={submitAdj}>Post adjustment</Btn></>}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Party type">
            <select className={inp} value={adj.partyKind} onChange={(e) => { const k = e.target.value as "client" | "supplier"; setAdj({ ...adj, partyKind: k, partyId: k === "client" ? db.clients[0]?.id ?? "" : db.suppliers[0]?.id ?? "" }); }}>
              <option value="client">Client</option><option value="supplier">Supplier</option>
            </select>
          </Field>
          <Field label="Party">
            <select className={inp} value={adj.partyId} onChange={(e) => setAdj({ ...adj, partyId: e.target.value })}>
              {(adj.partyKind === "client" ? db.clients.map((c) => ({ id: c.id, name: c.company })) : db.suppliers.map((s) => ({ id: s.id, name: s.name }))).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className={inp} value={adj.date} onChange={(e) => setAdj({ ...adj, date: e.target.value })} /></Field>
          <Field label="Debit (PKR)"><input type="number" className={`${inp} num text-right`} value={adj.debitPkr || ""} onChange={(e) => setAdj({ ...adj, debitPkr: Number(e.target.value) || 0, creditPkr: 0 })} /></Field>
          <Field label="Credit (PKR)"><input type="number" className={`${inp} num text-right`} value={adj.creditPkr || ""} onChange={(e) => setAdj({ ...adj, creditPkr: Number(e.target.value) || 0, debitPkr: 0 })} /></Field>
          <Field label="Reason / description" className="sm:col-span-2"><input className={inp} value={adj.description} onChange={(e) => setAdj({ ...adj, description: e.target.value })} placeholder="e.g. rounding write-off, dispute settlement…" /></Field>
        </div>
      </Modal>

      {printing === "client" && lClient && <PrintPortal><StatementDoc client={lClient} rows={cRows} company={db.settings} kind="client" /></PrintPortal>}
      {printing === "supplier" && lSupplier && <PrintPortal><StatementDoc client={{ id: lSupplier.id, code: lSupplier.code, company: lSupplier.name, contactPerson: lSupplier.contactPerson, phone: lSupplier.phone, email: lSupplier.email, address: `${lSupplier.city}, ${lSupplier.country}`, city: lSupplier.city, province: lSupplier.province, country: lSupplier.country, currency: lSupplier.currency, paymentTerms: lSupplier.paymentTerms, creditLimit: 0, openingBalance: 0, status: lSupplier.status, createdAt: lSupplier.createdAt }} rows={sRows} company={db.settings} kind="supplier" /></PrintPortal>}
    </div>
  );
}
