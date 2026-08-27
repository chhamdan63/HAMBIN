import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { StoreProvider, useStore, SUPABASE_STATE_ID } from "./lib/store";
import { supabase } from "./lib/supabase";
import { buildSeed } from "./lib/seed";
import { ConfirmHost, ToastHost } from "./components/ui";
import { Shell } from "./components/shell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import Sourcing from "./pages/Sourcing";
import Costing from "./pages/Costing";
import Quotations from "./pages/Quotations";
import Orders from "./pages/Orders";
import Shipments from "./pages/Shipments";
import Finance from "./pages/Finance";
import Invoices from "./pages/Invoices";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function Router() {
  const { user, route } = useStore();
  if (!user) return <Login />;
  switch (route.page) {
    case "clients": return <Clients />;
    case "suppliers": return <Suppliers />;
    case "products": return <Products />;
    case "sourcing": return <Sourcing />;
    case "costing": return <Costing />;
    case "quotations": return <Quotations />;
    case "orders": return <Orders />;
    case "shipments": return <Shipments />;
    case "finance": return <Finance />;
    case "invoices": return <Invoices />;
    case "reports": return <Reports />;
    case "settings": return <Settings />;
    default: return <Dashboard />;
  }
}

function Root() {
  const { user } = useStore();
  return user ? (
    <Shell>
      <Router />
    </Shell>
  ) : (
    <Login />
  );
}

/** Safety net: a render crash shows a recovery screen instead of a blank page. */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Hambin ERP render error:", error, info.componentStack); }
  reset = async () => {
    try {
      const seed = buildSeed();
      await supabase
        .from("hambin_state")
        .upsert(
          { id: SUPABASE_STATE_ID, data: seed as any, schema_version: 4 },
          { onConflict: "id" }
        );
    } catch { /* noop */ }
    window.location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="paper-grid flex min-h-screen items-center justify-center bg-paper-100 p-6">
        <div className="w-full max-w-md rounded-xl border border-paper-300 bg-white p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-bad-100 text-bad-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            </span>
            <div>
              <p className="disp text-[16px] font-bold text-ink-900">Ledger jammed</p>
              <p className="text-[12px] text-ink-400">The interface hit an unexpected error.</p>
            </div>
          </div>
          <pre className="num mt-4 max-h-24 overflow-auto rounded-lg bg-paper-100 p-3 text-[11px] leading-relaxed text-bad-600 scroll-thin">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
            This is usually caused by corrupted data from an earlier build. Resetting regenerates the
            clean production dataset &amp; restarts your session at the login screen.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={this.reset} className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-brand-700 active:scale-[.97]">
              Reset dataset &amp; reload
            </button>
            <button onClick={() => window.location.reload()} className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:border-brand-500">
              Just reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <Boundary>
      <StoreProvider>
        <Root />
        <ToastHost />
        <ConfirmHost />
      </StoreProvider>
    </Boundary>
  );
}
