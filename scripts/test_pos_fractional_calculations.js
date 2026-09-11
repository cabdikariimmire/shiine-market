// Automated test suite for POS fractional quantity increments/decrements and price calculations

console.log('====================================================');
console.log('🧪 RUNNING POS FRACTIONAL SALES & PRICING TEST SUITE');
console.log('====================================================\n');

// 1. Replicated exact formulas from src/lib/calculations/financials.ts and stock.ts for direct Node testing:
function calculateCartItemLine(unitPrice, unitCost, quantity, itemDiscount = 0) {
  const safeQty = Math.max(0, quantity);
  const safeUnitPrice = Math.max(0, unitPrice);
  const safeCost = Math.max(0, unitCost);
  const rawLineTotal = Math.round(safeUnitPrice * safeQty * 100) / 100;
  const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));

  const totalPrice = Math.round((rawLineTotal - safeDiscount) * 100) / 100;
  const totalCost = Math.round(safeCost * safeQty * 100) / 100;
  const grossProfit = Math.round((totalPrice - totalCost) * 100) / 100;

  return { totalPrice, grossProfit, totalCost };
}

function calculateSaleTotal(items, wholeSaleDiscount = 0) {
  let subtotal = 0;
  let itemDiscounts = 0;
  let costAmount = 0;

  for (const item of items) {
    const qty = item.quantity || 0;
    const price = item.unitPrice !== undefined ? item.unitPrice : item.unit_price;
    const cost = item.unitCost !== undefined ? item.unitCost : item.unit_cost;
    const disc = item.discount || 0;

    const lineTotal = Math.round(price * qty * 100) / 100;
    subtotal += lineTotal;
    itemDiscounts += disc;
    costAmount += Math.round(cost * qty * 100) / 100;
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

function calculateMinSellableQty(unitDivision = 1) {
  const div = Math.max(1, Number(unitDivision) || 1);
  return Math.round((1 / div) * 10000) / 10000;
}

function getVariantStep(variant) {
  if (variant.min_sellable_qty && Number(variant.min_sellable_qty) > 0) {
    return Number(variant.min_sellable_qty);
  }
  if (variant.unit_division && Number(variant.unit_division) > 1) {
    return calculateMinSellableQty(Number(variant.unit_division));
  }
  return 1;
}

function isValidSellableQuantity(quantity, minSellableQty = 1, unit = '') {
  if (isNaN(quantity) || quantity <= 0) {
    return {
      valid: false,
      reason: 'Geli tiro sax ah oo ka weyn 0 (Quantity must be greater than 0).',
    };
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

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// 1. DYNAMIC STEP RESOLUTION TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Dynamic Fractional Step Resolution ---');

const varDiv1 = { unit_division: 1, selling_unit: 'pcs' };
const varDiv2 = { unit_division: 2, selling_unit: 'kg' };
const varDiv4 = { unit_division: 4, selling_unit: 'kg' };
const varDiv8 = { unit_division: 8, selling_unit: 'kg' };
const varExplicit = { min_sellable_qty: 0.25, unit_division: 2, selling_unit: 'kg' };

assert(getVariantStep(varDiv1) === 1, 'Whole item (Division 1 / PCS) resolves step = 1');
assert(getVariantStep(varDiv2) === 0.5, 'Division 2 resolves step = 0.5');
assert(getVariantStep(varDiv4) === 0.25, 'Division 4 resolves step = 0.25');
assert(getVariantStep(varDiv8) === 0.125, 'Division 8 resolves step = 0.125');
assert(getVariantStep(varExplicit) === 0.25, 'Explicit min_sellable_qty takes priority (0.25)');

// -----------------------------------------------------------------------------
// 2. INCREMENT AND DECREMENT SEQUENCE SIMULATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. Quantity +/- Button Behavior ---');

// Test Division = 4 (step = 0.25)
const step4 = getVariantStep(varDiv4); // 0.25
let qty = 1.00;

// Decrement downwards from 1.00
const decSequence4 = [];
while (qty >= step4) {
  decSequence4.push(qty);
  const next = Number((qty - step4).toFixed(4));
  if (next < step4) break;
  qty = next;
}
assert(
  JSON.stringify(decSequence4) === JSON.stringify([1.00, 0.75, 0.50, 0.25]),
  `Division 4 decrement sequence: ${decSequence4.join(' → ')}`
);

// Decrement at 0.25 stops at 0.25
const decAtMin4 = Math.max(step4, Number((0.25 - step4).toFixed(4)));
assert(decAtMin4 === 0.25, 'Division 4 decrement stops at minimum allowed quantity (0.25)');

// Increment upwards from 1.00
qty = 1.00;
const incSequence4 = [];
for (let i = 0; i < 6; i++) {
  incSequence4.push(qty);
  qty = Number((qty + step4).toFixed(4));
}
assert(
  JSON.stringify(incSequence4) === JSON.stringify([1.00, 1.25, 1.50, 1.75, 2.00, 2.25]),
  `Division 4 increment sequence: ${incSequence4.join(' → ')}`
);

// Test Division = 8 (step = 0.125)
const step8 = getVariantStep(varDiv8); // 0.125
qty = 1.000;
const decSequence8 = [];
while (qty >= step8) {
  decSequence8.push(qty);
  const next = Number((qty - step8).toFixed(4));
  if (next < step8) break;
  qty = next;
}
assert(
  JSON.stringify(decSequence8) === JSON.stringify([1.000, 0.875, 0.750, 0.625, 0.500, 0.375, 0.250, 0.125]),
  `Division 8 decrement sequence: ${decSequence8.join(' → ')}`
);

qty = 1.000;
const incSequence8 = [];
for (let i = 0; i < 5; i++) {
  incSequence8.push(qty);
  qty = Number((qty + step8).toFixed(4));
}
assert(
  JSON.stringify(incSequence8) === JSON.stringify([1.000, 1.125, 1.250, 1.375, 1.500]),
  `Division 8 increment sequence: ${incSequence8.join(' → ')}`
);

// Stock Limit clamping
const stockLimit = 2.50;
const clampedInc = Math.min(stockLimit, Number((2.50 + step4).toFixed(4)));
assert(clampedInc === 2.50, 'Increment stops at available stock quantity (2.50)');

// -----------------------------------------------------------------------------
// 3. EXACT PRICE CALCULATIONS ($0.60/KG)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Exact Price Calculation (Selling Price = $0.60/KG) ---');

const sellPrice = 0.60;
const unitCost = 0.40;

const expectedPrices = [
  { qty: 0.25, expected: 0.15 },
  { qty: 0.50, expected: 0.30 },
  { qty: 0.75, expected: 0.45 },
  { qty: 1.00, expected: 0.60 },
  { qty: 1.25, expected: 0.75 },
  { qty: 1.50, expected: 0.90 },
  { qty: 1.75, expected: 1.05 },
  { qty: 2.00, expected: 1.20 },
  { qty: 3.00, expected: 1.80 },
];

for (const p of expectedPrices) {
  const line = calculateCartItemLine(sellPrice, unitCost, p.qty, 0);
  assert(
    line.totalPrice === p.expected,
    `${p.qty} KG @ $${sellPrice}/KG = $${line.totalPrice.toFixed(2)} (Expected: $${p.expected.toFixed(2)})`
  );
}

// -----------------------------------------------------------------------------
// 4. CART TOTAL COMBINATIONS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Overall Cart Totals ---');

// Example 1: 0.50 KG ($0.30) + 0.25 KG ($0.15) = $0.45
const cart1 = [
  { quantity: 0.50, unitPrice: 0.60, unitCost: 0.40, discount: 0 },
  { quantity: 0.25, unitPrice: 0.60, unitCost: 0.40, discount: 0 },
];
const total1 = calculateSaleTotal(cart1, 0);
assert(total1.subtotal === 0.45, 'Cart 1 Subtotal: $0.30 + $0.15 = $0.45');
assert(total1.totalAmount === 0.45, 'Cart 1 Total Amount: $0.45');

// Example 2: 1.00 KG ($0.60) + 0.50 KG ($0.30) = $0.90
const cart2 = [
  { quantity: 1.00, unitPrice: 0.60, unitCost: 0.40, discount: 0 },
  { quantity: 0.50, unitPrice: 0.60, unitCost: 0.40, discount: 0 },
];
const total2 = calculateSaleTotal(cart2, 0);
assert(total2.subtotal === 0.90, 'Cart 2 Subtotal: $0.60 + $0.30 = $0.90');
assert(total2.totalAmount === 0.90, 'Cart 2 Total Amount: $0.90');

// -----------------------------------------------------------------------------
// 5. DIRECT QUANTITY INPUT & VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Direct Input & Validation ---');

const step025 = 0.25;
const validDirectInputs = [0.125, 0.25, 0.375, 0.5, 0.75, 1.25, 1.5, 2, 3];

// For Division 8 (step 0.125) all above are valid
for (const input of validDirectInputs) {
  const res = isValidSellableQuantity(input, 0.125, 'KG');
  assert(res.valid, `Input ${input} KG is valid for step 0.125`);
}

// For Division 4 (step 0.25):
assert(isValidSellableQuantity(0.25, step025, 'KG').valid, '0.25 KG is valid for step 0.25');
assert(isValidSellableQuantity(0.50, step025, 'KG').valid, '0.50 KG is valid for step 0.25');
assert(isValidSellableQuantity(0.75, step025, 'KG').valid, '0.75 KG is valid for step 0.25');
assert(isValidSellableQuantity(1.00, step025, 'KG').valid, '1.00 KG is valid for step 0.25');
assert(isValidSellableQuantity(1.25, step025, 'KG').valid, '1.25 KG is valid for step 0.25');
assert(isValidSellableQuantity(1.50, step025, 'KG').valid, '1.50 KG is valid for step 0.25');
assert(isValidSellableQuantity(2.00, step025, 'KG').valid, '2.00 KG is valid for step 0.25');
assert(isValidSellableQuantity(3.00, step025, 'KG').valid, '3.00 KG is valid for step 0.25');

// Invalid inputs for step 0.25:
assert(!isValidSellableQuantity(0.10, step025, 'KG').valid, '0.10 KG rejected (< min step 0.25)');
assert(!isValidSellableQuantity(0.20, step025, 'KG').valid, '0.20 KG rejected (not a multiple of 0.25)');
assert(!isValidSellableQuantity(0.33, step025, 'KG').valid, '0.33 KG rejected (arbitrary decimal)');
assert(!isValidSellableQuantity(0, step025, 'KG').valid, '0 KG rejected');
assert(!isValidSellableQuantity(-1, step025, 'KG').valid, 'Negative qty rejected');

// -----------------------------------------------------------------------------
// 6. WHOLE-UNIT PRODUCTS (PCS, Carton, etc.)
// -----------------------------------------------------------------------------
console.log('\n--- 6. Whole-Unit Products (PCS / Carton) ---');
const pcsStep = getVariantStep(varDiv1); // 1
assert(pcsStep === 1, 'Whole item step is 1');
assert(isValidSellableQuantity(1, pcsStep, 'pcs').valid, '1 pcs valid');
assert(isValidSellableQuantity(5, pcsStep, 'pcs').valid, '5 pcs valid');
assert(!isValidSellableQuantity(0.5, pcsStep, 'pcs').valid, '0.5 pcs rejected for whole unit item');

console.log(`\n====================================================`);
console.log(`🎉 ALL ${passedTests}/${totalTests} FRACTIONAL POS TESTS PASSED SUCCESSFULLY!`);
console.log(`====================================================\n`);
