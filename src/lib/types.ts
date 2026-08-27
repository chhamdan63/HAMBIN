/* ------------------------------------------------------------------ */
/*  Hambin ERP — domain model                                          */
/*  Mirrors the MySQL schema documented in Settings → Data Blueprint   */
/* ------------------------------------------------------------------ */

export type Role = "superadmin" | "admin" | "sales" | "finance" | "viewer";
export type Currency = "PKR" | "RMB" | "USD" | "EUR";

export interface User {
  id: string; name: string; email: string; password: string;
  role: Role; active: boolean; phone?: string; lastLogin?: string;
}

export interface Client {
  id: string; code: string; company: string; contactPerson: string;
  phone: string; whatsapp?: string; email: string; cnicNtn?: string;
  address: string; city: string; province: string; country: string;
  currency: Currency; paymentTerms: string; creditLimit: number;
  openingBalance: number; status: "active" | "inactive"; notes?: string; createdAt: string;
}

export interface Supplier {
  id: string; code: string; name: string; contactPerson: string;
  phone: string; wechat?: string; whatsapp?: string; email: string;
  country: string; province: string; city: string; warehouseAddress?: string;
  categories: string[]; paymentTerms: string; currency: Currency;
  bankInfo?: string; status: "active" | "inactive"; notes?: string; createdAt: string;
}

export interface Category { id: string; name: string; }

export interface PricePoint { date: string; supplierId: string; currency: Exclude<Currency, "PKR">; amount: number; }

export interface Product {
  id: string; sku: string; name: string; chineseName?: string;
  category: string; subcategory?: string; description?: string; spec?: string;
  unit: string; defaultSupplierId: string; defaultCurrency: Exclude<Currency, "PKR">; defaultPrice: number;
  weightKg: number; cbm: number; hsCode: string; customsCategory: string;
  notes?: string; status: "active" | "inactive"; priceHistory: PricePoint[]; createdAt: string;
}

export type SourcingStatus =
  | "New" | "Searching" | "Supplier Found" | "Quotation Received"
  | "Client Quotation Prepared" | "Approved" | "Rejected" | "Converted to Order";

export interface SourcingRequest {
  id: string; number: string; clientId: string; productId: string; qty: number;
  spec?: string; targetPricePkr?: number; targetDate?: string; notes?: string;
  agentId: string; status: SourcingStatus; createdAt: string;
}

export interface SupplierQuote {
  id: string; number: string; requestId?: string; supplierId: string; productId: string;
  qty: number; unitPrice: number; currency: Exclude<Currency, "PKR">;
  moq: number; terms?: string; leadTimeDays: number; packagingCost: number;
  chinaFreight: number; validUntil: string; notes?: string; createdAt: string;
}

export interface ExchangeRate {
  id: string; currency: Exclude<Currency, "PKR">; rateToPkr: number;
  effectiveDate: string; source: string; notes?: string;
}

/* ---------------- costing snapshot (immutable on orders) ---------- */
export interface LandedSnapshot {
  qty: number; unitPrice: number; currency: Currency; rateToPkr: number;
  productCostPkr: number;
  chinaInland: number; warehouse: number; loading: number; packaging: number;
  inspection: number; otherChina: number; chinaTotal: number;
  freightMode: "air" | "sea"; weightKg: number; cbm: number;
  airRatePerKg: number; seaRatePerCbm: number; containerCharge: number; intlFreightPkr: number;
  customsDuty: number; salesTax: number; regulatoryDuty: number; additionalDuty: number; customsTotal: number;
  clearance: number; portCharges: number; documentation: number; clearanceTotal: number;
  localTransport: number; delivery: number; localTotal: number;
  insurance: number; bankCharges: number; commission: number; misc: number; otherTotal: number;
  landedCostPkr: number; unitLandedPkr: number;
  pricingMethod: "margin" | "fixed"; pricingValue: number;
  sellingPricePkr: number; unitSellingPkr: number;
  grossProfitPkr: number; profitPct: number;
}

export type QuotationStatus =
  | "Draft" | "Sent" | "Viewed" | "Accepted" | "Rejected" | "Expired" | "Converted to Order";

export interface QuotationItem {
  productId: string; description: string; qty: number;
  snapshot: LandedSnapshot;
}

export interface Quotation {
  id: string; number: string; clientId: string; date: string; validUntil: string;
  items: QuotationItem[]; discountPkr: number;
  paymentTerms: string; deliveryTerms: string; notes?: string;
  status: QuotationStatus; createdAt: string;
}

