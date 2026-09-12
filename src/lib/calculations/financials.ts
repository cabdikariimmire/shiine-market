import { CartItem, SaleItem } from '@/types';
import { calculateSosDenomination } from './denominations';

/**
 * Rounds a monetary amount to 2 decimal places safely, avoiding IEEE 754 floating-point under-rounding.
 */
export function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates item subtotal, total price, and gross profit for a single cart line item.
 * Supports per-item discount, decimal quantities (e.g. 1.25 kg), and denomination mode.
 */
export function calculateCartItemLine(
  unitPrice: number,
  unitCost: number,
  quantity: number,
  itemDiscount: number = 0,
  pricingMode: 'fixed' | 'denomination' = 'fixed',
  sosPrice: number = 0
): { 
  totalPrice: number; 
  grossProfit: number; 
  totalCost: number;
  sosTotal?: number;
  denominationUsd?: number;
  differenceSos?: number;
} {
  const safeQty = Math.max(0, quantity);
  const safeUnitPrice = Math.max(0, unitPrice);
  const safeCost = Math.max(0, unitCost);

  if (pricingMode === 'denomination' && sosPrice > 0) {
    const sosTotal = Math.round(sosPrice * safeQty);
    const denom = calculateSosDenomination(sosTotal);
    const rawLineTotal = denom.denominationUsd;
    const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));
    const totalPrice = roundToCents(rawLineTotal - safeDiscount);
    const totalCost = roundToCents(safeCost * safeQty);
    const grossProfit = roundToCents(totalPrice - totalCost);

    return { 
      totalPrice, 
      grossProfit, 
      totalCost, 
      sosTotal, 
      denominationUsd: denom.denominationUsd,
      differenceSos: denom.differenceSos
    };
  }

  const rawLineTotal = roundToCents(safeUnitPrice * safeQty);
  const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));

  const totalPrice = roundToCents(rawLineTotal - safeDiscount);
  const totalCost = roundToCents(safeCost * safeQty);
  const grossProfit = roundToCents(totalPrice - totalCost);

  return { totalPrice, grossProfit, totalCost };
}

export interface SaleTotalCalculation {
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  costAmount: number;
  grossProfit: number;
  // Denomination details
  hasDenominationItems: boolean;
  totalSos: number;
  denominationSos: number;
  denominationUsd: number;
  differenceSos: number;
  fixedSubtotal: number;
}

/**
 * Calculates complete POS sale totals with per-item discounts and overall sale discount.
 * Ensures profit is calculated strictly against actual final revenue.
 * Computes fixed USD items and denomination SOS items independently.
 */
export function calculateSaleTotal(
  items: CartItem[] | SaleItem[],
  wholeSaleDiscount: number = 0
): SaleTotalCalculation {
  let fixedSubtotal = 0;
  let totalSos = 0;
  let itemDiscounts = 0;
  let costAmount = 0;

  for (const item of items) {
    const qty = item.quantity || 0;
    const price = 'unitPrice' in item ? item.unitPrice : item.unit_price;
    const cost = 'unitCost' in item ? item.unitCost : item.unit_cost;
    const disc = item.discount || 0;

    // Determine pricing mode
    const mode = item.pricing_mode 
      || ('variant' in item && item.variant?.pricing_mode)
      || ('product_variant' in item && item.product_variant?.pricing_mode)
      || 'fixed';

    const itemSosPrice = ('sosPrice' in item ? item.sosPrice : undefined)
      ?? ('sos_price' in item ? item.sos_price : undefined)
      ?? ('variant' in item ? item.variant?.sos_price : undefined)
      ?? ('product_variant' in item ? item.product_variant?.sos_price : undefined)
      ?? 0;

    if (mode === 'denomination' && itemSosPrice > 0) {
      const lineSos = Math.round(itemSosPrice * qty);
      totalSos += lineSos;
      costAmount += roundToCents(cost * qty);
      itemDiscounts += disc;
    } else {
      const lineTotal = roundToCents(price * qty);
      fixedSubtotal += lineTotal;
      costAmount += roundToCents(cost * qty);
      itemDiscounts += disc;
    }
  }

  let denominationSos = 0;
  let denominationUsd = 0;
  let differenceSos = 0;
  const hasDenominationItems = totalSos > 0;

  if (hasDenominationItems) {
    const denomResult = calculateSosDenomination(totalSos);
    denominationSos = denomResult.denominationSos;
    denominationUsd = denomResult.denominationUsd;
    differenceSos = denomResult.differenceSos;
  }

  const subtotal = roundToCents(fixedSubtotal + denominationUsd);
  const safeOverallDiscount = Math.max(0, wholeSaleDiscount);
  const totalDiscount = roundToCents(itemDiscounts + safeOverallDiscount);
  const totalAmount = Math.max(0, roundToCents(subtotal - totalDiscount));
  const grossProfit = roundToCents(totalAmount - costAmount);

  return {
    subtotal: roundToCents(subtotal),
    totalDiscount,
    totalAmount,
    costAmount: roundToCents(costAmount),
    grossProfit,
    hasDenominationItems,
    totalSos,
    denominationSos,
    denominationUsd,
    differenceSos,
    fixedSubtotal: roundToCents(fixedSubtotal),
  };
}

/**
 * Cost of Goods Sold (COGS)
 */
export function calculateCOGS(
  items: Array<{ quantity: number; buy_price?: number; unit_cost?: number; unitCost?: number }>
): number {
  const total = items.reduce((acc, item) => {
    const cost = item.buy_price ?? item.unit_cost ?? item.unitCost ?? 0;
    return acc + cost * (item.quantity || 0);
  }, 0);
  return roundToCents(total);
}

/**
 * Gross Profit = Actual Sales Revenue - Cost of Goods Sold
 */
export function calculateGrossProfit(actualRevenue: number, cogs: number): number {
  return roundToCents(actualRevenue - cogs);
}

/**
 * Net Profit = Gross Profit - Total Expenses
 * Inventory purchases are NOT treated as normal expenses.
 */
export function calculateNetProfit(grossProfit: number, totalExpenses: number): number {
  return roundToCents(grossProfit - totalExpenses);
}

/**
 * Remaining Debt Balance = Original Amount - Amount Paid
 */
export function calculateDebtBalance(originalAmount: number, amountPaid: number): number {
  const remaining = Math.max(0, originalAmount - amountPaid);
  return roundToCents(remaining);
}

/**
 * Formats a currency amount into standard USD display e.g. "$120.00"
 */
export function formatMoney(amount: number | null | undefined, currency: string = '$'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  return `${currency}${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

