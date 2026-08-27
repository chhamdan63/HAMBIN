import { useMemo, useState } from "react";
import { Download, Lock, Plus, RotateCcw, Save, Trash2, Upload, Users2 } from "lucide-react";
import { PageHead } from "../components/shell";
import { BrandMark, Btn, Card, CurrencySelector, Empty, Field, Modal, Pager, paginate, Pill, SearchBox, SectionLabel, Tabs, inp } from "../components/ui";
import { currentRate, useStore, ROLE_LABEL } from "../lib/store";
import { fmtDate, fmtDateTime, todayISO, uid } from "../lib/money";
import type { Currency, ExchangeRate, Role, User } from "../lib/types";

const TABS = [
  { id: "company", label: "Company" },
  { id: "rates", label: "Exchange Rates" },
  { id: "users", label: "Users & Roles" },
  { id: "audit", label: "Audit Log" },
  { id: "blueprint", label: "Data Blueprint", superAdminOnly: true },
  { id: "deploy", label: "Deploy Guide", superAdminOnly: true },
];

/* ---------------- deployment guide (static demo + Laravel production) ---------------- */
const NGINX_CONF = [
  "server {",
  "    listen 80;",
  "    server_name erp.hambinintl.com;",
  "    root /var/www/hambin-erp/public;",
  "    index index.php;",
  "",
  "    client_max_body_size 25M;",
  "",
  "    location / {",
  "        try_files $uri $uri/ /index.php?$query_string;",
  "    }",
  "",
  "    location ~ \\.php$ {",
  "        fastcgi_pass unix:/run/php/php8.2-fpm.sock;",
  "        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;",
  "        include fastcgi_params;",
  "    }",
  "",
  "    location ~ /\\.(?!well-known).* { deny all; }",
  "}",
].join("\n");

const ENV_PROD = [
  "APP_NAME=\"Hambin ERP\"",
  "APP_ENV=production",
  "APP_DEBUG=false",
  "APP_URL=https://erp.hambinintl.com",
  "",
  "DB_CONNECTION=mysql",
  "DB_HOST=127.0.0.1",
  "DB_PORT=3306",
  "DB_DATABASE=hambin_erp",
  "DB_USERNAME=hambin_app",
  "DB_PASSWORD=<strong-random-password>",
  "",
  "SESSION_DRIVER=database",
  "SESSION_SECURE_COOKIE=true",
  "QUEUE_CONNECTION=redis",
  "CACHE_STORE=redis",
  "",
  "MAIL_MAILER=smtp",
  "MAIL_HOST=smtp.yourprovider.com",
  "MAIL_PORT=587",
  "",
  "# Admin seeded from env — never hardcoded",
  "ADMIN_NAME=\"Ayesha Khan\"",
  "ADMIN_EMAIL=admin@hambinintl.com",
  "ADMIN_PASSWORD=<change-me>",
].join("\n");

const VPS_SETUP = [
  "# 1 · Ubuntu 24.04 VPS — runtime install",
  "sudo apt update && sudo apt upgrade -y",
  "sudo apt install -y php8.2-fpm php8.2-cli php8.2-mysql php8.2-bcmath \\",
  "  php8.2-gd php8.2-intl php8.2-zip php8.2-mbstring php8.2-curl \\",
  "  nginx mysql-server redis-server composer unzip certbot python3-certbot-nginx",
  "",
  "# 2 · Database",
  "sudo mysql -e \"CREATE DATABASE hambin_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\"",
  "sudo mysql -e \"CREATE USER 'hambin_app'@'localhost' IDENTIFIED BY '<strong-password>';\"",
  "sudo mysql -e \"GRANT ALL ON hambin_erp.* TO 'hambin_app'@'localhost'; FLUSH PRIVILEGES;\"",
  "",
  "# 3 · Application",
  "cd /var/www && git clone <your-repo> hambin-erp && cd hambin-erp",
  "composer install --no-dev --optimize-autoloader",
  "cp .env.example .env && nano .env        # paste production values",
  "php artisan key:generate",
  "php artisan migrate --force",
  "php artisan db:seed --class=DemoSeeder   # demo data (skip on live)",
  "php artisan storage:link",
  "php artisan config:cache && php artisan route:cache && php artisan view:cache",
  "sudo chown -R www-data:www-data storage bootstrap/cache",
].join("\n");

