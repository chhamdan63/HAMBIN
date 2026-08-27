import { useMemo, useState } from "react";
import { FilePlus2, Pencil, Paperclip, PlaneTakeoff, Ship as ShipIcon } from "lucide-react";
import { PageHead } from "../components/shell";
import { Btn, Card, Drawer, Empty, Field, Modal, Pager, paginate, Pill, SearchBox, SectionLabel, inp } from "../components/ui";
import { useStore } from "../lib/store";
import { downloadCSV, fc, fm, fmtDate, fmtDateTime, todayISO, uid } from "../lib/money";
import type { Shipment } from "../lib/types";

const SH_FLOW: Shipment["status"][] = ["Preparing", "Warehouse", "Booked", "In Transit", "Arrived", "Customs", "Cleared", "Out for Delivery", "Delivered"];

const emptySh = (): Shipment => ({
  id: "", number: "", orderIds: [], method: "Sea", origin: "Guangzhou (CAN)", destination: "Karachi (KHI)",
  forwarder: "", trackingNo: "", currentLocation: "Supplier warehouse", status: "Preparing",
  sea: { containerNo: "", containerType: "40' HC", bl: "", vessel: "", voyage: "", etd: todayISO(), eta: todayISO(), port: "Karachi Port Trust", cbm: 0, weightKg: 0 },
  docs: [], timeline: [], createdAt: "",
});

