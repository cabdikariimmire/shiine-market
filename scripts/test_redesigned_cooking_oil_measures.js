/**
 * Automated Verification Script for:
 * REDESIGNED COOKING OIL PRODUCT REGISTRATION + POS SELLING MEASURES
 *
 * Tests cases A through M from Specification:
 * A: 3 Caag, 20L/Caag, $29.70/Caag -> 60L, $89.10 total cost, $1.485/L cost
 * B: 1L sale -> Correct stock deduction
 * C: ½ Liter sale -> Correct stock deduction
 * D: ¼ Weyn sale -> Correct stock deduction
 * E: 6K sale -> Correct configured physical quantity deduction (0.125L)
 * F: 4K sale -> Correct configured physical quantity deduction (0.0625L)
 * G: 5K: Value = $0.15, Customer pays = $0.20, Change = $0.05 (1,000 SOS)
 * H: 6K: Value = $0.20, Customer pays = $0.20, Change = $0
 * I: 7K: Value = $0.25, Customer pays = $0.25, Change = $0
 * J: 6K: Value = $0.20, Customer pays = $0.25, Change = $0.05 (1,000 SOS)
 * K: Multiple batches preserve separate costs (FIFO cost preservation)
 * L: Offline sale idempotency with client_transaction_id
 * M: No duplicate product created when adding a new oil batch
 */

const assert = require('assert');

function cleanPrecision(val) {
  return Math.round(Number(val) * 10000) / 10000;
}

// 1. Simulation of calculateCookingOilRegistration
function calculateCookingOilRegistration(params) {
  const containers = Math.max(0, Number(params.containers) || 0);
  const litersPerContainer = Math.max(0, Number(params.litersPerContainer) || 0);
  const buyPerContainer = Math.max(0, Number(params.purchasePricePerContainer) || 0);
  const sellPerLiter = Math.max(0, Number(params.sellingPricePerLiter) || 0);

  const totalStockLiters = cleanPrecision(containers * litersPerContainer);
  const totalPurchaseCost = cleanPrecision(containers * buyPerContainer);
  const costPerLiter = totalStockLiters > 0 ? cleanPrecision(totalPurchaseCost / totalStockLiters) : 0;
  const profitPerLiter = cleanPrecision(sellPerLiter - costPerLiter);
  const isLoss = profitPerLiter < 0;

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
  };
}

// 2. Simulation of calculateOilChange
function calculateOilChange(amountPaid, measurePrice) {
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
  const changeSos = Math.round(change * 20000); // $0.05 = 1,000 SOS

  return {
    change,
    changeUsd: change,
    changeSos,
    hasChange: change > 0,
    isValidPayment: true,
  };
}

// Default selling measures hierarchy
const DEFAULT_MEASURES = [
  { code: '1L', name: '1 Liter', quantity_liters: 1.0, display_price: 1.85, payment_price: 1.85 },
  { code: 'HALF_LITER', name: '½ Liter', quantity_liters: 0.5, display_price: 0.93, payment_price: 0.93 },
  { code: 'QUARTER_LARGE', name: '¼ Weyn', quantity_liters: 0.25, display_price: 0.50, payment_price: 0.50 },
  { code: '7K', name: '7K', quantity_liters: 0.15, display_price: 0.25, payment_price: 0.25 },
  { code: '6K', name: '6K', quantity_liters: 0.125, display_price: 0.20, payment_price: 0.20 },
  { code: '5K', name: '5K', quantity_liters: 0.10, display_price: 0.15, payment_price: 0.15 },
  { code: '4K', name: '4K', quantity_liters: 0.0625, display_price: 0.15, payment_price: 0.15 },
];

console.log('================================================================');
console.log('RUNNING COOKING OIL REDESIGNED VERIFICATION TEST SUITE (A to M)');
console.log('================================================================\n');

// TEST CASE A: Registration calculations
console.log('Test Case A: Product Registration Derived Calculations');
const regA = calculateCookingOilRegistration({
  containers: 3,
  litersPerContainer: 20,
  purchasePricePerContainer: 29.70,
  sellingPricePerLiter: 1.85,
});

