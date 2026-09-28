import { calculateSosDenomination } from './denominations';
import { cleanPrecision } from './financials';

export function calculateCostPerBaseUnit(
  buyPriceOrVariant: number | {
    buy_price?: number;
    conversion_factor?: number;
    cost_per_unit?: number | null;
    total_purchase_cost?: number | null;
    total_sellable_units?: number | null;
    management_mode?: string;
    pack_count?: number | null;
    source_quantity?: number | null;
    source_unit?: string | null;
    purchase_unit?: string | null;
    selling_unit?: string | null;
    stock_quantity?: number;
  },
  conversionFactor: number = 1,
  variantContext?: {
    buy_price?: number;
    conversion_factor?: number;
    cost_per_unit?: number | null;
    total_purchase_cost?: number | null;
    total_sellable_units?: number | null;
    management_mode?: string;
    pack_count?: number | null;
    source_quantity?: number | null;
    source_unit?: string | null;
    purchase_unit?: string | null;
    selling_unit?: string | null;
    stock_quantity?: number;
  }
): number {
  let buyPrice = 0;
  let conv = conversionFactor > 0 ? conversionFactor : 1;
  let v: any = undefined;

  if (typeof buyPriceOrVariant === 'object' && buyPriceOrVariant !== null) {
    v = buyPriceOrVariant;
    buyPrice = Number(v.buy_price) || 0;
    conv = Number(v.conversion_factor) > 0 ? Number(v.conversion_factor) : 1;
  } else {
    buyPrice = Number(buyPriceOrVariant) || 0;
    conv = conversionFactor > 0 ? conversionFactor : 1;
    v = variantContext;
  }

  // 1. If explicit cost_per_unit is present and valid (> 0), use it directly
  if (v && v.cost_per_unit !== undefined && v.cost_per_unit !== null && Number(v.cost_per_unit) > 0) {
    return cleanPrecision(Number(v.cost_per_unit));
  }

  // 2. If explicit total_purchase_cost and total_sellable_units are available
  if (v && Number(v.total_purchase_cost) > 0 && Number(v.total_sellable_units) > 0) {
    return cleanPrecision(Number(v.total_purchase_cost) / Number(v.total_sellable_units));
  }

  // 3. For pack-based products or when purchase_unit != selling_unit with source_quantity represented
  if (v && (v.management_mode === 'pack_based' || (v.source_quantity && Number(v.source_quantity) > 0))) {
    const totalCost = Number(v.total_purchase_cost || v.buy_price || buyPrice || 0);
    let totalSellableUnits = 0;

    if (v.total_sellable_units && Number(v.total_sellable_units) > 0) {
      totalSellableUnits = Number(v.total_sellable_units);
    } else if (v.pack_count && Number(v.pack_count) > 0) {
      totalSellableUnits = Number(v.pack_count);
    } else if (v.source_quantity && Number(v.source_quantity) > 0 && (v.conversion_factor || conv) > 0) {
      totalSellableUnits = Number(v.source_quantity) * Number(v.conversion_factor || conv);
    }

    if (totalSellableUnits > 0 && totalCost > 0) {
      return cleanPrecision(totalCost / totalSellableUnits);
    }
  }

  // 4. Fallback standard formula: buyPrice / conversionFactor
  if (conv <= 0) return cleanPrecision(buyPrice);
  return cleanPrecision(buyPrice / conv);
}

export function calculateUnitProfit(sellPricePerBaseUnit: number, costPerBaseUnit: number): number {
  return cleanPrecision(sellPricePerBaseUnit - costPerBaseUnit);
}

export function calculateMinSellableQty(unitDivision: number = 1): number {
  const div = Math.max(1, Number(unitDivision) || 1);
  return Math.round((1 / div) * 10000) / 10000;
}

