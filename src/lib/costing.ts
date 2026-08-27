/* ------------------------------------------------------------------ */
/*  CostingService — single source of truth for all costing math.      */
/*                                                                     */
/*  Equivalent of app/Services/CostingService.php in the Laravel       */
/*  blueprint. Used by: Cost Calculator, Quotations, Orders,           */
/*  Profit Reports. Never recalculated from master data after an       */
/*  order is confirmed — the LandedSnapshot is stored immutably.       */
/* ------------------------------------------------------------------ */

import { add, divSafe, mul, r2, sub } from "./money";
import type { Currency, LandedSnapshot } from "./types";

export interface CostingInput {
  qty: number;
  unitPrice: number;
  currency: Currency;
  rateToPkr: number;              // snapshot rate for the purchase currency
  /* China costs (PKR) */
  chinaInland: number;
  warehouse: number;
  loading: number;
  packaging: number;
  inspection: number;
  otherChina: number;
  /* International freight */
  freightMode: "air" | "sea";
  weightKg: number;
  cbm: number;
  airRatePerKg: number;           // PKR per KG
  seaRatePerCbm: number;          // PKR per CBM
  containerCharge: number;        // flat container charges (sea)
  /* Pakistan costs (PKR) */
  customsDuty: number;
  salesTax: number;
  regulatoryDuty: number;
  additionalDuty: number;
  clearance: number;
  portCharges: number;
  documentation: number;
  localTransport: number;
  delivery: number;
  /* Other costs (PKR) */
  insurance: number;
  bankCharges: number;
  commission: number;
  misc: number;
  /* Pricing */
  pricingMethod: "margin" | "fixed";
  pricingValue: number;           // margin % or fixed profit PKR
}

export interface CostingResult extends LandedSnapshot {
  dutyTotalLabel: string;
}

const n = (v: number | undefined | null): number => (isFinite(v as number) ? r2(v || 0) : 0);

/* Base Product Cost = Quantity × Unit Purchase Price × Exchange Rate */
export const calculateProductCost = (qty: number, unitPrice: number, rateToPkr: number): number =>
  mul(mul(qty, unitPrice), rateToPkr);

/* Air: Weight × Air Freight Rate · Sea: CBM × Sea Rate + Container charges */
export const calculateFreight = (
  mode: "air" | "sea", weightKg: number, airRate: number, cbm: number, seaRate: number, containerCharge: number
): number =>
  mode === "air" ? mul(weightKg, airRate) : add(mul(cbm, seaRate), containerCharge);

/* Selling Price — Percentage Margin: SP = Landed / (1 − margin)
   Selling Price — Fixed Profit:     SP = Landed + profit           */
export const calculateSellingPrice = (landedCost: number, method: "margin" | "fixed", value: number): number => {
  if (method === "fixed") return add(landedCost, value);
  const m = Math.min(Math.max(value, 0), 95) / 100;
  return r2(landedCost / (1 - m));
};

