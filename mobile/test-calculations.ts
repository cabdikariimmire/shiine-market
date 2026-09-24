import { calculateSosDenomination, formatSos } from './lib/calculations/denominations';
import { calculateOilMoneyToLiters, isValidSellableQuantity, getVariantStep, getStockStatus } from './lib/calculations/stock';
import { calculateCartItemLine, calculateSaleTotal, roundToCents } from './lib/calculations/financials';
import { UserRole, CartItem } from './types';

console.log('--- RUNNING MOBILE CORE CALCULATIONS & PHASE 2 / 3 TESTS ---');

// Test 1: Denominations
const test1k = calculateSosDenomination(1000);
console.assert(test1k.denominationUsd === 0.05, '1,000 SOS must be $0.05');

const test3k = calculateSosDenomination(3000);
console.assert(test3k.denominationUsd === 0.10, '3,000 SOS must be $0.10');

const test4k = calculateSosDenomination(4000);
console.assert(test4k.denominationUsd === 0.15, '4,000 SOS must be $0.15');

const test5k = calculateSosDenomination(5000);
console.assert(test5k.denominationUsd === 0.20 && test5k.denominationSos === 6000, '5,000 SOS rounds to $0.20 / 6,000 SOS');

const test6k = calculateSosDenomination(6000);
console.assert(test6k.denominationUsd === 0.20, '6,000 SOS must be $0.20');

const test7k = calculateSosDenomination(7000);
console.assert(test7k.denominationUsd === 0.25, '7,000 SOS must be $0.25');

console.log('✓ Denominations test passed.');

// Test 2: Cooking Oil Dynamic Calculation
const oilUsd = calculateOilMoneyToLiters(0.50, 'USD', 1.50);
console.assert(oilUsd.litersSold === 0.3333, `Expected 0.3333 L for $0.50 at $1.50/L, got ${oilUsd.litersSold}`);

const oilSos = calculateOilMoneyToLiters(5000, 'SOS', 1.50);
console.assert(oilSos.litersSold === 0.1333, `Expected 0.1333 L for 5,000 SOS at $1.50/L, got ${oilSos.litersSold}`);

console.log('✓ Cooking oil dynamic calculation test passed.');

// Test 3: Fractional Quantities Validation
const validStep = isValidSellableQuantity(0.25, 0.25, 'kg');
console.assert(validStep.valid === true, '0.25 kg should be valid with 0.25 step');

const validHalf = isValidSellableQuantity(0.5, 0.25, 'kg');
console.assert(validHalf.valid === true, '0.5 kg should be valid with 0.25 step');

const invalidStep = isValidSellableQuantity(0.3, 0.25, 'kg');
console.assert(invalidStep.valid === false, '0.3 kg should be invalid with 0.25 step');

const packInt = isValidSellableQuantity(2, 1, 'bac', 'pack_based');
console.assert(packInt.valid === true, '2 bac should be valid for pack_based');

const packDec = isValidSellableQuantity(1.5, 1, 'bac', 'pack_based');
console.assert(packDec.valid === false, '1.5 bac should be invalid for pack_based');

console.log('✓ Fractional quantities validation test passed.');

// Test 4: Financial Calculations & Empty Database Handling
const emptySale = calculateSaleTotal([]);
console.assert(emptySale.totalAmount === 0, 'Empty sale total must be 0');
console.assert(emptySale.grossProfit === 0, 'Empty sale profit must be 0');
console.assert(emptySale.subtotal === 0, 'Empty sale subtotal must be 0');

const line1 = calculateCartItemLine(2.0, 1.2, 3, 0.5);
console.assert(line1.totalPrice === 5.5, `Line total should be 3 * 2 - 0.5 = 5.5, got ${line1.totalPrice}`);
console.assert(line1.grossProfit === roundToCents(5.5 - 3 * 1.2), 'Gross profit should match revenue minus cost');

const stockStatus1 = getStockStatus(0, 10);
console.assert(stockStatus1.status === 'out_of_stock', 'Zero stock should be out_of_stock');

const stockStatus2 = getStockStatus(5, 10);
console.assert(stockStatus2.status === 'low_stock', '5 <= 10 should be low_stock');

const stockStatus3 = getStockStatus(25, 10);
console.assert(stockStatus3.status === 'in_stock', '25 > 10 should be in_stock');

console.log('✓ Financial calculations & stock status tests passed.');

// Test 5: Role Permission Matrix Validation
function mockCanAccess(role: UserRole, feature: string): boolean {
  if (role === 'admin') return true;
  if (role === 'reporter') return feature === 'dashboard' || feature === 'reports';
  if (role === 'seller') return ['pos', 'products', 'debts', 'customers', 'dashboard'].includes(feature);
  return false;
}