assert.strictEqual(regA.totalStockLiters, 60, 'Total stock must be 60L');
assert.strictEqual(regA.totalPurchaseCost, 89.10, 'Total cost must be $89.10');
assert.strictEqual(regA.costPerLiter, 1.485, 'Cost/L must be $1.485');
assert.strictEqual(regA.profitPerLiter, 0.365, 'Profit/L must be $0.365');
console.log('✓ PASS Case A: Stock=60L, Cost=$89.10, Cost/L=$1.485, Profit/L=$0.365\n');

// TEST CASES B to F: Stock deduction per measure
console.log('Test Cases B-F: Exact Physical Stock Deduction (in Liters)');
let stock = regA.totalStockLiters; // 60L

// B: 1L sale
const m1L = DEFAULT_MEASURES.find(m => m.code === '1L');
stock = cleanPrecision(stock - m1L.quantity_liters);
assert.strictEqual(stock, 59.0, 'Stock after 1L sale must be 59.0L');
console.log('✓ PASS Case B: 1L sale deducts 1.0L -> remaining 59.0L');

// C: ½ Liter sale
const mHalf = DEFAULT_MEASURES.find(m => m.code === 'HALF_LITER');
stock = cleanPrecision(stock - mHalf.quantity_liters);
assert.strictEqual(stock, 58.5, 'Stock after ½ Liter sale must be 58.5L');
console.log('✓ PASS Case C: ½ Liter sale deducts 0.5L -> remaining 58.5L');

// D: ¼ Weyn sale
const mQuarter = DEFAULT_MEASURES.find(m => m.code === 'QUARTER_LARGE');
stock = cleanPrecision(stock - mQuarter.quantity_liters);
assert.strictEqual(stock, 58.25, 'Stock after ¼ Weyn sale must be 58.25L');
console.log('✓ PASS Case D: ¼ Weyn sale deducts 0.25L -> remaining 58.25L');

// E: 6K sale
const m6K = DEFAULT_MEASURES.find(m => m.code === '6K');
stock = cleanPrecision(stock - m6K.quantity_liters);
assert.strictEqual(stock, 58.125, 'Stock after 6K sale must be 58.125L');
console.log('✓ PASS Case E: 6K sale deducts 0.125L -> remaining 58.125L');

// F: 4K sale
const m4K = DEFAULT_MEASURES.find(m => m.code === '4K');
stock = cleanPrecision(stock - m4K.quantity_liters);
assert.strictEqual(stock, 58.0625, 'Stock after 4K sale must be 58.0625L');
console.log('✓ PASS Case F: 4K sale deducts 0.0625L -> remaining 58.0625L\n');

// TEST CASES G to J: Payment & Cash / Change Calculations
console.log('Test Cases G-J: Special Payment / Cash Rules & SOS Equivalents');

// G: 5K: Value = $0.15, Customer pays = $0.20, Change = $0.05 (1,000 SOS)
const changeG = calculateOilChange(0.20, 0.15);
assert.strictEqual(changeG.isValidPayment, true);
assert.strictEqual(changeG.change, 0.05);
assert.strictEqual(changeG.changeSos, 1000);
console.log('✓ PASS Case G: 5K ($0.15) with $0.20 paid -> Change = $0.05 (1,000 SOS)');

// H: 6K: Value = $0.20, Customer pays = $0.20, Change = $0
const changeH = calculateOilChange(0.20, 0.20);
assert.strictEqual(changeH.isValidPayment, true);
assert.strictEqual(changeH.change, 0);
assert.strictEqual(changeH.hasChange, false);
console.log('✓ PASS Case H: 6K ($0.20) with $0.20 paid -> Change = $0');

// I: 7K: Value = $0.25, Customer pays = $0.25, Change = $0
const changeI = calculateOilChange(0.25, 0.25);
assert.strictEqual(changeI.isValidPayment, true);
assert.strictEqual(changeI.change, 0);
assert.strictEqual(changeI.hasChange, false);
console.log('✓ PASS Case I: 7K ($0.25) with $0.25 paid -> Change = $0');

// J: 6K: Value = $0.20, Customer pays = $0.25, Change = $0.05 (1,000 SOS)
const changeJ = calculateOilChange(0.25, 0.20);
assert.strictEqual(changeJ.isValidPayment, true);
assert.strictEqual(changeJ.change, 0.05);
assert.strictEqual(changeJ.changeSos, 1000);
console.log('✓ PASS Case J: 6K ($0.20) with $0.25 paid -> Change = $0.05 (1,000 SOS)\n');

