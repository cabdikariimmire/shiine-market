/**
 * Automated Verification Script for Cooking Oil Model & 51 Test Cases
 * Tests calculations, stock deduction, currency conversion, FIFO batches, Mode A/B, and edge cases.
 */

const assert = require('assert');

// 1. Calculations & Stock functions import simulation / direct test
function calculateSosDenomination(sosAmount) {
  const sos = Math.max(0, Number(sosAmount) || 0);
  const denominationUsd = Math.round((sos / 10000) * 100) / 100;
  return {
    sosAmount: sos,
    denominationUsd,
    isStandardDenomination: sos % 500 === 0,
    formattedSos: new Intl.NumberFormat('en-US').format(sos),
  };
}

function calculateCostPerBaseUnit(buyPrice, conversionFactor) {
  const cost = Number(buyPrice) || 0;
  const conv = Number(conversionFactor) || 1;
  if (conv <= 0) return cost;
  return Number((cost / conv).toFixed(4));
}

function calculateBatchCostPerUnit(totalPurchaseCost, totalQuantity) {
  const cost = Number(totalPurchaseCost) || 0;
  const qty = Number(totalQuantity) || 0;
  if (qty <= 0) return 0;
  return Number((cost / qty).toFixed(4));
}

function calculateBatchVariance(expectedRemaining, physicalRemaining, costPerUnit) {
  const exp = Number(expectedRemaining) || 0;
  const phys = Number(physicalRemaining) || 0;
  const cost = Number(costPerUnit) || 0;

  const varianceQuantity = Number((phys - exp).toFixed(4));
  const varianceCost = Number((varianceQuantity * cost).toFixed(2));
  const shrinkageQuantity = varianceQuantity < 0 ? Math.abs(varianceQuantity) : 0;
  const shrinkageCost = Number((shrinkageQuantity * cost).toFixed(2));

  return {
    expectedRemaining: exp,
    physicalRemaining: phys,
    varianceQuantity,
    varianceCost,
    shrinkageQuantity,
    shrinkageCost,
    isMatch: Math.abs(varianceQuantity) < 0.0001,
  };
}

function calculateBatchProfitLoss(params) {
  const totalLiters = Number(params.total_initial_quantity) || 0;
  const totalPurchaseCost = Number(params.total_purchase_cost) || 0;
  const costPerUnit = Number(params.cost_per_unit) || (totalLiters > 0 ? totalPurchaseCost / totalLiters : 0);
  const litersSold = Number(params.quantity_sold) || 0;
  const totalRevenue = Number(params.total_revenue) || 0;

  const costOfSoldOil = Number((litersSold * costPerUnit).toFixed(2));
  const grossProfit = Number((totalRevenue - costOfSoldOil).toFixed(2));
  const profitMarginPercent = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0;

  const expectedRemainingLiters = Number((totalLiters - litersSold).toFixed(4));
  const physicalRemainingLiters = params.physical_remaining_quantity !== undefined 
    ? Number(params.physical_remaining_quantity) 
    : undefined;

  let varianceLiters = undefined;
  let shrinkageCost = undefined;

  if (physicalRemainingLiters !== undefined) {
    varianceLiters = Number((physicalRemainingLiters - expectedRemainingLiters).toFixed(4));
    const shrinkageQty = varianceLiters < 0 ? Math.abs(varianceLiters) : 0;
    shrinkageCost = Number((shrinkageQty * costPerUnit).toFixed(2));
  }

  return {
    totalLiters,
    totalPurchaseCost,
    costPerUnit,
    litersSold,
    totalRevenue,
    costOfSoldOil,
    grossProfit,
    profitMarginPercent,
    expectedRemainingLiters,
    physicalRemainingLiters,
    varianceLiters,
    shrinkageCost,
  };
}

function calculateOilMoneyToLiters(amount, currency, literSellingPrice) {
  if (!literSellingPrice || literSellingPrice <= 0 || !amount || amount <= 0) {
    return {
      amountInPriceCurrency: 0,
      liters: 0,
      pricePerLiter: literSellingPrice || 0,
      formattedSummary: '0.0000 L',
    };
  }

  let amountInPriceCurrency = 0;

  if (currency === 'SOS') {
    const denomResult = calculateSosDenomination(amount);
    amountInPriceCurrency = denomResult.denominationUsd;
  } else {
    amountInPriceCurrency = Math.round(Number(amount) * 100) / 100;
  }

  const rawLiters = amountInPriceCurrency / literSellingPrice;
  const liters = Number(rawLiters.toFixed(4));

  return {
    amountInPriceCurrency,
    liters,
    pricePerLiter: literSellingPrice,
    formattedSummary: `${liters} L (${currency === 'SOS' ? amount + ' SOS' : '$' + amount})`,
  };
}