export function getVariantStep(variant: { min_sellable_qty?: number; unit_division?: number; management_mode?: string }): number {
  if (variant.min_sellable_qty !== undefined && variant.min_sellable_qty !== null && Number(variant.min_sellable_qty) > 0) {
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
  managementMode?: string,
  isMoneyBasedOption: boolean = false
): { valid: boolean; reason?: string } {
  if (isNaN(quantity) || quantity <= 0) {
    return {
      valid: false,
      reason: 'Geli tiro sax ah oo ka weyn 0 (Quantity must be greater than 0).',
    };
  }

  if (isMoneyBasedOption) {
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
    const ex1 = step;
    const ex2 = Number((step * 2).toFixed(4));
    const ex3 = Number((step * 3).toFixed(4));
    const ex4 = Number((step * 4).toFixed(4));
    return {
      valid: false,
      reason: `Tirada (${quantity} ${unit}) ma aha qeyb sax ah. Alaabtan waxaa loo qaybiyay (${step} ${unit}). Qiyaasaha la oggol yahay: ${ex1}, ${ex2}, ${ex3}, ${ex4} ${unit}...`,
    };
  }

  return { valid: true };
}

export type ShopProductType = 'jawan' | 'liquid' | 'carton' | 'loose';

export interface ProductModelCalculation {
  productType: ShopProductType;
  totalPurchaseCost: number;
  totalStockQuantity: number;
  costPerSellingUnit: number;
  sellPricePerUnit: number;
  profitPerUnit: number;
  isLoss: boolean;
  minSellableQty: number;
  conversionSummary: string;
  fractionalExample?: {
    qty: number;
    revenue: number;
    cost: number;
    exactProfit: number;
    displayProfit: number;
  };
}

export function calculateProductModel(params: {
  productType: ShopProductType;
  purchaseQuantity: number;
  costPerPurchaseUnit: number;
  totalPurchaseCost?: number;
  conversionValue: number;
  loosePackMode?: 'kg_per_bag' | 'bags_per_kg';
  packContentWeight?: number;
  sellingPrice: number;
  minSellableQty: number;
}): ProductModelCalculation {
  const purchaseQty = Math.max(0, Number(params.purchaseQuantity) || 0);
  const costPerUnit = Math.max(0, Number(params.costPerPurchaseUnit) || 0);
  const sellingPrice = Math.max(0, Number(params.sellingPrice) || 0);
  const minSellable = Math.max(0.0001, Number(params.minSellableQty) || 1);

  let totalCost = 0;
  let totalStock = 0;
  let unitCost = 0;
  let convSummary = '';

  switch (params.productType) {
    case 'jawan': {
      const kgPerJawan = Math.max(0.01, Number(params.conversionValue) || 25);
      totalCost = cleanPrecision(purchaseQty * costPerUnit);
      totalStock = cleanPrecision(purchaseQty * kgPerJawan);
      unitCost = cleanPrecision(costPerUnit / kgPerJawan);
      convSummary = `1 Jawan = ${kgPerJawan} KG`;
      break;
    }
    case 'liquid': {
      const litersPerContainer = Math.max(0.01, Number(params.conversionValue) || 20);
      totalCost = cleanPrecision(purchaseQty * costPerUnit);
      totalStock = cleanPrecision(purchaseQty * litersPerContainer);
      unitCost = cleanPrecision(costPerUnit / litersPerContainer);
      convSummary = `1 Caag = ${litersPerContainer} Liter`;
      break;
    }
    case 'carton': {
      const packsPerCarton = Math.max(1, Number(params.conversionValue) || 20);
      totalCost = cleanPrecision(purchaseQty * costPerUnit);
      totalStock = cleanPrecision(purchaseQty * packsPerCarton);
      unitCost = cleanPrecision(costPerUnit / packsPerCarton);
      const weightInfo = params.packContentWeight ? ` (1 Bac = ${params.packContentWeight} KG)` : '';
      convSummary = `1 Carton = ${packsPerCarton} Bac${weightInfo}`;
      break;
    }
    case 'loose': {
      totalCost = params.totalPurchaseCost !== undefined && params.totalPurchaseCost > 0
        ? cleanPrecision(Number(params.totalPurchaseCost))
        : cleanPrecision(purchaseQty * costPerUnit);
      
      let totalBags = 0;
      if (params.loosePackMode === 'kg_per_bag') {
        const kgPerBag = Math.max(0.0001, Number(params.conversionValue) || 0.05);
        totalBags = kgPerBag > 0 ? cleanPrecision(purchaseQty / kgPerBag) : 0;
        convSummary = `1 Bac = ${kgPerBag} KG (${kgPerBag * 1000}g)`;
      } else {
        const bagsPerKg = Math.max(0.0001, Number(params.conversionValue) || 20);
        totalBags = cleanPrecision(purchaseQty * bagsPerKg);
        convSummary = `1 KG = ${bagsPerKg} Bac`;
      }
      totalStock = totalBags;
      unitCost = totalBags > 0 ? cleanPrecision(totalCost / totalBags) : 0;
      break;
    }
  }

  const profitPerUnit = cleanPrecision(sellingPrice - unitCost);
  const isLoss = profitPerUnit < 0;

  let fractionalExample: ProductModelCalculation['fractionalExample'] = undefined;
  if (minSellable < 1) {
    const rev = cleanPrecision(minSellable * sellingPrice);
    const cost = cleanPrecision(minSellable * unitCost);
    const exactProf = cleanPrecision(rev - cost);
    const dispProf = Math.round((exactProf + Number.EPSILON) * 100) / 100;
    fractionalExample = {
      qty: minSellable,
      revenue: rev,
      cost,
      exactProfit: exactProf,
      displayProfit: dispProf,
    };
  }

  return {
    productType: params.productType,
    totalPurchaseCost: totalCost,
    totalStockQuantity: totalStock,
    costPerSellingUnit: unitCost,
    sellPricePerUnit: sellingPrice,
    profitPerUnit,
    isLoss,
    minSellableQty: minSellable,
    conversionSummary: convSummary,
    fractionalExample,
  };
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

export interface OilSellingMeasure {
  id: string;
  product_id?: string;
  variant_id?: string;
  name: string;
  code: string;
  quantity_liters: number;
  display_price: number;
  payment_price: number;
  label: string;
  amount: number;
  currency?: '$' | 'SOS' | string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export function getDefaultOilSellingMeasures(sellingPricePerLiter: number = 1.85): OilSellingMeasure[] {
  const sellPerL = Number(sellingPricePerLiter) > 0 ? Number(sellingPricePerLiter) : 1.85;
  const halfPrice = cleanPrecision(Math.round((sellPerL / 2) * 100) / 100);

  return [
    {
      id: 'oil-1l',
      name: '1 Liter',
      label: '1 Liter',
      code: '1L',
      quantity_liters: 1.0,
      display_price: sellPerL,
      amount: sellPerL,
      payment_price: sellPerL,
      currency: '$',
      description: '1 Liter',
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'oil-half-liter',
      name: '½ Liter',
      label: '½ Liter',
      code: 'HALF_LITER',
      quantity_liters: 0.5,
      display_price: halfPrice > 0 ? halfPrice : 0.93,
      amount: halfPrice > 0 ? halfPrice : 0.93,
      payment_price: halfPrice > 0 ? halfPrice : 0.93,
      currency: '$',
      description: '1 Liter ÷ 2',
      sort_order: 2,
      is_active: true,
    },
    {
      id: 'oil-quarter-large',
      name: '¼ Weyn',
      label: '¼ Weyn',
      code: 'QUARTER_LARGE',
      quantity_liters: 0.25,
      display_price: 0.50,
      amount: 0.50,
      payment_price: 0.50,
      currency: '$',
      description: '½ Liter ÷ 2',
      sort_order: 3,
      is_active: true,
    },
    {
      id: 'oil-7k',
      name: '7K',
      label: '7K',
      code: '7K',
      quantity_liters: 0.15,
      display_price: 0.25,
      amount: 0.25,
      payment_price: 0.25,
      currency: '$',
      description: 'Wax yar ka badan 6K',
      sort_order: 4,
      is_active: true,
    },
    {
      id: 'oil-6k',
      name: '6K',
      label: '6K',
      code: '6K',
      quantity_liters: 0.125,
      display_price: 0.20,
      amount: 0.20,
      payment_price: 0.20,
      currency: '$',
      description: '¼ Weyn ÷ 2',
      sort_order: 5,
      is_active: true,
    },
    {
      id: 'oil-5k',
      name: '5K',
      label: '5K',
      code: '5K',
      quantity_liters: 0.10,
      display_price: 0.15,
      amount: 0.15,
      payment_price: 0.15,
      currency: '$',
      description: 'Wax yar ka yar 6K',
      sort_order: 6,
      is_active: true,
    },
    {
      id: 'oil-4k',
      name: '4K',
      label: '4K',
      code: '4K',
      quantity_liters: 0.0625,
      display_price: 0.15,
      amount: 0.15,
      payment_price: 0.15,
      currency: '$',
      description: '½ × 6K',
      sort_order: 7,
      is_active: true,
    },
  ];
}

export function calculateOilChange(
  amountPaid: number,
  measurePrice: number
): {
  change: number;
  changeUsd: number;
  changeSos: number;
  hasChange: boolean;
  isValidPayment: boolean;
  errorMessage?: string;
} {
  const paid = cleanPrecision(Math.max(0, Number(amountPaid) || 0));
  const price = cleanPrecision(Math.max(0, Number(measurePrice) || 0));
  const diff = cleanPrecision(paid - price);

  if (diff < -0.0001) {
    return {
      change: 0,
      changeUsd: 0,
      changeSos: 0,
      hasChange: false,
      isValidPayment: false,
      errorMessage: 'Lacagta la bixiyay kuma filna qiimaha cabbirka.',
    };
  }

  const change = Math.max(0, diff);
  const changeSos = Math.round(change * 20000);

  return {
    change,
    changeUsd: change,
    changeSos,
    hasChange: change > 0,
    isValidPayment: true,
  };
}

export function calculateCookingOilRegistration(params: {
  containers: number;
  litersPerContainer: number;
  purchasePricePerContainer: number;
  sellingPricePerLiter: number;
  customMeasures?: OilSellingMeasure[];
}): {
  containers: number;
  litersPerContainer: number;
  purchasePricePerContainer: number;
  sellingPricePerLiter: number;
  totalStockLiters: number;
  totalPurchaseCost: number;
  costPerLiter: number;
  profitPerLiter: number;
  isLoss: boolean;
  measures: OilSellingMeasure[];
} {
  const containers = Math.max(0, Number(params.containers) || 0);
  const litersPerContainer = Math.max(0, Number(params.litersPerContainer) || 0);
  const buyPerContainer = Math.max(0, Number(params.purchasePricePerContainer) || 0);
  const sellPerLiter = Math.max(0, Number(params.sellingPricePerLiter) || 0);

  const totalStockLiters = cleanPrecision(containers * litersPerContainer);
  const totalPurchaseCost = cleanPrecision(containers * buyPerContainer);
  const costPerLiter = totalStockLiters > 0 ? cleanPrecision(totalPurchaseCost / totalStockLiters) : 0;
  const profitPerLiter = cleanPrecision(sellPerLiter - costPerLiter);
  const isLoss = profitPerLiter < 0;
  const measures = params.customMeasures || getDefaultOilSellingMeasures(sellPerLiter);

  return {
    containers,
    litersPerContainer,
    purchasePricePerContainer: buyPerContainer,
    sellingPricePerLiter: sellPerLiter,
    totalStockLiters,
    totalPurchaseCost,
    costPerLiter,
    profitPerLiter,
    isLoss,
    measures,
  };
}