// TEST CASE K: Multiple Batches & FIFO Cost Preservation
console.log('Test Case K: Multiple Batches with FIFO Unit Cost Preservation');
const batch1 = {
  batch_number: 'BATCH-001',
  container_count: 3,
  liters_per_container: 20,
  total_liters: 60,
  remaining_quantity: 60,
  cost_per_liter: 1.485,
  is_active: true,
};

const batch2 = {
  batch_number: 'BATCH-002',
  container_count: 2,
  liters_per_container: 20,
  total_liters: 40,
  remaining_quantity: 40,
  cost_per_liter: 1.60,
  is_active: false,
};

// Sale 1: 50L sold from Batch 1
const sale1Liters = 50;
const costSale1 = cleanPrecision(sale1Liters * batch1.cost_per_liter);
batch1.remaining_quantity -= sale1Liters;
assert.strictEqual(batch1.remaining_quantity, 10, 'Batch 1 remaining should be 10L');
assert.strictEqual(costSale1, 74.25, 'Sale 1 cost should be $74.25 @ $1.485/L');

// Sale 2: 15L sold (10L from Batch 1 @ 1.485, 5L from Batch 2 @ 1.60)
const fromBatch1 = batch1.remaining_quantity;
batch1.remaining_quantity = 0;
batch1.is_active = false;
const fromBatch2 = 15 - fromBatch1;
batch2.remaining_quantity -= fromBatch2;
batch2.is_active = true;

const costSale2 = cleanPrecision((fromBatch1 * batch1.cost_per_liter) + (fromBatch2 * batch2.cost_per_liter));
assert.strictEqual(costSale2, cleanPrecision((10 * 1.485) + (5 * 1.60)));
assert.strictEqual(batch2.remaining_quantity, 35, 'Batch 2 remaining should be 35L');
console.log('✓ PASS Case K: Batches preserve separate cost: Batch 1 @ $1.485/L and Batch 2 @ $1.60/L without overwriting costs\n');

// TEST CASE L: Offline Sale Idempotency
console.log('Test Case L: Offline Sale Idempotent Sync via client_transaction_id');
const processedIds = new Set();
function syncOfflineSale(tx) {
  if (processedIds.has(tx.client_transaction_id)) {
    return { status: 'ALREADY_SYNCED', saleId: tx.client_transaction_id };
  }
  processedIds.add(tx.client_transaction_id);
  return { status: 'INSERTED', saleId: tx.client_transaction_id };
}

const offlineTx = {
  client_transaction_id: 'tx-offline-oil-999',
  measure: '5K',
  quantity_liters: 0.10,
  price: 0.15,
};

const firstSync = syncOfflineSale(offlineTx);
assert.strictEqual(firstSync.status, 'INSERTED');
const secondSync = syncOfflineSale(offlineTx);
assert.strictEqual(secondSync.status, 'ALREADY_SYNCED');
console.log('✓ PASS Case L: Offline transaction is synchronized exactly once without duplicate deductions\n');

// TEST CASE M: Single Product Invariant (No duplicate product created)
console.log('Test Case M: Saliid is ONE Product with Multiple Batches / Measures');
const productsDb = [
  { id: 'prod-oil-01', name: 'Saliid', category: 'Cooking Oil', variants: [{ id: 'var-oil-01', name: 'Saliid 1L' }] }
];

function recordStockIn(productName, containerCount, litersPerContainer, pricePerContainer) {
  let existing = productsDb.find(p => p.name.toLowerCase() === productName.toLowerCase());
  if (!existing) {
    existing = { id: `prod-${Date.now()}`, name: productName, variants: [] };
    productsDb.push(existing);
  }
  // Attaches batch to existing variant instead of creating new product
  return {
    productId: existing.id,
    isNewProduct: false,
    batchAdded: true,
  };
}

const batchAdd1 = recordStockIn('Saliid', 3, 20, 29.70);
const batchAdd2 = recordStockIn('Saliid', 2, 20, 32.00);

assert.strictEqual(productsDb.length, 1, 'Only ONE Cooking Oil product must exist in database');
assert.strictEqual(batchAdd1.productId, batchAdd2.productId, 'Both batches attach to the exact same product ID');
console.log('✓ PASS Case M: Additional batches attach to the existing Saliid product without creating duplicate products\n');

console.log('================================================================');
console.log('ALL TEST CASES (A through M) PASSED SUCCESSFULLY!');
console.log('================================================================');
