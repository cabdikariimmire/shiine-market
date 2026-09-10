import { CartItem, SaleItem } from '@/types';

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
  const rawLineTotal = safeUnitPrice * safeQty;
  const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));

  const totalPrice = Math.round((rawLineTotal - safeDiscount) * 100) / 100;
  const totalCost = Math.round(safeCost * safeQty * 100) / 100;
  const grossProfit = Math.round((totalPrice - totalCost) * 100) / 100;

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

    subtotal += price * qty;
    itemDiscounts += disc;
    costAmount += cost * qty;
  }

  const safeOverallDiscount = Math.max(0, wholeSaleDiscount);
  const totalDiscount = Math.round((itemDiscounts + safeOverallDiscount) * 100) / 100;
  const totalAmount = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);
  const grossProfit = Math.round((totalAmount - costAmount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount,
    totalAmount,
    costAmount: Math.round(costAmount * 100) / 100,
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
  return Math.round(total * 100) / 100;
}

/**
 * Gross Profit = Actual Sales Revenue - Cost of Goods Sold
 */
export function calculateGrossProfit(actualRevenue: number, cogs: number): number {
  return Math.round((actualRevenue - cogs) * 100) / 100;
}

/**
 * Net Profit = Gross Profit - Total Expenses
 * Inventory purchases are NOT treated as normal expenses.
 */
export function calculateNetProfit(grossProfit: number, totalExpenses: number): number {
  return Math.round((grossProfit - totalExpenses) * 100) / 100;
}

/**
 * Remaining Debt Balance = Original Amount - Amount Paid
 */
export function calculateDebtBalance(originalAmount: number, amountPaid: number): number {
  const remaining = Math.max(0, originalAmount - amountPaid);
  return Math.round(remaining * 100) / 100;
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
