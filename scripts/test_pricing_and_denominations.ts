// Automated test suite for Product Pricing Modes and POS Denomination Logic
// Direct test of TypeScript implementation modules

import { 
  calculateSosDenomination, 
  formatSos, 
  AGREED_DENOMINATIONS 
} from '../src/lib/calculations/denominations';
import { 
  calculateCartItemLine, 
  calculateSaleTotal, 
  formatMoney 
} from '../src/lib/calculations/financials';
import { calculateMinSellableQty, isValidSellableQuantity } from '../src/lib/calculations/stock';
import { CartItem, ProductVariant } from '../src/types';

console.log('==================================================');
console.log('MASTER PRICING & DENOMINATION TEST SUITE (TSX)');
console.log('==================================================\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// ----------------------------------------------------
// TEST A: Product Caano = 5,000 SOS
// Verify:
// No exact denomination exists.
// Next applicable denomination: $0.20 = 6,000 SOS
// Difference: 1,000 SOS
// No debt created.
// ----------------------------------------------------
console.log('--- TEST A: Caano @ 5,000 SOS ---');
const denomA = calculateSosDenomination(5000);
assert(denomA.denominationUsd === 0.20, `Caano 5,000 SOS resolves to $0.20 (got: $${denomA.denominationUsd})`);
assert(denomA.denominationSos === 6000, `Caano 5,000 SOS denomination Sos is 6,000 SOS (got: ${denomA.denominationSos})`);
assert(denomA.differenceSos === 1000, `Caano 5,000 SOS difference remaining is 1,000 SOS (got: ${denomA.differenceSos})`);
assert(!denomA.hasExactDenomination, `No exact denomination exists for 5,000 SOS (hasExactDenomination: ${denomA.hasExactDenomination})`);

// Calculate sale total for Caano
const cartItemA: CartItem = {
  product: { id: 'prod_1', name: 'Caano', shop_id: 'shop_1', category_id: 'cat_1', created_at: '', updated_at: '' },
  variant: { 
    id: 'var_1', 
    product_id: 'prod_1',
    variant_name: 'Qasac', 
    selling_unit: 'PCS', 
    purchase_unit: 'PCS',
    conversion_factor: 1,
    pricing_mode: 'denomination', 
    sos_price: 5000,
    buy_price: 0.10,
    sell_price: 0.20,
    stock_quantity: 50,
    minimum_stock: 5,
    unit_division: 1,
    min_sellable_qty: 1,
    is_active: true,
    created_at: '',
    updated_at: ''
  },
  quantity: 1,
  unitPrice: 0.20,
  unitCost: 0.10,
  grossProfit: 0.10,
  totalCost: 0.10,
  totalPrice: 0.20,
  pricing_mode: 'denomination',
  sosPrice: 5000,
  sosTotal: 5000,
};
const totalA = calculateSaleTotal([cartItemA], 0);
assert(totalA.hasDenominationItems === true, 'Sale identifies denomination items present');
assert(totalA.totalSos === 5000, `Product SOS value is 5,000 SOS (got: ${totalA.totalSos})`);
assert(totalA.denominationUsd === 0.20, `Sale denomination payable is $0.20 (got: $${totalA.denominationUsd})`);
assert(totalA.totalAmount === 0.20, `Sale total amount is $0.20 (got: $${totalA.totalAmount})`);
assert(totalA.differenceSos === 1000, `Remaining difference is 1,000 SOS (got: ${totalA.differenceSos})`);

// ----------------------------------------------------
// TEST B: Caano 5,000 SOS + Other Product 1,000 SOS
// Total: 6,000 SOS
// Payment: $0.20
// Verify sale completes correctly
// ----------------------------------------------------
console.log('\n--- TEST B: Caano 5,000 SOS + Other 1,000 SOS ---');
const cartItemB1 = { ...cartItemA };
const cartItemB2: CartItem = {
  product: { id: 'prod_2', name: 'Buskud', shop_id: 'shop_1', category_id: 'cat_1', created_at: '', updated_at: '' },
  variant: { 
    id: 'var_2', 
    product_id: 'prod_2',
    variant_name: 'Xabbo', 
    selling_unit: 'PCS', 
    purchase_unit: 'PCS',
    conversion_factor: 1,
    pricing_mode: 'denomination', 
    sos_price: 1000,
    buy_price: 0.02,
    sell_price: 0.05,
    stock_quantity: 50,
    minimum_stock: 5,
    unit_division: 1,
    min_sellable_qty: 1,
    is_active: true,
    created_at: '',
    updated_at: ''
  },
  quantity: 1,
  unitPrice: 0.05,
  unitCost: 0.02,
  grossProfit: 0.03,
  totalCost: 0.02,
  totalPrice: 0.05,
  pricing_mode: 'denomination',
  sosPrice: 1000,
  sosTotal: 1000,
};
const totalB = calculateSaleTotal([cartItemB1, cartItemB2], 0);
assert(totalB.totalSos === 6000, `Combined SOS is 6,000 SOS (got: ${totalB.totalSos})`);
assert(totalB.denominationSos === 6000, `Denomination SOS is 6,000 SOS (got: ${totalB.denominationSos})`);
assert(totalB.denominationUsd === 0.20, `Payment denomination is $0.20 (got: $${totalB.denominationUsd})`);
assert(totalB.differenceSos === 0, `Difference remaining is 0 SOS (got: ${totalB.differenceSos})`);
assert(totalB.totalAmount === 0.20, `Sale total amount is $0.20 (got: $${totalB.totalAmount})`);

// ----------------------------------------------------
// TEST C: Pasto 1 bag = $0.50, Sell 8 bags -> Expected $4.00
// ----------------------------------------------------
console.log('\n--- TEST C: Pasto 1 bag = $0.50, Sell 8 bags ---');
const pastoVariant: ProductVariant = {
  id: 'var_pasto',
  product_id: 'prod_pasto',
  variant_name: 'Bac',
  selling_unit: 'PCS',
  purchase_unit: 'Carton',
  conversion_factor: 20,
  sell_price: 0.50,
  buy_price: 0.35,
  pricing_mode: 'fixed',
  stock_quantity: 100,
  minimum_stock: 10,
  unit_division: 1,
  min_sellable_qty: 1,
  is_active: true,
  created_at: '',
  updated_at: ''
};
const pastoLineC = calculateCartItemLine(0.50, 0.35, 8);
assert(pastoLineC.totalPrice === 4.00, `Total price for 8 bags is $4.00 (got: $${pastoLineC.totalPrice})`);

const cartItemPastoC: CartItem = {
  product: { id: 'prod_pasto', name: 'Pasto', shop_id: 'shop_1', category_id: 'cat_1', created_at: '', updated_at: '' },
  variant: pastoVariant,
  quantity: 8,
  unitPrice: 0.50,
  unitCost: 0.35,
  grossProfit: pastoLineC.grossProfit,
  totalCost: pastoLineC.totalCost,
  totalPrice: pastoLineC.totalPrice,
  pricing_mode: 'fixed',
};

const totalC = calculateSaleTotal([cartItemPastoC], 0);
assert(totalC.hasDenominationItems === false, 'Mode B does not trigger denomination adjustments');
assert(totalC.totalAmount === 4.00, `Total amount is exactly $4.00 (got: $${totalC.totalAmount})`);

// ----------------------------------------------------
// TEST D: Pasto 1 bag = $0.50, Sell 9 bags -> Expected $4.50
// ----------------------------------------------------
console.log('\n--- TEST D: Pasto 1 bag = $0.50, Sell 9 bags ---');
const pastoLineD = calculateCartItemLine(0.50, 0.35, 9);
assert(pastoLineD.totalPrice === 4.50, `Total price for 9 bags is $4.50 (got: $${pastoLineD.totalPrice})`);

const cartItemPastoD: CartItem = {
  product: { id: 'prod_pasto', name: 'Pasto', shop_id: 'shop_1', category_id: 'cat_1', created_at: '', updated_at: '' },
  variant: pastoVariant,
  quantity: 9,
  unitPrice: 0.50,
  unitCost: 0.35,
  grossProfit: pastoLineD.grossProfit,
  totalCost: pastoLineD.totalCost,
  totalPrice: pastoLineD.totalPrice,
  pricing_mode: 'fixed',
};

const totalD = calculateSaleTotal([cartItemPastoD], 0);
assert(totalD.totalAmount === 4.50, `Total amount is exactly $4.50 (got: $${totalD.totalAmount})`);

// ----------------------------------------------------
// TEST E: Pasto 20 bags -> Expected $10.00
// ----------------------------------------------------
console.log('\n--- TEST E: Pasto 20 bags ---');
const pastoLineE = calculateCartItemLine(0.50, 0.35, 20);
assert(pastoLineE.totalPrice === 10.00, `Total price for 20 bags is $10.00 (got: $${pastoLineE.totalPrice})`);

const cartItemPastoE: CartItem = {
  product: { id: 'prod_pasto', name: 'Pasto', shop_id: 'shop_1', category_id: 'cat_1', created_at: '', updated_at: '' },
  variant: pastoVariant,
  quantity: 20,
  unitPrice: 0.50,
  unitCost: 0.35,
  grossProfit: pastoLineE.grossProfit,
  totalCost: pastoLineE.totalCost,
  totalPrice: pastoLineE.totalPrice,
  pricing_mode: 'fixed',
};

const totalE = calculateSaleTotal([cartItemPastoE], 0);
assert(totalE.totalAmount === 10.00, `Total amount is exactly $10.00 (got: $${totalE.totalAmount})`);

// ----------------------------------------------------
// TEST F: Product 1 KG division = 4 -> Sell 0.25 KG -> Must be accepted
// ----------------------------------------------------
console.log('\n--- TEST F: Division = 4, Sell 0.25 KG ---');
const stepF = calculateMinSellableQty(4);
const validF = isValidSellableQuantity(0.25, stepF, 'KG');
assert(validF.valid === true, 'Quantity 0.25 KG is accepted for division 4');

// ----------------------------------------------------
// TEST G: Product 1 KG division = 8 -> Sell 0.125 KG -> Must be accepted
// ----------------------------------------------------
console.log('\n--- TEST G: Division = 8, Sell 0.125 KG ---');
const stepG = calculateMinSellableQty(8);
const validG = isValidSellableQuantity(0.125, stepG, 'KG');
assert(validG.valid === true, 'Quantity 0.125 KG is accepted for division 8');

// ----------------------------------------------------
// TEST H: Product 1 KG division = 8 -> Sell 0.10 KG -> Must be rejected as an invalid increment
// ----------------------------------------------------
console.log('\n--- TEST H: Division = 8, Sell 0.10 KG ---');
const stepH = calculateMinSellableQty(8);
const validH = isValidSellableQuantity(0.10, stepH, 'KG');
assert(validH.valid === false, 'Quantity 0.10 KG is rejected for division 8');

// ----------------------------------------------------
// MIXED SALE TEST: Fixed Items + Denomination Items
// Item 1: Pasto 8 bags x $0.50 = $4.00 (Mode B Fixed)
// Item 2: Caano 5,000 SOS -> $0.20 (Mode A Denomination)
// Expected Total: $4.00 + $0.20 = $4.20
// ----------------------------------------------------
console.log('\n--- MIXED SALE TEST: Pasto + Caano ---');
const mixedSaleTotal = calculateSaleTotal([
  cartItemPastoC,
  cartItemA
], 0);
assert(mixedSaleTotal.hasDenominationItems === true, 'Mixed sale identifies denomination items');
assert(mixedSaleTotal.fixedSubtotal === 4.00, `Fixed subtotal is $4.00 (got: $${mixedSaleTotal.fixedSubtotal})`);
assert(mixedSaleTotal.denominationUsd === 0.20, `Denomination payable is $0.20 (got: $${mixedSaleTotal.denominationUsd})`);
assert(mixedSaleTotal.totalAmount === 4.20, `Total payable is exactly $4.20 (got: $${mixedSaleTotal.totalAmount})`);
assert(mixedSaleTotal.differenceSos === 1000, `Remaining difference for Caano is 1,000 SOS (got: ${mixedSaleTotal.differenceSos})`);

// ----------------------------------------------------
// ALL AGREED DENOMINATIONS CHECK
// ----------------------------------------------------
console.log('\n--- AGREED DENOMINATIONS CHECK ---');
const agreed = [
  { sos: 1000, usd: 0.05 },
  { sos: 3000, usd: 0.10 },
  { sos: 4000, usd: 0.15 },
  { sos: 6000, usd: 0.20 },
  { sos: 7000, usd: 0.25 },
];
for (const item of agreed) {
  const calc = calculateSosDenomination(item.sos);
  assert(calc.denominationUsd === item.usd && calc.hasExactDenomination, `${item.sos} SOS matches exact agreed denomination $${item.usd}`);
}

console.log('\n==================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TESTS A THROUGH H PASSED WITH 100% SUCCESS!');
  process.exit(0);
}
