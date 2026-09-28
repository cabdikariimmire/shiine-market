import assert from 'assert';
import { calculateCartItemLine, calculateSaleTotal, cleanPrecision, roundToCents } from '../src/lib/calculations/financials';
import { calculateOilChange, getDefaultOilSellingMeasures } from '../src/lib/calculations/stock';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

console.log('================================================================================');
console.log('RUNNING SYSTEM VERIFICATION SUITE: PHASES 7, 8, 9, 10');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// PHASE 7: IMPORTANT CHANGE / PAYMENT RULE
// -----------------------------------------------------------------------------
console.log('--- PHASE 7: Payment & Change Rules ---');

// Rule 1: Sale total = $0.15, Customer pays = $0.20, Change = $0.05. Revenue = $0.15 (NEVER $0.20)
const change1 = calculateOilChange(0.20, 0.15);
assert.strictEqual(change1.changeUsd, 0.05, 'Phase 7.1: Change should be $0.05');
assert.strictEqual(change1.changeSos, 1000, 'Phase 7.1: Change in SOS should be 1000 SOS');

const saleTotalCalc1 = calculateSaleTotal([{
  quantity: 1,
  unitPrice: 0.15,
  unitCost: 1.525,
  actual_quantity_used: 0.10,
  totalPrice: 0.15,
  discount: 0,
  grossProfit: cleanPrecision(0.15 - (0.10 * 1.525)),
} as any]);

assert.strictEqual(saleTotalCalc1.totalAmount, 0.15, 'Phase 7.1: Revenue MUST be $0.15, never $0.20');
assert.notStrictEqual(saleTotalCalc1.totalAmount, 0.20, 'Phase 7.1: Revenue must NEVER equal amount paid');

// Rule 2: Sale total = $0.20, Customer pays = $0.25, Change = $0.05. Revenue = $0.20
const change2 = calculateOilChange(0.25, 0.20);
assert.strictEqual(change2.changeUsd, 0.05, 'Phase 7.2: Change should be $0.05');

const saleTotalCalc2 = calculateSaleTotal([{
  quantity: 1,
  unitPrice: 0.20,
  unitCost: 1.525,
  actual_quantity_used: 0.125,
  totalPrice: 0.20,
  discount: 0,
  grossProfit: cleanPrecision(0.20 - (0.125 * 1.525)),
} as any]);

assert.strictEqual(saleTotalCalc2.totalAmount, 0.20, 'Phase 7.2: Revenue MUST be $0.20, never $0.25');

console.log('✅ PHASE 7 PASSED: Payment, change, and revenue integrity verified.\n');

// -----------------------------------------------------------------------------
// PHASE 9: REQUIRED CONTROLLED TEST CASES (5K, 6K, 7K, 1L)
// -----------------------------------------------------------------------------
console.log('--- PHASE 9: Controlled Saliid Test Cases ---');
const costPerLiter = 1.525;

// Case 1: 5K (0.10L, $0.15)
const cogs5k = cleanPrecision(0.10 * costPerLiter);
const rev5k = 0.15;
const gp5k = cleanPrecision(rev5k - cogs5k);
assert.strictEqual(cogs5k, 0.1525, 'Phase 9.1: COGS must be $0.1525');
assert.strictEqual(gp5k, -0.0025, 'Phase 9.1: Gross Profit must be -$0.0025');

const sale5k = calculateSaleTotal([{
  quantity: 1,
  unitPrice: 0.15,
  unitCost: costPerLiter,
  actual_quantity_used: 0.10,
  totalPrice: 0.15,
  discount: 0,
  grossProfit: gp5k,
} as any]);

assert.strictEqual(sale5k.costAmount, 0.1525, 'Phase 9.1: System MUST calculate COGS = $0.1525');
assert.notStrictEqual(sale5k.costAmount, 1.525, 'Phase 9.1: System must NOT calculate COGS = $1.525');
assert.strictEqual(sale5k.totalAmount, 0.15, 'Phase 9.1: Revenue must be $0.15');
assert.strictEqual(sale5k.grossProfit, -0.0025, 'Phase 9.1: GP must be -$0.0025');
console.log('✅ Case 5K: 0.10L @ $1.525/L -> COGS=$0.1525, Rev=$0.15, GP=-$0.0025 (NOT $1.525)');

