import { ProductVariant } from '@/types';

/**
 * Calculates cost per base selling unit.
 * Example: 1 Jawan = $25, Conversion = 50 kg -> Cost = $25 / 50 = $0.50 per kg.
 */
export function calculateCostPerBaseUnit(buyPricePerPurchaseUnit: number, conversionFactor: number = 1): number {
  if (conversionFactor <= 0) return buyPricePerPurchaseUnit;
  return Math.round((buyPricePerPurchaseUnit / conversionFactor) * 10000) / 10000;
}

/**
 * Expected unit profit = Sell Price per base unit - Cost per base unit.
 * Example: Sell = $0.70/kg, Cost = $0.50/kg -> Profit = $0.20/kg.
 */
export function calculateUnitProfit(sellPricePerBaseUnit: number, costPerBaseUnit: number): number {
  return Math.round((sellPricePerBaseUnit - costPerBaseUnit) * 100) / 100;
}

/**
 * Profit margin percentage = ((Sell Price - Cost Price) / Sell Price) * 100
 */
export function calculateMarginPercentage(sellPrice: number, costPrice: number): number {
  if (sellPrice <= 0) return 0;
  return Math.round(((sellPrice - costPrice) / sellPrice) * 1000) / 10;
}

/**
 * Total stock valuation based on cost per base unit and retail valuation based on sell price
 */
export function calculateStockValuation(variants: ProductVariant[]): {
  totalCostValue: number;
  totalRetailValue: number;
  totalPotentialProfit: number;
  totalQuantity: number;
} {
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalQuantity = 0;

  for (const variant of variants) {
    if (!variant.is_active || variant.is_pending) continue;
    const qty = Math.max(0, variant.stock_quantity || 0);
    const costPerBaseUnit = calculateCostPerBaseUnit(variant.buy_price, variant.conversion_factor);
    
    totalQuantity += qty;
    totalCostValue += qty * costPerBaseUnit;
    totalRetailValue += qty * (variant.sell_price || 0);
  }

  const costVal = Math.round(totalCostValue * 100) / 100;
  const retVal = Math.round(totalRetailValue * 100) / 100;

  return {
    totalCostValue: costVal,
    totalRetailValue: retVal,
    totalPotentialProfit: Math.round((retVal - costVal) * 100) / 100,
    totalQuantity: Math.round(totalQuantity * 100) / 100,
  };
}

/**
 * Determines stock status in Somali and English
 */
export function getStockStatus(
  quantity: number, 
  minimumStock: number = 10,
  isPending: boolean = false
): {
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pending';
  labelSomali: string;
  labelEnglish: string;
  icon: string;
  colorClass: string;
  badgeClass: string;
} {
  if (isPending) {
    return {
      status: 'pending',
      labelSomali: 'Pending (AI Scan)',
      labelEnglish: 'Pending Review',
      icon: '🟡',
      colorClass: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700',
    };
  }

  if (quantity <= 0) {
    return {
      status: 'out_of_stock',
      labelSomali: 'Waa Dhamaatay',
      labelEnglish: 'Out of Stock',
      icon: '🔴',
      colorClass: 'text-red-600 dark:text-red-400',
      badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800',
    };
  }

  if (quantity <= minimumStock) {
    return {
      status: 'low_stock',
      labelSomali: 'Waa Yaraysaa',
      labelEnglish: 'Low Stock',
      icon: '🟡',
      colorClass: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    };
  }

  return {
    status: 'in_stock',
    labelSomali: 'Waa Buuxdaa',
    labelEnglish: 'In Stock',
    icon: '🟢',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
  };
}
