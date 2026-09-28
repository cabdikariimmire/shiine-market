import assert from 'assert';
import { calculateProductModel, isValidSellableQuantity, getVariantStep } from '../src/lib/calculations/stock';
import { calculateProductModel as calculateProductModelMobile, isValidSellableQuantity as isValidSellableQuantityMobile } from '../mobile/lib/calculations/stock';
import { cleanPrecision, roundToCents } from '../src/lib/calculations/financials';

console.log('====================================================');
console.log('RUNNING PRODUCT MODEL REDESIGN VERIFICATION TESTS');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST A: BUR (Jawan -> KG)
// ----------------------------------------------------
console.log('--> TEST A: BUR (Kiish / Jawan -> KG)');
const bur = calculateProductModel({
  productType: 'jawan',
  purchaseQuantity: 5,
  costPerPurchaseUnit: 12.40,
  conversionValue: 25,
  sellingPrice: 0.60,
  minSellableQty: 0.05,
});

console.log('Bur Results:', {
  totalPurchaseCost: bur.totalPurchaseCost,
  totalStockQuantity: bur.totalStockQuantity,
  costPerSellingUnit: bur.costPerSellingUnit,
  profitPerUnit: bur.profitPerUnit,
  minSellableQty: bur.minSellableQty,
});

assert.strictEqual(bur.totalStockQuantity, 125, 'Bur: 5 Jawan × 25 KG should be 125 KG');
assert.strictEqual(bur.totalPurchaseCost, 62.00, 'Bur: 5 × $12.40 should be $62.00');
assert.strictEqual(bur.costPerSellingUnit, 0.496, 'Bur: Cost per KG should be exactly $0.496');
assert.strictEqual(bur.profitPerUnit, 0.104, 'Bur: Profit per KG should be exactly $0.104 ($0.60 - $0.496)');
assert.strictEqual(bur.isLoss, false, 'Bur should not be a loss');
assert.strictEqual(bur.minSellableQty, 0.05, 'Bur min sellable should be 0.05 KG');

// Min sellable validation for Bur
assert.strictEqual(isValidSellableQuantity(0.05, bur.minSellableQty, 'kg', 'standard').valid, true, '0.05 KG should be valid');
assert.strictEqual(isValidSellableQuantity(0.10, bur.minSellableQty, 'kg', 'standard').valid, true, '0.10 KG should be valid');
assert.strictEqual(isValidSellableQuantity(0.15, bur.minSellableQty, 'kg', 'standard').valid, true, '0.15 KG should be valid');
assert.strictEqual(isValidSellableQuantity(0.20, bur.minSellableQty, 'kg', 'standard').valid, true, '0.20 KG should be valid');
assert.strictEqual(isValidSellableQuantity(0.25, bur.minSellableQty, 'kg', 'standard').valid, true, '0.25 KG should be valid');
assert.strictEqual(isValidSellableQuantity(0.03, bur.minSellableQty, 'kg', 'standard').valid, false, '0.03 KG should be rejected for 0.05 step');
console.log('✓ TEST A PASSED\n');

// ----------------------------------------------------
// TEST B: OIL (Caag / Jerrycan -> Liter)
// ----------------------------------------------------
console.log('--> TEST B: OIL (Caag -> Liter)');
const oil = calculateProductModel({
  productType: 'liquid',
  purchaseQuantity: 4,
  costPerPurchaseUnit: 32.00,
  conversionValue: 20,
  sellingPrice: 2.00,
  minSellableQty: 0.10,
});

console.log('Oil Results:', {
  totalPurchaseCost: oil.totalPurchaseCost,
  totalStockQuantity: oil.totalStockQuantity,
  costPerSellingUnit: oil.costPerSellingUnit,
  profitPerUnit: oil.profitPerUnit,
  minSellableQty: oil.minSellableQty,
});

