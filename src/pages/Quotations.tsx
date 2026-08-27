import { useMemo, useState } from "react";
import { Download, FilePlus2, Pencil, Printer, ShoppingCart, Trash2 } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Field, Modal, Pager, paginate, Pill, SearchBox, inp, PrintPortal, doPrint, CurrencySelector, CURRENCY_SYMBOLS, CurrencyAmountField } from "../components/ui";
import { QuotationDoc } from "../components/docs";
import { calculateLanded, type CostingInput } from "../lib/costing";
import { currentRate, useStore } from "../lib/store";
import { daysAhead, downloadCSV, fc, fm, fmtDate, r2, todayISO } from "../lib/money";
import { downloadPdf } from "../lib/pdf";
import type { Quotation, QuotationItem, Currency } from "../lib/types";

const QT_STATUSES: Quotation["status"][] = ["Draft", "Sent", "Viewed", "Accepted", "Rejected", "Expired", "Converted to Order"];

interface Row { productId: string; qty: number; unitPrice: number; currency: Currency; margin: number; }

export default function Quotations() {
  const { db, route, nav, can, saveQuotation, setQuotationStatus, convertQuotationToOrder, confirm, toast } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(route.id ?? null);
  const [builder, setBuilder] = useState(false);
  const [clientId, setClientId] = useState((route.carry as { clientId?: string } | undefined)?.clientId ?? db.clients[0]?.id ?? "");
  const [validUntil, setValidUntil] = useState(daysAhead(15));
  const [terms, setTerms] = useState("30% advance, balance against invoice");
  const [rows, setRows] = useState<Row[]>([{ productId: db.products[0]?.id ?? "", qty: 100, unitPrice: db.products[0]?.defaultPrice ?? 0, currency: db.products[0]?.defaultCurrency as Currency ?? "RMB", margin: 15 }]);
  const [printing, setPrinting] = useState(false);

  const editable = can("quotations", "edit");
  const qt = db.quotations.find((x) => x.id === detailId) ?? null;

  const list = useMemo(() => db.quotations
    .filter((x) => status === "all" || x.status === status)
    .filter((x) => {
      const c = db.clients.find((y) => y.id === x.clientId);
      return `${x.number} ${c?.company ?? ""} ${x.status}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db, q, status]);

  const pg = paginate(list, page, 9);

  const total = (x: Quotation) => r2(x.items.reduce((a, i) => a + i.snapshot.sellingPricePkr, 0) - x.discountPkr);

  const buildItem = (r: Row): QuotationItem | null => {
    const p = db.products.find((x) => x.id === r.productId);
    if (!p || r.qty <= 0 || r.unitPrice <= 0) return null;
    const rate = currentRate(db, r.currency);
    const input: CostingInput = {
      qty: r.qty, unitPrice: r.unitPrice, currency: r.currency, rateToPkr: rate,
      chinaInland: r2(p.weightKg * r.qty * 8), warehouse: 0, loading: 0, packaging: r2(r.qty * 12), inspection: 0, otherChina: 0,
      freightMode: "sea", weightKg: r2(p.weightKg * r.qty), cbm: r2(p.cbm * r.qty), airRatePerKg: 610,
      seaRatePerCbm: 61500, containerCharge: p.cbm * r.qty > 12 ? 85000 : 35000,
      customsDuty: 0, salesTax: 0, regulatoryDuty: 0, additionalDuty: 0,
      clearance: 18000, portCharges: 9000, documentation: 3500, localTransport: 0, delivery: 8000,
      insurance: 0, bankCharges: 4500, commission: 0, misc: 0,
      pricingMethod: "margin", pricingValue: r.margin,
    };

    const base = calculateLanded(input);
    const snap = calculateLanded({ ...input, customsDuty: r2(base.productCostPkr * 0.09), salesTax: r2((base.productCostPkr * 1.09) * 0.18) });
    return { productId: p.id, description: `${p.name} — ${p.spec ?? p.sku}`, qty: r.qty, snapshot: snap };
  };

  const saveNew = () => {
    const items = rows.map(buildItem);
    if (items.some((x) => !x)) { toast("Every line needs a product, qty > 0 and unit price > 0.", "error"); return; }
    const id = saveQuotation({
      id: "", number: "", clientId, date: todayISO(), validUntil,
      items: items as QuotationItem[], discountPkr: 0, paymentTerms: terms,
      deliveryTerms: "Sea groupage — 35 to 50 days · air available on request",
      notes: "Rates include China costs, freight, customs & clearing. Valid subject to exchange rate at confirmation.",
      status: "Draft", createdAt: "",
    });
    setBuilder(false);
    setDetailId(id);
  };

  const convert = async (id: string) => {
    const ok = await confirm({ title: "Convert to order?", message: "A draft order will be created and today's board rates are frozen into its cost snapshot. The quotation is marked “Converted to Order”.", confirmLabel: "Convert" });
    if (!ok) return;
    const oid = convertQuotationToOrder(id);
    if (oid) nav("orders", oid);
  };

  const print = () => { setPrinting(true); window.setTimeout(doPrint, 120); window.setTimeout(() => setPrinting(false), 1500); };

  const pdf = async (x: typeof qt) => {
    if (!x) return;
    await downloadPdf(QuotationDoc, {
      qt: x,
      client: db.clients.find((c) => c.id === x.clientId),
      company: db.settings,
    }, `${x.number}.pdf`);
  };

  return (
    <div>
      <PageHead title="Client Quotations" sub="Every line carries a full landed-cost snapshot — converting freezes it onto the order"
        actions={editable ? <>
          <button onClick={() => downloadCSV("quotations.csv", ["Number", "Client", "Date", "Valid Until", "Total PKR", "Status"], list.map((x) => [x.number, db.clients.find((c) => c.id === x.clientId)?.company ?? "", x.date, x.validUntil, total(x), x.status]))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700">CSV</button>
          <Btn onClick={() => setBuilder(true)}><FilePlus2 className="h-4 w-4" />New Quotation</Btn>
        </> : undefined} />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search number, client…" /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inp} w-auto`}>
            <option value="all">All statuses</option>{QT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto scroll-thin">
          <table className="hk-table w-full">
            <thead><tr><th>Number</th><th>Client</th><th>Date</th><th>Valid Until</th><th>Lines</th><th className="text-right">Total (PKR)</th><th>Status</th></tr></thead>
            <tbody>
              {pg.rows.map((x) => (
                <tr key={x.id} className="cursor-pointer" onClick={() => setDetailId(x.id)}>
                  <td className="num font-semibold text-brand-700">{x.number}</td>
                  <td>{db.clients.find((c) => c.id === x.clientId)?.company}</td>
                  <td className="num">{fmtDate(x.date)}</td>
                  <td className={`num ${x.validUntil < todayISO() && x.status === "Sent" ? "text-bad-600" : ""}`}>{fmtDate(x.validUntil)}</td>
                  <td className="num">{x.items.length}</td>
                  <td className="num text-right font-semibold">{fc("PKR", total(x))}</td>
                  <td><Pill label={x.status} /></td>
                </tr>
              ))}
              {pg.rows.length === 0 && <tr><td colSpan={7} className="py-8"><Empty title="No quotations match" body="Build one from the cost calculator or the builder." /></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={list.length} label="quotations" /></div>
      </Card>

      {/* builder */}
      <Modal open={builder} onClose={() => setBuilder(false)} w="max-w-3xl" title="New Client Quotation" sub="Landed snapshots are computed with today's board rates and default logistics"
        footer={<><Btn variant="outline" onClick={() => setBuilder(false)}>Cancel</Btn><Btn onClick={saveNew}>Create draft quotation</Btn></>}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Field label="Client"><select className={inp} value={clientId} onChange={(e) => setClientId(e.target.value)}>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</select></Field>
          <Field label="Valid Until"><input type="date" className={inp} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
          <Field label="Payment Terms"><input className={inp} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
        </div>

        <p className="disp mt-4 text-[11px] font-bold uppercase tracking-[.14em] text-brass-600">Line items</p>

        <div className="mt-2 space-y-2">
          {rows.map((r, idx) => {
            const item = buildItem(r);
            return (
              <div
                key={idx}
                className="grid grid-cols-2 items-end gap-2.5 rounded-lg border border-paper-200 bg-white p-3 md:grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1.4fr)_110px_130px_36px]"
              >
                <Field label="Product"><select className={inp} value={r.productId} onChange={(e) => { const p = db.products.find((x) => x.id === e.target.value); setRows(rows.map((x, j) => j === idx ? { ...x, productId: e.target.value, unitPrice: p?.defaultPrice ?? 0, currency: p?.defaultCurrency as Currency ?? "RMB" } : x)); }}>{db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>

                <Field label="Qty"><input type="number" className={`${inp} num text-right`} value={r.qty} onChange={(e) => setRows(rows.map((x, j) => j === idx ? { ...x, qty: Number(e.target.value) || 0 } : x))} /></Field>

                <CurrencyAmountField
                  label="Unit Price"
                  currency={r.currency}
                  amount={r.unitPrice}
                  onCurrencyChange={(c) => setRows(rows.map((x, j) => j === idx ? { ...x, currency: c } : x))}
                  onAmountChange={(n) => setRows(rows.map((x, j) => j === idx ? { ...x, unitPrice: n } : x))}
                  className="col-span-1"
                />

                <Field label="Margin %"><input type="number" step="0.5" className={`${inp} num text-right`} value={r.margin} onChange={(e) => setRows(rows.map((x, j) => j === idx ? { ...x, margin: Number(e.target.value) || 0 } : x))} /></Field>

                <div className="rounded-lg bg-paper-200/70 px-2.5 py-2 text-right">
                  <p className="text-[9px] font-bold uppercase text-ink-400">Selling</p>
                  <p className="num text-[12.5px] font-bold text-ink-900">{item ? fc("PKR", item.snapshot.sellingPricePkr) : "—"}</p>
                </div>

                <button
                  onClick={() => setRows(rows.filter((_, j) => j !== idx))}
                  disabled={rows.length === 1}
                  className="flex h-10 w-9 items-center justify-center self-end rounded-lg text-ink-300 hover:bg-bad-100 hover:text-bad-600 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <Btn size="sm" variant="outline" onClick={() => setRows([...rows, { productId: db.products[0]?.id ?? "", qty: 50, unitPrice: db.products[0]?.defaultPrice ?? 0, currency: db.products[0]?.defaultCurrency as Currency ?? "RMB", margin: 15 }])}>+ Add line</Btn>
          <p className="num text-[13px] font-bold text-ink-800">Total {fc("PKR", rows.reduce((a, r) => a + (buildItem(r)?.snapshot.sellingPricePkr ?? 0), 0))}</p>
        </div>
      </Modal>

      {/* detail */}
      <Drawer open={!!qt} onClose={() => setDetailId(null)} w="max-w-3xl"
        title={qt?.number ?? ""} sub={qt ? <span>{db.clients.find((c) => c.id === qt.clientId)?.company} · valid until <b className="num">{fmtDate(qt.validUntil)}</b> · <Pill label={qt.status} /></span> : null}
        footer={qt && editable ? <>
          {qt.status !== "Converted to Order" && <Btn variant="brass" onClick={() => convert(qt.id)}><ShoppingCart className="h-4 w-4" />Convert to Order</Btn>}
          {(["Draft", "Sent", "Viewed"] as const).includes(qt.status as never) && qt.status !== "Draft" && null}
          {qt.status === "Draft" && <Btn onClick={() => setQuotationStatus(qt.id, "Sent")}>Mark Sent</Btn>}
          {qt.status === "Sent" && <Btn variant="outline" onClick={() => setQuotationStatus(qt.id, "Viewed")}>Mark Viewed</Btn>}
          {(qt.status === "Sent" || qt.status === "Viewed") && <>
            <Btn variant="outline" className="border-ok-600/40 text-ok-600" onClick={() => setQuotationStatus(qt.id, "Accepted")}>Accepted</Btn>
            <Btn variant="outline" className="border-bad-600/40 text-bad-600" onClick={() => setQuotationStatus(qt.id, "Rejected")}>Rejected</Btn>
          </>}
          <Btn variant="outline" onClick={print}><Printer className="h-4 w-4" />Print</Btn>
          <Btn variant="dark" onClick={() => pdf(qt)}><Download className="h-4 w-4" />Download PDF</Btn>
        </> : qt ? <><Btn variant="outline" onClick={print}><Printer className="h-4 w-4" />Print</Btn><Btn variant="dark" onClick={() => pdf(qt)}><Download className="h-4 w-4" />Download PDF</Btn></> : undefined}>

        {qt && (
          <div className="p-5">
            <div className="num mb-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-paper-200/70 p-3 text-[11.5px] text-ink-600 sm:grid-cols-3">
              <span><b>Date:</b> {fmtDate(qt.date)}</span>
              <span><b>Payment:</b> {qt.paymentTerms}</span>
              <span><b>Delivery:</b> {qt.deliveryTerms}</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-paper-200 scroll-thin">
              <table className="hk-table w-full">
                <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Landed / unit</th><th className="text-right">Selling / unit</th><th className="text-right">Amount</th><th className="text-right">Profit</th></tr></thead>
                <tbody>
                  {qt.items.map((it, i2) => (
                    <tr key={i2}>
                      <td><p className="font-medium text-ink-900">{it.description}</p><p className="num text-[10px] text-ink-400">rate 1 {it.snapshot.currency} = {fm(it.snapshot.rateToPkr)} · {it.snapshot.freightMode} freight</p></td>
                      <td className="num text-right">{fm(it.snapshot.qty)}</td>
                      <td className="num text-right">{fm(it.snapshot.unitLandedPkr)}</td>
                      <td className="num text-right font-semibold">{fm(it.snapshot.unitSellingPkr)}</td>
                      <td className="num text-right font-semibold">{fc("PKR", it.snapshot.sellingPricePkr)}</td>
                      <td className="num text-right text-ok-600">{fc("PKR", it.snapshot.grossProfitPkr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              <div className="num w-64 space-y-1 text-[12.5px]">
                <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span className="font-semibold">{fc("PKR", qt.items.reduce((a, x) => a + x.snapshot.sellingPricePkr, 0))}</span></div>
                {qt.discountPkr > 0 && <div className="flex justify-between text-ok-600"><span>Discount</span><span>− {fc("PKR", qt.discountPkr)}</span></div>}
                <div className="flex justify-between border-t-2 border-brass-400 pt-1.5 text-[14px] font-bold text-ink-900"><span>Grand Total</span><span>{fc("PKR", total(qt))}</span></div>
              </div>
            </div>

            {qt.notes && <p className="mt-3 rounded-lg border border-brass-100 bg-brass-100/40 px-3 py-2 text-[12px] text-ink-600"><b>Note:</b> {qt.notes}</p>}
          </div>
        )}
      </Drawer>

      {printing && qt && <PrintPortal><QuotationDoc qt={qt} client={db.clients.find((c) => c.id === qt.clientId)} company={db.settings} /></PrintPortal>}
    </div>
  );
}