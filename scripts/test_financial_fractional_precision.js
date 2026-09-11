const assert = require('assert');

// Helper for exact cent rounding with epsilon to prevent floating-point representation loss
function roundToCents(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function calculateCartItemLine(unitPrice, unitCost, quantity, itemDiscount = 0) {
  const safeQty = Math.max(0, quantity);
  const safeUnitPrice = Math.max(0, unitPrice);
  const safeCost = Math.max(0, unitCost);
  const rawLineTotal = roundToCents(safeUnitPrice * safeQty);
  const safeDiscount = Math.max(0, Math.min(itemDiscount, rawLineTotal));

  const totalPrice = roundToCents(rawLineTotal - safeDiscount);
  const totalCost = roundToCents(safeCost * safeQty);
  const grossProfit = roundToCents(totalPrice - totalCost);

  return { totalPrice, grossProfit, totalCost };
}

function calculateSaleTotal(items, wholeSaleDiscount = 0) {
  let subtotal = 0;
  let itemDiscounts = 0;
  let costAmount = 0;

  for (const item of items) {
    const qty = item.quantity || 0;
    const price = 'unitPrice' in item ? item.unitPrice : item.unit_price;
    const cost = 'unitCost' in item ? item.unitCost : item.unit_cost;
    const disc = item.discount || 0;

    const lineTotal = roundToCents(price * qty);
    subtotal += lineTotal;
    itemDiscounts += disc;
    costAmount += roundToCents(cost * qty);
  }

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
  };
}

console.log('--- TEST 1: FRACTIONAL QUANTITIES CALCULATION ---');
const testCases = [
  { qty: 0.05, unitPrice: 1.00, expectedLineTotal: 0.05 },
  { qty: 0.10, unitPrice: 0.75, expectedLineTotal: 0.08 }, // 0.075 -> 0.08
  { qty: 0.15, unitPrice: 0.75, expectedLineTotal: 0.11 }, // 0.1125 -> 0.11
  { qty: 0.20, unitPrice: 0.60, expectedLineTotal: 0.12 },
  { qty: 0.25, unitPrice: 0.60, expectedLineTotal: 0.15 },
  { qty: 0.30, unitPrice: 0.60, expectedLineTotal: 0.18 },
  { qty: 0.125, unitPrice: 0.60, expectedLineTotal: 0.08 }, // 0.075 -> 0.08
  { qty: 0.25, unitPrice: 0.60, expectedLineTotal: 0.15 },
  { qty: 0.375, unitPrice: 0.60, expectedLineTotal: 0.23 }, // 0.225 -> 0.23
  { qty: 0.50, unitPrice: 0.60, expectedLineTotal: 0.30 },
  // Integer & clean fractions
  { qty: 1.00, unitPrice: 0.60, expectedLineTotal: 0.60 },
  { qty: 2.50, unitPrice: 1.20, expectedLineTotal: 3.00 },
];

testCases.forEach((tc, idx) => {
  const line = calculateCartItemLine(tc.unitPrice, 0.40, tc.qty, 0);
  console.log(`Case ${idx + 1}: ${tc.qty} @ $${tc.unitPrice.toFixed(2)} => LineTotal: $${line.totalPrice.toFixed(2)} (Expected: $${tc.expectedLineTotal.toFixed(2)})`);
  assert.strictEqual(line.totalPrice, tc.expectedLineTotal, `Mismatch on case ${idx + 1}`);
});

console.log('\n--- TEST 2: CART TOTALS & PAID + DEBT = TOTAL ---');
const cart = [
  { unitPrice: 0.60, unitCost: 0.48, quantity: 0.125, discount: 0 },
  { unitPrice: 0.60, unitCost: 0.48, quantity: 0.375, discount: 0 },
  { unitPrice: 1.50, unitCost: 1.00, quantity: 0.50, discount: 0 },
  { unitPrice: 2.00, unitCost: 1.50, quantity: 0.25, discount: 0 },
];

const totals = calculateSaleTotal(cart, 0);
console.log('Cart subtotal:', totals.subtotal);
console.log('Cart totalAmount:', totals.totalAmount);
assert.strictEqual(totals.subtotal, 1.56);
assert.strictEqual(totals.totalAmount, 1.56);

// Test payment scenarios
const scenarios = [
  { method: 'cash', paidInput: 1.56 },
  { method: 'credit', paidInput: 0 },
  { method: 'partial', paidInput: 0.56 },
  { method: 'partial', paidInput: 1.00 },
];

scenarios.forEach((sc, i) => {
  const totalAmount = totals.totalAmount;
  const amountPaid = sc.method === 'cash' ? totalAmount : Math.min(totalAmount, Math.max(0, sc.paidInput));
  const debtAmount = Math.max(0, roundToCents(totalAmount - amountPaid));
  const sum = roundToCents(amountPaid + debtAmount);
  console.log(`Scenario ${i + 1} (${sc.method}): Total=$${totalAmount}, Paid=$${amountPaid}, Debt=$${debtAmount} => Paid+Debt=$${sum}`);
  assert.strictEqual(sum, totalAmount, `Paid + Debt must equal TotalAmount exactly`);
});

console.log('\nALL FRACTIONAL PRECISION TESTS PASSED 100%!');
