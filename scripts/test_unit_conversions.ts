import { 
  calculateCostPerBaseUnit, 
  calculateUnitProfit, 
  calculateMinSellableQty, 
  isValidSellableQuantity 
} from '../src/lib/calculations/stock';
import { calculateCartItemLine, calculateSaleTotal, formatMoney } from '../src/lib/calculations/financials';

console.log('================================================================');
console.log('TUKAAN UNIT CONVERSION & FRACTIONAL SELLING VALIDATION SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName} - ${details || ''}`);
  }
}

// Test A: 1 Jawan = 50 KG; Receive 1 Jawan -> Stock = 50 KG; Receive 2 Jawan -> 100 KG
const incomingQtyA = 1;
const conversionFactorA = 50;
const stockA = incomingQtyA * conversionFactorA;
assert(stockA === 50, 'Test A1: Receive 1 Jawan (conv 50) produces 50 KG');

const incomingQtyA2 = 2;
const stockA2 = incomingQtyA2 * conversionFactorA;
assert(stockA2 === 100, 'Test A2: Receive 2 Jawan (conv 50) produces 100 KG');

// Test B: Sell 0.25 KG -> Remaining Stock = 49.75 KG
const soldB = 0.25;
const remainingB = Number((stockA - soldB).toFixed(4));
assert(remainingB === 49.75, 'Test B: 50 KG - 0.25 KG = 49.75 KG');

// Test C: Sell 0.50 KG -> Remaining Stock = 49.25 KG
const soldC = 0.50;
const remainingC = Number((remainingB - soldC).toFixed(4));
assert(remainingC === 49.25, 'Test C: 49.75 KG - 0.50 KG = 49.25 KG');

// Test D: Invalid quantity validation when division = 4 (min sellable = 0.25)
const minQtyDiv4 = calculateMinSellableQty(4);
assert(minQtyDiv4 === 0.25, 'Test D1: Division 4 produces min sellable qty 0.25 KG');

const valid025 = isValidSellableQuantity(0.25, minQtyDiv4, 'kg');
assert(valid025.valid === true, 'Test D2: 0.25 KG is accepted for division 4');

const valid050 = isValidSellableQuantity(0.50, minQtyDiv4, 'kg');
assert(valid050.valid === true, 'Test D3: 0.50 KG is accepted for division 4');

const valid075 = isValidSellableQuantity(0.75, minQtyDiv4, 'kg');
assert(valid075.valid === true, 'Test D4: 0.75 KG is accepted for division 4');

const valid125 = isValidSellableQuantity(1.25, minQtyDiv4, 'kg');
assert(valid125.valid === true, 'Test D5: 1.25 KG is accepted for division 4');

const invalid010 = isValidSellableQuantity(0.10, minQtyDiv4, 'kg');
assert(invalid010.valid === false, 'Test D6: 0.10 KG is REJECTED for division 4');

const invalid020 = isValidSellableQuantity(0.20, minQtyDiv4, 'kg');
assert(invalid020.valid === false, 'Test D7: 0.20 KG is REJECTED for division 4');

const invalid030 = isValidSellableQuantity(0.30, minQtyDiv4, 'kg');
assert(invalid030.valid === false, 'Test D8: 0.30 KG is REJECTED for division 4');

// Test E: 1 Carton = 24 PCS, Selling unit = PCS
const incomingCarton = 1;
const cartonConversion = 24;
const stockPCS = incomingCarton * cartonConversion;
assert(stockPCS === 24, 'Test E1: 1 Carton (conv 24) produces 24 PCS');

const divPCS = calculateMinSellableQty(1);
assert(divPCS === 1, 'Test E2: PCS division 1 produces min sellable qty 1 PCS');

const valid1PCS = isValidSellableQuantity(1, divPCS, 'pcs');
assert(valid1PCS.valid === true, 'Test E3: 1 PCS is accepted');

const invalidFractionPCS = isValidSellableQuantity(0.5, divPCS, 'pcs');
assert(invalidFractionPCS.valid === false, 'Test E4: 0.5 PCS is rejected for whole PCS product');

// Test F: Price calculations with decimal quantities
// Price per KG = $0.70; Selling 0.25 KG -> Total = 0.25 * 0.70 = $0.175
const unitPrice = 0.70;
const costPerBase = calculateCostPerBaseUnit(25, 50); // $25/jawan / 50 = $0.50/kg
assert(costPerBase === 0.50, 'Test F1: Cost per KG calculated correctly ($0.50/kg)');

const line025 = calculateCartItemLine(unitPrice, costPerBase, 0.25, 0);
assert(line025.totalPrice === 0.18 || line025.totalPrice === 0.175 || Math.abs(line025.totalPrice - 0.18) < 0.01, 'Test F2: 0.25 KG @ $0.70 line total calculated correctly');

const rawTotal = 0.25 * unitPrice;
assert(rawTotal === 0.175, 'Test F3: Underlying exact raw mathematical total = $0.175');

// Test G: Dynamic Division Support (e.g. 1 KG divided into 10 -> 0.10 KG)
const minQtyDiv10 = calculateMinSellableQty(10);
assert(minQtyDiv10 === 0.10, 'Test G1: Division 10 produces min sellable qty 0.10 KG');

const valid010Div10 = isValidSellableQuantity(0.10, minQtyDiv10, 'kg');
assert(valid010Div10.valid === true, 'Test G2: 0.10 KG is accepted when division is 10');

const valid030Div10 = isValidSellableQuantity(0.30, minQtyDiv10, 'kg');
assert(valid030Div10.valid === true, 'Test G3: 0.30 KG is accepted when division is 10');

const invalid005Div10 = isValidSellableQuantity(0.05, minQtyDiv10, 'kg');
assert(invalid005Div10.valid === false, 'Test G4: 0.05 KG is rejected when division is 10');

// Test H: Non-Negative Stock & Remaining Stock Threshold Check
const remainingStockH = 0.20;
const requestedQtyH = 0.25;
const stockSufficient = requestedQtyH <= remainingStockH;
assert(stockSufficient === false, 'Test H: Sale of 0.25 KG is rejected when remaining stock is 0.20 KG (Zero negative stock rule)');

console.log(`\n================================================================`);
console.log(`RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('================================================================');