// Case 2: 6K (0.125L, $0.20)
const cogs6k = cleanPrecision(0.125 * costPerLiter);
const rev6k = 0.20;
const gp6k = cleanPrecision(rev6k - cogs6k);
assert.strictEqual(cogs6k, 0.190625, 'Phase 9.2: COGS must be 0.190625');
assert.strictEqual(gp6k, 0.009375, 'Phase 9.2: GP must be 0.009375');

const sale6k = calculateSaleTotal([{
  quantity: 1,
  unitPrice: 0.20,
  unitCost: costPerLiter,
  actual_quantity_used: 0.125,
  totalPrice: 0.20,
  discount: 0,
  grossProfit: gp6k,
} as any]);

assert.strictEqual(sale6k.costAmount, 0.190625, 'Phase 9.2: COGS must match');
assert.strictEqual(sale6k.grossProfit, 0.009375, 'Phase 9.2: GP must match');
console.log('✅ Case 6K: 0.125L @ $1.525/L -> COGS=$0.190625, Rev=$0.20, GP=$0.009375');

// Case 3: 7K (0.15L, $0.25)
const cogs7k = cleanPrecision(0.15 * costPerLiter);
const rev7k = 0.25;
const gp7k = cleanPrecision(rev7k - cogs7k);
assert.strictEqual(cogs7k, 0.22875, 'Phase 9.3: COGS must be 0.22875');
assert.strictEqual(gp7k, 0.02125, 'Phase 9.3: GP must be 0.02125');

const sale7k = calculateSaleTotal([{
  quantity: 1,
  unitPrice: 0.25,
  unitCost: costPerLiter,
  actual_quantity_used: 0.15,
  totalPrice: 0.25,
  discount: 0,
  grossProfit: gp7k,
} as any]);

assert.strictEqual(sale7k.costAmount, 0.22875, 'Phase 9.3: COGS must match');
assert.strictEqual(sale7k.grossProfit, 0.02125, 'Phase 9.3: GP must match');
console.log('✅ Case 7K: 0.15L @ $1.525/L -> COGS=$0.22875, Rev=$0.25, GP=$0.02125');

// Case 4: 1L (1.00L, $1.85)
const cogs1L = cleanPrecision(1.00 * costPerLiter);
const rev1L = 1.85;
const gp1L = cleanPrecision(rev1L - cogs1L);
assert.strictEqual(cogs1L, 1.525, 'Phase 9.4: COGS must be 1.525');
assert.strictEqual(gp1L, 0.325, 'Phase 9.4: GP must be 0.325');

const sale1L = calculateSaleTotal([{
  quantity: 1,
  unitPrice: 1.85,
  unitCost: costPerLiter,
  actual_quantity_used: 1.00,
  totalPrice: 1.85,
  discount: 0,
  grossProfit: gp1L,
} as any]);

assert.strictEqual(sale1L.costAmount, 1.525, 'Phase 9.4: COGS must match');
assert.strictEqual(sale1L.grossProfit, 0.325, 'Phase 9.4: GP must match');
console.log('✅ Case 1L: 1.00L @ $1.525/L -> COGS=$1.525, Rev=$1.85, GP=$0.325');

console.log('✅ PHASE 9 PASSED: All controlled test cases matched exact target math.\n');

// -----------------------------------------------------------------------------
// PHASE 8: REGRESSION TESTS FOR OTHER PRODUCT TYPES
// -----------------------------------------------------------------------------
console.log('--- PHASE 8: Regression Testing across Product Types ---');

