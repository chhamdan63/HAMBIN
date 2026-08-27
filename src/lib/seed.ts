/* ------------------------------------------------------------------ */
/*  Hambin ERP — clean production seed                                  */
/*  صرف system users اور base config — کوئی demo data نہیں             */
/* ------------------------------------------------------------------ */

import { r2, daysAgo, uid } from "./money";
import type {
  AuditEntry, Category, CompanySettings, DB, ExchangeRate, User,
} from "./types";

export function buildSeed(): DB {
  /* ---------------- users (صرف 2) ---------------- */
  const users: User[] = [
    {
      id: "u1",
      name: "Admin",
      email: "admin@hambin.com",
      password: "hambin2024",
      role: "admin",
      active: true,
      phone: "",
      lastLogin: undefined,
    },
    {
      id: "u2",
      name: "Developer",
      email: "dev@hambin.com",
      password: "devpass2024",
      role: "superadmin",
      active: true,
      phone: "",
      lastLogin: undefined,
    },
  ];

  /* ---------------- product categories ---------------- */
  const categories: Category[] = [
    { id: "cat1", name: "Electrical & Lighting" },
    { id: "cat2", name: "Solar & Energy" },
    { id: "cat3", name: "Tools & Hardware" },
    { id: "cat4", name: "Home Appliances" },
  ];

  /* ---------------- exchange rates (current market) ---------------- */
  const exchangeRates: ExchangeRate[] = [
    { id: uid("fx"), currency: "RMB", rateToPkr: 39.8, effectiveDate: daysAgo(0), source: "Open market" },
    { id: uid("fx"), currency: "USD", rateToPkr: 280.0, effectiveDate: daysAgo(0), source: "Interbank" },
    { id: uid("fx"), currency: "EUR", rateToPkr: 302.75, effectiveDate: daysAgo(0), source: "ECB cross" },
  ];

  /* ---------------- company settings ---------------- */
  const settings: CompanySettings = {
    name: "Hambin International",
    tagline: "Trading & Consultancy",
    address: "Suite 14, 2nd Floor, Al-Habib Tower, Gulberg III, Lahore, Pakistan",
    phone: "+92 42 3575 8890",
    email: "info@hambinintl.com",
    website: "www.hambinintl.com",
    ntn: "NTN 4471820-6",
    taxInfo: "Sales Tax Reg. No. 25-77-8812-041-99 · PRA registered",
    invoicePrefix: "HITC-INV",
    quotationPrefix: "HITC-QT",
    orderPrefix: "HITC-ORD",
    shipmentPrefix: "HITC-SHP",
    currency: "PKR",
    bankName: "Meezan Bank — Gulberg III Branch, Lahore",
    accountTitle: "Hambin International Trading & Consultancy",
    accountNo: "0102-8834-5512-9907",
    iban: "PK36 MEZN 0001 0208 8345 5129",
  };

  /* ---------------- initial audit entry ---------------- */
  const audit: AuditEntry[] = [
    {
      id: uid("a"),
      at: new Date().toISOString(),
      userId: "u2",
      userName: "Developer",
      action: "System initialized",
      module: "System",
      refId: "INIT",
      detail: "Fresh production database initialized.",
      ip: "127.0.0.1",
    },
  ];

  return {
    users,
    sessionId: null,
    clients: [],
    suppliers: [],
    categories,
    products: [],
    sourcingRequests: [],
    supplierQuotes: [],
    exchangeRates,
    quotations: [],
    orders: [],
    shipments: [],
    payments: [],
    expenses: [],
    invoices: [],
    adjustments: [],
    audit,
    notices: [],
    settings,
    seq: {
      order: 0, invoice: 0, payment: 0, expense: 0,
      quotation: 0, sourcing: 0, shipment: 0, quote: 0, adjustment: 0,
      client: 0, supplier: 0, product: 0,
    },
  } as DB;
}

/* Expense categories — used across Finance page */
export const EXPENSE_CATEGORIES = [
  "Office Rent", "Salaries", "Utilities", "Internet", "Software",
  "Marketing", "Transport", "Bank Charges", "Freight", "Customs", "Miscellaneous",
];

export const _seedInternal = { expenseCategories: EXPENSE_CATEGORIES };

/* keep r2 referenced to avoid unused-import warning */
const _r2 = r2;
void _r2;