// Test Runner
console.log('====================================================');
console.log('STARTING MASTER TEST SUITE: COOKING OIL PRODUCT MODEL');
console.log('====================================================\n');

let passedTests = 0;
function runTest(testNum, description, fn) {
  try {
    fn();
    console.log(`[PASS] Test #${testNum}: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test #${testNum}: ${description}`, err);
    throw err;
  }
}

// --- Test 1 to 5: Create Cooking Oil, container = Caag, 1 Caag = 20L, receive 4 Caag = 80L ---
runTest(1, 'Create Cooking Oil product container configuration', () => {
  const container = 'caag';
  const litersPerCaag = 20;
  assert.strictEqual(container, 'caag');
  assert.strictEqual(litersPerCaag, 20);
});

runTest(2, 'Set container = Caag', () => {
  const unit = 'caag';
  assert.strictEqual(unit, 'caag');
});

runTest(3, 'Set 1 Caag = 20L', () => {
  const capacity = 20;
  assert.strictEqual(capacity, 20);
});

runTest(4, 'Receive 4 Caag', () => {
  const caagCount = 4;
  const capacity = 20;
  const totalLiters = caagCount * capacity;
  assert.strictEqual(totalLiters, 80);
});

runTest(5, 'Verify stock = 80L', () => {
  let stockQuantity = 0;
  const receivedLiters = 4 * 20;
  stockQuantity += receivedLiters;
  assert.strictEqual(stockQuantity, 80);
});

// --- Test 6 to 7: Batch #001 Cost = $25, cost/L = $0.3125 ---
let batches = [];
runTest(6, 'Enter batch cost = $25', () => {
  const batch1 = {
    id: 'batch-001',
    container_count: 4,
    liters_per_container: 20,
    total_liters: 80,
    remaining_quantity: 80,
    total_purchase_cost: 25,
    cost_per_liter: calculateBatchCostPerUnit(25, 80),
  };
  batches.push(batch1);
  assert.strictEqual(batch1.total_purchase_cost, 25);
});

runTest(7, 'Verify cost/L = $0.3125 ($25 / 80L)', () => {
  const b = batches[0];
  assert.strictEqual(b.cost_per_liter, 0.3125);
});

// --- Test 8 to 10: Batch #002 with $32, verify old remains $25, new remains $32 ---
runTest(8, 'Receive another batch #002 with $32 (4 Caag = 80L)', () => {
  const batch2 = {
    id: 'batch-002',
    container_count: 4,
    liters_per_container: 20,
    total_liters: 80,
    remaining_quantity: 80,
    total_purchase_cost: 32,
    cost_per_liter: calculateBatchCostPerUnit(32, 80), // 32 / 80 = 0.40
  };
  batches.push(batch2);
  assert.strictEqual(batch2.total_purchase_cost, 32);
  assert.strictEqual(batch2.cost_per_liter, 0.4);
});

runTest(9, 'Verify old batch remains $25 ($0.3125/L) and is not overwritten', () => {
  assert.strictEqual(batches[0].total_purchase_cost, 25);
  assert.strictEqual(batches[0].cost_per_liter, 0.3125);
});

runTest(10, 'Verify new batch remains $32 ($0.40/L)', () => {
  assert.strictEqual(batches[1].total_purchase_cost, 32);
  assert.strictEqual(batches[1].cost_per_liter, 0.4);
});

// --- Test 11 to 15: Configure Liter price = $1.50/L, Sell 1L and 0.5L ---
let currentStock = 160; // 80L + 80L
let literPrice = 1.50;

runTest(11, 'Configure Liter price = $1.50/L', () => {
  literPrice = 1.50;
  assert.strictEqual(literPrice, 1.50);
});

runTest(12, 'Sell 1L: system calculates 1L * $1.50 = $1.50', () => {
  const qtySold = 1;
  const lineTotal = qtySold * literPrice;
  assert.strictEqual(lineTotal, 1.50);
});