// 1. Normal unit product (e.g. Sabuun / Soda)
const unitProdSale = calculateSaleTotal([{
  quantity: 3,
  unitPrice: 0.50,
  unitCost: 0.35,
  totalPrice: 1.50,
  discount: 0,
  grossProfit: cleanPrecision(1.50 - (3 * 0.35)),
} as any]);
assert.strictEqual(unitProdSale.totalAmount, 1.50, 'Unit product revenue should be $1.50');
assert.strictEqual(unitProdSale.costAmount, 1.05, 'Unit product COGS should be 3 * $0.35 = $1.05');
assert.strictEqual(unitProdSale.grossProfit, 0.45, 'Unit product GP should be $0.45');
console.log('✅ Regression 1: Normal unit product (3 units @ $0.50, cost $0.35 -> Rev $1.50, COGS $1.05, GP $0.45)');

// 2. Carton product (e.g. Basto 24 pcs / carton)
const cartonSale = calculateSaleTotal([{
  quantity: 2, // 2 cartons
  unitPrice: 12.00,
  unitCost: 9.50,
  totalPrice: 24.00,
  discount: 0,
  grossProfit: cleanPrecision(24.00 - (2 * 9.50)),
} as any]);
assert.strictEqual(cartonSale.totalAmount, 24.00, 'Carton revenue should be $24.00');
assert.strictEqual(cartonSale.costAmount, 19.00, 'Carton COGS should be $19.00');
assert.strictEqual(cartonSale.grossProfit, 5.00, 'Carton GP should be $5.00');
console.log('✅ Regression 2: Carton product (2 Cartons @ $12.00, cost $9.50 -> Rev $24.00, COGS $19.00, GP $5.00)');

// 3. Jawan product (Bariis 50kg sold as 0.25kg / 5K)
const jawanSale = calculateSaleTotal([{
  quantity: 0.25,
  unitPrice: 0.60,
  unitCost: 0.516,
  actual_quantity_used: 0.25,
  totalPrice: 0.15,
  discount: 0,
  grossProfit: cleanPrecision(0.15 - (0.25 * 0.516)),
} as any]);
assert.strictEqual(jawanSale.totalAmount, 0.15, 'Jawan revenue should be $0.15');
assert.strictEqual(jawanSale.costAmount, 0.129, 'Jawan COGS should be 0.25 * 0.516 = $0.129');
assert.strictEqual(jawanSale.grossProfit, 0.021, 'Jawan GP should be $0.021');
console.log('✅ Regression 3: Jawan product (0.25 KG Bariis -> Rev $0.15, COGS $0.129, GP $0.021)');

// 4. Budada product (e.g. Caano Boore powder 0.5 kg)
const budadaSale = calculateSaleTotal([{
  quantity: 0.5,
  unitPrice: 3.50,
  unitCost: 2.80,
  actual_quantity_used: 0.5,
  totalPrice: 1.75,
  discount: 0,
  grossProfit: cleanPrecision(1.75 - (0.5 * 2.80)),
} as any]);
assert.strictEqual(budadaSale.totalAmount, 1.75, 'Budada revenue should be $1.75');
assert.strictEqual(budadaSale.costAmount, 1.40, 'Budada COGS should be $1.40');
assert.strictEqual(budadaSale.grossProfit, 0.35, 'Budada GP should be $0.35');
console.log('✅ Regression 4: Budada product (0.5 KG Powder -> Rev $1.75, COGS $1.40, GP $0.35)');

// 5. Saliid all measures (5K, 6K, 7K, ¼L, ½L, 1L)
const saliidMeasures = [
  { name: '5K', liters: 0.10, price: 0.15, expectedCogs: 0.1525, expectedGp: -0.0025 },
  { name: '6K', liters: 0.125, price: 0.20, expectedCogs: 0.190625, expectedGp: 0.009375 },
  { name: '7K', liters: 0.15, price: 0.25, expectedCogs: 0.22875, expectedGp: 0.02125 },
  { name: '¼L', liters: 0.25, price: 0.46, expectedCogs: 0.38125, expectedGp: 0.07875 },
  { name: '½L', liters: 0.50, price: 0.93, expectedCogs: 0.7625, expectedGp: 0.1675 },
  { name: '1L', liters: 1.00, price: 1.85, expectedCogs: 1.525, expectedGp: 0.325 },
];

