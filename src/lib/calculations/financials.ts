import { CartItem, SaleItem } from '@/types';

/**
 * Rounds a monetary amount to 2 decimal places safely, avoiding IEEE 754 floating-point under-rounding.
 */
export function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates item subtotal, total price, and gross profit for a single cart line item.
 * Supports per-item discount and decimal quantities (e.g. 1.25 kg).
 */
export function calculateCartItemLine(
  unitPrice: number,
  unitCost: number,
  quantity: number,
  itemDiscount: number = 0
): { totalPrice: number; grossProfit: number; totalCost: number } {
  const safeQty = Math.max(0, quantity);
  const safeUnitPrice = Math.max(0, unitPrice);
  const safeCost = Math.max(0, unitCost);
  const rawLineTotal = roundToCents(safeUnitPrice * safeQty);
  const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));

  const totalPrice = roundToCents(rawLineTotal - safeDiscount);
  const totalCost = roundToCents(safeCost * safeQty);
  const grossProfit = roundToCents(totalPrice - totalCost);

  return { totalPrice, grossProfit, totalCost };
}

/**
 * Calculates complete POS sale totals with per-item discounts and overall sale discount.
 * Ensures profit is calculated strictly against actual final revenue.
 */
export function calculateSaleTotal(
  items: CartItem[] | SaleItem[],
  wholeSaleDiscount: number = 0
): {
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  costAmount: number;
  grossProfit: number;
} {
  let subtotal = 0;
  let itemDiscounts = 0;
  let costAmount = 0;

  for (const item of items) {
    const qty = item.quantity || 0;
    const price = 'unitPrice' in item ? item.unitPrice : item.unit_price;
    const cost = 'unitCost' in item ? item.unitCost : item.unit_cost;
    const disc = item.discount || 0;

    const lineTotal = roundToCents(price * qty);
    subtotal += lineTotal;
    itemDiscounts += disc;
    costAmount += roundToCents(cost * qty);
  }

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

