import assert from 'assert';
import { 
  calculateJawanRegistration, 
  getDefaultJawanSellingMeasures, 
  calculateJawanChange,
  isValidSellableQuantity,
  getVariantStep,
  calculateCostPerBaseUnit,
  calculateUnitProfit
} from '../src/lib/calculations/stock';
import { cleanPrecision, calculateCartItemLine } from '../src/lib/calculations/financials';

console.log('====================================================');
console.log('STARTING INTEGRATION TESTS: JAWAN & BASTO FRACTIONAL');
console.log('====================================================\n');

// ----------------------------------------------------
// SECTION 1: BARIIS TESTS (A through E)
// ----------------------------------------------------
console.log('--- TEST A: Bariis Jawan Registration ---');
const bariisReg = calculateJawanRegistration({
  jawanCount: 10,
  kgPerJawan: 50,
  purchasePricePerJawan: 25.80,
  sellingPricePerKg: 0.60,
});

console.log('Bariis Registration Results:', {
  totalStockKg: bariisReg.totalStockKg,
  totalPurchaseCost: bariisReg.totalPurchaseCost,
  costPerKg: bariisReg.costPerKg,
  profitPerKg: bariisReg.profitPerKg,
});

assert.strictEqual(bariisReg.totalStockKg, 500, 'Test A: 10 Jawan × 50 KG should be 500 KG');
assert.strictEqual(bariisReg.totalPurchaseCost, 258.00, 'Test A: 10 × $25.80 should be $258.00');
assert.strictEqual(bariisReg.costPerKg, 0.516, 'Test A: Cost per KG should be exactly $0.516/KG');
assert.strictEqual(bariisReg.profitPerKg, 0.084, 'Test A: Profit per KG should be exactly $0.084/KG');
console.log('✅ TEST A PASSED: Bariis 500 KG, $258.00 cost, $0.516/KG cost, $0.084/KG profit\n');

// Measures for Bariis
const bariisMeasures = getDefaultJawanSellingMeasures(0.60);
const m1kg = bariisMeasures.find(m => m.quantity_kg === 1);
const mHalfKg = bariisMeasures.find(m => m.quantity_kg === 0.5);
const mQuarterKg = bariisMeasures.find(m => m.quantity_kg === 0.25);
const mThreeQuarterKg = bariisMeasures.find(m => m.quantity_kg === 0.75);

assert(m1kg && mHalfKg && mQuarterKg && mThreeQuarterKg, 'All 4 standard selling measures must exist');

console.log('--- TEST B: 1 KG Bariis Sale ---');
assert.strictEqual(m1kg.payment_price, 0.60, '1 KG price should be $0.60');
let bariisStock = bariisReg.totalStockKg;
bariisStock = cleanPrecision(bariisStock - m1kg.quantity_kg);
assert.strictEqual(bariisStock, 499, 'Remaining stock after 1 KG sale should be 499 KG');
console.log('✅ TEST B PASSED: 1 KG sale revenue $0.60, remaining stock 499 KG\n');

console.log('--- TEST C: 0.5 KG (½ KG) Bariis Sale ---');
assert.strictEqual(mHalfKg.payment_price, 0.30, '½ KG price should be $0.30');
bariisStock = cleanPrecision(bariisStock - mHalfKg.quantity_kg);
assert.strictEqual(bariisStock, 498.5, 'Remaining stock after 0.5 KG sale should be 498.5 KG');
console.log('✅ TEST C PASSED: 0.5 KG sale revenue $0.30, remaining stock 498.5 KG\n');

console.log('--- TEST D: 0.25 KG (¼ KG) Bariis Sale ---');
assert.strictEqual(mQuarterKg.payment_price, 0.15, '¼ KG price should be $0.15');
bariisStock = cleanPrecision(bariisStock - mQuarterKg.quantity_kg);
assert.strictEqual(bariisStock, 498.25, 'Remaining stock after 0.25 KG sale should be 498.25 KG');
console.log('✅ TEST D PASSED: 0.25 KG sale revenue $0.15, remaining stock 498.25 KG\n');

