import { useMemo, useState } from "react";
import { Calculator, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Field, MiniStat, Modal, Pager, paginate, Pill, SearchBox, Tabs, inp, CurrencySelector, CURRENCY_SYMBOLS, CurrencyAmountField, type CurrencyCode } from "../components/ui";
import { useStore } from "../lib/store";
import { downloadCSV, fc, fm, fmtDate, todayISO, uid } from "../lib/money";
import { currentRate } from "../lib/store";
import type { Product, Currency } from "../lib/types";

interface DefaultPrice { currency: Currency; amount: number; }

const empty = (cat: string): Product => ({
  id: "", sku: "", name: "", chineseName: "", category: cat, subcategory: "", description: "", spec: "",
  unit: "pc", defaultSupplierId: "", defaultCurrency: "RMB", defaultPrice: 0, weightKg: 0, cbm: 0, hsCode: "",
  customsCategory: "", notes: "", status: "active", priceHistory: [], createdAt: "",
});

export default function Products() {
  const { db, nav, route, can, saveProduct, deleteProduct, saveCategory, deleteCategory, confirm } = useStore();
  const initTab = (route.carry as { tab?: string } | undefined)?.tab === "categories" ? "categories" : "master";
  const [tab, setTab] = useState(initTab);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Product | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");

  const editable = can("products", "edit");
  const product = db.products.find((p) => p.id === detailId) ?? null;

  const rows = useMemo(() => db.products
    .filter((p) => cat === "all" || p.category === cat)
    .filter((p) => `${p.name} ${p.sku} ${p.chineseName ?? ""} ${p.hsCode} ${p.customsCategory}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)), [db.products, q, cat]);
  const pg = paginate(rows, page, 9);

  const submit = () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Product name is required.";
    if (!form.category) e.category = "Category is required.";
    if (form.defaultPrice <= 0) e.defaultPrice = "Enter a default price (> 0).";
    setErrs(e);
    if (Object.keys(e).length) return;
    saveProduct(form);
    setForm(null);
  };

  const askDelete = async (p: Product) => {
    const ok = await confirm({ title: "Delete product?", message: `${p.name} will be removed from the master. Products on existing orders cannot be deleted.`, danger: true, confirmLabel: "Delete" });
    if (ok) deleteProduct(p.id);
  };

  const usedInOrders = (pid: string) => db.orders.filter((o) => o.items.some((i) => i.productId === pid)).length;

  /* price history extremes */
  const hist = product?.priceHistory ?? [];
  const prices = hist.map((h) => h.currency === "RMB" ? h.amount : h.amount);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;

  return (
    <div>
      <PageHead title="Product Master" sub="Reusable product records — previous sourcing prices are remembered for fast re-quoting"
        actions={editable ? <Btn onClick={() => { setErrs({}); setForm(empty(db.categories[0]?.name ?? "")); }}><Plus className="h-4 w-4" />New Product</Btn> : undefined} />

      <div className="mb-4">
        <Tabs tabs={[{ id: "master", label: "Product Master", count: db.products.length }, { id: "categories", label: "Categories", count: db.categories.length }]} active={tab} onChange={setTab} />
      </div>

      {tab === "master" && (
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
            <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search SKU, name, HS code…" /></div>
            <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }} className={`${inp} w-auto`}>
              <option value="all">All categories</option>
              {db.categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button onClick={() => downloadCSV("products.csv", ["SKU", "Name", "Chinese", "Category", "Unit", "Default Currency", "Default Price", "Weight KG", "CBM", "HS Code"], rows.map((p) => [p.sku, p.name, p.chineseName ?? "", p.category, p.unit, p.defaultCurrency, p.defaultPrice, p.weightKg, p.cbm, p.hsCode]))}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700"><Download className="h-3.5 w-3.5" />CSV</button>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Default Supplier</th><th className="text-right">Currency</th><th className="text-right">Price</th><th className="text-right">Kg / CBM</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {pg.rows.map((p) => {
                  const s = db.suppliers.find((x) => x.id === p.defaultSupplierId);
                  return (
                    <tr key={p.id} className="cursor-pointer" onClick={() => setDetailId(p.id)}>
                      <td className="num font-semibold text-brand-700">{p.sku}</td>
                      <td><p className="font-semibold text-ink-900">{p.name}</p><p className="text-[10.5px] text-ink-400">{p.chineseName}</p></td>
                      <td><span className="rounded bg-paper-200 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-500">{p.category}</span></td>
                      <td className="text-[12px]">{s?.name ?? "—"}</td>
                      <td className="num text-right font-semibold">{CURRENCY_SYMBOLS[p.defaultCurrency]}</td>
                      <td className="num text-right">{fm(p.defaultPrice)}</td>
                      <td className="num text-right text-[11.5px]">{p.weightKg} / {p.cbm}</td>
                      <td><Pill label={p.status} /></td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {can("costing", "view") && <Btn size="sm" variant="ghost" title="Cost this product" onClick={() => nav("costing", undefined, { productId: p.id })}><Calculator className="h-3.5 w-3.5" /></Btn>}
                          {editable && <Btn size="sm" variant="ghost" title="Edit" onClick={() => { setErrs({}); setForm({ ...p }); }}><Pencil className="h-3.5 w-3.5" /></Btn>}
                          {editable && <Btn size="sm" variant="ghost" title="Delete" className="hover:text-bad-600" onClick={() => askDelete(p)}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pg.rows.length === 0 && <tr><td colSpan={9} className="py-8"><Empty title="No products match" /></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={rows.length} label="products" /></div>
        </Card>
      )}

      {tab === "categories" && (
        <Card title="Product Categories" sub="used across the master, sourcing and reports">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {db.categories.map((c) => {
              const n = db.products.filter((p) => p.category === c.name).length;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-paper-200 bg-white px-3.5 py-3 transition-shadow hover:shadow-md">
                  <div>
                    <p className="text-[13px] font-semibold text-ink-900">{c.name}</p>
                    <p className="num text-[11px] text-ink-400">{n} product(s)</p>
                  </div>
                  {editable && <Btn size="sm" variant="ghost" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Remove category?", message: `${c.name} will be removed. Categories in use are protected.`, danger: true, confirmLabel: "Remove" }); if (ok) deleteCategory(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                </div>
              );
            })}
          </div>
          {editable && (
            <div className="mt-4 flex gap-2">
              <input className={`${inp} max-w-xs`} placeholder="New category name…" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <Btn variant="dark" onClick={() => { if (!newCat.trim()) return; saveCategory({ id: uid("cat"), name: newCat.trim() }); setNewCat(""); }}><Plus className="h-4 w-4" />Add</Btn>
            </div>
          )}
        </Card>
      )}

      {/* form */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${form.sku}` : "New Product"} sub="Master record — snapshots on orders keep their own frozen prices"
        footer={<><Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn><Btn onClick={submit}>{form?.id ? "Save changes" : "Create product"}</Btn></>}>
        {form && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Product Name" err={errs.name} className="sm:col-span-2"><input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Chinese Name"><input className={inp} value={form.chineseName ?? ""} onChange={(e) => setForm({ ...form, chineseName: e.target.value })} /></Field>
            <Field label="SKU"><input className={inp} value={form.sku} placeholder="auto if blank" onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Category" err={errs.category}><select className={inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{db.categories.map((c) => <option key={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Subcategory"><input className={inp} value={form.subcategory ?? ""} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} /></Field>
            <Field label="Specification" className="sm:col-span-2"><input className={inp} value={form.spec ?? ""} onChange={(e) => setForm({ ...form, spec: e.target.value })} /></Field>
            <Field label="Unit"><input className={inp} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
            <Field label="Default Supplier"><select className={inp} value={form.defaultSupplierId} onChange={(e) => setForm({ ...form, defaultSupplierId: e.target.value })}><option value="">—</option>{db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <CurrencyAmountField label="Default Price" currency={form.defaultCurrency as CurrencyCode} amount={form.defaultPrice}
              onCurrencyChange={(c) => setForm({ ...form, defaultCurrency: c as Exclude<Currency, "PKR"> })}
              onAmountChange={(n) => setForm({ ...form, defaultPrice: n })} err={errs.defaultPrice} />
            <Field label="Weight per unit (KG)"><input type="number" step="0.001" className={inp} value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: Number(e.target.value) })} /></Field>
            <Field label="CBM per unit"><input type="number" step="0.0001" className={inp} value={form.cbm} onChange={(e) => setForm({ ...form, cbm: Number(e.target.value) })} /></Field>
            <Field label="HS Code" err={errs.hsCode}><input className={inp} value={form.hsCode} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} /></Field>
            <Field label="Customs Category"><input className={inp} value={form.customsCategory} onChange={(e) => setForm({ ...form, customsCategory: e.target.value })} /></Field>
            <Field label="Status"><select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Product["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea rows={2} className={inp} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* detail */}
      <Drawer open={!!product} onClose={() => setDetailId(null)} w="max-w-2xl"
        title={product?.name ?? ""} sub={product ? <span className="num">{product.sku} · {product.chineseName} · HS {product.hsCode}</span> : null}
        footer={product ? <>
          {can("costing", "view") && <Btn variant="dark" onClick={() => nav("costing", undefined, { productId: product.id })}><Calculator className="h-4 w-4" />Open in Cost Calculator</Btn>}
          {editable && <Btn onClick={() => { setErrs({}); setForm({ ...product }); }}><Pencil className="h-4 w-4" />Edit</Btn>}
        </> : undefined}>
        {product && (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <MiniStat label="Default Price" value={`${CURRENCY_SYMBOLS[product.defaultCurrency]} ${fm(product.defaultPrice)}`} />
              <MiniStat label="Weight / unit" value={`${product.weightKg} kg`} />
              <MiniStat label="CBM / unit" value={fm(product.cbm)} />
              <MiniStat label="Category" value={product.category} />
              <MiniStat label="Customs Cat." value={product.customsCategory || "—"} />
              <MiniStat label="Orders using" value={fm(usedInOrders(product.id))} />
              <MiniStat label="Status" value={product.status} />
            </div>
            {product.spec && <p className="mt-3 rounded-lg bg-paper-200/70 px-3 py-2 text-[12px] text-ink-600"><b>Spec:</b> {product.spec}</p>}

            <p className="disp mt-5 text-[12px] font-bold uppercase tracking-[.12em] text-ink-500">Sourcing price history</p>
            {hist.length > 0 ? (
              <>
                <div className="mt-2 flex items-end gap-3 rounded-lg border border-paper-200 bg-white p-3.5">
                  {hist.map((h, i) => {
                    const s = db.suppliers.find((x) => x.id === h.supplierId);
                    const isMin = h.amount === Math.min(...prices), isMax = h.amount === Math.max(...prices);
                    const hPct = prices.length === 1 ? 60 : 22 + ((h.amount - Math.min(...prices)) / (Math.max(...prices) - Math.min(...prices))) * 56;
                    return (
                      <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                        <span className={`num text-[11px] font-bold ${isMin ? "text-ok-600" : isMax ? "text-bad-600" : "text-ink-600"}`}>{CURRENCY_SYMBOLS[h.currency as CurrencyCode]}{fm(h.amount)}</span>
                        <div className="anim-grow-y w-full max-w-[46px] rounded-t-md" style={{ height: `${hPct}px`, background: isMin ? "#22703f" : isMax ? "#ab3a28" : "#c2922e", animationDelay: `${i * 90}ms` }} />
                        <span className="num text-[9.5px] text-ink-400">{fmtDate(h.date)}</span>
                        <span className="max-w-[70px] truncate text-[9px] text-ink-300">{s?.name.split(" ")[0] ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-400">Best price <b className="num text-ok-600">{CURRENCY_SYMBOLS["RMB"]}{fm(Math.min(...prices))}</b> · worst <b className="num text-bad-600">{CURRENCY_SYMBOLS["RMB"]}{fm(Math.max(...prices))}</b> — quotes land here automatically when orders confirm.</p>
              </>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-paper-300 px-3 py-4 text-center text-[12px] text-ink-300">No sourcing history yet — prices accumulate as quotes and orders are recorded.</p>
            )}
            <p className="num mt-4 text-[10.5px] text-ink-300">Record added {fmtDate(product.createdAt.slice(0, 10) || todayISO())} · {fc("PKR", product.defaultPrice * currentRate(db, product.defaultCurrency))} est. @ current board rate</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