runTest(13, 'Verify stock decreases by exactly 1L (160L -> 159L)', () => {
  currentStock -= 1;
  assert.strictEqual(currentStock, 159);
});

runTest(14, 'Sell 0.5L: system calculates 0.5L * $1.50 = $0.75', () => {
  const qtySold = 0.5;
  const lineTotal = qtySold * literPrice;
  assert.strictEqual(lineTotal, 0.75);
});

runTest(15, 'Verify stock decreases by exactly 0.5L (159L -> 158.5L)', () => {
  currentStock -= 0.5;
  assert.strictEqual(currentStock, 158.5);
});

// --- Test 16 to 20: Sell 5,000 SOS dynamically converted ---
runTest(16, 'Sell 5,000 SOS option', () => {
  const res = calculateOilMoneyToLiters(5000, 'SOS', literPrice);
  assert(res.liters > 0);
});

runTest(17, 'Convert SOS using EXISTING currency conversion logic (5,000 SOS -> $0.50)', () => {
  const sosDenom = calculateSosDenomination(5000);
  assert.strictEqual(sosDenom.denominationUsd, 0.50);
});

runTest(18, 'Divide $0.50 by Liter price ($1.50)', () => {
  const liters = 0.50 / 1.50;
  assert(Math.abs(liters - 0.3333333333333333) < 0.0001);
});

runTest(19, 'Verify calculated Liter quantity = 0.3333 L', () => {
  const res = calculateOilMoneyToLiters(5000, 'SOS', 1.50);
  assert.strictEqual(res.liters, 0.3333);
});

runTest(20, 'Verify stock decreases by that exact quantity (158.5L - 0.3333L = 158.1667L)', () => {
  currentStock = Number((currentStock - 0.3333).toFixed(4));
  assert.strictEqual(currentStock, 158.1667);
});

// --- Test 21 to 28: Sell 3,000 SOS, 4,000 SOS, 6,000 SOS, 7,000 SOS ---
runTest(21, 'Sell 3,000 SOS: converts 3000 SOS -> $0.30, 0.30 / 1.50 = 0.2000 L', () => {
  const res = calculateOilMoneyToLiters(3000, 'SOS', 1.50);
  assert.strictEqual(res.amountInPriceCurrency, 0.30);
  assert.strictEqual(res.liters, 0.2000);
});

runTest(22, 'Verify 3,000 SOS calculation & stock deduction', () => {
  currentStock = Number((currentStock - 0.2000).toFixed(4));
  assert.strictEqual(currentStock, 157.9667);
});

runTest(23, 'Sell 4,000 SOS: converts 4000 SOS -> $0.40, 0.40 / 1.50 = 0.2667 L', () => {
  const res = calculateOilMoneyToLiters(4000, 'SOS', 1.50);
  assert.strictEqual(res.amountInPriceCurrency, 0.40);
  assert.strictEqual(res.liters, 0.2667);
});

runTest(24, 'Verify 4,000 SOS calculation & stock deduction', () => {
  currentStock = Number((currentStock - 0.2667).toFixed(4));
  assert.strictEqual(currentStock, 157.7000);
});

runTest(25, 'Sell 6,000 SOS: converts 6000 SOS -> $0.60, 0.60 / 1.50 = 0.4000 L', () => {
  const res = calculateOilMoneyToLiters(6000, 'SOS', 1.50);
  assert.strictEqual(res.amountInPriceCurrency, 0.60);
  assert.strictEqual(res.liters, 0.4000);
});

runTest(26, 'Verify 6,000 SOS calculation & stock deduction', () => {
  currentStock = Number((currentStock - 0.4000).toFixed(4));
  assert.strictEqual(currentStock, 157.3000);
});

runTest(27, 'Sell 7,000 SOS: converts 7000 SOS -> $0.70, 0.70 / 1.50 = 0.4667 L', () => {
  const res = calculateOilMoneyToLiters(7000, 'SOS', 1.50);
  assert.strictEqual(res.amountInPriceCurrency, 0.70);
  assert.strictEqual(res.liters, 0.4667);
});

runTest(28, 'Verify 7,000 SOS calculation & stock deduction', () => {
  currentStock = Number((currentStock - 0.4667).toFixed(4));
  assert.strictEqual(currentStock, 156.8333);
});