assert.strictEqual(oil.totalStockQuantity, 80, 'Oil: 4 containers × 20L should be 80L');
assert.strictEqual(oil.totalPurchaseCost, 128.00, 'Oil: 4 × $32 should be $128.00');
assert.strictEqual(oil.costPerSellingUnit, 1.60, 'Oil: Cost per Liter should be exactly $1.60');
assert.strictEqual(oil.profitPerUnit, 0.40, 'Oil: Profit per Liter should be exactly $0.40 ($2.00 - $1.60)');
assert.strictEqual(oil.isLoss, false, 'Oil should not be a loss');
assert.strictEqual(oil.minSellableQty, 0.10, 'Oil min sellable should be 0.10 Liter');

// Min sellable validation for Oil
assert.strictEqual(isValidSellableQuantity(0.10, oil.minSellableQty, 'liter', 'amount_based').valid, true, '0.10 L should be valid');
assert.strictEqual(isValidSellableQuantity(0.50, oil.minSellableQty, 'liter', 'amount_based').valid, true, '0.50 L should be valid');
assert.strictEqual(isValidSellableQuantity(1.20, oil.minSellableQty, 'liter', 'amount_based').valid, true, '1.20 L should be valid');
assert.strictEqual(isValidSellableQuantity(0.05, oil.minSellableQty, 'liter', 'amount_based').valid, false, '0.05 L should be rejected for 0.10 step');
console.log('✓ TEST B PASSED\n');

// ----------------------------------------------------
// TEST C: BASTO MK (Carton -> Bac)
// ----------------------------------------------------
console.log('--> TEST C: BASTO MK (Carton -> Bac)');
const basto = calculateProductModel({
  productType: 'carton',
  purchaseQuantity: 2,
  costPerPurchaseUnit: 8.60,
  conversionValue: 20,
  packContentWeight: 0.5,
  sellingPrice: 0.50,
  minSellableQty: 0.5,
});

console.log('Basto Results:', {
  totalPurchaseCost: basto.totalPurchaseCost,
  totalStockQuantity: basto.totalStockQuantity,
  costPerSellingUnit: basto.costPerSellingUnit,
  profitPerUnit: basto.profitPerUnit,
  minSellableQty: basto.minSellableQty,
  fractionalExample: basto.fractionalExample,
});

assert.strictEqual(basto.totalStockQuantity, 40, 'Basto: 2 cartons × 20 Bac should be 40 Bac');
assert.strictEqual(basto.totalPurchaseCost, 17.20, 'Basto: 2 × $8.60 should be $17.20');
assert.strictEqual(basto.costPerSellingUnit, 0.43, 'Basto: Cost per Bac should be exactly $0.43');
assert.strictEqual(basto.profitPerUnit, 0.07, 'Basto: Profit per Bac should be exactly $0.07');
assert.strictEqual(basto.minSellableQty, 0.5, 'Basto min sellable should be 0.5 Bac');

// Check fractional sale: 0.5 Bac
assert(basto.fractionalExample, 'Should provide fractional example when minQty < 1');
assert.strictEqual(basto.fractionalExample.revenue, 0.25, '0.5 Bac revenue should be $0.25');
assert.strictEqual(basto.fractionalExample.cost, 0.215, '0.5 Bac cost should be $0.215');
assert.strictEqual(basto.fractionalExample.exactProfit, 0.035, '0.5 Bac exact profit should be $0.035');
assert.strictEqual(basto.fractionalExample.displayProfit, 0.04, '0.5 Bac display profit should round to $0.04');

// Verify unrounded financial aggregation:
// 2 transactions of 0.5 Bac must aggregate to 0.035 + 0.035 = 0.07, NOT 0.04 + 0.04 = 0.08
const profitTx1 = 0.5 * 0.50 - 0.5 * 0.43; // 0.035
const profitTx2 = 0.5 * 0.50 - 0.5 * 0.43; // 0.035
const totalProfitExact = cleanPrecision(profitTx1 + profitTx2);
assert.strictEqual(totalProfitExact, 0.07, 'Financial aggregation of 2 × 0.5 Bac sales must be exact $0.07');
assert.strictEqual(roundToCents(totalProfitExact), 0.07, 'Display of aggregated profit must be $0.07');

