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
 * Supports per-item discount, decimal quantities (e.g. 1.25 kg, 1.25 L), amount-based oil options, and denomination mode.
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
    const totalCost = roundToCents(safeCost * qtyUsed);

    if (options.amountBasedCurrency === 'SOS') {
      const sosVal = Math.round(options.amountBasedValue);
      const denom = calculateSosDenomination(sosVal);
      const rawLineTotal = denom.denominationUsd;
      const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));
      const totalPrice = roundToCents(rawLineTotal - safeDiscount);
      const grossProfit = roundToCents(totalPrice - totalCost);

      return {
        totalPrice,
        grossProfit,
        totalCost,
        sosTotal: sosVal,
        denominationUsd: denom.denominationUsd,
        differenceSos: denom.differenceSos,
      };
    } else {
      // Exact USD option (e.g. Rubac weyn $0.50 or $0.45)
      const rawLineTotal = roundToCents(options.amountBasedValue);
      const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));
      const totalPrice = roundToCents(rawLineTotal - safeDiscount);
      const grossProfit = roundToCents(totalPrice - totalCost);

      return { totalPrice, grossProfit, totalCost };
    }
  }

  // 2. Denomination SOS mode (Mode A)
  if (pricingMode === 'denomination' && safeSosPrice > 0) {
    const sosTotal = Math.round(safeSosPrice * safeQty);
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

  // 3. Standard Fixed USD mode (Mode B)
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
    const actualQty = ('actual_quantity_used' in item && item.actual_quantity_used !== undefined && item.actual_quantity_used > 0)
      ? item.actual_quantity_used
      : (('actualQuantityUsed' in item && (item as any).actualQuantityUsed > 0) ? (item as any).actualQuantityUsed : qty);

    const isAmountBased = ('management_mode' in item && item.management_mode === 'amount_based')
      || ('variant' in item && item.variant?.management_mode === 'amount_based')
      || ('product_variant' in item && item.product_variant?.management_mode === 'amount_based')
      || (('amount_based_value' in item && (item.amount_based_value || 0) > 0) || ('amountBasedValue' in item && ((item as any).amountBasedValue || 0) > 0));

    const amountCurrency = ('amount_based_currency' in item ? item.amount_based_currency : undefined)
      ?? ('amountBasedCurrency' in item ? (item as any).amountBasedCurrency : undefined);
    
    const amountVal = ('amount_based_value' in item ? item.amount_based_value : undefined)
      ?? ('amountBasedValue' in item ? (item as any).amountBasedValue : undefined);

    if (isAmountBased && amountVal && amountVal > 0) {
      if (amountCurrency === 'SOS') {
        totalSos += Math.round(amountVal);
        costAmount += roundToCents(cost * actualQty);
        itemDiscounts += disc;
      } else {
        fixedSubtotal += roundToCents(amountVal);
        costAmount += roundToCents(cost * actualQty);
        itemDiscounts += disc;
      }
      continue;
    }

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
 * Calculates batch profit & loss, usage, and physical reconciliation variance.
 */
export function calculateBatchProfitLoss(
  batch: {
    total_initial_quantity: number;
    total_purchase_cost: number;
    cost_per_unit: number;
    quantity_sold: number;
    total_revenue: number;
    physical_remaining_quantity?: number;
  }
): {
  litersReceived: number;
  totalPurchaseCost: number;
  costPerLiter: number;
  litersSold: number;
  salesRevenue: number;
  costOfSoldOil: number;
  grossProfit: number;
  expectedRemainingLiters: number;
  actualRemainingLiters: number;
  varianceLiters: number;
  shrinkageCost: number;
} {
  const litersReceived = Math.round(Number(batch.total_initial_quantity || 0) * 10000) / 10000;
  const totalPurchaseCost = roundToCents(Number(batch.total_purchase_cost || 0));
  const costPerLiter = Math.round(Number(batch.cost_per_unit || 0) * 10000) / 10000;
  const litersSold = Math.round(Number(batch.quantity_sold || 0) * 10000) / 10000;
  const salesRevenue = roundToCents(Number(batch.total_revenue || 0));
  const costOfSoldOil = roundToCents(litersSold * costPerLiter);
  const grossProfit = roundToCents(salesRevenue - costOfSoldOil);
  const expectedRemainingLiters = Math.max(0, Math.round((litersReceived - litersSold) * 10000) / 10000);
  const actualRemainingLiters = batch.physical_remaining_quantity !== undefined 
    ? Math.round(Number(batch.physical_remaining_quantity) * 10000) / 10000 
    : expectedRemainingLiters;
  const varianceLiters = Math.round((actualRemainingLiters - expectedRemainingLiters) * 10000) / 10000;
  const shrinkageCost = varianceLiters < 0 ? roundToCents(Math.abs(varianceLiters) * costPerLiter) : 0;

  return {
    litersReceived,
    totalPurchaseCost,
    costPerLiter,
    litersSold,
    salesRevenue,
    costOfSoldOil,
    grossProfit,
    expectedRemainingLiters,
    actualRemainingLiters,
    varianceLiters,
    shrinkageCost,
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