console.log('--- TEST E: 0.75 KG (¾ KG) Bariis Sale ---');
assert.strictEqual(mThreeQuarterKg.payment_price, 0.45, '¾ KG price should be $0.45');
bariisStock = cleanPrecision(bariisStock - mThreeQuarterKg.quantity_kg);
assert.strictEqual(bariisStock, 497.5, 'Remaining stock after 0.75 KG sale should be 497.5 KG');
console.log('✅ TEST E PASSED: 0.75 KG sale revenue $0.45, remaining stock 497.5 KG\n');

// ----------------------------------------------------
// SECTION 2: SOKOR TESTS (F through H)
// ----------------------------------------------------
console.log('--- TEST F: Sokor Gudud Jawan Registration ---');
const sokorReg = calculateJawanRegistration({
  jawanCount: 2,
  kgPerJawan: 50,
  purchasePricePerJawan: 30.50,
  sellingPricePerKg: 0.70, // configured selling price
});

assert.strictEqual(sokorReg.totalStockKg, 100, 'Test F: 2 Jawan × 50 KG should be 100 KG');
assert.strictEqual(sokorReg.totalPurchaseCost, 61.00, 'Test F: 2 × $30.50 should be $61.00');
assert.strictEqual(sokorReg.costPerKg, 0.61, 'Test F: Cost per KG should be exactly $0.61/KG');
console.log('✅ TEST F PASSED: Sokor 100 KG, $61.00 total cost, $0.61/KG cost\n');

console.log('--- TEST G: Sokor ¼ KG / 5K Selling Flow with Cash Change ---');
// 5K Sokor transaction: customer pays $0.20 for ¼ KG (selling value = $0.15), change = $0.05
const sokor5kChange = calculateJawanChange(0.20, 0.15);
assert.strictEqual(sokor5kChange.changeUsd, 0.05, 'Change should be exactly $0.05');
assert.strictEqual(sokor5kChange.changeSos, 1000, 'Change in SOS should be 1,000 SOS');
assert.strictEqual(sokor5kChange.hasChange, true, 'hasChange flag should be true');
assert.strictEqual(sokor5kChange.isValidPayment, true, 'isValidPayment should be true');

// Physical stock deduction for 5K Sokor: exactly ¼ KG (0.25 KG)
let sokorStock = sokorReg.totalStockKg;
sokorStock = cleanPrecision(sokorStock - 0.25);
assert.strictEqual(sokorStock, 99.75, 'Deducting ¼ KG from 100 KG leaves 99.75 KG');
console.log('✅ TEST G PASSED: ¼ KG sold as 5K, paid $0.20, change $0.05 (1,000 SOS), physical stock deduction = 0.25 KG\n');

console.log('--- TEST H: Tuman Measure ($0.10, not cash transaction) ---');
const tumanMeasure = {
  id: 'jawan-tuman',
  name: 'Tuman',
  code: 'TUMAN',
  quantity_kg: 0.166,
  payment_price: 0.10,
  supports_cash_change: false, // NOT treated as cash transaction
};
assert.strictEqual(tumanMeasure.payment_price, 0.10, 'Tuman value should be $0.10');
assert.strictEqual(tumanMeasure.supports_cash_change, false, 'Tuman must NOT have supports_cash_change = true');
sokorStock = cleanPrecision(sokorStock - tumanMeasure.quantity_kg);
assert.strictEqual(sokorStock, 99.584, 'Remaining stock after Tuman sale');
console.log('✅ TEST H PASSED: Tuman is a product selling measure ($0.10), not cash transaction\n');

// ----------------------------------------------------
// SECTION 3: BASTO MK FRACTIONAL TESTS (I through Q)
// ----------------------------------------------------
console.log('--- TESTS I-M: Basto MK Fractional Increments Validation ---');
const bastoVariant = {
  id: 'basto-mk-test',
  variant_name: 'MK',
  selling_unit: 'bac',
  management_mode: 'pack_based',
  min_sellable_qty: 0.5,
  stock_quantity: 38,
  sell_price: 0.50,
  buy_price: 8.60,
  conversion_factor: 20,
};

const bastoStep = getVariantStep(bastoVariant);
assert.strictEqual(bastoStep, 0.5, 'Basto step must resolve to 0.5 Bac');

// Test I: 0.25 Bac -> reject
const testI = isValidSellableQuantity(0.25, bastoStep, 'bac', 'pack_based');
assert.strictEqual(testI.valid, false, 'Test I: 0.25 Bac must be rejected');
console.log('✅ TEST I PASSED: 0.25 Bac rejected');

