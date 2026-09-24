import { CartItem, SaleItem } from '../../types';
import { calculateSosDenomination, roundToCents } from './denominations';

export { roundToCents };

/**
 * Trims IEEE 754 floating-point representation noise while preserving full precision (up to 6 decimal places).
 */
export function cleanPrecision(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Number(Number(num).toFixed(6));
}

/**
 * Calculates item subtotal, total price, and gross profit for a single cart line item.
 * Supports per-item discount, decimal quantities (e.g. 1.25 kg, 1.25 L), amount-based oil options, and denomination mode.
 * Preserves exact full-precision unit cost and gross profit without premature cent-rounding.
 */
export function calculateCartItemLine(
  unitPrice: number,
  unitCost: number,
  quantity: number,
  itemDiscount: number = 0,
  pricingMode: 'fixed' | 'denomination' = 'fixed',
  sosPrice: number | null | undefined = 0,
  options?: {
    managementMode?: 'standard' | 'pack_based' | 'amount_based';
    actualQuantityUsed?: number;
    amountBasedCurrency?: 'SOS' | 'USD';
    amountBasedValue?: number;
  }
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
  const safeSosPrice = Number(sosPrice) || 0;

  // 1. Amount-based (e.g. Cooking Oil with money options)
  if (options?.managementMode === 'amount_based' && options.amountBasedValue && options.amountBasedValue > 0) {
    const qtyUsed = options.actualQuantityUsed !== undefined && options.actualQuantityUsed > 0 
      ? options.actualQuantityUsed 
      : safeQty;
    const totalCost = cleanPrecision(safeCost * qtyUsed);

    if (options.amountBasedCurrency === 'SOS') {
      const sosVal = Math.round(options.amountBasedValue);
      const denom = calculateSosDenomination(sosVal);
      const rawLineTotal = denom.denominationUsd;
      const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));
      const totalPrice = roundToCents(rawLineTotal - safeDiscount);
      const grossProfit = cleanPrecision(totalPrice - totalCost);

      return {
        totalPrice,
        grossProfit,
        totalCost,
        sosTotal: sosVal,
        denominationUsd: denom.denominationUsd,
        differenceSos: denom.differenceSos,
      };
    } else {
      const rawLineTotal = roundToCents(options.amountBasedValue);
      const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));
      const totalPrice = roundToCents(rawLineTotal - safeDiscount);
      const grossProfit = cleanPrecision(totalPrice - totalCost);

      return { totalPrice, grossProfit, totalCost };
    }
  }

  // 2. Denomination SOS mode
  if (pricingMode === 'denomination' && safeSosPrice > 0) {
    const sosTotal = Math.round(safeSosPrice * safeQty);
    const denom = calculateSosDenomination(sosTotal);
    const rawLineTotal = denom.denominationUsd;
    const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));
    const totalPrice = roundToCents(rawLineTotal - safeDiscount);
    const totalCost = cleanPrecision(safeCost * safeQty);
    const grossProfit = cleanPrecision(totalPrice - totalCost);

    return { 
      totalPrice, 
      grossProfit, 
      totalCost, 
      sosTotal, 
      denominationUsd: denom.denominationUsd,
      differenceSos: denom.differenceSos
    };
  }

  // 3. Standard Fixed USD mode
  const rawLineTotal = safeUnitPrice * safeQty;
  const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));

  const totalPrice = roundToCents(rawLineTotal - safeDiscount);
  const totalCost = cleanPrecision(safeCost * safeQty);
  const grossProfit = cleanPrecision(totalPrice - totalCost);

  return { totalPrice, grossProfit, totalCost };
}

export interface SaleTotalCalculation {
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  costAmount: number;
  grossProfit: number;
  hasDenominationItems: boolean;
  totalSos: number;
  denominationSos: number;
  denominationUsd: number;
  differenceSos: number;
  fixedSubtotal: number;
}