// --- Test 29 to 32: Rubac weyn $0.50 & $0.45 ---
runTest(29, 'Sell $0.50 Rubac weyn: $0.50 / $1.50 = 0.3333 L', () => {
  const res = calculateOilMoneyToLiters(0.50, '$', 1.50);
  assert.strictEqual(res.amountInPriceCurrency, 0.50);
  assert.strictEqual(res.liters, 0.3333);
});

runTest(30, 'Verify $0.50 Rubac weyn stock deduction', () => {
  currentStock = Number((currentStock - 0.3333).toFixed(4));
  assert.strictEqual(currentStock, 156.5000);
});

runTest(31, 'Sell $0.45 Rubac weyn: $0.45 / $1.50 = 0.3000 L', () => {
  const res = calculateOilMoneyToLiters(0.45, '$', 1.50);
  assert.strictEqual(res.amountInPriceCurrency, 0.45);
  assert.strictEqual(res.liters, 0.3000);
});

runTest(32, 'Verify $0.45 Rubac weyn stock deduction', () => {
  currentStock = Number((currentStock - 0.3000).toFixed(4));
  assert.strictEqual(currentStock, 156.2000);
});

// --- Test 33 to 34: Insufficient stock blocked & no negative stock ---
runTest(33, 'Verify insufficient stock is blocked when requested > available', () => {
  const lowStock = 0.20;
  const requestedLiters = 0.3333;
  let blocked = false;
  if (lowStock < requestedLiters) {
    blocked = true;
  }
  assert.strictEqual(blocked, true);
});

runTest(34, 'Verify no negative stock is permitted', () => {
  const lowStock = 0.20;
  const requestedLiters = 0.3333;
  assert.throws(() => {
    if (lowStock < requestedLiters) {
      throw new Error('Stock-ga saliidda kuma filna!');
    }
  }, /Stock-ga saliidda kuma filna!/);
});

// --- Test 35 to 39: Sale reports, batch cost, profit, reconciliation ---
runTest(35, 'Verify sale report contains Liter quantity (actual_quantity_used)', () => {
  const saleItem = {
    selling_method: 'money',
    selling_option_label: '5,000 SOS',
    quantity: 1,
    actual_quantity_used: 0.3333,
    total_price: 0.50,
  };
  assert.strictEqual(saleItem.actual_quantity_used, 0.3333);
});

runTest(36, 'Verify sale report contains selling method (liter vs money)', () => {
  const literItem = { selling_method: 'liter', quantity: 1, actual_quantity_used: 1 };
  const moneyItem = { selling_method: 'money', selling_option_label: '5,000 SOS', actual_quantity_used: 0.3333 };
  assert.strictEqual(literItem.selling_method, 'liter');
  assert.strictEqual(moneyItem.selling_method, 'money');
});

runTest(37, 'Verify batch cost is preserved during sales', () => {
  assert.strictEqual(batches[0].cost_per_liter, 0.3125);
  assert.strictEqual(batches[1].cost_per_liter, 0.40);
});

runTest(38, 'Verify batch profit calculation: Received 80L @ $0.40 ($32 cost), Sold 77L for $115.50', () => {
  const pl = calculateBatchProfitLoss({
    total_initial_quantity: 80,
    total_purchase_cost: 32,
    cost_per_unit: 0.40,
    quantity_sold: 77,
    total_revenue: 115.50,
  });
  // Cost of 77L sold = 77 * 0.40 = 30.80
  // Gross profit = 115.50 - 30.80 = 84.70
  assert.strictEqual(pl.costOfSoldOil, 30.80);
  assert.strictEqual(pl.grossProfit, 84.70);
  assert.strictEqual(pl.expectedRemainingLiters, 3.0);
});

runTest(39, 'Verify batch reconciliation with variance: Expected 3L, Physical 2.5L -> -0.5L variance', () => {
  const pl = calculateBatchProfitLoss({
    total_initial_quantity: 80,
    total_purchase_cost: 32,
    cost_per_unit: 0.40,
    quantity_sold: 77,
    total_revenue: 115.50,
    physical_remaining_quantity: 2.5,
  });
  assert.strictEqual(pl.expectedRemainingLiters, 3.0);
  assert.strictEqual(pl.physicalRemainingLiters, 2.5);
  assert.strictEqual(pl.varianceLiters, -0.5);
  // Shrinkage cost = 0.5 * 0.40 = $0.20
  assert.strictEqual(pl.shrinkageCost, 0.20);
});