export type OrderStatus =
  | "Draft" | "Confirmed" | "Supplier Ordered" | "China Warehouse" | "Ready for Shipment"
  | "In Transit" | "Customs" | "Delivered" | "Completed" | "Cancelled";

export interface OrderItem {
  id: string; productId: string; supplierId: string;
  hsCode: string; snapshot: LandedSnapshot;
}

export interface Order {
  id: string; number: string; clientId: string; quotationId?: string;
  date: string; currency: Currency; rateSnapshot: { rmb: number; usd: number; eur: number; [k: string]: number };
  paymentTerms: string; advanceRequiredPct: number;
  status: OrderStatus; items: OrderItem[]; notes?: string; createdAt: string;
}

export type ShipmentStatus =
  | "Preparing" | "Warehouse" | "Booked" | "In Transit" | "Arrived"
  | "Customs" | "Cleared" | "Out for Delivery" | "Delivered";

export interface ShipmentDoc {
  id: string; name: string; kind: string; size: string; uploadedAt: string; by: string;
}

export interface Shipment {
  id: string; number: string; orderIds: string[]; method: "Air" | "Sea";
  origin: string; destination: string; forwarder: string; trackingNo?: string;
  currentLocation: string; status: ShipmentStatus;
  air?: { awb: string; airline: string; flight: string; departure: string; arrival: string; weightKg: number; freightRate: number };
  sea?: { containerNo: string; containerType: string; bl: string; vessel: string; voyage: string; etd: string; eta: string; port: string; cbm: number; weightKg: number };
  docs: ShipmentDoc[];
  timeline: { at: string; label: string; note?: string }[];
  createdAt: string;
}

export type PaymentType =
  | "Client Advance" | "Client Partial" | "Client Final" | "Supplier Payment" | "Expense Payment" | "Refund";
export type PaymentMethod = "Cash" | "Bank Transfer" | "Online Transfer" | "Other";

export interface Payment {
  id: string; number: string; date: string; type: PaymentType;
  partyKind: "client" | "supplier"; partyId: string;
  invoiceId?: string; orderId?: string;
  amount: number; currency: Currency; rateToPkr: number; amountPkr: number;
  method: PaymentMethod; reference?: string; notes?: string;
  void: boolean; createdAt: string; createdBy: string;
}

export interface Expense {
  id: string; number: string; date: string; category: string; description: string;
  amount: number; currency: Currency; rateToPkr: number; amountPkr: number;
  method: PaymentMethod; orderId?: string; attachment?: string; notes?: string; createdAt: string;
}

export interface InvoiceItem { description: string; qty: number; unitPrice: number; amount: number; }

export interface Invoice {
  id: string; number: string; orderId: string; clientId: string;
  date: string; dueDate: string; items: InvoiceItem[];
  subtotalPkr: number; freightPkr: number; customsPkr: number; taxPkr: number; discountPkr: number;
  grandTotalPkr: number; notes?: string;
  void: boolean; createdAt: string; createdBy: string;
}

export interface LedgerAdjustment {
  id: string; date: string; partyKind: "client" | "supplier"; partyId: string;
  description: string; debitPkr: number; creditPkr: number; createdAt: string; createdBy: string;
}

export interface AuditEntry {
  id: string; at: string; userId: string; userName: string;
  action: string; module: string; refId: string; detail: string; ip: string;
}

export interface Notice {
  id: string; at: string; kind: "order" | "payment" | "shipment" | "sourcing" | "invoice" | "system";
  title: string; body: string; read: boolean;
}

export interface CompanySettings {
  name: string; tagline: string; address: string; phone: string; email: string;
  website: string; ntn: string; taxInfo: string;
  invoicePrefix: string; quotationPrefix: string; orderPrefix: string; shipmentPrefix: string;
  currency: Currency;
  bankName: string; accountTitle: string; accountNo: string; iban: string;
  logo?: string; /* data-URL of the uploaded business logo (PNG/JPG/SVG/WebP) */
}

export interface DB {
  users: User[]; sessionId: string | null;
  clients: Client[]; suppliers: Supplier[]; categories: Category[]; products: Product[];
  sourcingRequests: SourcingRequest[]; supplierQuotes: SupplierQuote[];
  exchangeRates: ExchangeRate[];
  quotations: Quotation[]; orders: Order[]; shipments: Shipment[];
  payments: Payment[]; expenses: Expense[]; invoices: Invoice[];
  adjustments: LedgerAdjustment[];
  audit: AuditEntry[]; notices: Notice[];
  settings: CompanySettings;
  seq: Record<string, number>;
}