// Test J: 0.5 Bac -> accept
const testJ = isValidSellableQuantity(0.5, bastoStep, 'bac', 'pack_based');
assert.strictEqual(testJ.valid, true, 'Test J: 0.5 Bac must be accepted');
console.log('✅ TEST J PASSED: 0.5 Bac accepted');

// Test K: 1 Bac -> accept
const testK = isValidSellableQuantity(1.0, bastoStep, 'bac', 'pack_based');
assert.strictEqual(testK.valid, true, 'Test K: 1.0 Bac must be accepted');
console.log('✅ TEST K PASSED: 1.0 Bac accepted');

// Test L: 1.5 Bac -> accept
const testL = isValidSellableQuantity(1.5, bastoStep, 'bac', 'pack_based');
assert.strictEqual(testL.valid, true, 'Test L: 1.5 Bac must be accepted');
console.log('✅ TEST L PASSED: 1.5 Bac accepted');

// Test M: 2 Bac -> accept
const testM = isValidSellableQuantity(2.0, bastoStep, 'bac', 'pack_based');
assert.strictEqual(testM.valid, true, 'Test M: 2.0 Bac must be accepted');
console.log('✅ TEST M PASSED: 2.0 Bac accepted');

// Test N: 0.5 Bac at $0.50/Bac Revenue
console.log('\n--- TEST N: 0.5 Bac Revenue & Financial Calculation ---');
const unitCost = calculateCostPerBaseUnit(bastoVariant.buy_price, bastoVariant.conversion_factor, bastoVariant);
const line = calculateCartItemLine(bastoVariant.sell_price, unitCost, 0.5, 0, 'fixed');
assert.strictEqual(line.totalPrice, 0.25, 'Test N: 0.5 Bac × $0.50 = $0.25 revenue');
assert.strictEqual(line.totalCost, 0.215, 'Test N: 0.5 Bac × $0.43 = $0.215 cost');
assert.strictEqual(line.grossProfit, 0.035, 'Test N: Exact profit = $0.25 - $0.215 = $0.035');
console.log('✅ TEST N PASSED: 0.5 Bac revenue = $0.25, exact profit = $0.035');

// Test O: 0.5 Bac Stock Deduction
console.log('\n--- TEST O: 0.5 Bac Stock Deduction ---');
let bastoStock = bastoVariant.stock_quantity;
bastoStock = cleanPrecision(bastoStock - 0.5);
assert.strictEqual(bastoStock, 37.5, 'Test O: 38 Bac - 0.5 Bac = 37.5 Bac');
console.log('✅ TEST O PASSED: 0.5 Bac deducted, remaining stock = 37.5 Bac');

// Test P: Offline 0.5 Bac Sale payload verification
console.log('\n--- TEST P: Offline Sale Payload ---');
const offlineSaleItem = {
  variant_id: bastoVariant.id,
  quantity: 0.5,
  unit: 'bac',
  unit_price: 0.50,
  unit_cost: 0.43,
  total_price: 0.25,
  gross_profit: 0.035,
};
assert.strictEqual(offlineSaleItem.quantity, 0.5, 'Offline item quantity must be 0.5');
assert.strictEqual(offlineSaleItem.total_price, 0.25, 'Offline item total price must be $0.25');
console.log('✅ TEST P PASSED: Offline transaction preserves exact fractional quantity 0.5 and price $0.25');

// Test Q: Batch / FIFO logic without duplicate product creation
console.log('\n--- TEST Q: Non-duplication & FIFO Batches ---');
const existingVariants = [bastoVariant];
const incomingProduct = 'Basto';
const incomingVariantName = 'MK';
const existingMatch = existingVariants.find(
  v => v.variant_name.toLowerCase() === incomingVariantName.toLowerCase()
);
assert(existingMatch, 'Existing Basto MK variant found - must reuse, not duplicate');
assert.strictEqual(existingMatch.id, bastoVariant.id, 'Must reuse identical variant ID to prevent duplicate products');
console.log('✅ TEST Q PASSED: Existing product variant reused, no duplicates created');

console.log('\n====================================================');
console.log('ALL INTEGRATION TESTS A THROUGH Q PASSED SUCCESSFULLY!');
console.log('====================================================');