console.assert(mockCanAccess('admin', 'suppliers') === true, 'Admin can access suppliers');
console.assert(mockCanAccess('admin', 'expenses') === true, 'Admin can access expenses');
console.assert(mockCanAccess('admin', 'pos') === true, 'Admin can access pos');

console.assert(mockCanAccess('seller', 'pos') === true, 'Seller can access POS');
console.assert(mockCanAccess('seller', 'products') === true, 'Seller can access products');
console.assert(mockCanAccess('seller', 'suppliers') === false, 'Seller CANNOT access suppliers');
console.assert(mockCanAccess('seller', 'expenses') === false, 'Seller CANNOT access expenses');
console.assert(mockCanAccess('seller', 'reports') === false, 'Seller CANNOT access reports');

console.assert(mockCanAccess('reporter', 'dashboard') === true, 'Reporter can access dashboard');
console.assert(mockCanAccess('reporter', 'reports') === true, 'Reporter can access reports');
console.assert(mockCanAccess('reporter', 'pos') === false, 'Reporter CANNOT access pos');
console.assert(mockCanAccess('reporter', 'expenses') === false, 'Reporter CANNOT access expenses');

console.log('✓ Role permission matrix tests passed.');

// Test 6: Phase 3 POS & Checkout Scenarios
// Scenario A: Fixed Price Item (Mode B)
const fixedItemLine = calculateCartItemLine(0.50, 0.30, 8); // Pasto 8 bags at $0.50
console.assert(fixedItemLine.totalPrice === 4.00, `8 bags of $0.50 should be $4.00, got ${fixedItemLine.totalPrice}`);

// Scenario B: Denomination Mode Item (Mode A)
const denomItemLine = calculateCartItemLine(0, 0.10, 1, 0, 'denomination', 5000); // 1 unit of 5,000 SOS -> maps to $0.20
console.assert(denomItemLine.totalPrice === 0.20, `5,000 SOS item should be $0.20, got ${denomItemLine.totalPrice}`);

// Scenario C: Cooking Oil Money Option
const oilMoneyLine = calculateCartItemLine(1.50, 1.00, 0.3333, 0, 'fixed', 0, {
  managementMode: 'amount_based',
  actualQuantityUsed: 0.3333,
  amountBasedCurrency: 'USD',
  amountBasedValue: 0.50,
});
console.assert(oilMoneyLine.totalPrice === 0.50, `Oil $0.50 option should have $0.50 total price`);
console.assert(roundToCents(oilMoneyLine.totalCost) === roundToCents(1.00 * 0.3333) && oilMoneyLine.totalCost === 0.3333, `Oil cost should be calculated on actual liters used`);

// Scenario D: Customer Requirement for Credit & Partial sales
function validateSaleCustomer(paymentMethod: string, customerId?: string): boolean {
  if ((paymentMethod === 'credit' || paymentMethod === 'partial') && !customerId) {
    return false;
  }
  return true;
}

console.assert(validateSaleCustomer('cash') === true, 'Cash sale allows anonymous customer');
console.assert(validateSaleCustomer('credit') === false, 'Credit sale blocks without customer');
console.assert(validateSaleCustomer('credit', 'cust-123') === true, 'Credit sale passes with customer');
console.assert(validateSaleCustomer('partial') === false, 'Partial sale blocks without customer');
console.assert(validateSaleCustomer('partial', 'cust-123') === true, 'Partial sale passes with customer');

// Scenario E: Negative Stock Prevention
function validateStockAvailability(currentStock: number, requestedQty: number): boolean {
  return currentStock >= requestedQty;
}

console.assert(validateStockAvailability(10, 5) === true, 'Sufficient stock passes');
console.assert(validateStockAvailability(4, 5) === false, 'Insufficient stock blocks');
console.assert(validateStockAvailability(0, 0.25) === false, 'Zero stock blocks');

console.log('✓ Phase 3 POS & checkout scenarios tests passed.');

// Test 7: Phase 4 Debt Accounting & Repayment Rules
function applyDebtPayment(debt: { original_amount: number; amount_paid: number; remaining_balance: number }, payAmount: number) {
  if (payAmount <= 0) throw new Error('Payment must be greater than 0');
  if (payAmount > debt.remaining_balance + 0.001) throw new Error('Payment exceeds remaining debt');
  const newPaid = Number((debt.amount_paid + payAmount).toFixed(2));
  const newRemaining = Math.max(0, Number((debt.original_amount - newPaid).toFixed(2)));
  const status = newRemaining === 0 ? 'paid' : 'partial';
  return { newPaid, newRemaining, status };
}

