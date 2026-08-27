/* Printable branded documents — rendered into the print portal.
   Invoice / Quotation / Client Statement with company letterhead. */

import type { Client, CompanySettings, Invoice, Quotation } from "../lib/types";
import type { LedgerRow } from "../lib/store";
import { fm, fmtDate, todayISO } from "../lib/money";
import { BrandMark } from "./ui";

function Letterhead({ company, docTitle, docNo, tone = "pine" }:
  { company: CompanySettings; docTitle: string; docNo: string; tone?: "pine" | "brass" }) {
  return (
    <header className="mb-6">
      <div className="flex items-end justify-between gap-4 border-b-4 pb-4" style={{ borderColor: tone === "pine" ? "#0b211e" : "#c2922e" }}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <BrandMark logo={company.logo} size={46} maxWidth={180} />
          <div>
            <p className="disp text-[19px] font-bold leading-tight" style={{ color: "#0b211e" }}>{company.name.toUpperCase()}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[.22em]" style={{ color: "#a3761f" }}>{company.tagline}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="disp text-[22px] font-bold uppercase tracking-wide" style={{ color: "#0b211e" }}>{docTitle}</p>
          <p className="num text-[12px]" style={{ color: "#5c6f6a" }}>{docNo}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10.5px]" style={{ color: "#5c6f6a" }}>
        <span>{company.address}</span>
        <span className="num">{company.phone} · {company.email} · {company.website}</span>
      </div>
      <div className="num flex flex-wrap justify-between gap-2 border-y py-1.5 text-[10.5px]" style={{ borderColor: "#dcd8c9", color: "#5c6f6a" }}>
        <span>{company.ntn}</span>
        <span>{company.taxInfo}</span>
      </div>
    </header>
  );
}

const th = "border-b-2 px-2 py-2 text-left text-[9.5px] font-bold uppercase tracking-[.12em]";
const td = "border-b px-2 py-2 text-[11.5px]";

/* shared brand palette — one template for invoice & quotation */
const INK = "#17171a"; /* dark ink on a white sheet */
const SUB = "#4a4a50";
const LINE = "#cfcdc5";
const BRASS = "#b47f1e";
const PINE = "#145247"; /* deep pine green — the colourful letterhead band */
const GOLD_LT = "#d9a93f";
/* every text element inherits this single size; bold is reserved for amounts */
const cell = "px-3 py-2 text-[12px] leading-snug";

/* colourful pine band letterhead — identical on invoice & quotation */
function BandHeader({ company, docTitle, docNo }: { company: CompanySettings; docTitle: string; docNo: string }) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-4 rounded-t-xl px-6 py-4" style={{ background: PINE }}>
        <div className="flex min-w-0 flex-wrap items-center gap-3.5">
          {company.logo ? (
            <span className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1" style={{ width: 52, height: 52 }}>
              <BrandMark logo={company.logo} size={42} maxWidth={42} />
            </span>
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(217,169,63,.14)", boxShadow: "inset 0 0 0 1px rgba(217,169,63,.45)" }}>
              <svg viewBox="0 0 32 32" className="h-7 w-7"><path d="M6 23 L13 8 L18 16 L25 6" stroke={GOLD_LT} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="25" cy="6" r="2.3" fill={GOLD_LT} /><path d="M6 27 h20" stroke="#5c8f80" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[16px] uppercase leading-tight" style={{ color: "#f4f2ea", letterSpacing: ".07em" }}>{company.name}</p>
            <p className="text-[10px] uppercase" style={{ color: GOLD_LT, letterSpacing: ".22em" }}>{company.tagline}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] uppercase" style={{ color: GOLD_LT, letterSpacing: ".2em" }}>{docTitle}</p>
          <p className="num text-[12px]" style={{ color: "#a8c4bb" }}>{docNo}</p>
        </div>
      </div>
      <div className="rounded-b-xl border-x-2 border-b-2 px-6 pb-2.5 pt-1" style={{ borderColor: PINE }}>
        <div className="h-[3px] w-full rounded-full" style={{ background: "linear-gradient(90deg,#d9a93f 0%,#c2922e 55%,#145247 100%)" }} />
      </div>
    </header>
  );
}

/* Fixed page footer — pinned to the absolute bottom of every printed page.
   In @media print it becomes position:fixed, so browsers repeat it at the
   foot of each page even if the document overflows. */
