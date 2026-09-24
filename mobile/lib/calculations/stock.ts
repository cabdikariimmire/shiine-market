import { calculateSosDenomination } from './denominations';
import { cleanPrecision } from './financials';

export function calculateCostPerBaseUnit(buyPricePerPurchaseUnit: number, conversionFactor: number = 1): number {
  if (conversionFactor <= 0) return buyPricePerPurchaseUnit;
  return cleanPrecision(buyPricePerPurchaseUnit / conversionFactor);
}

export function calculateUnitProfit(sellPricePerBaseUnit: number, costPerBaseUnit: number): number {
  return cleanPrecision(sellPricePerBaseUnit - costPerBaseUnit);
}

export function calculateMinSellableQty(unitDivision: number = 1): number {
  const div = Math.max(1, Number(unitDivision) || 1);
  return Math.round((1 / div) * 10000) / 10000;
}

export function getVariantStep(variant: { min_sellable_qty?: number; unit_division?: number; management_mode?: string }): number {
  if (variant.management_mode === 'pack_based') {
    return 1;
  }

  if (variant.min_sellable_qty && Number(variant.min_sellable_qty) > 0) {
    return Number(variant.min_sellable_qty);
  }
  if (variant.unit_division && Number(variant.unit_division) > 1) {
    return calculateMinSellableQty(Number(variant.unit_division));
  }
  return 1;
}

export function isValidSellableQuantity(
  quantity: number,
  minSellableQty: number = 1,
  unit: string = '',
  managementMode?: string
): { valid: boolean; reason?: string } {
  if (isNaN(quantity) || quantity <= 0) {
    return {
      valid: false,
      reason: 'Geli tiro sax ah oo ka weyn 0 (Quantity must be greater than 0).',
    };
  }

  if (managementMode === 'amount_based') {
    return { valid: true };
  }

  if (managementMode === 'pack_based') {
    if (!Number.isInteger(quantity) && Math.abs(quantity - Math.round(quantity)) > 0.0001) {
      return {
        valid: false,
        reason: `Alaabtan bacaha ah waxaa loo iibiyaa xabo buuxda (Integer bags: 1 ${unit}, 2 ${unit}...).`,
      };
    }
    return { valid: true };
  }

  const step = minSellableQty > 0 ? minSellableQty : 1;

  if (quantity < step - 0.0001) {
    return {
      valid: false,
      reason: `Tiradu kama yaraan karto qiyaasta ugu yar ee la oggol yahay (${step} ${unit}).`,
    };
  }

  const ratio = quantity / step;
  const nearestInteger = Math.round(ratio);
  const diff = Math.abs(ratio - nearestInteger);

  if (diff > 0.001) {
    return {
      valid: false,
      reason: `Tirada (${quantity} ${unit}) ma aha qeyb sax ah. Alaabtan waxaa loo qaybiyay talaabooyin ah (${step} ${unit}).`,
    };
  }

  return { valid: true };
}

export function getStockStatus(
  quantity: number, 
  minimumStock: number = 10,
  isPending: boolean = false
): {
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pending';
  labelSomali: string;
  labelEnglish: string;
  icon: string;
  color: string;
  badgeBg: string;
} {
  if (isPending) {
    return {
      status: 'pending',
      labelSomali: 'Waa Sugaysaa',
      labelEnglish: 'Pending Review',
      icon: '🟡',
      color: '#d97706',
      badgeBg: '#fef3c7',
    };
  }

  if (quantity <= 0) {
    return {
      status: 'out_of_stock',
      labelSomali: 'Waa Dhamaatay',
      labelEnglish: 'Out of Stock',
      icon: '🔴',
      color: '#dc2626',
      badgeBg: '#fee2e2',
    };
  }

  if (quantity <= minimumStock) {
    return {
      status: 'low_stock',
      labelSomali: 'Waa Yaraysaa',
      labelEnglish: 'Low Stock',
      icon: '🟡',
      color: '#d97706',
      badgeBg: '#fef3c7',
    };
  }

  return {
    status: 'in_stock',
    labelSomali: 'Waa Buuxdaa',
    labelEnglish: 'In Stock',
    icon: '🟢',
    color: '#16a34a',
    badgeBg: '#dcfce7',
  };
}

export function calculateOilMoneyToLiters(
  amount: number,
  currency: string = 'SOS',
  literSellingPrice: number = 1.5
): {
  amountUsd: number;
  litersSold: number;
  displayText: string;
} {
  const safeLiterPrice = Math.max(0.0001, Number(literSellingPrice) || 1.5);
  const isSos = currency.toUpperCase() === 'SOS';
  let amountUsd = 0;

  if (isSos) {
    const denom = calculateSosDenomination(Number(amount) || 0);
    amountUsd = denom.denominationUsd;
  } else {
    amountUsd = Math.max(0, Number(amount) || 0);
  }

  const rawLiters = amountUsd / safeLiterPrice;
  const litersSold = Math.round(rawLiters * 10000) / 10000;

  return {
    amountUsd,
    litersSold,
    displayText: `${litersSold} L`,
  };
}