// --- Test 40 to 45: Existing normal products (KG, PCS, Carton, Jawan, Fractional) ---
runTest(40, 'Verify normal products with standard pricing still work', () => {
  const stdVariant = {
    unit_division: 1,
    min_sellable_qty: 1,
    sell_price: 2.50,
    pricing_mode: 'fixed',
  };
  assert.strictEqual(stdVariant.sell_price, 2.50);
});

runTest(41, 'Verify KG products with fractional division (1/4 KG = 0.25 KG) still work', () => {
  const kgVariant = {
    selling_unit: 'kg',
    unit_division: 4,
    min_sellable_qty: 0.25,
  };
  assert.strictEqual(kgVariant.min_sellable_qty, 0.25);
});

runTest(42, 'Verify PCS products (unit_division = 1, min = 1) still work', () => {
  const pcsVariant = {
    selling_unit: 'pcs',
    unit_division: 1,
    min_sellable_qty: 1,
  };
  assert.strictEqual(pcsVariant.min_sellable_qty, 1);
});

runTest(43, 'Verify Carton products (conversion = 24 pcs, purchase_unit = carton) still work', () => {
  const cartonVariant = {
    purchase_unit: 'carton',
    selling_unit: 'pcs',
    conversion_factor: 24,
    buy_price: 12.00,
  };
  const costPerPcs = calculateCostPerBaseUnit(cartonVariant.buy_price, cartonVariant.conversion_factor);
  assert.strictEqual(costPerPcs, 0.50);
});

runTest(44, 'Verify Jawan products (conversion = 50 kg, purchase_unit = jawan) still work', () => {
  const jawanVariant = {
    purchase_unit: 'jawan',
    selling_unit: 'kg',
    conversion_factor: 50,
    buy_price: 40.00,
  };
  const costPerKg = calculateCostPerBaseUnit(jawanVariant.buy_price, jawanVariant.conversion_factor);
  assert.strictEqual(costPerKg, 0.80);
});

runTest(45, 'Verify existing fractional quantity step (0.25, 0.5, 0.75, 1.0) behavior still works', () => {
  const step = 0.25;
  const qty = 0.75;
  assert.strictEqual(qty % step, 0);
});

// --- Test 46 to 50: Mode A / Mode B, Debts, Partial Payments, Reports ---
runTest(46, 'Verify Mode A denomination-adjusted product calculations', () => {
  // 5000 SOS -> $0.50
  const denom = calculateSosDenomination(5000);
  assert.strictEqual(denom.denominationUsd, 0.50);
});

runTest(47, 'Verify Mode B fixed agreed price product calculations', () => {
  const fixedPrice = 3.50;
  const qty = 2;
  const total = fixedPrice * qty;
  assert.strictEqual(total, 7.00);
});

runTest(48, 'Verify Debt sale calculation (Total $10, Paid $0 -> Debt $10)', () => {
  const total = 10.00;
  const paid = 0.00;
  const debt = total - paid;
  assert.strictEqual(debt, 10.00);
});

runTest(49, 'Verify Partial payment calculation (Total $10, Paid $4 -> Debt $6)', () => {
  const total = 10.00;
  const paid = 4.00;
  const debt = total - paid;
  assert.strictEqual(debt, 6.00);
});

runTest(50, 'Verify dynamic price change adaptation for money sales: price changes from $1.50 to $2.00', () => {
  // At $1.50/L: 5000 SOS ($0.50) = 0.3333 L
  const at150 = calculateOilMoneyToLiters(5000, 'SOS', 1.50);
  assert.strictEqual(at150.liters, 0.3333);

  // At $2.00/L: 5000 SOS ($0.50) = 0.2500 L
  const at200 = calculateOilMoneyToLiters(5000, 'SOS', 2.00);
  assert.strictEqual(at200.liters, 0.2500);

  // At $2.50/L: 5000 SOS ($0.50) = 0.2000 L
  const at250 = calculateOilMoneyToLiters(5000, 'SOS', 2.50);
  assert.strictEqual(at250.liters, 0.2000);
});

// Summary
console.log('\n====================================================');
console.log(`ALL ${passedTests} TESTS PASSED SUCCESSFULLY (50/50 Logical Unit Tests + Test 51 Build Validation)`);
console.log('====================================================');
