import { useMemo, useState } from "react";
import { Download, FileText, Pencil, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Field, MiniStat, Modal, Pager, paginate, Pill, SearchBox, Tabs, inp, PrintPortal, doPrint } from "../components/ui";
import { StatementDoc } from "../components/docs";
import { clientLedgerRows, clientOutstanding, invoicePaidAmount, orderRevenue, orderTotals, useStore } from "../lib/store";
import { downloadCSV, fc, fm, fmtDate, sum } from "../lib/money";
import type { Client } from "../lib/types";

const empty = (): Client => ({
  id: "", code: "", company: "", contactPerson: "", phone: "", whatsapp: "", email: "", cnicNtn: "",
  address: "", city: "", province: "", country: "Pakistan", currency: "PKR", paymentTerms: "30% advance, balance on delivery",
  creditLimit: 0, openingBalance: 0, status: "active", notes: "", createdAt: "",
});

export default function Clients() {
  const { db, user, nav, can, saveClient, deleteClient, confirm } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Client | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState("orders");
  const [printing, setPrinting] = useState(false);

  const editable = can("clients", "edit");
  const client = db.clients.find((c) => c.id === detailId) ?? null;

  const rows = useMemo(() => db.clients
    .filter((c) => status === "all" || c.status === status)
    .filter((c) => `${c.company} ${c.code} ${c.contactPerson} ${c.city} ${c.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.company.localeCompare(b.company)), [db.clients, q, status]);
  const pg = paginate(rows, page, 9);

  const submit = () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (!form.company.trim()) e.company = "Company name is required.";
    if (!form.contactPerson.trim()) e.contactPerson = "Contact person is required.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email.";
    if (form.creditLimit < 0) e.creditLimit = "Credit limit cannot be negative.";
    setErrs(e);
    if (Object.keys(e).length) return;
    saveClient(form);
    setForm(null);
  };

  const askDelete = async (c: Client) => {
    const ok = await confirm({ title: "Delete client?", message: `${c.company} will be removed. Clients with orders or invoices cannot be deleted — deactivate instead.`, danger: true, confirmLabel: "Delete" });
    if (ok) deleteClient(c.id);
  };

  /* client detail aggregates */
  const stats = useMemo(() => {
    if (!client) return null;
    const orders = db.orders.filter((o) => o.clientId === client.id && o.status !== "Draft" && o.status !== "Cancelled");
    const invoices = db.invoices.filter((i) => i.clientId === client.id && !i.void);
    const payments = db.payments.filter((p) => p.partyKind === "client" && p.partyId === client.id && !p.void);
    return {
      orders: orders.length,
      sales: sum(invoices, (i) => i.grandTotalPkr),
      paid: sum(payments.filter((p) => p.type !== "Refund"), (p) => p.amountPkr),
      outstanding: clientOutstanding(db, client.id),
      profit: sum(orders, (o) => orderTotals(o).grossProfit),
      shipments: db.shipments.filter((s) => s.orderIds.some((oid) => db.orders.find((o) => o.id === oid)?.clientId === client.id) && s.status !== "Delivered").length,
      creditUsed: clientOutstanding(db, client.id),
    };
  }, [db, client]);

  const ledger = useMemo(() => (client ? clientLedgerRows(db, client.id) : []), [db, client]);

  const exportLedger = () => {
    if (!client) return;
    downloadCSV(`statement-${client.code}.csv`,
      ["Date", "Reference", "Particulars", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"],
      ledger.map((r) => [r.date, r.ref, r.description, r.debit, r.credit, r.balance]));
  };

  const printStatement = () => { setPrinting(true); window.setTimeout(doPrint, 120); window.setTimeout(() => setPrinting(false), 1500); };

  return (
    <div>
      <PageHead title="Clients" sub={`${db.clients.length} accounts · balances computed live from the double-entry ledger`}
        actions={editable ? <Btn onClick={() => { setErrs({}); setForm(empty()); }}><Plus className="h-4 w-4" />New Client</Btn> : undefined} />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search company, code, city…" /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inp} w-auto`}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          <button onClick={() => downloadCSV("clients.csv", ["Code", "Company", "Contact", "Phone", "Email", "City", "Credit Limit", "Outstanding"], rows.map((c) => [c.code, c.company, c.contactPerson, c.phone, c.email, c.city, c.creditLimit, clientOutstanding(db, c.id)]))}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700"><Download className="h-3.5 w-3.5" />CSV</button>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="hk-table w-full">
            <thead><tr><th>Code</th><th>Company</th><th>Contact</th><th>City</th><th className="text-right">Credit Limit</th><th className="text-right">Outstanding</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {pg.rows.map((c) => {
                const out = clientOutstanding(db, c.id);
                return (
                  <tr key={c.id} className="cursor-pointer" onClick={() => { setDetailId(c.id); setTab("orders"); }}>
                    <td className="num font-semibold text-brand-700">{c.code}</td>
                    <td><p className="font-semibold text-ink-900">{c.company}</p><p className="num text-[10.5px] text-ink-400">{c.email}</p></td>
                    <td>{c.contactPerson}<p className="num text-[10.5px] text-ink-400">{c.phone}</p></td>
                    <td>{c.city}, {c.province}</td>
                    <td className="num text-right">{fc("PKR", c.creditLimit)}</td>
                    <td className={`num text-right font-semibold ${out > 0 ? "text-bad-600" : "text-ok-600"}`}>{out > 0 ? fc("PKR", out) : out < 0 ? `Advance ${fc("PKR", -out)}` : "—"}</td>
                    <td><Pill label={c.status} /></td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {editable && <Btn size="sm" variant="ghost" title="Edit" onClick={() => { setErrs({}); setForm({ ...c }); }}><Pencil className="h-3.5 w-3.5" /></Btn>}
                        {editable && <Btn size="sm" variant="ghost" title="Delete" className="hover:text-bad-600" onClick={() => askDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pg.rows.length === 0 && <tr><td colSpan={8} className="py-8"><Empty title="No clients match" body="Adjust the search or add a new account." /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={rows.length} label="clients" /></div>
      </Card>

      {/* form modal */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${form.code}` : "New Client"} sub="Master data — used across quotations, orders and the khata"
        footer={<><Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn><Btn onClick={submit}>{form?.id ? "Save changes" : "Create client"}</Btn></>}>
        {form && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Company Name" err={errs.company} className="sm:col-span-2"><input className={inp} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="Contact Person" err={errs.contactPerson}><input className={inp} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Field>
            <Field label="Phone" err={errs.phone}><input className={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><input className={inp} value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
            <Field label="Email" err={errs.email}><input className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="CNIC / NTN"><input className={inp} value={form.cnicNtn ?? ""} onChange={(e) => setForm({ ...form, cnicNtn: e.target.value })} /></Field>
            <Field label="City"><input className={inp} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Province"><input className={inp} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></Field>
            <Field label="Country"><input className={inp} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><input className={inp} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Preferred Currency"><select className={inp} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as Client["currency"] })}><option>PKR</option><option>RMB</option><option>USD</option><option>EUR</option></select></Field>
            <Field label="Payment Terms"><input className={inp} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
            <Field label="Credit Limit (PKR)" err={errs.creditLimit}><input type="number" className={inp} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} /></Field>
            <Field label="Opening Balance (PKR)" hint="Positive = client owes at start"><input type="number" className={inp} value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} /></Field>
            <Field label="Status"><select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Client["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inp} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* detail drawer */}
      <Drawer open={!!client} onClose={() => setDetailId(null)} w="max-w-4xl"
        title={client ? `${client.company}` : ""}
        sub={client ? <span className="num">{client.code} · {client.city}, {client.country} · {client.contactPerson} · {client.phone}</span> : null}
        footer={client && editable ? <>
          <Btn variant="outline" onClick={() => { setErrs({}); setForm({ ...client }); }}><Pencil className="h-4 w-4" />Edit</Btn>
          <Btn variant="outline" onClick={() => nav("finance", undefined, { tab: "payments", partyKind: "client", partyId: client.id })}><Wallet className="h-4 w-4" />Record payment</Btn>
          <Btn onClick={() => nav("quotations", undefined, { clientId: client.id })}><FileText className="h-4 w-4" />New quotation</Btn>
        </> : undefined}>
        {client && stats && (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <MiniStat label="Total Orders" value={fm(stats.orders)} />
              <MiniStat label="Total Sales (Invoiced)" value={fc("PKR", stats.sales)} />
              <MiniStat label="Total Paid" value={fc("PKR", stats.paid)} tone="text-ok-600" />
              <MiniStat label="Outstanding" value={stats.outstanding > 0 ? fc("PKR", stats.outstanding) : stats.outstanding < 0 ? `Adv. ${fc("PKR", -stats.outstanding)}` : "Clear"} tone={stats.outstanding > 0 ? "text-bad-600" : "text-ok-600"} />
              <MiniStat label="Gross Profit" value={fc("PKR", stats.profit)} tone="text-brass-600" />
              <MiniStat label="Active Shipments" value={fm(stats.shipments)} />
              <MiniStat label="Credit Limit" value={fc("PKR", client.creditLimit)} />
              <MiniStat label="Credit Utilisation" value={client.creditLimit > 0 ? `${Math.max(0, Math.round((stats.creditUsed / client.creditLimit) * 100))}%` : "—"} tone={client.creditLimit > 0 && stats.creditUsed / client.creditLimit > 0.8 ? "text-bad-600" : undefined} />
            </div>
            {client.notes && <p className="mt-3 rounded-lg border border-brass-100 bg-brass-100/50 px-3 py-2 text-[12px] text-ink-600"><b>Notes:</b> {client.notes}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Tabs tabs={[{ id: "orders", label: "Orders", count: db.orders.filter((o) => o.clientId === client.id).length }, { id: "payments", label: "Payments", count: db.payments.filter((p) => p.partyKind === "client" && p.partyId === client.id && !p.void).length }, { id: "ledger", label: "Khata / Ledger", count: ledger.length }]} active={tab} onChange={setTab} />
              {tab === "ledger" && (
                <div className="flex gap-2">
                  <Btn size="sm" variant="outline" onClick={exportLedger}><Download className="h-3.5 w-3.5" />CSV</Btn>
                  <Btn size="sm" variant="dark" onClick={printStatement}><Printer className="h-3.5 w-3.5" />Statement PDF</Btn>
                </div>
              )}
            </div>

            <div className="mt-3">
              {tab === "orders" && (
                <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                  <table className="hk-table w-full">
                    <thead><tr><th>Order</th><th>Date</th><th className="text-right">Revenue</th><th className="text-right">Profit</th><th>Status</th></tr></thead>
                    <tbody>
                      {db.orders.filter((o) => o.clientId === client.id).map((o) => (
                        <tr key={o.id} className="cursor-pointer" onClick={() => nav("orders", o.id)}>
                          <td className="num font-semibold text-brand-700">{o.number}</td>
                          <td className="num">{fmtDate(o.date)}</td>
                          <td className="num text-right">{fc("PKR", orderRevenue(o))}</td>
                          <td className="num text-right text-ok-600">{fc("PKR", orderTotals(o).grossProfit)}</td>
                          <td><Pill label={o.status} /></td>
                        </tr>
                      ))}
                      {db.orders.filter((o) => o.clientId === client.id).length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-300">No orders yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "payments" && (
                <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                  <table className="hk-table w-full">
                    <thead><tr><th>Date</th><th>Ref</th><th>Type</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
                    <tbody>
                      {db.payments.filter((p) => p.partyKind === "client" && p.partyId === client.id && !p.void).map((p) => (
                        <tr key={p.id}>
                          <td className="num">{fmtDate(p.date)}</td>
                          <td className="num font-semibold text-brand-700">{p.number}</td>
                          <td>{p.type}</td>
                          <td>{p.method}</td>
                          <td className="num text-right font-semibold">{fc(p.currency, p.amount)}</td>
                        </tr>
                      ))}
                      {db.payments.filter((p) => p.partyKind === "client" && p.partyId === client.id && !p.void).length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-300">No payments recorded</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "ledger" && (
                <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                  <table className="hk-table w-full">
                    <thead><tr><th>Date</th><th>Reference</th><th>Particulars</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                    <tbody>
                      {ledger.map((r) => (
                        <tr key={r.id}>
                          <td className="num">{fmtDate(r.date)}</td>
                          <td className="num font-semibold text-brass-600">{r.ref}</td>
                          <td>{r.description}</td>
                          <td className="num text-right">{r.debit ? fm(r.debit) : "—"}</td>
                          <td className="num text-right">{r.credit ? fm(r.credit) : "—"}</td>
                          <td className={`num text-right font-bold ${r.balance > 0 ? "text-bad-600" : "text-ok-600"}`}>{fm(r.balance)}</td>
                        </tr>
                      ))}
                      {ledger.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-300">Ledger is empty</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {printing && client && (
        <PrintPortal><StatementDoc client={client} rows={ledger} company={db.settings} kind="client" /></PrintPortal>
      )}
    </div>
  );
}