// Min sellable validation for Basto
assert.strictEqual(isValidSellableQuantity(0.5, basto.minSellableQty, 'bac', 'pack_based').valid, true, '0.5 Bac should be valid');
assert.strictEqual(isValidSellableQuantity(1.0, basto.minSellableQty, 'bac', 'pack_based').valid, true, '1.0 Bac should be valid');
assert.strictEqual(isValidSellableQuantity(1.5, basto.minSellableQty, 'bac', 'pack_based').valid, true, '1.5 Bac should be valid');
assert.strictEqual(isValidSellableQuantity(2.0, basto.minSellableQty, 'bac', 'pack_based').valid, true, '2.0 Bac should be valid');
assert.strictEqual(isValidSellableQuantity(0.25, basto.minSellableQty, 'bac', 'pack_based').valid, false, '0.25 Bac should be rejected for 0.5 step');
console.log('✓ TEST C PASSED\n');

// ----------------------------------------------------
// TEST D: XAWAAJI (Bulk KG -> Bac / Shub-shub)
// ----------------------------------------------------
console.log('--> TEST D: XAWAAJI (Bulk KG -> Bac / Shub-shub)');
const xawaaji = calculateProductModel({
  productType: 'loose',
  purchaseQuantity: 2,
  costPerPurchaseUnit: 2, // $4 total / 2 KG
  totalPurchaseCost: 4.00,
  conversionValue: 0.05, // 1 Bac = 0.05 KG
  loosePackMode: 'kg_per_bag',
  sellingPrice: 0.05,
  minSellableQty: 1,
});

console.log('Xawaaji Results:', {
  totalPurchaseCost: xawaaji.totalPurchaseCost,
  totalStockQuantity: xawaaji.totalStockQuantity,
  costPerSellingUnit: xawaaji.costPerSellingUnit,
  profitPerUnit: xawaaji.profitPerUnit,
  isLoss: xawaaji.isLoss,
  minSellableQty: xawaaji.minSellableQty,
});

assert.strictEqual(xawaaji.totalStockQuantity, 40, 'Xawaaji: 2 KG / 0.05 KG should be 40 Bac');
assert.strictEqual(xawaaji.costPerSellingUnit, 0.10, 'Xawaaji: Cost per Bac should be $4 / 40 = $0.10/Bac');
assert.strictEqual(xawaaji.profitPerUnit, -0.05, 'Xawaaji: Profit should be -$0.05/Bac');
assert.strictEqual(xawaaji.isLoss, true, 'Xawaaji MUST be flagged as a LOSS');
console.log('✓ TEST D PASSED\n');

// ----------------------------------------------------
// TEST E: WEB AND MOBILE PARITY
// ----------------------------------------------------
console.log('--> TEST E: WEB & MOBILE CODE SYNC PARITY');
const mobileBur = calculateProductModelMobile({
  productType: 'jawan',
  purchaseQuantity: 5,
  costPerPurchaseUnit: 12.40,
  conversionValue: 25,
  sellingPrice: 0.60,
  minSellableQty: 0.05,
});

assert.deepStrictEqual(bur, mobileBur, 'Web and Mobile calculateProductModel must return identical results for Bur');

const mobileBasto = calculateProductModelMobile({
  productType: 'carton',
  purchaseQuantity: 2,
  costPerPurchaseUnit: 8.60,
  conversionValue: 20,
  packContentWeight: 0.5,
  sellingPrice: 0.50,
  minSellableQty: 0.5,
});

assert.deepStrictEqual(basto, mobileBasto, 'Web and Mobile calculateProductModel must return identical results for Basto');

assert.deepStrictEqual(
  isValidSellableQuantity(0.25, 0.5, 'bac', 'pack_based'),
  isValidSellableQuantityMobile(0.25, 0.5, 'bac', 'pack_based'),
  'Web and Mobile validation for invalid 0.25 Bac must match'
);

assert.deepStrictEqual(
  isValidSellableQuantity(0.05, 0.05, 'kg', 'standard'),
  isValidSellableQuantityMobile(0.05, 0.05, 'kg', 'standard'),
  'Web and Mobile validation for 0.05 KG must match'
);
console.log('✓ TEST E PASSED\n');

console.log('====================================================');
console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! 🎉');
console.log('====================================================');
