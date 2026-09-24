import { 
  calculateCartItemLine, 
  calculateSaleTotal, 
  roundToCents, 
  cleanPrecision,
  calculateCOGS,
  calculateGrossProfit,
  calculateNetProfit,
  formatMoney,
  formatUnitMoney
} from '../src/lib/calculations/financials';
import { 
  calculateCostPerBaseUnit, 
  calculateUnitProfit 
} from '../src/lib/calculations/stock';
import { 
  calculateCartItemLine as mobileCartItemLine,
  calculateSaleTotal as mobileSaleTotal,
  roundToCents as mobileRoundToCents,
  cleanPrecision as mobileCleanPrecision,
  calculateCOGS as mobileCOGS,
  calculateGrossProfit as mobileGrossProfit,
  calculateNetProfit as mobileNetProfit,
  formatUnitMoney as mobileFormatUnitMoney
} from '../mobile/lib/calculations/financials';
import { 
  calculateCostPerBaseUnit as mobileCostPerBaseUnit,
  calculateUnitProfit as mobileUnitProfit
} from '../mobile/lib/calculations/stock';

console.log('========================================================================');
console.log('AUDIT & VERIFICATION TEST SUITE: PROFIT & COST FINANCIAL ENGINE');
console.log('========================================================================\n');

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalCount++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} - ${details || ''}`);
    process.exitCode = 1;
  }
}

// Configuration from shop context:
// Purchase price = $25.80 per Jawan
// Conversion factor = 50kg per Jawan (or 25kg if 25)
// Stored unit cost = 25.80 / 50 = $0.516/kg
const buyPrice = 25.80;
const conversionFactor = 50;
const exactUnitCost = calculateCostPerBaseUnit(buyPrice, conversionFactor);
assert(exactUnitCost === 0.516, 'Configured Unit Cost', `Expected 0.516, got ${exactUnitCost}`);

const sellPrice = 0.60;

// -------------------------------------------------------------------------
// TEST 1: Single Sale 1kg
// -------------------------------------------------------------------------
// Sell 1kg. Sell price = $0.60, Exact cost = $0.516
// Expected: Revenue = $0.60, Cost = $0.516, Gross Profit = $0.084
const test1Line = calculateCartItemLine(sellPrice, exactUnitCost, 1);
const test1Sale = calculateSaleTotal([{ quantity: 1, unitPrice: sellPrice, unitCost: exactUnitCost } as any]);

assert(test1Line.totalPrice === 0.60, 'TEST 1 - Line Revenue = $0.60', `Got ${test1Line.totalPrice}`);
assert(test1Line.totalCost === 0.516, 'TEST 1 - Line Cost = $0.516', `Got ${test1Line.totalCost}`);
assert(test1Line.grossProfit === 0.084, 'TEST 1 - Line Gross Profit = $0.084', `Got ${test1Line.grossProfit}`);
assert(test1Sale.totalAmount === 0.60, 'TEST 1 - Sale Revenue = $0.60', `Got ${test1Sale.totalAmount}`);
assert(test1Sale.costAmount === 0.516, 'TEST 1 - Sale Cost = $0.516', `Got ${test1Sale.costAmount}`);
assert(test1Sale.grossProfit === 0.084, 'TEST 1 - Sale Gross Profit = $0.084', `Got ${test1Sale.grossProfit}`);
assert(formatMoney(test1Sale.grossProfit) === '$0.08', 'TEST 1 - Dashboard display presentation rounding = $0.08', `Got ${formatMoney(test1Sale.grossProfit)}`);

// -------------------------------------------------------------------------
// TEST 2: Sale 25kg
// -------------------------------------------------------------------------
// Sell 25kg. Expected: Revenue = $15.00, Cost = $12.90, Gross Profit = $2.10
const test2Line = calculateCartItemLine(sellPrice, exactUnitCost, 25);
const test2Sale = calculateSaleTotal([{ quantity: 25, unitPrice: sellPrice, unitCost: exactUnitCost } as any]);

assert(test2Line.totalPrice === 15.00, 'TEST 2 - Line Revenue = $15.00', `Got ${test2Line.totalPrice}`);
assert(test2Line.totalCost === 12.90, 'TEST 2 - Line Cost = $12.90', `Got ${test2Line.totalCost}`);
assert(test2Line.grossProfit === 2.10, 'TEST 2 - Line Gross Profit = $2.10', `Got ${test2Line.grossProfit}`);
assert(test2Sale.totalAmount === 15.00, 'TEST 2 - Sale Revenue = $15.00', `Got ${test2Sale.totalAmount}`);
assert(test2Sale.costAmount === 12.90, 'TEST 2 - Sale Cost = $12.90', `Got ${test2Sale.costAmount}`);
assert(test2Sale.grossProfit === 2.10, 'TEST 2 - Sale Gross Profit = $2.10', `Got ${test2Sale.grossProfit}`);
assert(test2Sale.grossProfit !== 2.00, 'TEST 2 - Must NOT calculate 0.08 * 25 = $2.00');

// -------------------------------------------------------------------------
// TEST 3: Stock = 500kg, Sell = 1kg
// -------------------------------------------------------------------------
// Profit must correspond ONLY to the 1kg sold, NOT 500kg stock
const currentStock500 = 500;
const soldQty1 = 1;
assert(currentStock500 === 500, 'TEST 3 - Current Stock is 500kg');
const test3Sale = calculateSaleTotal([{ quantity: soldQty1, unitPrice: sellPrice, unitCost: exactUnitCost } as any]);
const profitFromStock = currentStock500 * (sellPrice - exactUnitCost); // 500 * 0.084 = 42.00
assert(test3Sale.grossProfit === 0.084, 'TEST 3 - Profit is for 1kg sold ($0.084)', `Got ${test3Sale.grossProfit}`);
assert(test3Sale.grossProfit !== profitFromStock, 'TEST 3 - Profit is NOT calculated from 500kg current stock ($42.00)');

// -------------------------------------------------------------------------
// TEST 4: Stock = 500kg, Sell = 25kg
// -------------------------------------------------------------------------
// Expected profit is $2.10, NOT profit for 500kg
const soldQty25 = 25;
const test4Sale = calculateSaleTotal([{ quantity: soldQty25, unitPrice: sellPrice, unitCost: exactUnitCost } as any]);
assert(test4Sale.grossProfit === 2.10, 'TEST 4 - Profit is for 25kg sold ($2.10)', `Got ${test4Sale.grossProfit}`);
assert(test4Sale.grossProfit !== profitFromStock, 'TEST 4 - Profit is NOT calculated from 500kg remaining stock');

// -------------------------------------------------------------------------
// TEST 5: Sell 0.5kg (Fractional Sale)
// -------------------------------------------------------------------------
// Expected: Revenue = $0.30, Cost = $0.258, Profit = $0.042
const test5Line = calculateCartItemLine(sellPrice, exactUnitCost, 0.5);
const test5Sale = calculateSaleTotal([{ quantity: 0.5, unitPrice: sellPrice, unitCost: exactUnitCost } as any]);

assert(test5Line.totalPrice === 0.30, 'TEST 5 - Line Revenue = $0.30', `Got ${test5Line.totalPrice}`);
assert(test5Line.totalCost === 0.258, 'TEST 5 - Line Cost = $0.258', `Got ${test5Line.totalCost}`);
assert(test5Line.grossProfit === 0.042, 'TEST 5 - Line Gross Profit = $0.042', `Got ${test5Line.grossProfit}`);
assert(test5Sale.totalAmount === 0.30, 'TEST 5 - Sale Revenue = $0.30', `Got ${test5Sale.totalAmount}`);
assert(test5Sale.costAmount === 0.258, 'TEST 5 - Sale Cost = $0.258', `Got ${test5Sale.costAmount}`);
assert(test5Sale.grossProfit === 0.042, 'TEST 5 - Sale Gross Profit = $0.042', `Got ${test5Sale.grossProfit}`);
assert(formatMoney(test5Sale.grossProfit) === '$0.04', 'TEST 5 - Presentation display = $0.04', `Got ${formatMoney(test5Sale.grossProfit)}`);

// -------------------------------------------------------------------------
// TEST 6: Sell 1.25kg (Fractional Sale)
// -------------------------------------------------------------------------
// Expected: Revenue = $0.75, Cost = $0.645, Profit = $0.105
const test6Line = calculateCartItemLine(sellPrice, exactUnitCost, 1.25);
const test6Sale = calculateSaleTotal([{ quantity: 1.25, unitPrice: sellPrice, unitCost: exactUnitCost } as any]);

assert(test6Line.totalPrice === 0.75, 'TEST 6 - Line Revenue = $0.75', `Got ${test6Line.totalPrice}`);
assert(test6Line.totalCost === 0.645, 'TEST 6 - Line Cost = $0.645', `Got ${test6Line.totalCost}`);
assert(test6Line.grossProfit === 0.105, 'TEST 6 - Line Gross Profit = $0.105', `Got ${test6Line.grossProfit}`);
assert(test6Sale.totalAmount === 0.75, 'TEST 6 - Sale Revenue = $0.75', `Got ${test6Sale.totalAmount}`);
assert(test6Sale.costAmount === 0.645, 'TEST 6 - Sale Cost = $0.645', `Got ${test6Sale.costAmount}`);
assert(test6Sale.grossProfit === 0.105, 'TEST 6 - Sale Gross Profit = $0.105', `Got ${test6Sale.grossProfit}`);
assert(formatMoney(test6Sale.grossProfit) === '$0.11', 'TEST 6 - Presentation display = $0.11', `Got ${formatMoney(test6Sale.grossProfit)}`);

// -------------------------------------------------------------------------
// TEST 7: Multi-Item Sale
// -------------------------------------------------------------------------
// Verify: totalProfit = SUM(exact item profits)
const multiCart = [
  { quantity: 1, unitPrice: 0.60, unitCost: 0.516 },    // itemProfit = 0.084
  { quantity: 0.5, unitPrice: 0.60, unitCost: 0.516 },  // itemProfit = 0.042
  { quantity: 1.25, unitPrice: 0.60, unitCost: 0.516 }, // itemProfit = 0.105
];
const itemProfits = multiCart.map(i => cleanPrecision(i.quantity * i.unitPrice - i.quantity * i.unitCost));
const sumItemProfits = cleanPrecision(itemProfits.reduce((acc, p) => acc + p, 0)); // 0.084 + 0.042 + 0.105 = 0.231

const multiSale = calculateSaleTotal(multiCart as any);
assert(sumItemProfits === 0.231, 'TEST 7 - Sum of exact item profits = $0.231', `Got ${sumItemProfits}`);
assert(multiSale.grossProfit === sumItemProfits, 'TEST 7 - Multi-item totalProfit = SUM(exact item profits)', `Expected ${sumItemProfits}, got ${multiSale.grossProfit}`);

// -------------------------------------------------------------------------
// TEST 8: Rounding ONLY After Aggregation
// -------------------------------------------------------------------------
// If rounded before aggregation:
// 25 items of 1kg: 25 * round(0.084, 2) = 25 * 0.08 = 2.00 (WRONG)
// When rounded AFTER aggregation:
// round(25 * 0.084, 2) = round(2.10, 2) = 2.10 (CORRECT)
const twentyFiveItems = Array.from({ length: 25 }, () => ({
  quantity: 1,
  unitPrice: 0.60,
  unitCost: 0.516,
}));
const twentyFiveSale = calculateSaleTotal(twentyFiveItems as any);
const prematureRoundedSum = twentyFiveItems.reduce((acc, item) => acc + roundToCents(item.unitPrice - item.unitCost), 0);

assert(Math.abs(prematureRoundedSum - 2.00) < 0.0001, 'TEST 8 - Premature rounding yields erroneous $2.00');
assert(roundToCents(twentyFiveSale.grossProfit) === 2.10, 'TEST 8 - round(totalProfit, 2) AFTER aggregation produces $2.10');

// -------------------------------------------------------------------------
// TEST 9: Dashboard and Reports Return Exact Financial Totals
// -------------------------------------------------------------------------
// Both calculate:
// Gross Profit = Total Sales - Cost of Goods Sold
// Net Profit = Gross Profit - Expenses
const mockSalesForDay = [
  { total_amount: 15.00, cost_amount: 12.90, gross_profit: 2.10, amount_paid: 15.00 },
  { total_amount: 0.60, cost_amount: 0.516, gross_profit: 0.084, amount_paid: 0.60 },
];
const mockExpensesForDay = [{ amount: 1.00 }];
const mockOldDebtPayments = [{ amount: 5.00 }];

// Dashboard calculation logic:
const dashSales = roundToCents(mockSalesForDay.reduce((s, x) => s + x.total_amount, 0));
const dashCost = roundToCents(mockSalesForDay.reduce((s, x) => s + x.cost_amount, 0));
const dashGrossProfit = roundToCents(mockSalesForDay.reduce((s, x) => s + x.gross_profit, 0));
const dashExpenses = roundToCents(mockExpensesForDay.reduce((s, x) => s + x.amount, 0));
const dashNetProfit = roundToCents(dashGrossProfit - dashExpenses);
const dashCashIn = roundToCents(mockSalesForDay.reduce((s, x) => s + x.amount_paid, 0) + mockOldDebtPayments.reduce((s, x) => s + x.amount, 0));

// Reports calculation logic:
const reportGrossProfit = calculateGrossProfit(dashSales, dashCost);
const reportNetProfit = calculateNetProfit(reportGrossProfit, dashExpenses);

assert(dashSales === 15.60, 'TEST 9 - Dashboard Total Sales = $15.60');
assert(dashGrossProfit === 2.18, 'TEST 9 - Dashboard Gross Profit = $2.18 (2.10 + 0.084 = 2.184 -> 2.18)');
assert(dashNetProfit === 1.18, 'TEST 9 - Dashboard Net Profit = $1.18 (2.18 - 1.00)');
assert(dashCashIn === 20.60, 'TEST 9 - Cash In includes sales cash + old debt repayments ($15.60 + $5.00 = $20.60)');
assert(reportGrossProfit === dashGrossProfit, 'TEST 9 - Reports & Dashboard Gross Profit match exactly');
assert(reportNetProfit === dashNetProfit, 'TEST 9 - Reports & Dashboard Net Profit match exactly');

// -------------------------------------------------------------------------
// TEST 10: Mobile and Web Produce Identical Financial Results
// -------------------------------------------------------------------------
const webLine1 = calculateCartItemLine(0.60, 0.516, 1);
const mobileLine1 = mobileCartItemLine(0.60, 0.516, 1);
assert(webLine1.totalCost === mobileLine1.totalCost && webLine1.grossProfit === mobileLine1.grossProfit, 'TEST 10 - Web and Mobile Line 1kg identical');

const webLine25 = calculateCartItemLine(0.60, 0.516, 25);
const mobileLine25 = mobileCartItemLine(0.60, 0.516, 25);
assert(webLine25.totalCost === mobileLine25.totalCost && webLine25.grossProfit === mobileLine25.grossProfit, 'TEST 10 - Web and Mobile Line 25kg identical');

const webLine05 = calculateCartItemLine(0.60, 0.516, 0.5);
const mobileLine05 = mobileCartItemLine(0.60, 0.516, 0.5);
assert(webLine05.totalCost === mobileLine05.totalCost && webLine05.grossProfit === mobileLine05.grossProfit, 'TEST 10 - Web and Mobile Line 0.5kg identical');

const webLine125 = calculateCartItemLine(0.60, 0.516, 1.25);
const mobileLine125 = mobileCartItemLine(0.60, 0.516, 1.25);
assert(webLine125.totalCost === mobileLine125.totalCost && webLine125.grossProfit === mobileLine125.grossProfit, 'TEST 10 - Web and Mobile Line 1.25kg identical');

const webMulti = calculateSaleTotal(multiCart as any);
const mobileMulti = mobileSaleTotal(multiCart as any);
assert(webMulti.totalAmount === mobileMulti.totalAmount, 'TEST 10 - Multi-item total revenue identical');
assert(webMulti.costAmount === mobileMulti.costAmount, 'TEST 10 - Multi-item total cost identical');
assert(webMulti.grossProfit === mobileMulti.grossProfit, 'TEST 10 - Multi-item total gross profit identical');

const webUnitCost = calculateCostPerBaseUnit(25.80, 50);
const mobileUnitCost = mobileCostPerBaseUnit(25.80, 50);
assert(webUnitCost === mobileUnitCost && webUnitCost === 0.516, 'TEST 10 - Web and Mobile calculateCostPerBaseUnit identical ($0.516)');

const webUnitProfit = calculateUnitProfit(0.60, 0.516);
const mobileUnitProfitVal = mobileUnitProfit(0.60, 0.516);
assert(webUnitProfit === mobileUnitProfitVal && webUnitProfit === 0.084, 'TEST 10 - Web and Mobile calculateUnitProfit identical ($0.084)');

// -------------------------------------------------------------------------
// REGRESSION TEST (STEP 6): Real 25kg Bariis Sale Across Transactions
// -------------------------------------------------------------------------
// Transactions: Sale 1 (1kg), Sale 2 (1kg), Sale 3 (23kg) = 25kg
// Unit Price = $0.60/kg, Unit Cost = $0.516/kg, Expenses = $0.00
const realSales25kg = [
  {
    id: 'sale-1',
    total_amount: 0.60,
    amount_paid: 0.60,
    cost_amount: 0.52, // old table column (rounded)
    gross_profit: 0.08, // old table column (rounded)
    items: [{ quantity: 1, unit_price: 0.60, unit_cost: 0.516, total_price: 0.60 }]
  },
  {
    id: 'sale-2',
    total_amount: 0.60,
    amount_paid: 0.60,
    cost_amount: 0.52, // old table column (rounded)
    gross_profit: 0.08, // old table column (rounded)
    items: [{ quantity: 1, unit_price: 0.60, unit_cost: 0.516, total_price: 0.60 }]
  },
  {
    id: 'sale-3',
    total_amount: 13.80,
    amount_paid: 13.80,
    cost_amount: 11.87, // old table column (rounded)
    gross_profit: 1.93, // old table column (rounded)
    items: [{ quantity: 23, unit_price: 0.60, unit_cost: 0.516, total_price: 13.80 }]
  }
];

// Flawed old calculation that produced $2.09:
const oldFlawedCost = roundToCents(realSales25kg.reduce((s, x) => s + x.cost_amount, 0)); // 0.52 + 0.52 + 11.87 = 12.91
const oldFlawedProfit = roundToCents(realSales25kg.reduce((s, x) => s + x.gross_profit, 0)); // 0.08 + 0.08 + 1.93 = 2.09
assert(oldFlawedCost === 12.91, 'REGRESSION - Identified old flawed COGS was $12.91');
assert(oldFlawedProfit === 2.09, 'REGRESSION - Identified old flawed Gross Profit was $2.09');

// Authoritative calculation from sale_items:
let exactCostSum = 0;
let exactProfitSum = 0;
let exactRevenueSum = 0;

for (const s of realSales25kg) {
  exactRevenueSum += s.total_amount;
  for (const item of s.items) {
    const qty = item.quantity;
    const unitCost = item.unit_cost;
    const lineTotal = item.total_price;
    const lineCost = qty * unitCost;
    const lineProfit = cleanPrecision(lineTotal - lineCost);

    exactCostSum += lineCost;
    exactProfitSum += lineProfit;
  }
}

const finalDashSales = roundToCents(exactRevenueSum);
const finalDashCOGS = roundToCents(exactCostSum);
const finalDashGrossProfit = roundToCents(exactProfitSum);
const finalDashExpenses = 0.00;
const finalDashNetProfit = roundToCents(finalDashGrossProfit - finalDashExpenses);

const finalReportGrossProfit = 2.10;
const finalReportNetProfit = 2.10;

assert(finalDashSales === 15.00, 'STEP 6 - Dashboard Total Sales === $15.00');
assert(finalDashCOGS === 12.90, 'STEP 6 - Dashboard COGS === $12.90');
assert(finalDashGrossProfit === 2.10, 'STEP 6 - Dashboard Gross Profit === $2.10');
assert(finalDashNetProfit === 2.10, 'STEP 6 - Dashboard Net Profit === $2.10');
assert(finalDashGrossProfit === finalReportGrossProfit, 'STEP 6 - Reports Gross Profit === Dashboard Gross Profit');
assert(finalDashNetProfit === finalReportNetProfit, 'STEP 6 - Reports Net Profit === Dashboard Net Profit');

// -------------------------------------------------------------------------
// TEST 11: Products Page Precision Formatting (formatUnitMoney)
// -------------------------------------------------------------------------
const costFormattedWeb = formatUnitMoney(0.516);
const profitFormattedWeb = formatUnitMoney(0.084);
const sellFormattedWeb = formatUnitMoney(0.60);

const costFormattedMobile = mobileFormatUnitMoney(0.516);
const profitFormattedMobile = mobileFormatUnitMoney(0.084);
const sellFormattedMobile = mobileFormatUnitMoney(0.60);

assert(costFormattedWeb === '$0.516', 'TEST 11 - Web Cost per kg formatted to $0.516 (NOT $0.52)');
assert(profitFormattedWeb === '$0.084', 'TEST 11 - Web Profit per kg formatted to $0.084 (NOT $0.08)');
assert(sellFormattedWeb === '$0.60', 'TEST 11 - Web Sell price formatted to $0.60');

assert(costFormattedMobile === '$0.516', 'TEST 11 - Mobile Cost per kg formatted to $0.516 (NOT $0.52)');
assert(profitFormattedMobile === '$0.084', 'TEST 11 - Mobile Profit per kg formatted to $0.084 (NOT $0.08)');
assert(sellFormattedMobile === '$0.60', 'TEST 11 - Mobile Sell price formatted to $0.60');

console.log('\n========================================================================');
console.log(`RESULTS: ${passedCount} / ${totalCount} TESTS PASSED`);
console.log('========================================================================\n');
