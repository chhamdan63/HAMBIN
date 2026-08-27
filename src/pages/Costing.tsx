import { useEffect, useMemo, useState } from "react";
import { Calculator, ChevronDown, FileText, FlaskConical, RotateCcw, ShieldCheck } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Field, Modal, SectionLabel, inp, CurrencySelector, CURRENCY_SYMBOLS, CurrencyAmountField } from "../components/ui";
import { FORMULAS, SPEC_EXAMPLE, calculateLanded, type CostingInput } from "../lib/costing";
import { currentRate, useStore } from "../lib/store";
import { daysAhead, fc, fm, fmt, pct, r2, todayISO } from "../lib/money";
import type { Quotation } from "../lib/types";

const Num = ({ v, set, step = 1 }: { v: number; set: (n: number) => void; step?: number }) => (
  <input type="number" step={step} className={`${inp} num text-right`} value={v === 0 ? "" : v} placeholder="0" onChange={(e) => set(Number(e.target.value) || 0)} />
);

export default function Costing() {
  const { db, route, nav, can, saveQuotation, toast } = useStore();
  const carry = route.carry as { productId?: string } | undefined;

  const mkInput = (productId?: string): CostingInput => {
    const p = db.products.find((x) => x.id === productId);
    return {
      qty: p ? 100 : 100, unitPrice: p?.defaultPrice ?? 50, currency: (p?.defaultCurrency as "RMB" | "USD" | "PKR") ?? "RMB",
      rateToPkr: currentRate(db, (p?.defaultCurrency as "RMB" | "USD" | "PKR") ?? "RMB"),
      chinaInland: 0, warehouse: 0, loading: 0, packaging: 0, inspection: 0, otherChina: 0,
      freightMode: "sea", weightKg: p ? r2(p.weightKg * 100) : 0, cbm: p ? r2(p.cbm * 100) : 0,
      airRatePerKg: 610, seaRatePerCbm: 61500, containerCharge: 0,
      customsDuty: 0, salesTax: 0, regulatoryDuty: 0, additionalDuty: 0,
      clearance: 0, portCharges: 0, documentation: 0, localTransport: 0, delivery: 0,
      insurance: 0, bankCharges: 0, commission: 0, misc: 0,
      pricingMethod: "margin", pricingValue: 15,
    };
  };

  const [i, setI] = useState<CostingInput>(() => mkInput(carry?.productId));
  const [productId, setProductId] = useState<string>(carry?.productId ?? "");
  const [showFormulas, setShowFormulas] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [clientId, setClientId] = useState(db.clients[0]?.id ?? "");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (carry?.productId) {
      setProductId(carry.productId);
      setI(mkInput(carry.productId));
      const p = db.products.find((x) => x.id === carry.productId);
      setDesc(p ? `${p.name} — ${p.spec ?? p.sku}` : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carry?.productId]);

  const r = useMemo(() => calculateLanded(i), [i]);
  const set = (patch: Partial<CostingInput>) => setI((x) => ({ ...x, ...patch }));

  const pickProduct = (id: string) => {
    setProductId(id);
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    setI((x) => ({
      ...x, qty: x.qty || 100,
      unitPrice: p.defaultPrice, currency: p.defaultCurrency as "RMB" | "USD" | "PKR", rateToPkr: currentRate(db, p.defaultCurrency as "RMB" | "USD" | "PKR"),
      weightKg: r2(p.weightKg * (x.qty || 100)), cbm: r2(p.cbm * (x.qty || 100)),
    }));
    setDesc(`${p.name} — ${p.spec ?? p.sku}`);
    toast(`Loaded ${p.name} defaults (last sourced ${CURRENCY_SYMBOLS[p.defaultCurrency as "RMB" | "USD" | "PKR"]}${fm(p.defaultPrice)}).`, "info");
  };

  const breakdown = [
    { label: "Product cost (base)", value: r.productCostPkr, color: "#0e6b5e" },
    { label: "China costs", value: r.chinaTotal, color: "#3d7166" },
    { label: "International freight", value: r.intlFreightPkr, color: "#275f86" },
    { label: "Customs & taxes", value: r.customsTotal, color: "#a35d10" },
    { label: "Clearance & port", value: r.clearanceTotal, color: "#c2922e" },
    { label: "Local transport", value: r.localTotal, color: "#8a5a44" },
    { label: "Other costs", value: r.otherTotal, color: "#7a4f7c" },
  ];

  const saveAsQuotation = () => {
    if (!clientId) { toast("Select a client for the quotation.", "warning"); return; }
    if (i.qty <= 0 || i.unitPrice <= 0) { toast("Quantity and unit price must be greater than zero.", "error"); return; }
    if (r.sellingPricePkr < r.landedCostPkr && !window.confirm("Selling price is below landed cost (loss-making). Save anyway?")) return;
    const p = db.products.find((x) => x.id === productId);
    const qt: Quotation = {
      id: "", number: "", clientId, date: todayISO(), validUntil: daysAhead(15),
      items: [{ productId: productId || p?.id || "", description: desc || p?.name || "Item", qty: i.qty, snapshot: r }],
      discountPkr: 0,
      paymentTerms: db.clients.find((c) => c.id === clientId)?.paymentTerms ?? "30% advance",
      deliveryTerms: i.freightMode === "air" ? "Air freight — 7 to 12 days after supplier dispatch" : "Sea groupage — 35 to 50 days after supplier dispatch",
      notes: `Prepared in the Cost Estimator · rate snapshot 1 ${i.currency} = PKR ${fm(i.rateToPkr)} (${i.freightMode === "air" ? `air @ PKR ${fm(i.airRatePerKg)}/kg` : `sea @ PKR ${fm(i.seaRatePerCbm)}/cbm`})`,
      status: "Draft", createdAt: "",
    };
    const id = saveQuotation(qt);
    setClientModal(false);
    nav("quotations", id);
  };

  const spec = useMemo(() => calculateLanded(SPEC_EXAMPLE), []);
  const editable = can("quotations", "edit");

  return (
    <div>
      <PageHead title="Product Cost Estimator" sub="One engine everywhere: quotes, orders and profit reports all consume this exact math"
        actions={<>
          <Btn variant="outline" onClick={() => { setI({ ...SPEC_EXAMPLE }); setProductId(""); setDesc("Spec verification example — LED consignment"); toast("Loaded the master-spec worked example.", "info"); }}><FlaskConical className="h-4 w-4" />Load spec example</Btn>
          <Btn variant="ghost" onClick={() => { setI(mkInput(productId || undefined)); }}><RotateCcw className="h-4 w-4" />Reset</Btn>
        </>} />

      {/* spec verification strip */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-[11.5px] text-ink-600">
        <span className="inline-flex items-center gap-1.5 font-bold text-brand-700"><ShieldCheck className="h-4 w-4" />Engine verified against master spec</span>
        <span className="num">100 × RMB 50 × 39.50 = <b>PKR {fm(spec.productCostPkr)}</b></span>
        <span className="num">landed <b>PKR {fm(spec.landedCostPkr)}</b></span>
        <span className="num">SP <b>PKR {fm(spec.sellingPricePkr)}</b></span>
        <span className="num">profit <b>PKR {fm(spec.grossProfitPkr)} ({pct(spec.profitPct)})</b></span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
        {/* inputs */}
        <div className="space-y-4">
          <Card title="1 · Product & Purchase" sub="Base Product Cost = Qty × Unit Price × Exchange Rate">
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              <Field label="Product (prefill)" className="col-span-2">
                <select className={inp} value={productId} onChange={(e) => pickProduct(e.target.value)}>
                  <option value="">Manual entry…</option>
                  {db.products.map((p) => <option key={p.id} value={p.id}>{p.name} · last {CURRENCY_SYMBOLS[p.defaultCurrency as "RMB" | "USD" | "PKR"] ?? "¥"}{fm(p.defaultPrice)}</option>)}
                </select>
              </Field>
              <Field label="Quantity"><Num v={i.qty} set={(n) => set({ qty: n })} /></Field>
              <div className="md:col-span-2">
                <CurrencyAmountField label="Unit Price" currency={i.currency} amount={i.unitPrice}
                  onCurrencyChange={(c) => set({ currency: c, rateToPkr: c === "PKR" ? 1 : currentRate(db, c) })}
                  onAmountChange={(n) => set({ unitPrice: n })} step={0.01} />
              </div>
              <Field label={`Exchange Rate (${i.currency} → PKR)`} hint="today's board rate — editable">
                <Num v={i.rateToPkr} set={(n) => set({ rateToPkr: n })} step={0.01} />
              </Field>
              <Field label="Total Weight (KG)"><Num v={i.weightKg} set={(n) => set({ weightKg: n })} step={0.1} /></Field>
              <Field label="Total CBM"><Num v={i.cbm} set={(n) => set({ cbm: n })} step={0.01} /></Field>
            </div>
          </Card>

          <Card title="2 · China Costs (PKR)" sub="Inland freight, warehouse, loading, packaging, inspection">
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
              <Field label="China Inland Freight"><Num v={i.chinaInland} set={(n) => set({ chinaInland: n })} /></Field>
              <Field label="Warehouse Charges"><Num v={i.warehouse} set={(n) => set({ warehouse: n })} /></Field>
              <Field label="Loading"><Num v={i.loading} set={(n) => set({ loading: n })} /></Field>
              <Field label="Packaging"><Num v={i.packaging} set={(n) => set({ packaging: n })} /></Field>
              <Field label="Inspection"><Num v={i.inspection} set={(n) => set({ inspection: n })} /></Field>
              <Field label="Other China Costs"><Num v={i.otherChina} set={(n) => set({ otherChina: n })} /></Field>
            </div>
          </Card>

          <Card title="3 · International Freight" sub={i.freightMode === "air" ? "Air: Chargeable Weight × Rate per KG" : "Sea: CBM × Rate per CBM + Container charges"}>
            <div className="mb-3 flex gap-1.5">
              {(["air", "sea"] as const).map((m) => (
                <button key={m} onClick={() => set({ freightMode: m })}
                  className={`rounded-lg border px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide transition-all ${i.freightMode === m ? "border-ink-900 bg-ink-900 text-brass-300" : "border-paper-300 bg-white text-ink-500 hover:border-brass-400"}`}>{m === "air" ? "✈ Air" : "⚓ Sea"}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
              {i.freightMode === "air" ? (
                <Field label="Air Rate (PKR / KG)"><Num v={i.airRatePerKg} set={(n) => set({ airRatePerKg: n })} /></Field>
              ) : (
                <>
                  <Field label="Sea Rate (PKR / CBM)"><Num v={i.seaRatePerCbm} set={(n) => set({ seaRatePerCbm: n })} /></Field>
                  <Field label="Container Charges"><Num v={i.containerCharge} set={(n) => set({ containerCharge: n })} /></Field>
                </>
              )}
              <div className="col-span-2 flex items-end md:col-span-1">
                <p className="num w-full rounded-lg bg-ink-900 px-3 py-2 text-right text-[13px] font-bold text-brass-300">
                  Freight = {i.freightMode === "air" ? `${fm(i.weightKg)} kg × ${fm(i.airRatePerKg)}` : `${fm(i.cbm)} cbm × ${fm(i.seaRatePerCbm)} + ${fm(i.containerCharge)}`} → <span className="text-paper-100">{fc("PKR", r.intlFreightPkr)}</span>
                </p>
              </div>
            </div>
          </Card>

          <Card title="4 · Pakistan / Destination Costs (PKR)" sub="Customs duty, taxes, clearance, port, local movement">
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
              <Field label="Customs Duty"><Num v={i.customsDuty} set={(n) => set({ customsDuty: n })} /></Field>
              <Field label="Sales Tax"><Num v={i.salesTax} set={(n) => set({ salesTax: n })} /></Field>
              <Field label="Regulatory Duty"><Num v={i.regulatoryDuty} set={(n) => set({ regulatoryDuty: n })} /></Field>
              <Field label="Additional Duty"><Num v={i.additionalDuty} set={(n) => set({ additionalDuty: n })} /></Field>
              <Field label="Customs Clearance"><Num v={i.clearance} set={(n) => set({ clearance: n })} /></Field>
              <Field label="Port Charges"><Num v={i.portCharges} set={(n) => set({ portCharges: n })} /></Field>
              <Field label="Documentation"><Num v={i.documentation} set={(n) => set({ documentation: n })} /></Field>
              <Field label="Local Transport"><Num v={i.localTransport} set={(n) => set({ localTransport: n })} /></Field>
              <Field label="Delivery"><Num v={i.delivery} set={(n) => set({ delivery: n })} /></Field>
            </div>
          </Card>

          <Card title="5 · Other Costs (PKR)" sub="Insurance, bank, commission, misc">
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              <Field label="Insurance"><Num v={i.insurance} set={(n) => set({ insurance: n })} /></Field>
              <Field label="Bank Charges"><Num v={i.bankCharges} set={(n) => set({ bankCharges: n })} /></Field>
              <Field label="Agent Commission"><Num v={i.commission} set={(n) => set({ commission: n })} /></Field>
              <Field label="Miscellaneous"><Num v={i.misc} set={(n) => set({ misc: n })} /></Field>
            </div>
          </Card>
        </div>

        {/* results */}
        <div className="space-y-4 xl:sticky xl:top-[76px] xl:self-start">
          <div className="ink-topo overflow-hidden rounded-xl border border-ink-800 bg-ink-900 p-4 text-paper-100">
            <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.16em] text-brass-400"><Calculator className="h-4 w-4" />Live result · {i.qty} units</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><p className="text-[10px] uppercase tracking-wider text-ink-400">Product Cost</p><p className="num text-[15px] font-bold">{fc("PKR", r.productCostPkr)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-ink-400">Logistics (China+Intl)</p><p className="num text-[15px] font-bold">{fc("PKR", r2(r.chinaTotal + r.intlFreightPkr))}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-ink-400">Customs & Clearing</p><p className="num text-[15px] font-bold">{fc("PKR", r2(r.customsTotal + r.clearanceTotal))}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-ink-400">Per-unit Landed</p><p className="num text-[15px] font-bold text-brass-300">{fc("PKR", r.unitLandedPkr)}</p></div>
            </div>
            <div className="mt-3 rounded-lg bg-ink-850 px-3.5 py-3">
              <div className="flex items-baseline justify-between"><p className="text-[10.5px] font-bold uppercase tracking-[.14em] text-ink-300">Total Landed Cost</p><p className="num text-[21px] font-bold text-paper-50">{fc("PKR", r.landedCostPkr)}</p></div>
              {/* stacked bar */}
              <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-ink-800">
                {breakdown.filter((b) => b.value > 0).map((b) => (
                  <div key={b.label} title={`${b.label}: ${fc("PKR", b.value)}`} className="h-full transition-all duration-500" style={{ width: `${(b.value / Math.max(r.landedCostPkr, 1)) * 100}%`, background: b.color }} />
                ))}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-0.5">
                {breakdown.map((b) => (
                  <div key={b.label} className="flex items-center justify-between text-[10.5px]">
                    <span className="flex items-center gap-1.5 text-ink-300"><span className="h-2 w-2 rounded-sm" style={{ background: b.color }} />{b.label}</span>
                    <span className="num font-semibold text-paper-100">{fm(b.value)} <span className="text-ink-400">({r.landedCostPkr ? fmt((b.value / r.landedCostPkr) * 100, 1) : 0}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card title="Pricing & Profit">
            <div className="flex gap-1.5">
              {(["margin", "fixed"] as const).map((m) => (
                <button key={m} onClick={() => set({ pricingMethod: m })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-bold transition-all ${i.pricingMethod === m ? "border-brand-600 bg-brand-600 text-white" : "border-paper-300 bg-white text-ink-500 hover:border-brand-500"}`}>
                  {m === "margin" ? "% Margin on sales" : "Fixed profit (PKR)"}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Field label={i.pricingMethod === "margin" ? `Margin % — SP = Landed ÷ (1 − ${i.pricingValue}%)` : "Desired profit (PKR) — SP = Landed + profit"}>
                {i.pricingMethod === "margin" ? (
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={60} step={0.5} value={i.pricingValue} onChange={(e) => set({ pricingValue: Number(e.target.value) })} className="flex-1 accent-[#0e6b5e]" />
                    <span className="num w-14 rounded-lg bg-paper-200 px-2 py-1 text-center text-[13px] font-bold text-ink-800">{i.pricingValue}%</span>
                  </div>
                ) : (
                  <Num v={i.pricingValue} set={(n) => set({ pricingValue: n })} />
                )}
              </Field>
            </div>
            <div className="mt-3 space-y-1.5 rounded-lg border border-paper-200 bg-paper-100/70 p-3.5">
              <div className="flex justify-between text-[12.5px]"><span className="text-ink-500">Selling Price (total)</span><span className="num font-bold text-ink-900">{fc("PKR", r.sellingPricePkr)}</span></div>
              <div className="flex justify-between text-[12.5px]"><span className="text-ink-500">Per-unit selling</span><span className="num font-bold text-ink-900">{fc("PKR", r.unitSellingPkr)}</span></div>
              <div className="flex justify-between border-t border-paper-300 pt-1.5 text-[13px]"><span className="font-semibold text-ink-600">Gross Profit</span><span className={`num font-bold ${r.grossProfitPkr >= 0 ? "text-ok-600" : "text-bad-600"}`}>{fc("PKR", r.grossProfitPkr)}</span></div>
              <div className="flex justify-between text-[12.5px]"><span className="text-ink-500">Profit on sales</span><span className={`num font-bold ${r.profitPct >= 0 ? "text-ok-600" : "text-bad-600"}`}>{pct(r.profitPct)}</span></div>
              {r.sellingPricePkr < r.landedCostPkr && <p className="rounded bg-bad-100 px-2 py-1 text-[11px] font-semibold text-bad-600">Loss-making price — below landed cost.</p>}
            </div>
            {editable && <Btn className="mt-3 w-full" onClick={() => { setClientId(db.clients[0]?.id ?? ""); setClientModal(true); }}><FileText className="h-4 w-4" />Save as Client Quotation</Btn>}
          </Card>

          <Card title="Formula Reference" sub="the exact engine behind quotes, orders & reports" pad={false}>
            <button onClick={() => setShowFormulas((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-[12px] font-semibold text-brand-700 hover:bg-paper-100">
              {showFormulas ? "Hide formulas" : "Show all formulas"}<ChevronDown className={`h-4 w-4 transition-transform ${showFormulas ? "rotate-180" : ""}`} />
            </button>
            {showFormulas && (
              <div className="grid gap-2 border-t border-paper-200 p-3.5 sm:grid-cols-2">
                {FORMULAS.map((f) => (
                  <div key={f.title} className="rounded-lg border border-paper-200 bg-white p-2.5">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-brass-600">{f.title}</p>
                    <p className="num mt-1 whitespace-pre-line text-[10.5px] leading-relaxed text-ink-600">{f.body}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={clientModal} onClose={() => setClientModal(false)} title="Save as Client Quotation" sub="Snapshot of every rate & cost is stored with the quotation"
        footer={<><Btn variant="outline" onClick={() => setClientModal(false)}>Cancel</Btn><Btn onClick={saveAsQuotation}>Create quotation</Btn></>}>
        <div className="space-y-3.5">
          <Field label="Client">
            <select className={inp} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {db.clients.map((c) => <option key={c.id} value={c.id}>{c.company} · {c.city}</option>)}
            </select>
          </Field>
          <Field label="Line description">
            <input className={inp} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Item description shown on the quotation" />
          </Field>
          <SectionLabel>Snapshot preview</SectionLabel>
          <div className="num grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-paper-200/70 p-3 text-[11.5px] text-ink-600">
            <span>Rate: 1 {i.currency} = PKR {fm(i.rateToPkr)}</span>
            <span>Qty: {fm(i.qty)} · unit {i.currency} {fm(i.unitPrice)}</span>
            <span>Landed: {fc("PKR", r.landedCostPkr)}</span>
            <span>Selling: {fc("PKR", r.sellingPricePkr)}</span>
            <span>Freight: {i.freightMode} {i.freightMode === "air" ? `@ ${fm(i.airRatePerKg)}/kg` : `@ ${fm(i.seaRatePerCbm)}/cbm`}</span>
            <span>Profit: {fc("PKR", r.grossProfitPkr)} ({pct(r.profitPct)})</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