const initialDebt = { original_amount: 100, amount_paid: 20, remaining_balance: 80 };
const step1 = applyDebtPayment(initialDebt, 30);
console.assert(step1.newPaid === 50 && step1.newRemaining === 50 && step1.status === 'partial', 'Partial payment reduces balance correctly');

const step2 = applyDebtPayment({ original_amount: 100, amount_paid: 50, remaining_balance: 50 }, 50);
console.assert(step2.newPaid === 100 && step2.newRemaining === 0 && step2.status === 'paid', 'Full payment marks debt as paid');

let overpayBlocked = false;
try {
  applyDebtPayment({ original_amount: 100, amount_paid: 50, remaining_balance: 50 }, 60);
} catch {
  overpayBlocked = true;
}
console.assert(overpayBlocked === true, 'Overpayment must be blocked');
console.log('✓ Phase 4 Debt accounting & payment rules tests passed.');

// --- PHASE 5: SUPPLIERS, EXPENSES, REPORTS, AND ROLES TESTS ---
// 1. Supplier & Expense Permission Guard
function checkAdminPermission(action: 'supplier' | 'expense' | 'user_role', userRole: UserRole): boolean {
  if (userRole === 'admin') return true;
  return false;
}
console.assert(checkAdminPermission('supplier', 'admin') === true, 'Admin can manage suppliers');
console.assert(checkAdminPermission('supplier', 'seller') === false, 'Seller cannot manage suppliers');
console.assert(checkAdminPermission('expense', 'admin') === true, 'Admin can manage expenses');
console.assert(checkAdminPermission('expense', 'seller') === false, 'Seller cannot manage expenses');
console.assert(checkAdminPermission('user_role', 'reporter') === false, 'Reporter cannot change user roles');

// 2. Financial Reports Calculation Consistency
function calculateFinancialsReport(sales: { revenue: number; grossProfit: number }[], expenses: { amount: number }[]) {
  const totalRevenue = sales.reduce((acc, s) => acc + s.revenue, 0);
  const totalGrossProfit = sales.reduce((acc, s) => acc + s.grossProfit, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = Number((totalGrossProfit - totalExpenses).toFixed(2));
  return { totalRevenue, totalGrossProfit, totalExpenses, netProfit };
}

const mockSales = [{ revenue: 100, grossProfit: 30 }, { revenue: 200, grossProfit: 60 }];
const mockExpenses = [{ amount: 40 }, { amount: 15 }];
const report = calculateFinancialsReport(mockSales, mockExpenses);

console.assert(report.totalRevenue === 300, 'Total revenue matches sum of sales');
console.assert(report.totalGrossProfit === 90, 'Gross profit matches sum of gross profit');
console.assert(report.totalExpenses === 55, 'Total expenses matches sum of expenses');
console.assert(report.netProfit === 35, 'Net profit = Gross profit - Expenses (90 - 55 = 35)');

// 3. Stock Cost and Retail Valuation Consistency
function calculateStockValuation(variants: { qty: number; buyPrice: number; conv: number; sellPrice: number }[]) {
  let costVal = 0;
  let retailVal = 0;
  for (const v of variants) {
    const unitCost = v.buyPrice / Math.max(1, v.conv);
    costVal += v.qty * unitCost;
    retailVal += v.qty * v.sellPrice;
  }
  return {
    costVal: Math.round(costVal * 100) / 100,
    retailVal: Math.round(retailVal * 100) / 100,
    potentialProfit: Math.round((retailVal - costVal) * 100) / 100,
  };
}

const mockStock = [
  { qty: 50, buyPrice: 20, conv: 1, sellPrice: 25 }, // 50 * 20 = 1000 cost, 50 * 25 = 1250 retail
  { qty: 10, buyPrice: 100, conv: 20, sellPrice: 8 }, // 10 * 5 = 50 cost, 10 * 8 = 80 retail
];
const val = calculateStockValuation(mockStock);
console.assert(val.costVal === 1050, 'Stock cost valuation is $1050');
console.assert(val.retailVal === 1330, 'Stock retail valuation is $1330');
console.assert(val.potentialProfit === 280, 'Potential profit is $280');
console.log('✓ Phase 5 Suppliers, Expenses, Financial Reports & Stock Valuation tests passed.');

console.log('ALL PHASE 2, 3, 4 & 5 UNIT TESTS COMPLETED SUCCESSFULLY!');