function DocFooter({ company }: { company: CompanySettings }) {
  return (
    <footer className="print-doc-footer mt-10 border-t-2 pt-3.5" style={{ borderColor: INK }}>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px]" style={{ color: SUB }}>
        <span className="inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke={BRASS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
          {company.address}
        </span>
        <span className="num inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke={BRASS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
          {company.phone}
        </span>
        <span className="num inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke={BRASS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
          {company.email}
        </span>
        <span className="num inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke={BRASS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
          {company.website}
        </span>
      </div>
      <p className="mt-2.5 text-center text-[12px]" style={{ color: SUB }}>
        Thank you for your business · Generated {fmtDate(todayISO())}
      </p>
    </footer>
  );
}

export function InvoiceDoc({ invoice, client, company, paid, orderNo }:
  { invoice: Invoice; client?: Client; company: CompanySettings; paid: number; orderNo?: string }) {
  const balance = invoice.grandTotalPkr - paid;
  return (
    <div className="print-page mx-auto max-w-[760px] bg-white p-8" style={{ fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", color: INK, fontSize: 12 }}>
      <BandHeader company={company} docTitle={invoice.void ? "Invoice · Void" : "Invoice"} docNo={invoice.number} />

      {/* ------- bill to (company only) + date / ref / currency ------- */}
      <div className="mb-6 flex items-start justify-between gap-8">
        <div>
          <p className="text-[10px] uppercase" style={{ color: BRASS, letterSpacing: ".18em" }}>Bill To</p>
          <p className="mt-1.5 text-[12px]" style={{ color: INK }}>{client?.company ?? "—"}</p>
        </div>
        <div className="num space-y-1.5 text-[12px]">
          {([["Invoice Date", fmtDate(invoice.date)], ["Invoice Ref", invoice.number], ["Currency", "PKR"]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex items-center justify-end gap-4">
              <span style={{ color: SUB }}>{l}:</span>
              <span className="inline-block min-w-[150px] text-right" style={{ color: INK }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ------- items ------- */}
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ color: SUB, borderBottom: `2px solid ${INK}` }}>
            <th className={`${cell} text-left`} style={{ width: 40, fontWeight: 400 }}>#</th>
            <th className={`${cell} text-left`} style={{ fontWeight: 400 }}>Description</th>
            <th className={`${cell} text-right`} style={{ width: 60, fontWeight: 400 }}>Qty</th>
            <th className={`${cell} text-right`} style={{ width: 112, fontWeight: 400 }}>Unit Price</th>
            <th className={`${cell} text-right`} style={{ width: 124, fontWeight: 400 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i} style={{ background: i % 2 ? "#f7f6f2" : "#ffffff" }}>
              <td className={`${cell} num border-b`} style={{ borderColor: LINE, color: BRASS }}>{String(i + 1).padStart(2, "0")}</td>
              <td className={`${cell} border-b`} style={{ borderColor: LINE, color: INK }}>{it.description}</td>
              <td className={`${cell} num border-b text-right`} style={{ borderColor: LINE, color: INK }}>{fm(it.qty)}</td>
              <td className={`${cell} num border-b text-right`} style={{ borderColor: LINE, color: INK }}>{fm(it.unitPrice)}</td>
              <td className={`${cell} num border-b text-right font-bold`} style={{ borderColor: LINE, color: INK }}>{fm(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* bank details (left) aligned with totals (right) in the same band */}
      <div className="mt-4 flex items-end justify-between gap-6">
        <div className="num space-y-0.5 text-[12px]" style={{ color: INK }}>
          <p><span style={{ color: SUB }}>Bank:</span> {company.bankName}</p>
          <p><span style={{ color: SUB }}>A/C Title:</span> {company.accountTitle}</p>
          <p><span style={{ color: SUB }}>A/C No:</span> {company.accountNo}</p>
          <p><span style={{ color: SUB }}>IBAN:</span> {company.iban}</p>
        </div>
        <div className="num w-[310px] shrink-0 text-[12px]">
          <div className="flex justify-between border-b py-1.5" style={{ borderColor: LINE, color: INK }}><span style={{ color: SUB }}>Subtotal</span><span className="font-bold">{fm(invoice.subtotalPkr)}</span></div>
          {([["Freight", invoice.freightPkr], ["Customs", invoice.customsPkr], ["Taxes", invoice.taxPkr]] as [string, number][]).map(([l, v]) => (
            <div key={l} className="flex justify-between border-b py-1.5" style={{ borderColor: LINE }}>
              <span style={{ color: SUB }}>{l}</span>
              <span className="font-bold" style={{ color: v === 0 ? SUB : INK }}>{v === 0 ? "incl." : fm(v)}</span>
            </div>
          ))}
          {invoice.discountPkr > 0 && (
            <div className="flex justify-between border-b py-1.5" style={{ borderColor: LINE, color: "#1e7a45" }}><span>Discount</span><span className="font-bold">− {fm(invoice.discountPkr)}</span></div>
          )}
          <div className="mt-2 flex items-center justify-between border-2 px-3 py-2.5" style={{ borderColor: INK }}>
            <span className="uppercase" style={{ color: INK, letterSpacing: ".08em" }}>Grand Total</span>
            <span className="font-bold" style={{ color: INK }}>PKR {fm(invoice.grandTotalPkr)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span style={{ color: SUB }}>Advance / Payments Received</span><span className="font-bold" style={{ color: "#1e7a45" }}>− {fm(paid)}</span>
          </div>
          <div className="flex justify-between border-t-2 pt-1.5" style={{ borderColor: BRASS }}>
            <span style={{ color: SUB }}>Balance Due</span>
            <span className="font-bold" style={{ color: balance > 0 ? "#b3261e" : "#1e7a45" }}>PKR {fm(Math.max(0, balance))}</span>
          </div>
        </div>
      </div>

      {invoice.notes && <p className="mt-4 rounded-lg px-3 py-2 text-[12px]" style={{ background: "#f5f4f0", color: SUB }}>Note: {invoice.notes}</p>}

      <div className="mt-8 grid grid-cols-3 gap-6 text-center text-[12px]" style={{ color: SUB }}>
        <div className="border-t pt-2" style={{ borderColor: "#8f8d84" }}>Prepared by</div>
        <div className="border-t pt-2" style={{ borderColor: "#8f8d84" }}>Checked by</div>
        <div className="border-t pt-2" style={{ borderColor: "#8f8d84" }}>Authorised Signatory</div>
      </div>
      <DocFooter company={company} />
    </div>
  );
}

export function QuotationDoc({ qt, client, company }: { qt: Quotation; client?: Client; company: CompanySettings }) {
  const subtotal = qt.items.reduce((a, i) => a + i.snapshot.sellingPricePkr, 0);
  return (
    <div className="print-page mx-auto max-w-[760px] bg-white p-8" style={{ fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", color: INK, fontSize: 12 }}>
      <BandHeader company={company} docTitle="Quotation" docNo={qt.number} />

      {/* prepared for + key terms — same layout as invoice */}
      <div className="mb-6 flex items-start justify-between gap-8">
        <div>
          <p className="text-[10px] uppercase" style={{ color: BRASS, letterSpacing: ".18em" }}>Prepared For</p>
          <p className="mt-1.5 text-[12px]" style={{ color: INK }}>{client?.company ?? "—"}</p>
        </div>
        <div className="num space-y-1.5 text-[12px]">
          {([["Quotation Date", fmtDate(qt.date)], ["Valid Until", fmtDate(qt.validUntil)], ["Payment", qt.paymentTerms], ["Delivery", qt.deliveryTerms]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex items-center justify-end gap-4">
              <span style={{ color: SUB }}>{l}:</span>
              <span className="inline-block min-w-[150px] text-right" style={{ color: INK }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* items — identical table treatment */}
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ color: SUB, borderBottom: `2px solid ${INK}` }}>
            <th className={`${cell} text-left`} style={{ width: 40, fontWeight: 400 }}>#</th>
            <th className={`${cell} text-left`} style={{ fontWeight: 400 }}>Item &amp; Specification</th>
            <th className={`${cell} text-right`} style={{ width: 60, fontWeight: 400 }}>Qty</th>
            <th className={`${cell} text-right`} style={{ width: 112, fontWeight: 400 }}>Rate (PKR)</th>
            <th className={`${cell} text-right`} style={{ width: 124, fontWeight: 400 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {qt.items.map((it, i) => (
            <tr key={i} style={{ background: i % 2 ? "#f7f6f2" : "#ffffff" }}>
              <td className={`${cell} num border-b`} style={{ borderColor: LINE, color: BRASS }}>{String(i + 1).padStart(2, "0")}</td>
              <td className={`${cell} border-b`} style={{ borderColor: LINE, color: INK }}>{it.description}<br /><span className="text-[10px]" style={{ color: SUB }}>Landed rate — includes China costs, freight, customs &amp; clearing</span></td>
              <td className={`${cell} num border-b text-right`} style={{ borderColor: LINE, color: INK }}>{fm(it.snapshot.qty)}</td>
              <td className={`${cell} num border-b text-right`} style={{ borderColor: LINE, color: INK }}>{fm(it.snapshot.unitSellingPkr)}</td>
              <td className={`${cell} num border-b text-right font-bold`} style={{ borderColor: LINE, color: INK }}>{fm(it.snapshot.sellingPricePkr)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals — same bordered grand-total box */}
      <div className="mt-4 flex justify-end">
        <div className="num w-[310px] text-[12px]">
          <div className="flex justify-between border-b py-1.5" style={{ borderColor: LINE, color: INK }}><span style={{ color: SUB }}>Subtotal</span><span className="font-bold">{fm(subtotal)}</span></div>
          {qt.discountPkr > 0 && (
            <div className="flex justify-between border-b py-1.5" style={{ borderColor: LINE, color: "#1e7a45" }}><span>Discount</span><span className="font-bold">− {fm(qt.discountPkr)}</span></div>
          )}
          <div className="mt-2 flex items-center justify-between border-2 px-3 py-2.5" style={{ borderColor: INK }}>
            <span className="uppercase" style={{ color: INK, letterSpacing: ".08em" }}>Grand Total</span>
            <span className="font-bold" style={{ color: INK }}>PKR {fm(subtotal - qt.discountPkr)}</span>
          </div>
        </div>
      </div>

      {qt.notes && <p className="mt-4 rounded-lg px-3 py-2 text-[12px]" style={{ background: "#f5f4f0", color: SUB }}>Note: {qt.notes}</p>}

      <div className="mt-8 grid grid-cols-2 gap-6 text-center text-[12px]" style={{ color: SUB }}>
        <div className="border-t pt-2" style={{ borderColor: "#8f8d84" }}>For {company.name}</div>
        <div className="border-t pt-2" style={{ borderColor: "#8f8d84" }}>Client Acceptance</div>
      </div>
      <DocFooter company={company} />
    </div>
  );
}

export function StatementDoc({ client, rows, company, kind }:
  { client: Client; rows: LedgerRow[]; company: CompanySettings; kind: "client" | "supplier" }) {
  const last = rows.length ? rows[rows.length - 1].balance : 0;
  return (
      <div className="print-page mx-auto max-w-[760px] bg-white p-8" style={{ fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", color: "#1c2a27" }}>
        <Letterhead company={company} docTitle={kind === "client" ? "Account Statement" : "Supplier Statement"} docNo={client.code} />      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="disp text-[15px] font-bold">{client.company}</p>
          <p className="text-[11px]" style={{ color: "#5c6f6a" }}>{client.address}, {client.city} · {client.phone}</p>
        </div>
        <p className="num text-[11px]" style={{ color: "#5c6f6a" }}>As of <b>{fmtDate(todayISO())}</b></p>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ color: "#0b211e", borderColor: "#0b211e" }}>
            <th className={th} style={{ width: 82 }}>Date</th>
            <th className={th} style={{ width: 120 }}>Reference</th>
            <th className={th}>Particulars</th>
            <th className={`${th} text-right`} style={{ width: 100 }}>Debit</th>
            <th className={`${th} text-right`} style={{ width: 100 }}>Credit</th>
            <th className={`${th} text-right`} style={{ width: 110 }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`${td} num`}>{fmtDate(r.date)}</td>
              <td className={`${td} num`} style={{ color: "#a3761f" }}>{r.ref}</td>
              <td className={td}>{r.description}</td>
              <td className={`${td} num text-right`}>{r.debit ? fm(r.debit) : "—"}</td>
              <td className={`${td} num text-right`}>{r.credit ? fm(r.credit) : "—"}</td>
              <td className={`${td} num text-right font-semibold`} style={{ color: r.balance > 0 ? "#ab3a28" : "#22703f" }}>{fm(r.balance)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className={td} colSpan={6} style={{ textAlign: "center", color: "#9aa8a3" }}>No transactions</td></tr>}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="px-2 py-2 text-right text-[11px] font-bold uppercase" style={{ color: "#0b211e" }}>Closing Balance</td>
            <td className={`${td} num text-right font-bold`}>{fm(rows.reduce((a, r) => a + r.debit, 0))}</td>
            <td className={`${td} num text-right font-bold`}>{fm(rows.reduce((a, r) => a + r.credit, 0))}</td>
            <td className="num border-t-2 px-2 py-2 text-right text-[12.5px] font-bold" style={{ borderColor: "#c2922e", color: last > 0 ? "#ab3a28" : "#22703f" }}>{fm(last)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-4 text-[10px]" style={{ color: "#9aa8a3" }}>
        {kind === "client"
          ? "A debit balance means amount receivable from the client."
          : "A debit balance means amount payable to the supplier."}
        {" "}Positive balances are shown in red.
      </p>
    </div>
  );
}