const QUEUES_BACKUP = [
  "# /etc/supervisor/conf.d/hambin-queue.conf",
  "[program:hambin-queue]",
  "process_name=%(program_name)s_%(process_num)02d",
  "command=php /var/www/hambin-erp/artisan queue:work redis --sleep=3 --tries=3",
  "autostart=true",
  "autorestart=true",
  "user=www-data",
  "numprocs=2",
  "",
  "sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start \"hambin-queue:*\"",
  "",
  "# nightly MySQL backup (crontab -e)",
  "0 2 * * * mysqldump -u hambin_app -p'<pw>' hambin_erp | gzip > /backups/hambin_$(date +\\%F).sql.gz",
].join("\n");

function CodeBlock({ title, code, onCopy }: { title: string; code: string; onCopy: (t: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-ink-800">
      <div className="ink-topo flex items-center justify-between bg-ink-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-bad-600/80" /><span className="h-2.5 w-2.5 rounded-full bg-brass-500/80" /><span className="h-2.5 w-2.5 rounded-full bg-ok-600/80" /></span>
          <span className="num text-[11px] font-semibold text-ink-300">{title}</span>
        </div>
        <button
          onClick={() => { onCopy(code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }}
          className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider transition-all ${copied ? "bg-ok-100 text-ok-600" : "bg-ink-800 text-brass-300 hover:bg-ink-700"}`}
        >{copied ? "Copied ✓" : "Copy"}</button>
      </div>
      <pre className="num max-h-[340px] overflow-auto whitespace-pre bg-ink-950 px-4 py-3.5 text-[11.5px] leading-relaxed text-paper-200 scroll-thin">{code}</pre>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative flex gap-3.5 pb-5 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-brass-300 ring-2 ring-brass-400/40">{n}</span>
        <span className="mt-1 w-px flex-1 bg-paper-300" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <p className="disp text-[13.5px] font-bold text-ink-900">{title}</p>
        <div className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{children}</div>
      </div>
    </div>
  );
}

function DeployGuide() {
  const { toast } = useStore();
  const copy = (t: string) => {
    navigator.clipboard?.writeText(t).then(() => toast("Command copied to clipboard.", "info")).catch(() => toast("Copy failed — select the text manually.", "warning"));
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Option A — Is demo ko live karna" sub="static React build · koi server nahi chahiye" className="anim-rise">
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-ink-500">
              Yeh working model aik <b className="text-ink-800">static site</b> hai — <span className="num rounded bg-paper-200 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">npm run build</span> se
              <span className="num rounded bg-paper-200 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700"> dist/</span> folder banta hai, jise kisi bhi static host par daal dein. Saray records Supabase cloud mein save hote hain — har device aur user ke liye same data.
            </p>
            <CodeBlock title="build.sh" code={"# 1 · Production build\nnpm install\nnpm run build\n\n# 2 · dist/ folder ko deploy karein:\n#    Netlify / Vercel / Cloudflare Pages → drag & drop ya git connect\n#    cPanel → dist/ ke files public_html/ mein upload\n#    VPS Nginx → root /var/www/hambin-demo/dist;"} onCopy={copy} />
            <div className="flex flex-wrap gap-1.5">
              {["Netlify — 2 min, free", "Vercel — git push deploy", "Cloudflare Pages", "cPanel / shared hosting", "GitHub Pages"].map((h) => (
                <span key={h} className="rounded-full border border-paper-300 bg-paper-100 px-2.5 py-1 text-[10.5px] font-semibold text-ink-600 transition-colors hover:border-brass-400 hover:text-brass-600">{h}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Option B — Production ERP (Laravel + MySQL)" sub="blueprint ke mutabiq asli deployment" className="anim-rise" >
          <div className="space-y-1">
            <Step n="1" title="VPS tayar karein (Ubuntu 24.04)"><p>PHP 8.2-FPM, MySQL 8, Redis, Nginx aur Composer — neeche wali commands se poora stack lag jata hai.</p></Step>
            <Step n="2" title="Code + database"><p>Repo clone, <b>composer install</b>, <b>.env</b> mein production values, phir <b>migrate</b> — saari 30+ tables ban jati hain.</p></Step>
            <Step n="3" title="Nginx point karein /public par"><p>Laravel mein sirf <b>public/</b> folder web par khulta hai — baqi code server par mehfooz rehta hai.</p></Step>
            <Step n="4" title="SSL + queues + backups"><p>Certbot se free HTTPS, Supervisor se PDF/report queues, aur raat 2 baje automatic MySQL dump.</p></Step>
            <div className="pt-2">
              <div className="grid gap-2 sm:grid-cols-3">
                {[["DECIMAL(18,2)", "har paisa"], ["Transactions", "invoice / payment"], ["Audit log", "har action"], ["Rate snapshot", "historical orders"], ["Roles + Policies", "access control"], ["No hard delete", "financial records"]].map(([a, b]) => (
                  <div key={a} className="rounded-lg border border-paper-200 bg-paper-100/70 px-2.5 py-2">
                    <p className="num text-[11px] font-bold text-brand-700">{a}</p>
                    <p className="text-[10.5px] text-ink-400">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CodeBlock title="terminal · vps-setup.sh" code={VPS_SETUP} onCopy={copy} />
        <CodeBlock title="/etc/nginx/sites-available/hambin-erp" code={NGINX_CONF} onCopy={copy} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <CodeBlock title=".env · production" code={ENV_PROD} onCopy={copy} />
        <CodeBlock title="supervisor + nightly backup" code={QUEUES_BACKUP} onCopy={copy} />
      </div>

      <Card title="Local development — XAMPP variant" sub="Windows par Laravel + MySQL chalane ka tareeqa">
        <ol className="grid gap-x-8 gap-y-1.5 text-[12.5px] text-ink-600 sm:grid-cols-2">
          {[
            "XAMPP install karein — Apache + MySQL start",
            "phpMyAdmin mein database hambin_erp banayein (utf8mb4)",
            "Composer install karein (getcomposer.org)",
            "Repo clone kar ke composer install chalayein",
            ".env copy karein — DB_USERNAME=root, DB_PASSWORD=(khali)",
            "php artisan migrate --seed",
            "php artisan serve → http://localhost:8000",
            "Admin login .env wali credentials se",
          ].map((t, i) => (
            <li key={i} className="flex gap-2.5"><span className="num shrink-0 font-bold text-brass-600">{String(i + 1).padStart(2, "0")}</span>{t}</li>
          ))}
        </ol>
      </Card>

      <Card title="Go-live checklist" sub="launch se pehle har nishaan lagayein">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[
            "APP_DEBUG=false aur APP_ENV=production",
            "APP_KEY generate ho chuki hai (key:generate)",
            "Admin password .env se set, default nahi",
            "HTTPS active — mixed content check",
            "Rate limiting login par test",
            "storage/ aur bootstrap/cache writable (www-data)",
            "Queues supervisor se chal rahi hain",
            "Backup cron test restore ke saath verify",
            "Mail (forgot password) sandbox se test",
            "PDF invoice / statement print test",
          ].map((t, i) => (
            <label key={i} className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-paper-200 bg-white px-3 py-2 text-[12px] font-medium text-ink-600 transition-all hover:border-brand-500 hover:shadow-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#0e6b5e]" />
              <span className="transition-colors group-has-[:checked]:text-ink-300 group-has-[:checked]:line-through">{t}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

const SCHEMA: { table: string; note: string }[] = [
  { table: "users · roles", note: "session auth, granular role permissions" },
  { table: "clients", note: "code, terms, credit limit, opening balance" },
  { table: "suppliers", note: "WeChat, warehouse address, bank info" },
  { table: "categories · products", note: "SKU, HS code, weight/CBM, price history" },
  { table: "sourcing_requests", note: "client need → agent pipeline" },
  { table: "supplier_quotes", note: "multi-quote comparison per request" },
  { table: "exchange_rates", note: "dated board rates; history preserved" },
  { table: "quotations · quotation_items", note: "snapshot per line (DECIMAL 18,2)" },
  { table: "orders · order_items", note: "immutable LandedSnapshot per line" },
  { table: "shipments · shipment_docs", note: "air/sea detail, timeline, documents" },
  { table: "invoices · invoice_items", note: "void flag — never hard-deleted" },
  { table: "payments", note: "multi-currency with stored rate" },
  { table: "client_ledger · supplier_ledger", note: "derived debit/credit + running balance" },
  { table: "expenses · expense_categories", note: "overhead pool for net profit" },
  { table: "ledger_adjustments", note: "manual Dr/Cr with reason" },
  { table: "audit_logs", note: "user, action, old→new, IP, timestamp" },
  { table: "settings", note: "company profile, document prefixes" },
];

export default function Settings() {
  const { db, route, user, can, saveSettings, saveRate, deleteRate, saveUser, setUserActive, resetDemo, replaceDb, confirm, toast } = useStore();
  const [tab, setTab] = useState((route.carry as { tab?: string } | undefined)?.tab ?? "company");
  const [s, setS] = useState({ ...db.settings });
  const [rateForm, setRateForm] = useState<ExchangeRate | null>(null);
  const [userForm, setUserForm] = useState<User | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const editable = can("settings", "edit");

  /* logo upload — validated type & size, stored as data-URL */
  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/.test(f.type)) { toast("Only PNG, JPG, SVG, WebP or GIF images are allowed.", "error"); return; }
    if (f.size > 400 * 1024) { toast("Logo must be under 400 KB — compress it first.", "error"); return; }
    const r = new FileReader();
    r.onload = () => setS((prev) => ({ ...prev, logo: String(r.result) }));
    r.onerror = () => toast("Could not read that file — try another image.", "error");
    r.readAsDataURL(f);
  };

  /* data backup — export the whole workspace as JSON / import to restore */
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ v: 4, exportedAt: new Date().toISOString(), db }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hambin-erp-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded — keep it somewhere safe.", "success");
  };
  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "application/json" && !/\.json$/i.test(f.name)) { toast("Only a .json backup file can be imported.", "error"); return; }
    const r = new FileReader();
    r.onload = () => {
      try {
        const wrap = JSON.parse(String(r.result));
        if (!wrap || !wrap.db || !Array.isArray(wrap.db.clients)) throw new Error("bad shape");
        replaceDb({ ...wrap.db, sessionId: db.sessionId });
        toast("Backup restored — all modules updated.", "success");
      } catch {
        toast("That file is not a valid Hambin backup.", "error");
      }
    };
    r.readAsText(f);
  };

  const rates = useMemo(() => db.exchangeRates.slice().sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || a.currency.localeCompare(b.currency)), [db.exchangeRates]);
  const audits = useMemo(() => db.audit.filter((a) => `${a.action} ${a.module} ${a.userName} ${a.refId} ${a.detail}`.toLowerCase().includes(q.toLowerCase())), [db.audit, q]);
  const pg = paginate(audits, page, 12);

  const visibleTabs = TABS.filter((t) => !(t as { superAdminOnly?: boolean }).superAdminOnly || user?.role === "superadmin");

  return (
    <div>
      <PageHead title="System Settings" sub="Company profile, board rates, users and the complete audit trail" />
      <div className="mb-4"><Tabs tabs={visibleTabs} active={tab} onChange={setTab} /></div>

      {tab === "company" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <Card title="Company Profile" sub="used on invoices, quotations and statements">
            {/* logo uploader */}
            <div className="mb-5 flex items-center gap-4 rounded-xl border-2 border-dashed border-paper-300 bg-paper-100/70 p-4 transition-colors hover:border-brass-400">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-paper-300">
                <BrandMark logo={s.logo} size={56} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-ink-800">Business Logo</p>
                <p className="text-[11px] leading-snug text-ink-400">PNG, JPG, SVG or WebP · max 400 KB · appears on invoices, quotations, statements, sidebar &amp; login</p>
                <div className="mt-2 flex items-center gap-2">
                  <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700 ${!editable ? "pointer-events-none opacity-50" : ""}`}>
                    <Upload className="h-3.5 w-3.5" />Upload logo
                    <input type="file" hidden accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" onChange={onLogoFile} />
                  </label>
                  {editable && (
                    <Btn size="sm" variant="outline" onClick={() => setS((prev) => ({ ...prev, logo: "/logo-badge.svg" }))}>Use brand mark</Btn>
                  )}
                  {s.logo && editable && (
                    <Btn size="sm" variant="ghost" className="hover:text-bad-600" onClick={() => setS({ ...s, logo: undefined })}>Remove</Btn>
                  )}
                  {s.logo !== db.settings.logo && <span className="anim-pulse-soft text-[10.5px] font-semibold text-brass-600">Press “Save settings” to apply</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Company Name"><input className={inp} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} disabled={!editable} /></Field>
              <Field label="Tagline"><input className={inp} value={s.tagline} onChange={(e) => setS({ ...s, tagline: e.target.value })} disabled={!editable} /></Field>
              <Field label="Address" className="sm:col-span-2"><input className={inp} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} disabled={!editable} /></Field>
              <Field label="Phone"><input className={inp} value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} disabled={!editable} /></Field>
              <Field label="Email"><input className={inp} value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} disabled={!editable} /></Field>
              <Field label="Website"><input className={inp} value={s.website} onChange={(e) => setS({ ...s, website: e.target.value })} disabled={!editable} /></Field>
              <Field label="NTN"><input className={inp} value={s.ntn} onChange={(e) => setS({ ...s, ntn: e.target.value })} disabled={!editable} /></Field>
              <Field label="Tax Information" className="sm:col-span-2"><input className={inp} value={s.taxInfo} onChange={(e) => setS({ ...s, taxInfo: e.target.value })} disabled={!editable} /></Field>
              <Field label="Invoice Prefix"><input className={inp} value={s.invoicePrefix} onChange={(e) => setS({ ...s, invoicePrefix: e.target.value })} disabled={!editable} /></Field>
              <Field label="Quotation Prefix"><input className={inp} value={s.quotationPrefix} onChange={(e) => setS({ ...s, quotationPrefix: e.target.value })} disabled={!editable} /></Field>
              <Field label="Order Prefix"><input className={inp} value={s.orderPrefix} onChange={(e) => setS({ ...s, orderPrefix: e.target.value })} disabled={!editable} /></Field>
              <Field label="Shipment Prefix"><input className={inp} value={s.shipmentPrefix} onChange={(e) => setS({ ...s, shipmentPrefix: e.target.value })} disabled={!editable} /></Field>
            </div>
            <p className="mb-2 mt-6 text-[10.5px] font-bold uppercase tracking-[.14em] text-brass-600">Bank details — printed on every invoice</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank Name"><input className={inp} value={s.bankName} onChange={(e) => setS({ ...s, bankName: e.target.value })} disabled={!editable} placeholder="e.g. Meezan Bank — Gulberg Branch" /></Field>
              <Field label="Account Title (Company Name)"><input className={inp} value={s.accountTitle} onChange={(e) => setS({ ...s, accountTitle: e.target.value })} disabled={!editable} placeholder="e.g. Hambin International" /></Field>
              <Field label="Account Number"><input className={inp} value={s.accountNo} onChange={(e) => setS({ ...s, accountNo: e.target.value })} disabled={!editable} placeholder="e.g. 0102-8834-5512-9907" /></Field>
              <Field label="IBAN"><input className={inp} value={s.iban} onChange={(e) => setS({ ...s, iban: e.target.value })} disabled={!editable} placeholder="e.g. PK36MEZN0001020883455129" /></Field>
            </div>
            {editable && <Btn className="mt-4" onClick={() => saveSettings(s)}><Save className="h-4 w-4" />Save settings</Btn>}
          </Card>
          <div className="space-y-4">
            <Card title="Board Rates Today" sub="what new confirmations will freeze">
              <div className="space-y-2">
                {(["RMB", "USD", "EUR"] as const).map((c) => (
                  <div key={c} className="num flex items-center justify-between rounded-lg border border-paper-200 bg-white px-3.5 py-2.5">
                    <span className="text-[12px] font-bold text-ink-700">1 {c}</span>
                    <span className="text-[15px] font-bold text-brand-700">PKR {currentRate(db, c).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Card>
            {editable && (
              <Card title="Demo Data" sub="regenerate the full dataset">
                <p className="text-[12px] leading-relaxed text-ink-400">Resets every module to the seeded demo (clients, orders, shipments, ledgers…). Your session stays signed in.</p>
                <Btn variant="danger" className="mt-3 w-full" onClick={async () => { const ok = await confirm({ title: "Reset demo data?", message: "All records return to the seeded state. This cannot be undone.", danger: true, confirmLabel: "Reset everything" }); if (ok) resetDemo(); }}><RotateCcw className="h-4 w-4" />Reset demo data</Btn>
              </Card>
            )}
            <Card title="Data Backup" sub="download or restore your workspace">
              <p className="text-[12px] leading-relaxed text-ink-400">
                All records are saved in realtime to Supabase cloud (with auto-version history inside Supabase).
                For extra safety, download a periodic .json backup &amp; import it to restore everything — clients,
                orders, shipments, ledgers &amp; settings.
              </p>
              <div className="mt-3 grid gap-2">
                <Btn variant="dark" className="w-full" onClick={exportBackup}><Download className="h-4 w-4" />Download backup (.json)</Btn>
                <label className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-semibold text-ink-700 transition-all hover:border-brand-500 hover:text-brand-700 ${!editable ? "pointer-events-none opacity-50" : ""}`}>
                  <Upload className="h-4 w-4" />Import backup
                  <input type="file" hidden accept="application/json,.json" onChange={importBackup} />
                </label>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "rates" && (
        <Card pad={false} title="Exchange Rate History" sub="new dated rates apply forward only — confirmed orders keep their snapshot"
          actions={editable ? <Btn size="sm" onClick={() => setRateForm({ id: uid("fx"), currency: "RMB", rateToPkr: currentRate(db, "RMB"), effectiveDate: todayISO(), source: "Open market", notes: "" })}><Plus className="h-4 w-4" />Publish rate</Btn> : undefined}>
          <div className="grid gap-2.5 border-b border-paper-200 p-4 sm:grid-cols-3">
            {(["RMB", "USD", "EUR"] as const).map((c) => {
              const list = rates.filter((r) => r.currency === c);
              const cur = list.find((r) => r.effectiveDate <= todayISO()) ?? list[0];
              const prev = list[list.indexOf(cur) + 1];
              const delta = prev ? cur.rateToPkr - prev.rateToPkr : 0;
              return (
                <div key={c} className="rounded-xl border border-ink-800 bg-ink-900 p-3.5">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[10.5px] font-bold uppercase tracking-[.16em] text-ink-400">{c} → PKR</p>
                    <span className={`num text-[10.5px] font-bold ${delta >= 0 ? "text-ok-100" : "text-bad-100"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}</span>
                  </div>
                  <p className="num mt-1 text-[22px] font-bold text-brass-300">{cur?.rateToPkr.toFixed(2) ?? "—"}</p>
                  <p className="num text-[10px] text-ink-400">effective {cur ? fmtDate(cur.effectiveDate) : "—"} · {cur?.source}</p>
                </div>
              );
            })}
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>Currency</th><th className="text-right">Rate (PKR)</th><th>Effective</th><th>Source</th><th>Notes</th>{editable && <th></th>}</tr></thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}>
                    <td className="font-bold text-ink-800">{r.currency}</td>
                    <td className="num text-right font-semibold text-brand-700">{r.rateToPkr.toFixed(2)}</td>
                    <td className="num">{fmtDate(r.effectiveDate)}{r.effectiveDate <= todayISO() && !rates.some((x) => x.currency === r.currency && x.effectiveDate <= todayISO() && x.effectiveDate > r.effectiveDate) && <span className="ml-1.5 rounded bg-ok-100 px-1.5 text-[9.5px] font-bold text-ok-600">ACTIVE</span>}</td>
                    <td className="text-[12px]">{r.source}</td>
                    <td className="text-[11.5px] text-ink-400">{r.notes ?? "—"}</td>
                    {editable && <td><Btn size="sm" variant="ghost" className="hover:text-bad-600" onClick={async () => { const ok = await confirm({ title: "Remove rate entry?", message: `1 ${r.currency} = ${r.rateToPkr} (${fmtDate(r.effectiveDate)}) will be removed. Order snapshots are unaffected.`, danger: true, confirmLabel: "Remove" }); if (ok) deleteRate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Btn></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="num border-t border-paper-200 px-4 py-2.5 text-[10.5px] text-ink-400">Rule: historical records never re-price. Each order stores {`{ rmb, usd, eur }`} at confirmation; profit reports read the snapshot, not this table.</p>
        </Card>
      )}

      {tab === "users" && (
        <Card pad={false} title="Users & Role-Based Access" sub="granular module permissions enforced across the UI and every store action"
          actions={editable ? <Btn size="sm" onClick={() => setUserForm({ id: "", name: "", email: "", password: "hambin123", role: "sales", active: true })}><Plus className="h-4 w-4" />Add user</Btn> : undefined}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>User</th><th>Role</th><th>Phone</th><th>Last login</th><th>Status</th>{editable && <th className="text-right">Actions</th>}</tr></thead>
              <tbody>
                {db.users.map((u) => (
                  <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                    <td><p className="font-semibold text-ink-900">{u.name}{u.id === user?.id && <span className="ml-1.5 rounded bg-brass-100 px-1.5 text-[9.5px] font-bold text-brass-600">YOU</span>}</p><p className="num text-[10.5px] text-ink-400">{u.email}</p></td>
                    <td><Pill label={ROLE_LABEL[u.role]} tone={u.role === "superadmin" ? "pine" : u.role === "finance" ? "brass" : u.role === "sales" ? "info" : "muted"} /></td>
                    <td className="num text-[12px]">{u.phone ?? "—"}</td>
                    <td className="num text-[11.5px]">{u.lastLogin ? fmtDateTime(u.lastLogin) : "never"}</td>
                    <td><Pill label={u.active ? "active" : "inactive"} /></td>
                    {editable && (
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Btn size="sm" variant="ghost" onClick={() => setUserForm({ ...u })}><Users2 className="h-3.5 w-3.5" /></Btn>
                          {u.id !== user?.id && <Btn size="sm" variant="ghost" className={u.active ? "hover:text-bad-600" : "hover:text-ok-600"} onClick={() => setUserActive(u.id, !u.active)}>{u.active ? "Deactivate" : "Activate"}</Btn>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "audit" && (
        <Card pad={false} title="Audit Log" sub="every financial action, rate change and status move"
          actions={<div className="w-56"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Filter actions…" /></div>}>
          <div className="overflow-x-auto scroll-thin">
            <table className="hk-table w-full">
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Module</th><th>Ref</th><th>Detail</th><th>IP</th></tr></thead>
              <tbody>
                {pg.rows.map((a) => (
                  <tr key={a.id}>
                    <td className="num whitespace-nowrap text-[11.5px]">{fmtDateTime(a.at)}</td>
                    <td className="font-semibold text-ink-800">{a.userName}</td>
                    <td><Pill label={a.action} tone={/void|cancel|delet|remov/i.test(a.action) ? "bad" : /payment|invoice|confirm/i.test(a.action) ? "ok" : "info"} /></td>
                    <td className="text-[12px]">{a.module}</td>
                    <td className="num text-[11.5px] text-brass-600">{a.refId}</td>
                    <td className="max-w-[280px] truncate text-[11.5px] text-ink-500" title={a.detail}>{a.detail}</td>
                    <td className="num text-[11px] text-ink-300">{a.ip}</td>
                  </tr>
                ))}
                {pg.rows.length === 0 && <tr><td colSpan={7} className="py-8"><Empty title="No audit entries match" /></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="border-t border-paper-200 px-3 py-2"><Pager page={page} pages={pg.pages} onPage={setPage} total={audits.length} label="entries" /></div>
        </Card>
      )}

      {tab === "blueprint" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <Card title="Database Blueprint" sub="the normalized MySQL schema this product mirrors — every money column DECIMAL(18,2)">
            <div className="grid gap-2 sm:grid-cols-2">
              {SCHEMA.map((t) => (
                <div key={t.table} className="rounded-lg border border-paper-200 bg-white px-3.5 py-2.5 transition-shadow hover:shadow-md">
                  <p className="num text-[12px] font-bold text-brand-700">{t.table}</p>
                  <p className="text-[11px] text-ink-400">{t.note}</p>
                </div>
              ))}
            </div>
            <SectionLabel>Financial invariants</SectionLabel>
            <ul className="grid gap-1.5 text-[12px] text-ink-500 sm:grid-cols-2">
              {[
                "No FLOAT/DOUBLE for money — DECIMAL(18,2) semantics",
                "Transactions wrap invoice, payment & ledger posting",
                "Confirmed orders store rate + cost snapshots",
                "Ledgers are void/reverse — never hard-deleted",
                "Client-side math is preview only; saves re-validate",
                "Indexed lookups on code, date, status, party IDs",
              ].map((t) => <li key={t} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-brass-500" />{t}</li>)}
            </ul>
          </Card>
          <Card title="Costing Engine Flow" sub="single source of truth">
            <div className="space-y-1.5">
              {["CostingController", "CostingService", "ExchangeRateService", "Calculation (DECIMAL math)", "Snapshot → order_items", "Profit reports read snapshot"].map((t, i2) => (
                <div key={t}>
                  <div className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${i2 === 1 ? "border-brand-600 bg-brand-600 text-white" : i2 === 4 ? "border-brass-400 bg-brass-100 text-brass-600" : "border-paper-200 bg-white text-ink-600"}`}>
                    <span className="num mr-2 text-[10px] opacity-60">{String(i2 + 1).padStart(2, "0")}</span>{t}
                  </div>
                  {i2 < 5 && <p className="pl-6 text-[13px] leading-4 text-ink-300">↓</p>}
                </div>
              ))}
            </div>
            <p className="num mt-3 flex items-center gap-1.5 rounded-lg bg-paper-200/70 px-3 py-2 text-[10.5px] text-ink-400"><Lock className="h-3.5 w-3.5" />Verified: 100 × RMB 50 × 39.50 = PKR 197,500 → landed 262,500 → SP 308,823.53</p>
          </Card>
        </div>
      )}

      {tab === "deploy" && <DeployGuide />}

      {/* rate modal */}
      <Modal open={!!rateForm} onClose={() => setRateForm(null)} title="Publish Exchange Rate" sub="applies to new records from the effective date forward"
        footer={<><Btn variant="outline" onClick={() => setRateForm(null)}>Cancel</Btn><Btn onClick={() => { if (rateForm && rateForm.rateToPkr > 0) { saveRate(rateForm); setRateForm(null); } else toast("Rate must be greater than zero.", "error"); }}>Publish</Btn></>}>
        {rateForm && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Currency"><CurrencySelector value={rateForm.currency} onChange={(c) => setRateForm({ ...rateForm, currency: c as Exclude<Currency, "PKR"> })} /></Field>
            <Field label="Rate (1 unit → PKR)"><input type="number" step="0.01" className={`${inp} num text-right`} value={rateForm.rateToPkr || ""} onChange={(e) => setRateForm({ ...rateForm, rateToPkr: Number(e.target.value) || 0 })} /></Field>
            <Field label="Effective Date"><input type="date" className={inp} value={rateForm.effectiveDate} onChange={(e) => setRateForm({ ...rateForm, effectiveDate: e.target.value })} /></Field>
            <Field label="Source"><input className={inp} value={rateForm.source} onChange={(e) => setRateForm({ ...rateForm, source: e.target.value })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><input className={inp} value={rateForm.notes ?? ""} onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* user modal */}
      <Modal open={!!userForm} onClose={() => setUserForm(null)} title={userForm?.id ? `Edit ${userForm.name}` : "Add User"}
        footer={<><Btn variant="outline" onClick={() => setUserForm(null)}>Cancel</Btn><Btn onClick={() => { if (userForm && userForm.name.trim() && /^\S+@\S+\.\S+$/.test(userForm.email) && userForm.password.length >= 6) { saveUser(userForm); setUserForm(null); } else toast("Name, valid email and 6+ char password required.", "error"); }}>Save user</Btn></>}>
        {userForm && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Full Name"><input className={inp} value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></Field>
            <Field label="Email"><input className={inp} value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></Field>
            <Field label="Password" hint="stored hashed in production"><input className={inp} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></Field>
            <Field label="Role"><select className={inp} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <Field label="Phone"><input className={inp} value={userForm.phone ?? ""} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} /></Field>
            <Field label="Status"><select className={inp} value={userForm.active ? "active" : "inactive"} onChange={(e) => setUserForm({ ...userForm, active: e.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