export default function Shipments() {
  const { db, nav, can, addShipment, setShipmentStatus, addShipmentDoc, toast } = useStore();
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Shipment | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [docModal, setDocModal] = useState(false);
  const [docName, setDocName] = useState("");
  const [docKind, setDocKind] = useState("Commercial Invoice");

  const editable = can("shipments", "edit");
  const sh = db.shipments.find((x) => x.id === detailId) ?? null;

  const list = useMemo(() => db.shipments
    .filter((s) => method === "all" || s.method === method)
    .filter((s) => `${s.number} ${s.origin} ${s.destination} ${s.forwarder} ${s.status} ${s.sea?.vessel ?? ""} ${s.air?.airline ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.shipments, q, method]);
  const pg = paginate(list, page, 9);

  const submit = () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (form.orderIds.length === 0) e.orders = "Link at least one order.";
    if (!form.forwarder.trim()) e.forwarder = "Forwarder is required.";
    if (form.method === "Air" && (!form.air?.awb.trim())) e.awb = "AWB number is required for air freight.";
    if (form.method === "Sea" && (!form.sea?.bl.trim() || form.sea.bl === "Pending") && form.status !== "Preparing") e.bl = "Bill of Lading is required once booked.";
    setErrs(e);
    if (Object.keys(e).length) return;
    const id = addShipment(form);
    setForm(null);
    if (id) setDetailId(id);
  };

  const submitDoc = () => {
    if (!sh) return;
    if (!docName.trim() || !/\.[a-z0-9]{2,4}$/i.test(docName.trim())) { toast("Enter a valid filename with extension (pdf, jpg…).", "error"); return; }
    addShipmentDoc(sh.id, docName.trim(), docKind);
    setDocModal(false); setDocName("");
  };

  return (
    <div>
      <PageHead title="Shipments & Freight" sub="Air (AWB) and sea (BL/container) movements with customs milestones and documents"
        actions={<>
          <button onClick={() => downloadCSV("shipments.csv", ["Number", "Method", "Origin", "Destination", "Forwarder", "ETD/Departure", "ETA/Arrival", "Status"], list.map((s) => [s.number, s.method, s.origin, s.destination, s.forwarder, s.method === "Air" ? s.air?.departure ?? "" : s.sea?.etd ?? "", s.method === "Air" ? s.air?.arrival ?? "" : s.sea?.eta ?? "", s.status]))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700">CSV</button>
          {editable && <Btn onClick={() => { setErrs({}); setForm(emptySh()); }}><FilePlus2 className="h-4 w-4" />New Shipment</Btn>}
        </>} />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-paper-200 px-4 py-3">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search vessel, AWB, forwarder…" /></div>
          <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className={`${inp} w-auto`}>
            <option value="all">Air + Sea</option><option value="Air">Air only</option><option value="Sea">Sea only</option>
          </select>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="hk-table w-full">
            <thead><tr><th>Shipment</th><th>Method</th><th>Route</th><th>Carrier / Ref</th><th>Orders</th><th>ETA</th><th>Status</th></tr></thead>
            <tbody>
              {pg.rows.map((s) => (
                <tr key={s.id} className="cursor-pointer" onClick={() => setDetailId(s.id)}>
                  <td className="num font-semibold text-brand-700">{s.number}</td>
                  <td><span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">{s.method === "Air" ? <PlaneTakeoff className="h-3.5 w-3.5 text-info-600" /> : <ShipIcon className="h-3.5 w-3.5 text-brand-600" />}{s.method}</span></td>
                  <td><span className="num text-[12px]">{s.origin} → {s.destination}</span></td>
                  <td className="text-[12px]">{s.method === "Air" ? `${s.air?.airline} · ${s.air?.awb}` : `${s.sea?.vessel} · ${s.sea?.containerNo}`}</td>
                  <td className="num text-[11.5px]">{s.orderIds.map((oid) => db.orders.find((o) => o.id === oid)?.number.slice(-5)).join(", ")}</td>
                  <td className="num">{fmtDate(s.method === "Air" ? s.air?.arrival ?? "" : s.sea?.eta ?? "")}</td>
                  <td><Pill label={s.status} pulse={["In Transit", "Customs"].includes(s.status)} /></td>
                </tr>
              ))}
              {pg.rows.length === 0 && <tr><td colSpan={7} className="py-8"><Empty title="No shipments match" /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={list.length} label="shipments" /></div>
      </Card>

      {/* form */}
      <Modal open={!!form} onClose={() => setForm(null)} w="max-w-2xl" title={form?.id ? `Edit ${form.number}` : "New Shipment"} sub="Air or sea — fields adapt to the method"
        footer={<><Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn><Btn onClick={submit}>{form?.id ? "Save shipment" : "Create shipment"}</Btn></>}>
        {form && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Linked order(s)" err={errs.orders}>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-paper-300 bg-white p-2 scroll-thin">
                  {db.orders.filter((o) => !["Draft", "Cancelled"].includes(o.status)).map((o) => {
                    const on = form.orderIds.includes(o.id);
                    return (
                      <button key={o.id} type="button" onClick={() => setForm({ ...form, orderIds: on ? form.orderIds.filter((x) => x !== o.id) : [...form.orderIds, o.id] })}
                        className={`num rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${on ? "border-brand-600 bg-brand-600 text-white" : "border-paper-300 text-ink-500 hover:border-brand-500"}`}>{o.number.slice(-8)}</button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Method">
                <div className="flex gap-1.5">
                  {(["Air", "Sea"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setForm({ ...form, method: m, air: m === "Air" ? { awb: "", airline: "", flight: "", departure: todayISO(), arrival: todayISO(), weightKg: 0, freightRate: 0 } : form.air ? undefined : form.air, sea: m === "Sea" ? (form.sea ?? emptySh().sea) : undefined })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-bold transition-all ${form.method === m ? "border-ink-900 bg-ink-900 text-brass-300" : "border-paper-300 bg-white text-ink-500"}`}>{m === "Air" ? "✈ Air" : "⚓ Sea"}</button>
                  ))}
                </div>
              </Field>
              <Field label="Origin"><input className={inp} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></Field>
              <Field label="Destination"><input className={inp} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
              <Field label="Forwarder" err={errs.forwarder}><input className={inp} value={form.forwarder} onChange={(e) => setForm({ ...form, forwarder: e.target.value })} /></Field>
              <Field label="Tracking No."><input className={inp} value={form.trackingNo ?? ""} onChange={(e) => setForm({ ...form, trackingNo: e.target.value })} /></Field>
            </div>
            {form.method === "Air" && form.air && (
              <div className="grid grid-cols-2 gap-3.5 rounded-lg border border-info-100 bg-info-100/30 p-3 sm:grid-cols-3">
                <Field label="AWB Number" err={errs.awb}><input className={inp} value={form.air.awb} onChange={(e) => setForm({ ...form, air: { ...form.air!, awb: e.target.value } })} /></Field>
                <Field label="Airline"><input className={inp} value={form.air.airline} onChange={(e) => setForm({ ...form, air: { ...form.air!, airline: e.target.value } })} /></Field>
                <Field label="Flight"><input className={inp} value={form.air.flight} onChange={(e) => setForm({ ...form, air: { ...form.air!, flight: e.target.value } })} /></Field>
                <Field label="Departure"><input type="date" className={inp} value={form.air.departure} onChange={(e) => setForm({ ...form, air: { ...form.air!, departure: e.target.value } })} /></Field>
                <Field label="Arrival"><input type="date" className={inp} value={form.air.arrival} onChange={(e) => setForm({ ...form, air: { ...form.air!, arrival: e.target.value } })} /></Field>
                <Field label="Weight (KG)"><input type="number" className={inp} value={form.air.weightKg} onChange={(e) => setForm({ ...form, air: { ...form.air!, weightKg: Number(e.target.value) } })} /></Field>
                <Field label="Freight Rate (PKR/KG)"><input type="number" className={inp} value={form.air.freightRate} onChange={(e) => setForm({ ...form, air: { ...form.air!, freightRate: Number(e.target.value) } })} /></Field>
              </div>
            )}
            {form.method === "Sea" && form.sea && (
              <div className="grid grid-cols-2 gap-3.5 rounded-lg border border-brand-100 bg-brand-50/60 p-3 sm:grid-cols-3">
                <Field label="Container No."><input className={inp} value={form.sea.containerNo} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, containerNo: e.target.value } })} /></Field>
                <Field label="Container Type"><select className={inp} value={form.sea.containerType} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, containerType: e.target.value } })}><option>20' GP</option><option>40' GP</option><option>40' HC</option><option>LCL Groupage</option></select></Field>
                <Field label="Bill of Lading" err={errs.bl}><input className={inp} value={form.sea.bl} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, bl: e.target.value } })} /></Field>
                <Field label="Vessel"><input className={inp} value={form.sea.vessel} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, vessel: e.target.value } })} /></Field>
                <Field label="Voyage"><input className={inp} value={form.sea.voyage} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, voyage: e.target.value } })} /></Field>
                <Field label="Port"><input className={inp} value={form.sea.port} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, port: e.target.value } })} /></Field>
                <Field label="ETD"><input type="date" className={inp} value={form.sea.etd} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, etd: e.target.value } })} /></Field>
                <Field label="ETA"><input type="date" className={inp} value={form.sea.eta} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, eta: e.target.value } })} /></Field>
                <Field label="CBM"><input type="number" step="0.1" className={inp} value={form.sea.cbm} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, cbm: Number(e.target.value) } })} /></Field>
                <Field label="Weight (KG)"><input type="number" className={inp} value={form.sea.weightKg} onChange={(e) => setForm({ ...form, sea: { ...form.sea!, weightKg: Number(e.target.value) } })} /></Field>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* doc modal */}
      <Modal open={docModal} onClose={() => setDocModal(false)} title="Attach Document" sub="Invoice, packing list, BL/AWB, customs docs — validated & stored"
        footer={<><Btn variant="outline" onClick={() => setDocModal(false)}>Cancel</Btn><Btn onClick={submitDoc}>Upload</Btn></>}>
        <div className="space-y-3.5">
          <Field label="Document type">
            <select className={inp} value={docKind} onChange={(e) => setDocKind(e.target.value)}>
              {["Commercial Invoice", "Packing List", "Bill of Lading", "AWB", "Customs Document", "Payment Receipt", "Other"].map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="File name" hint="e.g. BL-COSU66210493.pdf">
            <input className={inp} value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="document.pdf" />
          </Field>
        </div>
      </Modal>

      {/* detail */}
      <Drawer open={!!sh} onClose={() => setDetailId(null)} w="max-w-3xl"
        title={sh?.number ?? ""} sub={sh ? <span>{sh.method} · {sh.forwarder} · <Pill label={sh.status} pulse={["In Transit", "Customs"].includes(sh.status)} /></span> : null}
        footer={sh && editable ? <>
          <Btn variant="outline" onClick={() => { setErrs({}); setForm({ ...sh }); }}><Pencil className="h-4 w-4" />Edit</Btn>
          <Btn variant="outline" onClick={() => setDocModal(true)}><Paperclip className="h-4 w-4" />Attach document</Btn>
        </> : undefined}>
        {sh && (
          <div className="p-5">
            {/* route visual */}
            <div className="ink-topo relative overflow-hidden rounded-xl border border-ink-800 bg-ink-900 p-4">
              <svg viewBox="0 0 640 90" className="w-full">
                <line x1="70" y1="52" x2="570" y2="52" stroke="#1d443d" strokeWidth="2" />
                <line className="anim-route" x1="70" y1="52" x2="570" y2="52" stroke="#c2922e" strokeWidth="2" />
                <circle cx="70" cy="52" r="6" fill="#d9a93f" /><circle cx="570" cy="52" r="6" fill="#147f6f" stroke="#d9a93f" strokeWidth="2" />
                <text x="70" y="28" fill="#c0d4cd" fontSize="12" fontFamily="Arial, sans-serif" letterSpacing="1.5" textAnchor="middle">{sh.origin.split(" (")[0].toUpperCase()}</text>
                <text x="570" y="28" fill="#c0d4cd" fontSize="12" fontFamily="Arial, sans-serif" letterSpacing="1.5" textAnchor="middle">{sh.destination.split(" (")[0].toUpperCase()}</text>
                <g transform="translate(320,40)">
                  {sh.method === "Air"
                    ? <path d="M-14 6 L14 -6 L6 2 L16 4 L6 6 L8 14 Z" fill="#d9a93f" />
                    : <path d="M-16 4 h32 l-6 10 h-20 Z M-10 4 v-8 h8 v8 M2 4 v-5 h8 v5" fill="none" stroke="#d9a93f" strokeWidth="2" strokeLinejoin="round" />}
                </g>
              </svg>
              <p className="num mt-1 text-center text-[11px] text-ink-300">Current location: <span className="text-brass-300">{sh.currentLocation}</span></p>
            </div>

            {/* method facts */}
            <div className="num mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {sh.method === "Air" && sh.air ? (
                <>
                  <Fact k="AWB" v={sh.air.awb} /><Fact k="Airline / Flight" v={`${sh.air.airline} · ${sh.air.flight}`} />
                  <Fact k="Departure" v={fmtDate(sh.air.departure)} /><Fact k="Arrival" v={fmtDate(sh.air.arrival)} />
                  <Fact k="Weight" v={`${fm(sh.air.weightKg)} kg`} /><Fact k="Freight rate" v={`PKR ${fm(sh.air.freightRate)}/kg`} />
                  <Fact k="Freight total" v={fc("PKR", sh.air.weightKg * sh.air.freightRate)} /><Fact k="Tracking" v={sh.trackingNo || "—"} />
                </>
              ) : sh.sea ? (
                <>
                  <Fact k="Container" v={`${sh.sea.containerNo} · ${sh.sea.containerType}`} /><Fact k="Bill of Lading" v={sh.sea.bl} />
                  <Fact k="Vessel / Voyage" v={`${sh.sea.vessel} · ${sh.sea.voyage}`} /><Fact k="Port" v={sh.sea.port} />
                  <Fact k="ETD" v={fmtDate(sh.sea.etd)} /><Fact k="ETA" v={fmtDate(sh.sea.eta)} />
                  <Fact k="CBM" v={`${fm(sh.sea.cbm)} cbm`} /><Fact k="Weight" v={`${fm(sh.sea.weightKg)} kg`} />
                </>
              ) : null}
            </div>

            {/* linked orders */}
            <SectionLabel>Linked orders</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {sh.orderIds.map((oid) => {
                const o = db.orders.find((x) => x.id === oid);
                return o ? <button key={oid} onClick={() => nav("orders", o.id)} className="num rounded-full border border-paper-300 bg-white px-3 py-1 text-[11.5px] font-semibold text-brand-700 transition-colors hover:border-brand-500 hover:-translate-y-0.5" title={`Open ${o.number}`}>{o.number}</button> : null;
              })}
              {sh.orderIds.length === 0 && <p className="text-[12px] text-ink-300">No orders linked</p>}
            </div>

            {/* timeline */}
            <SectionLabel>Tracking timeline</SectionLabel>
            <div className="space-y-0 border-l-2 border-paper-300 pl-4">
              {sh.timeline.map((t, i2) => {
                const last = i2 === sh.timeline.length - 1;
                return (
                  <div key={i2} className="relative pb-3.5">
                    <span className={`absolute -left-[21.5px] top-1 h-3 w-3 rounded-full border-2 ${last ? "border-brass-500 bg-brass-400 anim-pulse-soft" : "border-ink-400 bg-white"}`} />
                    <p className="text-[12.5px] font-bold text-ink-800">{t.label}{last && <span className="ml-2 rounded bg-brass-100 px-1.5 py-0.5 text-[9.5px] font-bold text-brass-600">LATEST</span>}</p>
                    <p className="num text-[10.5px] text-ink-400">{fmtDateTime(t.at)}{t.note ? ` · ${t.note}` : ""}</p>
                  </div>
                );
              })}
              {sh.timeline.length === 0 && <p className="pb-2 text-[12px] text-ink-300">No milestones yet</p>}
            </div>

            {/* status progression */}
            {editable && sh.status !== "Delivered" && (
              <>
                <SectionLabel>Advance status</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {SH_FLOW.filter((s) => SH_FLOW.indexOf(s) > SH_FLOW.indexOf(sh.status)).slice(0, 3).map((s) => (
                    <Btn key={s} size="sm" variant="outline" onClick={() => setShipmentStatus(sh.id, s)}>{s}</Btn>
                  ))}
                </div>
              </>
            )}

            {/* docs */}
            <SectionLabel>Documents · {sh.docs.length}</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {sh.docs.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 rounded-lg border border-paper-200 bg-white px-3 py-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-bad-100 text-[8.5px] font-bold text-bad-600">PDF</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-ink-800">{d.name}</p>
                    <p className="num text-[10px] text-ink-400">{d.kind} · {d.size} · {d.by}</p>
                  </div>
                </div>
              ))}
              {sh.docs.length === 0 && <p className="text-[12px] text-ink-300 sm:col-span-2">No documents attached yet.</p>}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-paper-200 bg-white px-3 py-2">
      <p className="text-[9.5px] font-semibold uppercase tracking-[.1em] text-ink-400">{k}</p>
      <p className="mt-0.5 truncate text-[12.5px] font-semibold text-ink-800" title={v}>{v}</p>
    </div>
  );
}
