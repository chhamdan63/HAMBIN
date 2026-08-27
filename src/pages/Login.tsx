import { useState } from "react";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { useStore } from "../lib/store";
import { currentRate } from "../lib/store";
import { BrandMark, Btn, Field, inp } from "../components/ui";

export default function Login() {
  const { login, db } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pw) { setErr("Email and password are required."); setShake((s) => s + 1); return; }
    if (!login(email, pw)) { setErr("Invalid credentials or inactive account."); setShake((s) => s + 1); }
  };

  const rmb = currentRate(db, "RMB");
  const usd = currentRate(db, "USD");

  return (
    <div className="flex min-h-screen">
      {/* brand panel */}
      <div className="ink-topo relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink-900 p-10 lg:flex">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 800" fill="none" preserveAspectRatio="xMidYMid slice">
          <path className="anim-route" d="M-40 640 C 140 560, 220 420, 340 380 S 560 260, 660 140" stroke="#c2922e" strokeWidth="1.6" opacity=".5" />
          <path className="anim-route" d="M-60 720 C 120 660, 260 520, 380 470 S 590 330, 700 230" stroke="#3d7166" strokeWidth="1.4" opacity=".5" style={{ animationDelay: "-6s" }} />
          <circle cx="340" cy="380" r="4" fill="#d9a93f" /><circle cx="140" cy="560" r="3" fill="#3d7166" /><circle cx="520" cy="275" r="3" fill="#d9a93f" />
          <text x="330" y="365" fill="#8fb0a7" fontSize="10" fontFamily="Arial, sans-serif" letterSpacing="1">GUANGZHOU</text>
          <text x="100" y="585" fill="#8fb0a7" fontSize="10" fontFamily="Arial, sans-serif" letterSpacing="1">YIWU</text>
          <text x="500" y="258" fill="#8fb0a7" fontSize="10" fontFamily="Arial, sans-serif" letterSpacing="1">KARACHI</text>
        </svg>
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brass-400/15 px-1.5 ring-1 ring-brass-400/40">
              <BrandMark size={36} maxWidth={130} />
            </span>
            <div>
              <p className="disp text-[17px] font-bold tracking-wide text-paper-100">HAMBIN INTERNATIONAL</p>
              <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-brass-400">Trading &amp; Consultancy</p>
            </div>
          </div>
          <h1 className="disp mt-10 max-w-md text-[34px] font-bold leading-[1.12] text-paper-50">
            Import, sourcing &amp; shipment ERP — <span className="text-brass-400">down to the last rupee.</span>
          </h1>
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-ink-300">
            One ledger from client inquiry to final invoice: supplier quotes, landed-cost snapshots,
            air &amp; sea freight, customs, khata and profit — every figure auditable.
          </p>
          <ul className="mt-7 grid max-w-md grid-cols-2 gap-x-6 gap-y-2.5">
            {["Sourcing → quotation → order", "Immutable rate snapshots", "Air / sea freight tracking", "Double-entry client khata", "Customs & clearing costs", "Order-level net profit"].map((t) => (
              <li key={t} className="flex items-center gap-2 text-[12.5px] text-ink-200">
                <span className="h-1.5 w-1.5 rounded-sm bg-brass-400" />{t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div className="num flex gap-6 rounded-xl border border-ink-700 bg-ink-850/80 px-5 py-3.5">
            <div><p className="text-[9.5px] uppercase tracking-[.18em] text-ink-400">Board rate</p><p className="text-[15px] font-semibold text-brass-300">1 RMB = {rmb.toFixed(2)} PKR</p></div>
            <div><p className="text-[9.5px] uppercase tracking-[.18em] text-ink-400">Board rate</p><p className="text-[15px] font-semibold text-brass-300">1 USD = {usd.toFixed(2)} PKR</p></div>
            <div className="ml-auto self-center"><span className="anim-pulse-soft inline-flex items-center gap-1.5 rounded-full bg-ok-100/10 px-2.5 py-1 text-[10.5px] font-semibold text-ok-100"><span className="h-1.5 w-1.5 rounded-full bg-ok-100" />Ledger live</span></div>
          </div>
        </div>
      </div>

      {/* form panel */}
      <div className="paper-grid flex flex-1 items-center justify-center bg-paper-100 p-6">
        <div className="w-full max-w-[400px]">
          <div key={shake} className={shake ? "anim-shake" : ""}>
            <p className="text-[10.5px] font-bold uppercase tracking-[.2em] text-brass-600">Secure sign-in</p>
            <h2 className="disp mt-1 text-[26px] font-bold text-ink-900">Open the ledger</h2>
            <p className="mt-1 text-[12.5px] text-ink-400">Session-based auth · CSRF protected · role-scoped access</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
                  <input className={`${inp} pl-9`} value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@hambin.com" autoComplete="username" />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
                  <input className={`${inp} pl-9`} type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} placeholder="••••••••" autoComplete="current-password" />
                </div>
              </Field>
              {err && <p className="rounded-lg border border-bad-600/25 bg-bad-100 px-3 py-2 text-[12px] font-medium text-bad-600">{err}</p>}
              <Btn type="submit" className="w-full py-2.5 text-[13.5px]">Sign in to Hambin ERP <ArrowRight className="h-4 w-4" /></Btn>
            </form>

          </div>
          <p className="mt-8 flex items-center gap-1.5 text-[11px] text-ink-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Role-based access · session-scoped · all actions are audited
          </p>
        </div>
      </div>
    </div>
  );
}

