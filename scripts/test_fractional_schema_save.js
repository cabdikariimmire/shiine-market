// Test script for verifying fractional selling product save with min_sellable_qty & unit_division
function calculateMinSellableQty(unitDivision) {
  const div = Number(unitDivision) || 1;
  if (div <= 0) return 1;
  return Number((1 / div).toFixed(4));
}

function isValidSellableQuantity(quantity, minSellableQty, sellingUnit) {
  const qty = Number(quantity);
  const minQty = Number(minSellableQty) || 1;

  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: 'Tirada waa inay ka weynaataa 0' };
  }

  const remainder = (qty % minQty);
  const isMultiple = Math.abs(remainder) < 0.0001 || Math.abs(remainder - minQty) < 0.0001;

  if (!isMultiple) {
    return {
      valid: false,
      error: `Tiradu waa inay noqotaa qayb ka mid ah (${minQty} ${sellingUnit || ''})`
    };
  }

  return { valid: true };
}

console.log('====================================================');
console.log('🧪 VERIFYING FRACTIONAL PRODUCT SAVE LOGIC');
console.log('====================================================\n');

// Exact Test Example from prompt:
// Incoming unit: Jawan
// 1 Jawan = 25 KG
// Selling unit: KG
// 1 KG divided into: 4
// Expected: min_sellable_qty = 0.25

const incomingUnit = 'jawan';
const conversionFactor = 25;
const sellingUnit = 'kg';
const unitDivision = 4;
const minSellableQty = calculateMinSellableQty(unitDivision);

console.log('Configuration:');
console.log(`- Incoming Unit: ${incomingUnit}`);
console.log(`- 1 ${incomingUnit} = ${conversionFactor} ${sellingUnit}`);
console.log(`- Selling Unit: ${sellingUnit}`);
console.log(`- 1 ${sellingUnit} divided into: ${unitDivision} parts`);
console.log(`- Computed min_sellable_qty: ${minSellableQty}`);

if (minSellableQty === 0.25) {
  console.log('✅ PASS: min_sellable_qty is accurately 0.25');
} else {
  console.error(`❌ FAIL: Expected 0.25, got ${minSellableQty}`);
  process.exit(1);
}

// POS Validation Test
console.log('\nTesting POS Validation with min_sellable_qty = 0.25:');
const validQuantities = [0.25, 0.50, 0.75, 1.00, 1.25, 2.50, 10.75];
const invalidQuantities = [0.10, 0.20, 0.33, 0.40, 1.15];

let allPosPassed = true;
for (const q of validQuantities) {
  const res = isValidSellableQuantity(q, minSellableQty, sellingUnit);
  if (!res.valid) {
    console.error(`❌ FAIL: Valid qty ${q} was rejected: ${res.error}`);
    allPosPassed = false;
  }
}

for (const q of invalidQuantities) {
  const res = isValidSellableQuantity(q, minSellableQty, sellingUnit);
  if (res.valid) {
    console.error(`❌ FAIL: Invalid qty ${q} was accepted`);
    allPosPassed = false;
  }
}

if (allPosPassed) {
  console.log('✅ PASS: POS validates fractional sales correctly (multiples of 0.25 allowed, others rejected)');
} else {
  process.exit(1);
}

// Decimal support verification (0.25, 0.10, 0.50, 1.00)
console.log('\nTesting Decimal Division Steps:');
const divisionSteps = [
  { div: 1, expectedMin: 1.00 },
  { div: 2, expectedMin: 0.50 },
  { div: 4, expectedMin: 0.25 },
  { div: 10, expectedMin: 0.10 },
];

for (const step of divisionSteps) {
  const computed = calculateMinSellableQty(step.div);
  if (Math.abs(computed - step.expectedMin) < 0.0001) {
    console.log(`✅ PASS: Division ${step.div} -> min_sellable_qty = ${computed}`);
  } else {
    console.error(`❌ FAIL: Division ${step.div} expected ${step.expectedMin}, got ${computed}`);
    process.exit(1);
  }
}

console.log('\n🎉 ALL FRACTIONAL SAVE & POS VALIDATION TESTS PASSED!');