export function calculateSaleTotal(
  items: CartItem[] | SaleItem[],
  wholeSaleDiscount: number = 0
): SaleTotalCalculation {
  let fixedSubtotal = 0;
  let totalSos = 0;
  let itemDiscounts = 0;
  let rawCostAmount = 0;

  for (const item of items) {
    const qty = item.quantity || 0;
    const price = 'unitPrice' in item ? item.unitPrice : item.unit_price;
    const cost = 'unitCost' in item ? item.unitCost : item.unit_cost;
    const disc = item.discount || 0;
    const actualQty = ('actual_quantity_used' in item && item.actual_quantity_used !== undefined && item.actual_quantity_used > 0)
      ? item.actual_quantity_used
      : (('actual_quantity_used' in item && (item as any).actual_quantity_used > 0) ? (item as any).actual_quantity_used : qty);

    const isAmountBased = ('management_mode' in item && (item as any).management_mode === 'amount_based')
      || ('variant' in item && item.variant?.management_mode === 'amount_based')
      || ('product_variant' in item && item.product_variant?.management_mode === 'amount_based')
      || (('amount_based_value' in item && (item.amount_based_value || 0) > 0));

    const amountCurrency = ('amount_based_currency' in item ? item.amount_based_currency : undefined);
    const amountVal = ('amount_based_value' in item ? item.amount_based_value : undefined);

    if (isAmountBased && amountVal && amountVal > 0) {
      if (amountCurrency === 'SOS') {
        totalSos += Math.round(amountVal);
        rawCostAmount += (cost * actualQty);
        itemDiscounts += disc;
      } else {
        fixedSubtotal += amountVal;
        rawCostAmount += (cost * actualQty);
        itemDiscounts += disc;
      }
      continue;
    }

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
      rawCostAmount += (cost * qty);
      itemDiscounts += disc;
    } else {
      const lineTotal = price * qty;
      fixedSubtotal += lineTotal;
      rawCostAmount += (cost * qty);
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

  const calculatedSubtotal = roundToCents(fixedSubtotal + denominationUsd);
  const totalDiscount = roundToCents(itemDiscounts + Math.max(0, wholeSaleDiscount));
  const totalAmount = roundToCents(Math.max(0, calculatedSubtotal - wholeSaleDiscount));
  const costAmount = cleanPrecision(rawCostAmount);
  // Full precision profit: Revenue - Exact COGS (never pre-rounded per unit)
  const grossProfit = cleanPrecision(totalAmount - costAmount);

  return {
    subtotal: calculatedSubtotal,
    totalDiscount,
    totalAmount,
    costAmount,
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
 * Preserves exact decimal precision without premature rounding.
 */
export function calculateCOGS(
  items: Array<{ quantity: number; buy_price?: number; unit_cost?: number; unitCost?: number }>
): number {
  const total = items.reduce((acc, item) => {
    const cost = item.buy_price ?? item.unit_cost ?? item.unitCost ?? 0;
    return acc + cost * (item.quantity || 0);
  }, 0);
  return cleanPrecision(total);
}

/**
 * Gross Profit = Actual Sales Revenue - Cost of Goods Sold
 * Preserves full precision without premature rounding.
 */
export function calculateGrossProfit(actualRevenue: number, cogs: number): number {
  return cleanPrecision(actualRevenue - cogs);
}

/**
 * Net Profit = Gross Profit - Total Expenses
 * Inventory purchases are NOT treated as normal expenses.
 * Preserves full precision without premature rounding.
 */
export function calculateNetProfit(grossProfit: number, totalExpenses: number): number {
  return cleanPrecision(grossProfit - totalExpenses);
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

/**
 * Formats a per-unit price, cost, or profit rate with precision up to at least 3-4 decimal places.
 * If the value has fractional cents (e.g. $0.516 or $0.084), it preserves full precision (e.g. "$0.516").
 * If the value has standard 2 decimals (e.g. $0.60 or $0.50), it maintains standard currency format ("$0.60").
 */
export function formatUnitMoney(amount: number | null | undefined, currency: string = '$'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  const clean = cleanPrecision(amount);
  const parts = clean.toString().split('.');
  if (!parts[1] || parts[1].length <= 2) {
    return `${currency}${clean.toFixed(2)}`;
  }
  const str = clean.toFixed(4);
  const trimmed = str.replace(/0+$/, '').replace(/\.$/, '');
  const decimals = trimmed.split('.')[1] || '';
  if (decimals.length < 2) {
    return `${currency}${clean.toFixed(2)}`;
  }
  return `${currency}${trimmed}`;
}