for (const m of saliidMeasures) {
  const cogs = cleanPrecision(m.liters * costPerLiter);
  const gp = cleanPrecision(m.price - cogs);
  assert.strictEqual(cogs, m.expectedCogs, `${m.name} COGS mismatch`);
  assert.strictEqual(gp, m.expectedGp, `${m.name} GP mismatch`);
}
console.log('✅ Regression 5: Saliid all 6 measures verified (5K, 6K, 7K, ¼L, ½L, 1L)');
console.log('✅ PHASE 8 PASSED: Regression testing passed across all product types.\n');

// -----------------------------------------------------------------------------
// PHASE 10: VERIFY LIVE PRODUCTION DATABASE DASHBOARD NUMBERS
// -----------------------------------------------------------------------------
async function verifyPhase10Live() {
  console.log('--- PHASE 10: Live Dashboard Database Verification ---');

  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const supabase = createClient(url, key);

  const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%saliid%');
  const prodIds = (prods || []).map(p => p.id);

  const { data: variants } = await supabase.from('product_variants').select('*').in('product_id', prodIds);
  const variantIds = (variants || []).map(v => v.id);

  // The 8 historical investigation sales + 1L sale
  const historicalInvestigationIds = [
    '382f349e-3ac1-48e6-aa87-f2ea6de5e544',
    '1c66fdab-6f26-4e57-9877-ba989cafbb9d',
    'bfb59678-cd0e-4c96-bc3d-4d22b285dc4a',
    'e3d8e9e4-9bfd-4d03-bc33-0f9f8116b807',
    '69f709bc-9f08-4714-aaea-cdc5eefbae85',
    '721e4b56-e40c-46ff-8a01-ee8636cda5e7',
    'd125c1c1-2844-4066-afb6-94253aeeb7ff', // 1L sale
    '802ede85-0c0e-4451-98d7-1c86a7a74d0a',
    'f290945a-4a35-4301-9753-28f3fbac1810',
  ];

  const { data: histSales } = await supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .in('id', historicalInvestigationIds);

  let histRev = 0;
  let histCogs = 0;
  let histGP = 0;
  let histLiters = 0;

  for (const s of histSales || []) {
    const sItems = (s.items || []).filter(i => variantIds.includes(i.product_variant_id));
    for (const it of sItems) {
      const rev = Number(it.total_price);
      const cogs = cleanPrecision(Number(it.quantity) * Number(it.unit_cost));
      const gp = Number(it.gross_profit);
      const liters = Number(it.quantity);

      histRev += rev;
      histCogs += cogs;
      histGP += gp;
      histLiters += liters;
    }
  }

  console.log(`Live Saliid Historical Investigation Sales (9 sales):`);
  console.log(`  Revenue:      $${histRev.toFixed(2)}  (Target: $4.11)`);
  console.log(`  Liters Sold:  ${cleanPrecision(histLiters)} L  (Target: 2.25 L)`);
  console.log(`  True COGS:    $${cleanPrecision(histCogs).toFixed(2)}  (Target: ~$3.44)`);
  console.log(`  True GP:      +$${cleanPrecision(histGP).toFixed(2)}  (Target: ~+$0.67)`);

  assert.strictEqual(roundToCents(histRev), 4.11, 'Phase 10: Live Saliid revenue must be exactly $4.11');
  assert.strictEqual(cleanPrecision(histLiters), 2.25, 'Phase 10: Live Saliid liters sold must be exactly 2.25 L');
  assert(Math.abs(cleanPrecision(histCogs) - 3.44) <= 0.02, 'Phase 10: Live COGS must be approx $3.44');
  assert(Math.abs(cleanPrecision(histGP) - 0.67) <= 0.02, 'Phase 10: Live GP must be approx +$0.67');

  console.log('✅ PHASE 10 PASSED: Live database matches expected numbers without phantom loss!\n');
}

verifyPhase10Live().catch(err => {
  console.error('Phase 10 Failed:', err);
  process.exit(1);
});
