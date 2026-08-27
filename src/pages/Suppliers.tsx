import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Field, MiniStat, Modal, Pager, paginate, Pill, SearchBox, Tabs, inp, PrintPortal, doPrint, CURRENCY_SYMBOLS } from "../components/ui";
import { StatementDoc } from "../components/docs";
import { orderTotals, supplierLedgerRows, supplierOutstanding, useStore } from "../lib/store";
import { downloadCSV, fc, fm, fmtDate, sum } from "../lib/money";
import type { Supplier } from "../lib/types";

const empty = (): Supplier => ({
  id: "", code: "", name: "", contactPerson: "", phone: "", wechat: "", whatsapp: "", email: "",
  country: "China", province: "", city: "", warehouseAddress: "", categories: [], paymentTerms: "30% deposit, 70% before shipment",
  currency: "RMB", bankInfo: "", status: "active", notes: "", createdAt: "",
});

export default function Suppliers() {
  const { db, nav, can, saveSupplier, deleteSupplier, confirm } = useStore();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Supplier | null>(null);
  const [cats, setCats] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState("purchases");
  const [printing, setPrinting] = useState(false);

  const editable = can("suppliers", "edit");
  const supplier = db.suppliers.find((s) => s.id === detailId) ?? null;

  const rows = useMemo(() => db.suppliers
    .filter((s) => `${s.name} ${s.code} ${s.city} ${s.contactPerson} ${s.categories.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)), [db.suppliers, q]);
  const pg = paginate(rows, page, 9);

  const submit = () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Supplier name is required.";
    if (!form.contactPerson.trim()) e.contactPerson = "Contact person is required.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    setErrs(e);
    if (Object.keys(e).length) return;
    saveSupplier({ ...form, categories: cats.split(",").map((x) => x.trim()).filter(Boolean) });
    setForm(null);
  };

  const askDelete = async (s: Supplier) => {
    const ok = await confirm({ title: "Delete supplier?", message: `${s.name} will be removed. Suppliers linked to purchase orders cannot be deleted.`, danger: true, confirmLabel: "Delete" });
    if (ok) deleteSupplier(s.id);
  };

  const stats = useMemo(() => {
    if (!supplier) return null;
    const purchases = supplierLedgerRows(db, supplier.id).filter((r) => r.kind === "purchase");
    const orders = db.orders.filter((o) => o.status !== "Draft" && o.status !== "Cancelled" && o.items.some((i) => i.supplierId === supplier.id));
    return {
      orders: orders.length,
      purchased: sum(purchases, (p) => p.debit),
      paid: sum(db.payments.filter((p) => p.partyKind === "supplier" && p.partyId === supplier.id && !p.void), (p) => p.amountPkr),
      payable: supplierOutstanding(db, supplier.id),
      products: db.products.filter((p) => p.defaultSupplierId === supplier.id).length,
    };
  }, [db, supplier]);

  const ledger = useMemo(() => (supplier ? supplierLedgerRows(db, supplier.id) : []), [db, supplier]);
  const purchaseItems = useMemo(() => supplier ? db.orders
    .filter((o) => o.status !== "Draft" && o.status !== "Cancelled")
    .flatMap((o) => o.items.filter((i) => i.supplierId === supplier.id).map((i) => ({ o, i }))) : [], [db.orders, supplier]);

  const printStatement = () => { setPrinting(true); window.setTimeout(doPrint, 120); window.setTimeout(() => setPrinting(false), 1500); };

  return (
    <div>
      <PageHead title="Suppliers" sub="Chinese export partners — purchase ledger shown in foreign currency and PKR equivalent"
        actions={editable ? <Btn onClick={() => { setErrs({}); setCats(""); setForm(empty()); }}><Plus className="h-4 w-4" />New Supplier</Btn> : undefined} />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search supplier, city, category…" /></div>
          <button onClick={() => downloadCSV("suppliers.csv", ["Code", "Name", "Contact", "Phone", "WeChat", "City", "Country", "Terms", "Payable PKR"], rows.map((s) => [s.code, s.name, s.contactPerson, s.phone, s.wechat ?? "", s.city, s.country, s.paymentTerms, supplierOutstanding(db, s.id)]))}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700"><Download className="h-3.5 w-3.5" />CSV</button>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="hk-table w-full">
            <thead><tr><th>Code</th><th>Supplier</th><th>Contact / WeChat</th><th>Location</th><th>Categories</th><th className="text-right">Payable (PKR)</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {pg.rows.map((s) => {
                const out = supplierOutstanding(db, s.id);
                return (
                  <tr key={s.id} className="cursor-pointer" onClick={() => { setDetailId(s.id); setTab("purchases"); }}>
                    <td className="num font-semibold text-brand-700">{s.code}</td>
                    <td><p className="font-semibold text-ink-900">{s.name}</p><p className="num text-[10.5px] text-ink-400">{s.email}</p></td>
                    <td>{s.contactPerson}<p className="num text-[10.5px] text-ink-400">{s.wechat ? `WeChat: ${s.wechat}` : s.phone}</p></td>
                    <td>{s.city}, {s.province}<p className="text-[10.5px] text-ink-400">{s.country}</p></td>
                    <td><div className="flex flex-wrap gap-1">{s.categories.slice(0, 2).map((c) => <span key={c} className="rounded bg-paper-200 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">{c}</span>)}</div></td>
                    <td className={`num text-right font-semibold ${out > 0 ? "text-warn-600" : "text-ok-600"}`}>{out > 0 ? fc("PKR", out) : "Settled"}</td>
                    <td><Pill label={s.status} /></td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {editable && <Btn size="sm" variant="ghost" title="Edit" onClick={() => { setErrs({}); setCats(s.categories.join(", ")); setForm({ ...s }); }}><Pencil className="h-3.5 w-3.5" /></Btn>}
                        {editable && <Btn size="sm" variant="ghost" title="Delete" className="hover:text-bad-600" onClick={() => askDelete(s)}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pg.rows.length === 0 && <tr><td colSpan={8} className="py-8"><Empty title="No suppliers match" /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={rows.length} label="suppliers" /></div>
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${form.code}` : "New Supplier"} sub="Sourcing partners — quotes & purchase ledger attach to this record"
        footer={<><Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn><Btn onClick={submit}>{form?.id ? "Save changes" : "Create supplier"}</Btn></>}>
        {form && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Supplier Name" err={errs.name} className="sm:col-span-2"><input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Contact Person" err={errs.contactPerson}><input className={inp} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Field>
            <Field label="Phone" err={errs.phone}><input className={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="WeChat"><input className={inp} value={form.wechat ?? ""} onChange={(e) => setForm({ ...form, wechat: e.target.value })} /></Field>
            <Field label="WhatsApp"><input className={inp} value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
            <Field label="Email"><input className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Country"><input className={inp} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            <Field label="Province"><input className={inp} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></Field>
            <Field label="City"><input className={inp} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Warehouse Address" className="sm:col-span-2"><input className={inp} value={form.warehouseAddress ?? ""} onChange={(e) => setForm({ ...form, warehouseAddress: e.target.value })} /></Field>
            <Field label="Product Categories" hint="comma separated" className="sm:col-span-2"><input className={inp} value={cats} onChange={(e) => setCats(e.target.value)} placeholder="LED Lighting, Solar…" /></Field>
            <Field label="Payment Terms"><input className={inp} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
            <Field label="Preferred Currency"><select className={inp} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as Supplier["currency"] })}><option>RMB</option><option>USD</option><option>EUR</option><option>PKR</option></select></Field>
            <Field label="Bank Information" className="sm:col-span-2"><input className={inp} value={form.bankInfo ?? ""} onChange={(e) => setForm({ ...form, bankInfo: e.target.value })} /></Field>
            <Field label="Status"><select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Supplier["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inp} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Drawer open={!!supplier} onClose={() => setDetailId(null)} w="max-w-4xl"
        title={supplier?.name ?? ""}
        sub={supplier ? <span className="num">{supplier.code} · {supplier.city}, {supplier.country} · {supplier.contactPerson} · {supplier.phone}</span> : null}
        footer={supplier && editable ? <>
          <Btn variant="outline" onClick={() => { setErrs({}); setCats(supplier.categories.join(", ")); setForm({ ...supplier }); }}><Pencil className="h-4 w-4" />Edit</Btn>
          <Btn onClick={() => nav("finance", undefined, { tab: "payments", partyKind: "supplier", partyId: supplier.id })}><Wallet className="h-4 w-4" />Pay supplier</Btn>
        </> : undefined}>
        {supplier && stats && (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
              <MiniStat label="Purchase Orders" value={fm(stats.orders)} />
              <MiniStat label="Total Purchased" value={fc("PKR", stats.purchased)} />
              <MiniStat label="Total Paid" value={fc("PKR", stats.paid)} tone="text-ok-600" />
              <MiniStat label="Payable Now" value={fc("PKR", Math.max(0, stats.payable))} tone={stats.payable > 0 ? "text-warn-600" : "text-ok-600"} />
              <MiniStat label="Master Products" value={fm(stats.products)} />
            </div>
            {supplier.warehouseAddress && <p className="num mt-3 rounded-lg bg-paper-200/70 px-3 py-2 text-[11.5px] text-ink-500"><b>Warehouse:</b> {supplier.warehouseAddress}</p>}
            {supplier.bankInfo && <p className="num mt-2 rounded-lg bg-paper-200/70 px-3 py-2 text-[11.5px] text-ink-500"><b>Bank:</b> {supplier.bankInfo}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Tabs tabs={[{ id: "purchases", label: "Purchases", count: purchaseItems.length }, { id: "payments", label: "Payments", count: db.payments.filter((p) => p.partyKind === "supplier" && p.partyId === supplier.id && !p.void).length }, { id: "ledger", label: "Ledger", count: ledger.length }, { id: "products", label: "Products", count: stats.products }]} active={tab} onChange={setTab} />
              {tab === "ledger" && <Btn size="sm" variant="dark" onClick={printStatement}><Printer className="h-3.5 w-3.5" />Statement PDF</Btn>}
            </div>

            <div className="mt-3">
              {tab === "purchases" && (
                <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                  <table className="hk-table w-full">
                    <thead><tr><th>Order</th><th>Product</th><th className="text-right">Qty</th><th className="text-right">Unit Price</th><th className="text-right">Cost (PKR)</th><th>Status</th></tr></thead>
                    <tbody>
                      {purchaseItems.map(({ o, i }) => {
                        const p = db.products.find((x) => x.id === i.productId);
                        return (
                          <tr key={i.id} className="cursor-pointer" onClick={() => nav("orders", o.id)}>
                            <td className="num font-semibold text-brand-700">{o.number}</td>
                            <td>{p?.name ?? i.productId}</td>
                            <td className="num text-right">{fm(i.snapshot.qty)}</td>
                            <td className="num text-right">{i.snapshot.currency} {fm(i.snapshot.unitPrice)}</td>
                            <td className="num text-right font-semibold">{fc("PKR", i.snapshot.productCostPkr)}</td>
                            <td><Pill label={o.status} /></td>
                          </tr>
                        );
                      })}
                      {purchaseItems.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-300">No purchases yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "payments" && (
                <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                  <table className="hk-table w-full">
                    <thead><tr><th>Date</th><th>Ref</th><th>Method</th><th className="text-right">Foreign</th><th className="text-right">PKR</th></tr></thead>
                    <tbody>
                      {db.payments.filter((p) => p.partyKind === "supplier" && p.partyId === supplier.id && !p.void).map((p) => (
                        <tr key={p.id}>
                          <td className="num">{fmtDate(p.date)}</td>
                          <td className="num font-semibold text-brand-700">{p.number}</td>
                          <td>{p.method}</td>
                          <td className="num text-right">{fc(p.currency, p.amount)} @ {p.rateToPkr}</td>
                          <td className="num text-right font-semibold">{fc("PKR", p.amountPkr)}</td>
                        </tr>
                      ))}
                      {db.payments.filter((p) => p.partyKind === "supplier" && p.partyId === supplier.id && !p.void).length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-300">No payments yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "ledger" && (
                <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
                  <table className="hk-table w-full">
                    <thead><tr><th>Date</th><th>Reference</th><th>Particulars</th><th className="text-right">Debit (PKR)</th><th className="text-right">Credit (PKR)</th><th className="text-right">Balance</th></tr></thead>
                    <tbody>
                      {ledger.map((r) => (
                        <tr key={r.id}>
                          <td className="num">{fmtDate(r.date)}</td>
                          <td className="num font-semibold text-brass-600">{r.ref}</td>
                          <td>{r.description}</td>
                          <td className="num text-right">{r.debit ? fm(r.debit) : "—"}</td>
                          <td className="num text-right">{r.credit ? fm(r.credit) : "—"}</td>
                          <td className={`num text-right font-bold ${r.balance > 0 ? "text-warn-600" : "text-ok-600"}`}>{fm(r.balance)}</td>
                        </tr>
                      ))}
                      {ledger.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-300">Ledger is empty</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "products" && (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {db.products.filter((p) => p.defaultSupplierId === supplier.id).map((p) => (
                    <div key={p.id} className="rounded-lg border border-paper-200 bg-white p-3">
                      <p className="text-[13px] font-semibold text-ink-900">{p.name}</p>
                      <p className="num text-[11px] text-ink-400">{p.sku} · {p.chineseName}</p>
                      <p className="num mt-1.5 text-[12px] font-semibold text-brand-700">{CURRENCY_SYMBOLS[p.defaultCurrency as "RMB" | "USD" | "PKR"] ?? "¥"} {fm(p.defaultPrice)}</p>
                    </div>
                  ))}
                  {db.products.filter((p) => p.defaultSupplierId === supplier.id).length === 0 && <p className="py-6 text-center text-[12px] text-ink-300 sm:col-span-2">No products assigned</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {printing && supplier && (
        <PrintPortal><StatementDoc client={{ ...supplier, company: supplier.name, openingBalance: 0, creditLimit: 0, currency: "RMB", cnicNtn: "", address: `${supplier.city}, ${supplier.country}`, paymentTerms: supplier.paymentTerms } as never} rows={ledger} company={db.settings} kind="supplier" /></PrintPortal>
      )}
    </div>
  );
}
