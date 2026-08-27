import { useMemo, useState } from "react";
import { BadgeCheck, Crown, FileText, Pencil, Plus, Trash2, TrendingDown } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Field, Modal, Pager, paginate, Pill, SearchBox, SectionLabel, Tabs, inp, CurrencySelector, CURRENCY_SYMBOLS } from "../components/ui";
import { calculateLanded, type CostingInput } from "../lib/costing";
import { currentRate, useStore } from "../lib/store";
import { daysAhead, fc, fm, fmtDate, r2, todayISO, uid } from "../lib/money";
import type { Quotation, SourcingRequest, SupplierQuote, Currency } from "../lib/types";

const REQ_STATUSES: SourcingRequest["status"][] = ["New", "Searching", "Supplier Found", "Quotation Received", "Client Quotation Prepared", "Approved", "Rejected", "Converted to Order"];

export default function Sourcing() {
  const { db, route, nav, can, saveSourcing, deleteSourcing, saveQuote, deleteQuote, saveQuotation, confirm, toast } = useStore();
  const initTab = (route.carry as { tab?: string } | undefined)?.tab === "quotes" ? "quotes" : "requests";
  const [tab, setTab] = useState(initTab);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<SourcingRequest | null>(null);
  const [quoteForm, setQuoteForm] = useState<SupplierQuote | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  const editable = can("sourcing", "edit");
  const req = db.sourcingRequests.find((r) => r.id === detailId) ?? null;

  const rows = useMemo(() => db.sourcingRequests
    .filter((r) => {
      const c = db.clients.find((x) => x.id === r.clientId);
      const p = db.products.find((x) => x.id === r.productId);
      return `${r.number} ${c?.company ?? ""} ${p?.name ?? ""} ${r.status}`.toLowerCase().includes(q.toLowerCase());
    }), [db, q]);
  const pg = paginate(rows, page, 9);

  const submitReq = () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = "Client is required.";
    if (!form.productId) e.productId = "Product is required.";
    if (form.qty <= 0) e.qty = "Quantity must be greater than zero.";
    setErrs(e);
    if (Object.keys(e).length) return;
    saveSourcing(form);
    setForm(null);
  };

  const submitQuote = () => {
    if (!quoteForm) return;
    const e: Record<string, string> = {};
    if (!quoteForm.supplierId) e.supplierId = "Supplier is required.";
    if (quoteForm.unitPrice <= 0) e.unitPrice = "Unit price must be greater than zero.";
    if (quoteForm.moq <= 0) e.moq = "MOQ must be greater than zero.";
    setErrs(e);
    if (Object.keys(e).length) return;
    saveQuote(quoteForm);
    setQuoteForm(null);
  };

  /* comparison for a request */
  const compare = (requestId: string) => {
    const request = db.sourcingRequests.find((x) => x.id === requestId);
    const quotes = db.supplierQuotes.filter((x) => x.requestId === requestId)
      .map((x) => {
        const rate = currentRate(db, x.currency);
        return { ...x, pkrUnit: r2(x.unitPrice * rate), eligible: x.moq <= (request?.qty ?? 0) };
      })
      .sort((a, b) => a.pkrUnit - b.pkrUnit);
    const cheapest = quotes[0] ?? null;
    const eligibleCheapest = quotes.find((x) => x.eligible) ?? null;
    return { quotes, cheapest, recommended: eligibleCheapest };
  };

  const newQuoteFor = (r: SourcingRequest): SupplierQuote => ({
    id: "", number: "", requestId: r.id, supplierId: "", productId: r.productId, qty: r.qty,
    unitPrice: 0, currency: "RMB", moq: 100, terms: "", leadTimeDays: 15, packagingCost: 0,
    chinaFreight: 0, validUntil: daysAhead(14), notes: "", createdAt: "",
  });

  const prepareQuotation = (r: SourcingRequest) => {
    const { recommended, cheapest } = compare(r.id);
    const pick = recommended ?? cheapest;
    if (!pick) { toast("Add at least one supplier quote before preparing a client quotation.", "warning"); return; }
    const p = db.products.find((x) => x.id === r.productId);
    if (!p) return;
    const rate = currentRate(db, pick.currency);
    const input: CostingInput = {
      qty: r.qty, unitPrice: pick.unitPrice, currency: pick.currency, rateToPkr: rate,
      chinaInland: pick.chinaFreight, warehouse: 0, loading: 0, packaging: pick.packagingCost, inspection: 0, otherChina: 0,
      freightMode: "sea", weightKg: p.weightKg * r.qty, cbm: p.cbm * r.qty, airRatePerKg: 0,
      seaRatePerCbm: 61500, containerCharge: r.qty * p.cbm > 12 ? 85000 : 35000,
      customsDuty: 0, salesTax: 0, regulatoryDuty: 0, additionalDuty: 0,
      clearance: 0, portCharges: 0, documentation: 0, localTransport: 0, delivery: 0,
      insurance: 0, bankCharges: 0, commission: 0, misc: 0,
      pricingMethod: "margin", pricingValue: 15,
    };
    /* duty estimate: 9% of product cost + 18% sales tax on (cost + duty) */
    const base = calculateLanded(input);
    const customsDuty = r2(base.productCostPkr * 0.09);
    const salesTax = r2((base.productCostPkr + customsDuty) * 0.18);
    const snap = calculateLanded({ ...input, customsDuty, salesTax, clearance: 18000, portCharges: 9000, documentation: 3500, localTransport: r2(base.productCostPkr * 0.02), delivery: 8000, insurance: r2(base.productCostPkr * 0.008), bankCharges: 4500 });
    const sup = db.suppliers.find((x) => x.id === pick.supplierId);
    const qt: Quotation = {
      id: "", number: "", clientId: r.clientId, date: todayISO(), validUntil: daysAhead(15),
      items: [{ productId: p.id, description: `${p.name} — ${p.spec ?? p.sku}`, qty: r.qty, snapshot: snap }],
      discountPkr: 0, paymentTerms: db.clients.find((c) => c.id === r.clientId)?.paymentTerms ?? "30% advance", deliveryTerms: `${sup?.city ?? "China"} origin · sea groupage · ~45 days`,
      notes: `Based on ${pick.number} (${pick.currency} ${fm(pick.unitPrice)}/unit). Duty & tax estimated — refine in the cost calculator before sending.`,
      status: "Draft", createdAt: "",
    };
    const id = saveQuotation(qt);
    saveSourcing({ ...r, status: "Client Quotation Prepared" });
    toast("Client quotation drafted from the recommended supplier quote.", "success");
    nav("quotations", id);
  };

  const cmp = req ? compare(req.id) : null;
  const allQuotes = db.supplierQuotes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <PageHead title="Sourcing Desk" sub="Client requirements → supplier quotes → side-by-side comparison → client quotation"
        actions={editable ? <Btn onClick={() => { setErrs({}); setForm({ id: "", number: "", clientId: db.clients[0]?.id ?? "", productId: db.products[0]?.id ?? "", qty: 100, spec: "", targetPricePkr: 0, targetDate: daysAhead(45), notes: "", agentId: "", status: "New", createdAt: "" }); }}><Plus className="h-4 w-4" />New Request</Btn> : undefined} />

      <div className="mb-4"><Tabs tabs={[{ id: "requests", label: "Sourcing Requests", count: db.sourcingRequests.length }, { id: "quotes", label: "Supplier Quotes", count: db.supplierQuotes.length }]} active={tab} onChange={setTab} /></div>

      {tab === "requests" && (
        <Card pad={false}>
          <div className="border-b border-paper-200 px-4 py-3"><div className="w-full sm:w-72"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search number, client, product…" /></div></div>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Request</th><th>Client</th><th>Product</th><th className="text-right">Qty</th><th>Target</th><th>Quotes</th><th>Agent</th><th>Status</th></tr></thead>
              <tbody>
                {pg.rows.map((r) => {
                  const c = db.clients.find((x) => x.id === r.clientId);
                  const p = db.products.find((x) => x.id === r.productId);
                  const qc = db.supplierQuotes.filter((x) => x.requestId === r.id).length;
                  const a = db.users.find((u) => u.id === r.agentId);
                  return (
                    <tr key={r.id} className="cursor-pointer" onClick={() => setDetailId(r.id)}>
                      <td className="num font-semibold text-brand-700">{r.number}<p className="num text-[10px] font-normal text-ink-400">{fmtDate(r.createdAt.slice(0, 10))}</p></td>
                      <td>{c?.company}</td>
                      <td><p className="font-medium text-ink-900">{p?.name}</p><p className="text-[10.5px] text-ink-400">{r.spec}</p></td>
                      <td className="num text-right font-semibold">{fm(r.qty)}</td>
                      <td className="num text-[11.5px]">{r.targetPricePkr ? `≤ ${fc("PKR", r.targetPricePkr)}/u` : "—"}{r.targetDate && <p className="text-[10px] text-ink-400">by {fmtDate(r.targetDate)}</p>}</td>
                      <td><span className={`num rounded-full px-2 py-0.5 text-[11px] font-bold ${qc > 0 ? "bg-brass-100 text-brass-600" : "bg-paper-200 text-ink-400"}`}>{qc}</span></td>
                      <td className="text-[12px]">{a?.name ?? "—"}</td>
                      <td><Pill label={r.status} pulse={r.status === "Searching"} /></td>
                    </tr>
                  );
                })}
                {pg.rows.length === 0 && <tr><td colSpan={8} className="py-8"><Empty title="No sourcing requests" body="Raise a request to start collecting supplier quotes." /></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={rows.length} label="requests" /></div>
        </Card>
      )}

      {tab === "quotes" && (
        <Card pad={false}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Quote</th><th>Supplier</th><th>Product</th><th className="text-right">Qty</th><th className="text-right">Unit Price</th><th className="text-right">≈ PKR / unit</th><th>MOQ</th><th>Lead</th><th>Valid Until</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {allQuotes.map((sq) => {
                  const s = db.suppliers.find((x) => x.id === sq.supplierId);
                  const p = db.products.find((x) => x.id === sq.productId);
                  const rate = currentRate(db, sq.currency);
                  return (
                    <tr key={sq.id} className="cursor-pointer" onClick={() => sq.requestId && setDetailId(sq.requestId)}>
                      <td className="num font-semibold text-brand-700">{sq.number}</td>
                      <td>{s?.name}</td>
                      <td>{p?.name}</td>
                      <td className="num text-right">{fm(sq.qty)}</td>
                      <td className="num text-right font-semibold">{sq.currency} {fm(sq.unitPrice)}</td>
                      <td className="num text-right text-brass-600">{fm(r2(sq.unitPrice * rate))}</td>
                      <td className="num text-right">{fm(sq.moq)}</td>
                      <td className="num text-right">{sq.leadTimeDays}d</td>
                      <td className={`num ${sq.validUntil < todayISO() ? "text-bad-600" : ""}`}>{fmtDate(sq.validUntil)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {editable && <Btn size="sm" variant="ghost" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Remove quote?", message: `${sq.number} will be removed from the comparison.`, danger: true, confirmLabel: "Remove" }); if (ok) deleteQuote(sq.id); }}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                      </td>
                    </tr>
                  );
                })}
                {allQuotes.length === 0 && <tr><td colSpan={10} className="py-8"><Empty title="No supplier quotes yet" /></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* request form */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${form.number}` : "New Sourcing Request"} sub="What does the client need, and at what target?"
        footer={<><Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn><Btn onClick={submitReq}>{form?.id ? "Save changes" : "Create request"}</Btn></>}>
        {form && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Client" err={errs.clientId}><select className={inp} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</select></Field>
            <Field label="Product" err={errs.productId}><select className={inp} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>{db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Quantity" err={errs.qty}><input type="number" className={inp} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
            <Field label="Target Price (PKR / unit)"><input type="number" className={inp} value={form.targetPricePkr ?? 0} onChange={(e) => setForm({ ...form, targetPricePkr: Number(e.target.value) })} /></Field>
            <Field label="Required Specification" className="sm:col-span-2"><input className={inp} value={form.spec ?? ""} onChange={(e) => setForm({ ...form, spec: e.target.value })} /></Field>
            <Field label="Target Delivery Date"><input type="date" className={inp} value={form.targetDate ?? ""} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} /></Field>
            <Field label="Assigned Agent"><select className={inp} value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}><option value="">—</option>{db.users.filter((u) => ["sales", "admin", "superadmin"].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Status"><select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SourcingRequest["status"] })}>{REQ_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inp} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* quote form */}
      <Modal open={!!quoteForm} onClose={() => setQuoteForm(null)} title="Record Supplier Quote" sub="Entered quotes re-rank the comparison instantly"
        footer={<><Btn variant="outline" onClick={() => setQuoteForm(null)}>Cancel</Btn><Btn onClick={submitQuote}>Save quote</Btn></>}>
        {quoteForm && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Supplier" err={errs.supplierId}><select className={inp} value={quoteForm.supplierId} onChange={(e) => setQuoteForm({ ...quoteForm, supplierId: e.target.value })}><option value="">Select supplier…</option>{db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <Field label="Currency">
                <CurrencySelector value={quoteForm.currency} onChange={(c) => setQuoteForm({ ...quoteForm, currency: c as Exclude<Currency, "PKR"> })} excludePkr />
              </Field>
              <Field label="Unit Price" err={errs.unitPrice}>
                <input type="number" step="0.01" className={`${inp} num text-right`} value={quoteForm.unitPrice || ""} onChange={(e) => setQuoteForm({ ...quoteForm, unitPrice: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Quoted Qty"><input type="number" className={inp} value={quoteForm.qty} onChange={(e) => setQuoteForm({ ...quoteForm, qty: Number(e.target.value) })} /></Field>
            <Field label="MOQ" err={errs.moq}><input type="number" className={inp} value={quoteForm.moq} onChange={(e) => setQuoteForm({ ...quoteForm, moq: Number(e.target.value) })} /></Field>
            <Field label="Lead Time (days)"><input type="number" className={inp} value={quoteForm.leadTimeDays} onChange={(e) => setQuoteForm({ ...quoteForm, leadTimeDays: Number(e.target.value) })} /></Field>
            <Field label="Packaging Cost (PKR)"><input type="number" className={inp} value={quoteForm.packagingCost} onChange={(e) => setQuoteForm({ ...quoteForm, packagingCost: Number(e.target.value) })} /></Field>
            <Field label="China Domestic Freight (PKR)"><input type="number" className={inp} value={quoteForm.chinaFreight} onChange={(e) => setQuoteForm({ ...quoteForm, chinaFreight: Number(e.target.value) })} /></Field>
            <Field label="Quote Valid Until"><input type="date" className={inp} value={quoteForm.validUntil} onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} /></Field>
            <Field label="Supplier Terms"><input className={inp} value={quoteForm.terms ?? ""} onChange={(e) => setQuoteForm({ ...quoteForm, terms: e.target.value })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inp} value={quoteForm.notes ?? ""} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* request detail + comparison */}
      <Drawer open={!!req} onClose={() => setDetailId(null)} w="max-w-3xl"
        title={req ? `${req.number} — ${db.products.find((p) => p.id === req.productId)?.name ?? ""}` : ""}
        sub={req ? <span>{db.clients.find((c) => c.id === req.clientId)?.company} · qty <b className="num">{fm(req.qty)}</b> · <Pill label={req.status} /></span> : null}
        footer={req && editable ? <>
          {cmp && cmp.quotes.length > 0 && req.status !== "Converted to Order" && (
            <Btn variant="brass" onClick={() => prepareQuotation(req)}><FileText className="h-4 w-4" />Prepare client quotation</Btn>
          )}
          <Btn variant="outline" onClick={() => { setErrs({}); setQuoteForm(newQuoteFor(req)); }}><Plus className="h-4 w-4" />Add supplier quote</Btn>
          <Btn variant="outline" onClick={() => { setErrs({}); setForm({ ...req }); }}><Pencil className="h-4 w-4" />Edit</Btn>
          <Btn variant="ghost" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Delete request?", message: `${req.number} and its quotes will be removed.`, danger: true, confirmLabel: "Delete" }); if (ok) { deleteSourcing(req.id); setDetailId(null); } }}><Trash2 className="h-4 w-4" /></Btn>
        </> : undefined}>
        {req && cmp && (
          <div className="p-5">
            {req.spec && <p className="rounded-lg bg-paper-200/70 px-3 py-2 text-[12px] text-ink-600"><b>Spec:</b> {req.spec}</p>}
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-paper-200 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-ink-400">Target price</p><p className="num text-[13.5px] font-bold text-ink-800">{req.targetPricePkr ? fc("PKR", req.targetPricePkr) : "—"}</p></div>
              <div className="rounded-lg border border-paper-200 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-ink-400">Target date</p><p className="num text-[13.5px] font-bold text-ink-800">{req.targetDate ? fmtDate(req.targetDate) : "—"}</p></div>
              <div className="rounded-lg border border-paper-200 bg-white px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-ink-400">Agent</p><p className="text-[13.5px] font-bold text-ink-800">{db.users.find((u) => u.id === req.agentId)?.name ?? "—"}</p></div>
            </div>

            <SectionLabel>Supplier comparison — {cmp.quotes.length} quote(s)</SectionLabel>
            {cmp.quotes.length === 0 ? (
              <Empty title="No quotes yet" body="Collect at least one supplier quote to unlock the comparison and client quotation."
                action={editable ? <Btn onClick={() => { setErrs({}); setQuoteForm(newQuoteFor(req)); }}><Plus className="h-4 w-4" />Add first quote</Btn> : undefined} />
            ) : (
              <div className="space-y-2">
                {cmp.quotes.map((sq) => {
                  const s = db.suppliers.find((x) => x.id === sq.supplierId);
                  const isCheap = cmp.cheapest?.id === sq.id;
                  const isRec = cmp.recommended?.id === sq.id;
                  return (
                    <div key={sq.id} className={`relative rounded-xl border-2 bg-white p-3.5 transition-all hover:shadow-md ${isRec ? "border-brand-500" : isCheap ? "border-brass-400" : "border-paper-200"}`}>
                      {(isCheap || isRec) && (
                        <div className="absolute -top-2.5 left-3 flex gap-1.5">
                          {isCheap && <span className="inline-flex items-center gap-1 rounded-full bg-brass-500 px-2 py-0.5 text-[10px] font-bold text-ink-950"><TrendingDown className="h-3 w-3" />CHEAPEST</span>}
                          {isRec && <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white"><Crown className="h-3 w-3" />RECOMMENDED</span>}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="min-w-[150px]">
                          <p className="text-[13px] font-bold text-ink-900">{s?.name}</p>
                          <p className="num text-[10.5px] text-ink-400">{sq.number} · valid {fmtDate(sq.validUntil)}</p>
                        </div>
                        <div><p className="text-[10px] font-semibold uppercase text-ink-400">Unit price</p><p className="num text-[16px] font-bold text-ink-900">{sq.currency} {fm(sq.unitPrice)}</p></div>
                        <div><p className="text-[10px] font-semibold uppercase text-ink-400">≈ PKR / unit</p><p className="num text-[14px] font-bold text-brass-600">{fm(sq.pkrUnit)}</p></div>
                        <div><p className="text-[10px] font-semibold uppercase text-ink-400">MOQ</p><p className={`num text-[13px] font-semibold ${sq.eligible ? "text-ink-700" : "text-bad-600"}`}>{fm(sq.moq)}{!sq.eligible && <span className="ml-1 text-[10px] font-bold text-bad-600">ABOVE REQ. QTY</span>}</p></div>
                        <div><p className="text-[10px] font-semibold uppercase text-ink-400">Lead time</p><p className="num text-[13px] font-semibold text-ink-700">{sq.leadTimeDays} days</p></div>
                        <div className="ml-auto flex items-center gap-2">
                          {isRec && <BadgeCheck className="h-5 w-5 text-brand-600" />}
                          {editable && <Btn size="sm" variant="ghost" onClick={() => { setErrs({}); setQuoteForm({ ...sq }); }}><Pencil className="h-3.5 w-3.5" /></Btn>}
                          {editable && <Btn size="sm" variant="ghost" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Remove quote?", message: `${sq.number} will be removed.`, danger: true, confirmLabel: "Remove" }); if (ok) deleteQuote(sq.id); }}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                        </div>
                      </div>
                      {sq.notes && <p className="mt-2 text-[11.5px] text-ink-400">{sq.notes}</p>}
                    </div>
                  );
                })}
                <p className="text-[11px] text-ink-400">
                  Recommendation = cheapest quote whose MOQ fits the requested {fm(req.qty)} units, converted at today's board rate. Cheapest overall is flagged even if its MOQ is higher.
                </p>
              </div>
            )}

            <SectionLabel>Status</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {REQ_STATUSES.map((s) => (
                <button key={s} disabled={!editable} onClick={() => saveSourcing({ ...req, status: s })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${req.status === s ? "border-ink-900 bg-ink-900 text-brass-300" : "border-paper-300 bg-white text-ink-500 hover:border-brass-400 hover:text-brass-600 disabled:opacity-50"}`}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