export function calculateLanded(i: CostingInput): CostingResult {
  const qty = Math.max(0, n(i.qty));
  const rate = n(i.rateToPkr);

  const productCostPkr = calculateProductCost(qty, n(i.unitPrice), i.currency === "PKR" ? 1 : rate);

  const chinaInland = n(i.chinaInland), warehouse = n(i.warehouse), loading = n(i.loading),
    packaging = n(i.packaging), inspection = n(i.inspection), otherChina = n(i.otherChina);
  const chinaTotal = add(chinaInland, warehouse, loading, packaging, inspection, otherChina);

  const weightKg = n(i.weightKg), cbm = n(i.cbm),
    airRatePerKg = n(i.airRatePerKg), seaRatePerCbm = n(i.seaRatePerCbm), containerCharge = n(i.containerCharge);
  const intlFreightPkr = calculateFreight(i.freightMode, weightKg, airRatePerKg, cbm, seaRatePerCbm, containerCharge);

  const customsDuty = n(i.customsDuty), salesTax = n(i.salesTax),
    regulatoryDuty = n(i.regulatoryDuty), additionalDuty = n(i.additionalDuty);
  const customsTotal = add(customsDuty, salesTax, regulatoryDuty, additionalDuty);

  const clearance = n(i.clearance), portCharges = n(i.portCharges), documentation = n(i.documentation);
  const clearanceTotal = add(clearance, portCharges, documentation);

  const localTransport = n(i.localTransport), delivery = n(i.delivery);
  const localTotal = add(localTransport, delivery);

  const insurance = n(i.insurance), bankCharges = n(i.bankCharges),
    commission = n(i.commission), misc = n(i.misc);
  const otherTotal = add(insurance, bankCharges, commission, misc);

  /* Total Landed Cost = Product + China + Intl Freight + Customs + Taxes
     + Clearance + Port + Local Transport + Insurance + Other costs      */
  const landedCostPkr = add(productCostPkr, chinaTotal, intlFreightPkr, customsTotal, clearanceTotal, localTotal, otherTotal);
  const unitLandedPkr = qty > 0 ? r2(divSafe(landedCostPkr, qty)) : 0;

  const sellingPricePkr = calculateSellingPrice(landedCostPkr, i.pricingMethod, n(i.pricingValue));
  const unitSellingPkr = qty > 0 ? r2(divSafe(sellingPricePkr, qty)) : 0;
  const grossProfitPkr = sub(sellingPricePkr, landedCostPkr);
  const profitPct = sellingPricePkr > 0 ? r2(divSafe(grossProfitPkr, sellingPricePkr) * 100) : 0;

  return {
    qty, unitPrice: n(i.unitPrice), currency: i.currency, rateToPkr: rate,
    productCostPkr,
    chinaInland, warehouse, loading, packaging, inspection, otherChina, chinaTotal,
    freightMode: i.freightMode, weightKg, cbm, airRatePerKg, seaRatePerCbm, containerCharge, intlFreightPkr,
    customsDuty, salesTax, regulatoryDuty, additionalDuty, customsTotal,
    clearance, portCharges, documentation, clearanceTotal,
    localTransport, delivery, localTotal,
    insurance, bankCharges, commission, misc, otherTotal,
    landedCostPkr, unitLandedPkr,
    pricingMethod: i.pricingMethod, pricingValue: n(i.pricingValue),
    sellingPricePkr, unitSellingPkr,
    grossProfitPkr, profitPct,
    dutyTotalLabel: "Customs + Taxes",
  };
}

/* Net profit = Gross profit − allocated overhead (expenses ∝ revenue share) */
export const allocateOverhead = (grossProfit: number, totalExpenses: number, revenue: number, totalRevenue: number): number => {
  if (totalRevenue <= 0) return sub(grossProfit, totalExpenses);
  const share = r2(totalExpenses * divSafe(revenue, totalRevenue));
  return sub(grossProfit, share);
};

/* ---------------- reference formulas (shown in UI) ---------------- */

export const FORMULAS: { title: string; body: string }[] = [
  { title: "Currency Conversion", body: "Product Cost (PKR) = Qty × Unit Price × Rate\ne.g. 100 × RMB 50 × 39.50 = PKR 197,500" },
  { title: "Air Freight", body: "Intl Freight = Chargeable Weight (KG) × Air Rate per KG" },
  { title: "Sea Freight", body: "Intl Freight = CBM × Sea Rate per CBM + Container Charges" },
  { title: "Total Landed Cost", body: "Product Cost + China Costs + Intl Freight + Customs Duty + Taxes + Clearance + Port + Local Transport + Insurance + Other Costs" },
  { title: "Percentage Margin", body: "Selling Price = Landed Cost ÷ (1 − Margin %)\ne.g. 800,000 ÷ (1 − 0.15) = 941,176" },
  { title: "Fixed Profit", body: "Selling Price = Landed Cost + Desired Profit\ne.g. 800,000 + 120,000 = 920,000" },
  { title: "Gross Profit", body: "Gross Profit = Selling Price − Total Landed Cost" },
  { title: "Net Profit", body: "Net Profit = Gross Profit − Allocated Business Overhead" },
];

/* The worked example from the master spec — verified in tests */
export const SPEC_EXAMPLE: CostingInput = {
  qty: 100, unitPrice: 50, currency: "RMB", rateToPkr: 39.5,
  chinaInland: 10000, warehouse: 0, loading: 0, packaging: 0, inspection: 0, otherChina: 0,
  freightMode: "sea", weightKg: 0, cbm: 0, airRatePerKg: 0, seaRatePerCbm: 0, containerCharge: 0,
  customsDuty: 15000, salesTax: 10000, regulatoryDuty: 0, additionalDuty: 0,
  clearance: 5000, portCharges: 0, documentation: 0,
  localTransport: 0, delivery: 8000,
  insurance: 0, bankCharges: 0, commission: 0, misc: 2000,
  pricingMethod: "margin", pricingValue: 15,
};
/* Expected: product cost 197,500 · landed 262,500 · SP 308,823.53 · GP 46,323.53 · 15% */
