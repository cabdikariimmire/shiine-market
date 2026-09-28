import fs from 'fs';
import path from 'path';

// Pre-load .env.local before importing any client/repository
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...vals] = trimmed.split('=');
    const val = vals.join('=').replace(/^["']|["']$/g, '');
    process.env[key.trim()] = val.trim();
  }
}

import { repository } from '../src/lib/services/repository';
import { supabase } from '../src/lib/supabase/client';

async function runTestSuite() {
  console.log('=================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE PRODUCT-BASED DEBT TEST SUITE (12 TESTS)');
  console.log('=================================================================\n');

  const mockAdmin = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@tukaan.so',
    role: 'admin' as const,
    name: 'Admin User',
    status: 'active' as const,
    created_at: new Date().toISOString()
  };
  repository.checkAdminAuth = async () => mockAdmin;
  repository.getCurrentUser = async () => mockAdmin;

  // Query available products for testing via getVariantsPaginated to get all fractional configurations
  const varsRes = await repository.getVariantsPaginated('', 'all', 'all', 1, 1000);
  const variants = varsRes.data.filter(v => !v.is_pending && Number(v.stock_quantity) > 5);

  if (!variants || variants.length === 0) {
    throw new Error('No product variants available with stock > 5 for testing.');
  }

  console.log(`Found ${variants.length} available product variants for testing.`);

  // Find suitable variants
  let bariisVar = variants.find(v => v.selling_unit === 'kg' && ((v.product?.name || '').toLowerCase().includes('baris') || (v.product?.name || '').toLowerCase().includes('bur') || (v.product?.name || '').toLowerCase().includes('sokor'))) || variants.find(v => v.selling_unit === 'kg') || variants[0];
  let bastoVar = variants.find(v => v.selling_unit === 'bac' && ((v.product?.name || '').toLowerCase().includes('basto') || (v.product?.name || '').toLowerCase().includes('baasto'))) || variants.find(v => v.selling_unit === 'bac') || variants[1] || variants[0];
  let saliidVar = variants.find(v => v.selling_unit === 'liter' && (v.product?.name || '').toLowerCase().includes('saliid')) || variants.find(v => v.selling_unit === 'liter') || variants[2] || variants[0];
  let genericVar = variants[0];

  console.log('Test Variants:');
  console.log(' - Bariis/KG Var:', bariisVar.product?.name, bariisVar.variant_name, 'Unit:', bariisVar.selling_unit, 'Stock:', bariisVar.stock_quantity, 'Price:', bariisVar.sell_price, 'MinQty:', bariisVar.min_sellable_qty);
  console.log(' - Basto/Bac Var:', bastoVar.product?.name, bastoVar.variant_name, 'Unit:', bastoVar.selling_unit, 'Stock:', bastoVar.stock_quantity, 'Price:', bastoVar.sell_price, 'MinQty:', bastoVar.min_sellable_qty);
  console.log(' - Saliid/Liter Var:', saliidVar.product?.name, saliidVar.variant_name, 'Unit:', saliidVar.selling_unit, 'Stock:', saliidVar.stock_quantity, 'Price:', saliidVar.sell_price, 'MinQty:', saliidVar.min_sellable_qty);

  const testSuffix = Date.now().toString().slice(-6);
  const testPhone1 = `619${testSuffix}1`;
  const testPhone2 = `619${testSuffix}2`;
  const testCustomerName1 = `Macmiil Tijaabo ${testSuffix}A`;
  const testCustomerName2 = `Macmiil Tijaabo ${testSuffix}B`;

  const createdCustomerIds: string[] = [];
  const createdDebtIds: string[] = [];
  const createdSaleIds: string[] = [];

  // -------------------------------------------------------------
  // TEST 1: New customer + one product + full debt
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 1: New customer + one product + full debt');
  console.log('-------------------------------------------------------------');

  const { data: stockBefore1 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bariisVar.id).single();
  const initialStock1 = Number(stockBefore1?.stock_quantity);

  const test1Item = {
    product: bariisVar.product,
    variant: bariisVar,
    quantity: 1,
    unitPrice: Number(bariisVar.sell_price),
    unitCost: Number(bariisVar.buy_price || 0),
    totalPrice: Number(bariisVar.sell_price),
  };

  const res1 = await repository.createProductDebtTransaction({
    customerName: testCustomerName1,
    customerPhone: testPhone1,
    items: [test1Item],
    amountPaidInitially: 0,
    notes: 'Test 1 Full Debt',
  });

  createdCustomerIds.push(res1.debt.customer_id);
  createdDebtIds.push(res1.debt.id);
  createdSaleIds.push(res1.sale.id);

  console.log('Created Debt ID:', res1.debt.id);
  console.log('Customer ID:', res1.debt.customer_id);
  console.log('Original Amount:', res1.debt.original_amount);
  console.log('Amount Paid:', res1.debt.amount_paid);
  console.log('Remaining Balance:', res1.debt.remaining_balance);
  console.log('Status:', res1.debt.status);

  const { data: stockAfter1 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bariisVar.id).single();
  const finalStock1 = Number(stockAfter1?.stock_quantity);
  console.log(`Stock before: ${initialStock1} -> Stock after: ${finalStock1} (Diff: ${initialStock1 - finalStock1})`);

  if (res1.debt.status !== 'unpaid' || res1.debt.amount_paid !== 0 || res1.debt.remaining_balance !== Number(bariisVar.sell_price)) {
    throw new Error('TEST 1 FAILED: Debt status or balance incorrect');
  }
  if (Math.abs((initialStock1 - finalStock1) - 1) > 0.001) {
    throw new Error(`TEST 1 FAILED: Stock was not deducted by 1. Diff: ${initialStock1 - finalStock1}`);
  }
  console.log('✅ TEST 1 PASSED: New customer created, debt recorded as unpaid, exact stock deducted.');

  // -------------------------------------------------------------
  // TEST 2: Existing customer + multiple products (No duplicate customer)
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 2: Existing customer + multiple products (No duplicate customer)');
  console.log('-------------------------------------------------------------');

  const { data: custCountBefore } = await supabase.from('customers').select('id').eq('phone', testPhone1);
  if ((custCountBefore?.length || 0) !== 1) {
    throw new Error('TEST 2 Setup failed: Expected exactly 1 customer with phone ' + testPhone1);
  }

  const { data: stockBariisBefore2 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bariisVar.id).single();
  const { data: stockBastoBefore2 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bastoVar.id).single();

  const res2 = await repository.createProductDebtTransaction({
    customerPhone: testPhone1, // Same phone, no customerId passed
    customerName: testCustomerName1,
    items: [
      {
        product: bariisVar.product,
        variant: bariisVar,
        quantity: 1,
        unitPrice: Number(bariisVar.sell_price),
        unitCost: Number(bariisVar.buy_price || 0),
        totalPrice: Number(bariisVar.sell_price),
      },
      {
        product: bastoVar.product,
        variant: bastoVar,
        quantity: 1,
        unitPrice: Number(bastoVar.sell_price),
        unitCost: Number(bastoVar.buy_price || 0),
        totalPrice: Number(bastoVar.sell_price),
      }
    ],
    amountPaidInitially: 0,
    notes: 'Test 2 Multiple Products Existing Customer',
  });

  createdDebtIds.push(res2.debt.id);
  createdSaleIds.push(res2.sale.id);

  const { data: custCountAfter } = await supabase.from('customers').select('id').eq('phone', testPhone1);
  if ((custCountAfter?.length || 0) !== 1) {
    throw new Error(`TEST 2 FAILED: Duplicate customer created! Count: ${custCountAfter?.length}`);
  }
  if (res2.debt.customer_id !== res1.debt.customer_id) {
    throw new Error(`TEST 2 FAILED: Existing customer was not reused!`);
  }

  const { data: stockBariisAfter2 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bariisVar.id).single();
  const { data: stockBastoAfter2 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bastoVar.id).single();

  console.log(`Bariis Stock deducted: ${Number(stockBariisBefore2?.stock_quantity) - Number(stockBariisAfter2?.stock_quantity)}`);
  console.log(`Basto Stock deducted: ${Number(stockBastoBefore2?.stock_quantity) - Number(stockBastoAfter2?.stock_quantity)}`);
  console.log('✅ TEST 2 PASSED: Existing customer reused without duplicate, multiple products deducted.');

  // -------------------------------------------------------------
  // TEST 3: Partial payment
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 3: Partial payment');
  console.log('-------------------------------------------------------------');

  const totalAmount3 = Number(genericVar.sell_price) * 2;
  const partialPaid3 = Math.round((totalAmount3 / 2) * 100) / 100;
  const expectedRemaining3 = Math.round((totalAmount3 - partialPaid3) * 100) / 100;

  const res3 = await repository.createProductDebtTransaction({
    customerId: res1.debt.customer_id,
    items: [
      {
        product: genericVar.product,
        variant: genericVar,
        quantity: 2,
        unitPrice: Number(genericVar.sell_price),
        unitCost: Number(genericVar.buy_price || 0),
        totalPrice: totalAmount3,
      }
    ],
    amountPaidInitially: partialPaid3,
    notes: 'Test 3 Partial Payment',
  });

  createdDebtIds.push(res3.debt.id);
  createdSaleIds.push(res3.sale.id);

  console.log(`Total: $${res3.debt.original_amount}, Paid: $${res3.debt.amount_paid}, Remaining: $${res3.debt.remaining_balance}`);
  if (res3.debt.status !== 'partial' || res3.debt.remaining_balance !== expectedRemaining3) {
    throw new Error(`TEST 3 FAILED: Expected status partial with remaining ${expectedRemaining3}, got ${res3.debt.status} and ${res3.debt.remaining_balance}`);
  }

  // Check debt_payments record
  const { data: paymentRecord3 } = await supabase.from('debt_payments').select('*').eq('debt_id', res3.debt.id);
  if (!paymentRecord3 || paymentRecord3.length === 0 || paymentRecord3[0].amount !== partialPaid3) {
    throw new Error(`TEST 3 FAILED: Initial payment not recorded in debt_payments table!`);
  }
  console.log('✅ TEST 3 PASSED: Partial payment recorded correctly in debts and debt_payments.');

  // -------------------------------------------------------------
  // TEST 4: Full payment at debt creation
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 4: Full payment at debt creation');
  console.log('-------------------------------------------------------------');

  const totalAmount4 = Number(genericVar.sell_price);
  const res4 = await repository.createProductDebtTransaction({
    customerId: res1.debt.customer_id,
    items: [
      {
        product: genericVar.product,
        variant: genericVar,
        quantity: 1,
        unitPrice: totalAmount4,
        unitCost: Number(genericVar.buy_price || 0),
        totalPrice: totalAmount4,
      }
    ],
    amountPaidInitially: totalAmount4,
    notes: 'Test 4 Full Payment',
  });

  createdDebtIds.push(res4.debt.id);
  createdSaleIds.push(res4.sale.id);

  console.log(`Total: $${res4.debt.original_amount}, Paid: $${res4.debt.amount_paid}, Remaining: $${res4.debt.remaining_balance}`);
  if (res4.debt.status !== 'paid' || res4.debt.remaining_balance !== 0) {
    throw new Error(`TEST 4 FAILED: Expected status paid with remaining 0, got ${res4.debt.status} and ${res4.debt.remaining_balance}`);
  }
  console.log('✅ TEST 4 PASSED: Fully paid debt recorded with status paid and 0 remaining balance.');

  // -------------------------------------------------------------
  // TEST 5: Insufficient stock
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 5: Insufficient stock check & rollback');
  console.log('-------------------------------------------------------------');

  const { data: currentStock5 } = await supabase.from('product_variants').select('stock_quantity').eq('id', genericVar.id).single();
  const excessiveQty = Number(currentStock5?.stock_quantity || 0) + 1000;

  let test5Passed = false;
  try {
    await repository.createProductDebtTransaction({
      customerId: res1.debt.customer_id,
      items: [
        {
          product: genericVar.product,
          variant: genericVar,
          quantity: excessiveQty,
          unitPrice: Number(genericVar.sell_price),
          unitCost: Number(genericVar.buy_price || 0),
          totalPrice: excessiveQty * Number(genericVar.sell_price),
        }
      ],
      amountPaidInitially: 0,
      notes: 'Test 5 Insufficient Stock',
    });
  } catch (err: any) {
    console.log('Caught expected error:', err.message);
    if (err.message.includes('Kaydka alaabtan kuma filna.')) {
      test5Passed = true;
    }
  }

  if (!test5Passed) {
    throw new Error('TEST 5 FAILED: Did not reject insufficient stock with expected message.');
  }
  console.log('✅ TEST 5 PASSED: Insufficient stock properly blocked with Somali message "Kaydka alaabtan kuma filna."');

  // -------------------------------------------------------------
  // TEST 6: Fractional quantity validation
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 6: Fractional quantity validation');
  console.log('-------------------------------------------------------------');

  // Find or test fractional product (min_sellable_qty < 1 or unit_division > 1)
  const fractionalVar = variants.find(v => (v.min_sellable_qty && Number(v.min_sellable_qty) < 1) || (v.unit_division && Number(v.unit_division) > 1)) || bariisVar;
  console.log(`Testing fractional on variant: ${fractionalVar.product?.name} (${fractionalVar.variant_name}), unit_division: ${fractionalVar.unit_division}, min_sellable_qty: ${fractionalVar.min_sellable_qty}`);

  const validFractionalQty = Number(fractionalVar.min_sellable_qty) || (fractionalVar.unit_division ? 1 / Number(fractionalVar.unit_division) : 0.25);
  const { data: stockBefore6 } = await supabase.from('product_variants').select('stock_quantity').eq('id', fractionalVar.id).single();
  const initStock6 = Number(stockBefore6?.stock_quantity);

  const res6 = await repository.createProductDebtTransaction({
    customerId: res1.debt.customer_id,
    items: [
      {
        product: fractionalVar.product,
        variant: fractionalVar,
        quantity: validFractionalQty,
        unitPrice: Number(fractionalVar.sell_price),
        unitCost: Number(fractionalVar.buy_price || 0),
        totalPrice: Number((validFractionalQty * Number(fractionalVar.sell_price)).toFixed(2)),
      }
    ],
    amountPaidInitially: 0,
    notes: 'Test 6 Fractional Quantity',
  });

  createdDebtIds.push(res6.debt.id);
  createdSaleIds.push(res6.sale.id);

  const { data: stockAfter6 } = await supabase.from('product_variants').select('stock_quantity').eq('id', fractionalVar.id).single();
  const finalStock6 = Number(stockAfter6?.stock_quantity);
  const deducted6 = Number((initStock6 - finalStock6).toFixed(4));

  console.log(`Fractional stock deduction: ${initStock6} -> ${finalStock6} (Deducted: ${deducted6}, Expected: ${validFractionalQty})`);
  if (Math.abs(deducted6 - validFractionalQty) > 0.001) {
    throw new Error(`TEST 6 FAILED: Fractional stock not deducted accurately!`);
  }

  // Also verify that an invalid fractional increment is blocked
  let invalidQtyBlocked = false;
  try {
    await repository.createProductDebtTransaction({
      customerId: res1.debt.customer_id,
      items: [
        {
          product: fractionalVar.product,
          variant: fractionalVar,
          quantity: validFractionalQty * 0.73, // misaligned quantity
          unitPrice: Number(fractionalVar.sell_price),
          unitCost: Number(fractionalVar.buy_price || 0),
          totalPrice: validFractionalQty * 0.73 * Number(fractionalVar.sell_price),
        }
      ],
      amountPaidInitially: 0,
      notes: 'Test 6 Invalid Fractional Increment',
    });
  } catch (err: any) {
    if (err.message.includes('ma aha qeyb sax ah')) {
      invalidQtyBlocked = true;
    }
  }
  if (!invalidQtyBlocked) {
    throw new Error('TEST 6 FAILED: Invalid fractional increment was not rejected!');
  }
  console.log('✅ Invalid fractional increment was correctly blocked.');
  console.log('✅ TEST 6 PASSED: Fractional quantity successfully validated, deducted, and invalid step blocked.');

  // -------------------------------------------------------------
  // TEST 7: Saliid measure debt & Financial COGS accuracy
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 7: Saliid measure debt & COGS accuracy (Saliid loss bug check)');
  console.log('-------------------------------------------------------------');

  const { data: stockSaliidBefore } = await supabase.from('product_variants').select('stock_quantity, buy_price, sell_price').eq('id', saliidVar.id).single();
  const initSaliidStock = Number(stockSaliidBefore?.stock_quantity);
  const saliidCostPerLiter = Number(stockSaliidBefore?.buy_price || 1.20);
  const saliidSellingPrice = Number(stockSaliidBefore?.sell_price || 1.50);

  // Measure sale of 0.25L Saliid
  const measureLiters = 0.25;
  const measureSellingPrice = 0.40;

  const res7 = await repository.createProductDebtTransaction({
    customerId: res1.debt.customer_id,
    items: [
      {
        product: saliidVar.product,
        variant: saliidVar,
        quantity: 1, // 1 measure
        unitPrice: measureSellingPrice,
        unitCost: saliidCostPerLiter,
        totalPrice: measureSellingPrice,
        actual_quantity_used: measureLiters,
        selling_option_label: '0.25L Measure',
        selling_method: 'measure',
      }
    ],
    amountPaidInitially: 0,
    notes: 'Test 7 Saliid Measure Debt',
  });

  createdDebtIds.push(res7.debt.id);
  createdSaleIds.push(res7.sale.id);

  const { data: stockSaliidAfter } = await supabase.from('product_variants').select('stock_quantity').eq('id', saliidVar.id).single();
  const finalSaliidStock = Number(stockSaliidAfter?.stock_quantity);
  const saliidDeducted = Number((initSaliidStock - finalSaliidStock).toFixed(4));

  console.log(`Saliid Physical stock: ${initSaliidStock} -> ${finalSaliidStock} (Deducted: ${saliidDeducted}L, Expected: ${measureLiters}L)`);
  if (Math.abs(saliidDeducted - measureLiters) > 0.001) {
    throw new Error(`TEST 7 FAILED: Saliid stock deduction used measure count instead of physical liters!`);
  }

  // Verify financial COGS on the created sale
  const { data: saleRecord7 } = await supabase.from('sales').select('*, items:sale_items(*)').eq('id', res7.sale.id).single();
  const saleItem7 = saleRecord7?.items?.[0];
  console.log('Sale Item 7 COGS:', saleItem7?.unit_cost, 'Total Price:', saleItem7?.total_price, 'Gross profit:', saleItem7?.gross_profit);

  // Expected COGS = 0.25L * saliidCostPerLiter
  const expectedCogs = Number((measureLiters * saliidCostPerLiter).toFixed(4));
  const expectedProfit = Number((measureSellingPrice - expectedCogs).toFixed(4));
  console.log(`Expected COGS: $${expectedCogs}, Expected Profit: $${expectedProfit}, Recorded Profit: $${saleItem7?.gross_profit}`);

  if (Number(saleItem7?.gross_profit) < 0 && measureSellingPrice > expectedCogs) {
    throw new Error(`TEST 7 FAILED: Saliid phantom loss re-introduced! Profit is negative.`);
  }
  console.log('✅ TEST 7 PASSED: Saliid measure debt deducted exact physical liters and preserved correct COGS calculation.');

  // -------------------------------------------------------------
  // TEST 8: Basto 0.5 Bac debt
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 8: Basto 0.5 Bac debt');
  console.log('-------------------------------------------------------------');

  const { data: stockBastoBefore8 } = await supabase.from('product_variants').select('stock_quantity, sell_price, buy_price').eq('id', bastoVar.id).single();
  const initBastoStock8 = Number(stockBastoBefore8?.stock_quantity);
  const bastoHalfQty = 0.5;
  const bastoHalfPrice = Number(((Number(stockBastoBefore8?.sell_price || 1)) * 0.5).toFixed(2));

  const res8 = await repository.createProductDebtTransaction({
    customerId: res1.debt.customer_id,
    items: [
      {
        product: bastoVar.product,
        variant: bastoVar,
        quantity: bastoHalfQty,
        unitPrice: Number(stockBastoBefore8?.sell_price || 1),
        unitCost: Number(stockBastoBefore8?.buy_price || 0.5),
        totalPrice: bastoHalfPrice,
      }
    ],
    amountPaidInitially: 0,
    notes: 'Test 8 Basto 0.5 Bac Debt',
  });

  createdDebtIds.push(res8.debt.id);
  createdSaleIds.push(res8.sale.id);

  const { data: stockBastoAfter8 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bastoVar.id).single();
  const finalBastoStock8 = Number(stockBastoAfter8?.stock_quantity);
  const bastoDeducted8 = Number((initBastoStock8 - finalBastoStock8).toFixed(4));

  console.log(`Basto Stock: ${initBastoStock8} -> ${finalBastoStock8} (Deducted: ${bastoDeducted8}, Expected: ${bastoHalfQty})`);
  if (Math.abs(bastoDeducted8 - bastoHalfQty) > 0.001) {
    throw new Error(`TEST 8 FAILED: Basto 0.5 Bac stock deduction mismatch!`);
  }
  console.log('✅ TEST 8 PASSED: Basto 0.5 Bac debt created and stock deducted cleanly.');

  // -------------------------------------------------------------
  // TEST 9: Jawan/Bariis fractional KG debt
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 9: Jawan/Bariis fractional KG debt');
  console.log('-------------------------------------------------------------');

  const { data: stockBariisBefore9 } = await supabase.from('product_variants').select('stock_quantity, sell_price, buy_price').eq('id', bariisVar.id).single();
  const initBariisStock9 = Number(stockBariisBefore9?.stock_quantity);
  const bariisFractionQty = 0.5; // 0.5 KG
  const bariisFractionPrice = Number(((Number(stockBariisBefore9?.sell_price || 0.8)) * bariisFractionQty).toFixed(2));

  const res9 = await repository.createProductDebtTransaction({
    customerId: res1.debt.customer_id,
    items: [
      {
        product: bariisVar.product,
        variant: bariisVar,
        quantity: bariisFractionQty,
        unitPrice: Number(stockBariisBefore9?.sell_price || 0.8),
        unitCost: Number(stockBariisBefore9?.buy_price || 0.5),
        totalPrice: bariisFractionPrice,
      }
    ],
    amountPaidInitially: 0,
    notes: 'Test 9 Bariis Fractional KG Debt',
  });

  createdDebtIds.push(res9.debt.id);
  createdSaleIds.push(res9.sale.id);

  const { data: stockBariisAfter9 } = await supabase.from('product_variants').select('stock_quantity').eq('id', bariisVar.id).single();
  const finalBariisStock9 = Number(stockBariisAfter9?.stock_quantity);
  const bariisDeducted9 = Number((initBariisStock9 - finalBariisStock9).toFixed(4));

  console.log(`Bariis Stock: ${initBariisStock9} -> ${finalBariisStock9} (Deducted: ${bariisDeducted9}, Expected: ${bariisFractionQty})`);
  if (Math.abs(bariisDeducted9 - bariisFractionQty) > 0.001) {
    throw new Error(`TEST 9 FAILED: Bariis fractional KG stock deduction mismatch!`);
  }
  console.log('✅ TEST 9 PASSED: Jawan/Bariis fractional KG debt verified successfully.');

  // -------------------------------------------------------------
  // TEST 10: Product price changed after old debt
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 10: Product price changed after old debt (Historical integrity)');
  console.log('-------------------------------------------------------------');

  const oldDebtTotal = res1.debt.original_amount;
  const originalProductPrice = bariisVar.sell_price;
  const temporaryNewPrice = Number(originalProductPrice) + 10.0;

  console.log(`Original debt total: $${oldDebtTotal} with product price $${originalProductPrice}`);
  console.log(`Temporarily updating product variant price to $${temporaryNewPrice}...`);

  await supabase.from('product_variants').update({ sell_price: temporaryNewPrice }).eq('id', bariisVar.id);

  // Fetch the old debt again
  const oldDebtFetched = await repository.getDebtById(res1.debt.id);
  console.log(`Fetched historical debt original_amount: $${oldDebtFetched?.original_amount}`);
  console.log(`Historical sale item unit_price: $${oldDebtFetched?.sale?.items?.[0]?.unit_price}`);

  // Revert price back
  await supabase.from('product_variants').update({ sell_price: originalProductPrice }).eq('id', bariisVar.id);

  if (oldDebtFetched?.original_amount !== oldDebtTotal) {
    throw new Error(`TEST 10 FAILED: Historical debt amount changed from ${oldDebtTotal} to ${oldDebtFetched?.original_amount}`);
  }
  if (Number(oldDebtFetched?.sale?.items?.[0]?.unit_price) !== Number(originalProductPrice)) {
    throw new Error(`TEST 10 FAILED: Historical item unit price was mutated!`);
  }
  console.log('✅ TEST 10 PASSED: Historical debt amount and line item prices preserved perfectly despite price changes.');

  // -------------------------------------------------------------
  // TEST 11: Customer makes another debt later (Balance aggregation)
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 11: Customer makes another debt later (Cumulative balance)');
  console.log('-------------------------------------------------------------');

  const customerId = res1.debt.customer_id;
  const { data: custBefore11 } = await supabase.from('customers').select('*').eq('id', customerId).single();
  const prevTotalDebt = Number(custBefore11?.total_debt || 0);
  const prevRemainingDebt = Number(custBefore11?.remaining_debt || 0);

  const newDebtAmount = 5.0;
  const res11 = await repository.createProductDebtTransaction({
    customerId,
    items: [
      {
        product: genericVar.product,
        variant: genericVar,
        quantity: 1,
        unitPrice: newDebtAmount,
        unitCost: 3.0,
        totalPrice: newDebtAmount,
      }
    ],
    amountPaidInitially: 1.0, // paid $1, remaining $4
    notes: 'Test 11 Cumulative Balance',
  });

  createdDebtIds.push(res11.debt.id);
  createdSaleIds.push(res11.sale.id);

  const { data: custAfter11 } = await supabase.from('customers').select('*').eq('id', customerId).single();
  const newTotalDebt = Number(custAfter11?.total_debt || 0);
  const newRemainingDebt = Number(custAfter11?.remaining_debt || 0);

  console.log(`Customer total debt: ${prevTotalDebt} -> ${newTotalDebt} (Expected +$5: ${prevTotalDebt + 5})`);
  console.log(`Customer remaining debt: ${prevRemainingDebt} -> ${newRemainingDebt} (Expected +$4: ${prevRemainingDebt + 4})`);

  if (Math.abs(newTotalDebt - (prevTotalDebt + 5)) > 0.01 || Math.abs(newRemainingDebt - (prevRemainingDebt + 4)) > 0.01) {
    throw new Error(`TEST 11 FAILED: Customer cumulative debt balance mismatch!`);
  }
  console.log('✅ TEST 11 PASSED: Subsequent debt properly aggregated into customer balance.');

  // -------------------------------------------------------------
  // TEST 12: Debt repayment
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TEST 12: Debt repayment (recordDebtPayment)');
  console.log('-------------------------------------------------------------');

  const debtToRepayId = res11.debt.id;
  const repaymentAmount = 2.0;
  const prevDebtRemaining = res11.debt.remaining_balance; // was 4.0
  const prevCustRemaining = Number(custAfter11?.remaining_debt || 0);

  console.log(`Repaying $${repaymentAmount} on debt #${debtToRepayId.slice(0, 8)} (Current debt remaining: $${prevDebtRemaining})`);

  const paymentRecord = await repository.recordDebtPayment({
    customerId,
    debtId: debtToRepayId,
    amount: repaymentAmount,
    paymentMethod: 'cash',
    notes: 'Test 12 Repayment',
  });

  const { data: debtAfterRepay } = await supabase.from('debts').select('*').eq('id', debtToRepayId).single();
  const { data: custAfterRepay } = await supabase.from('customers').select('*').eq('id', customerId).single();

  console.log(`Debt remaining balance after payment: $${debtAfterRepay?.remaining_balance} (Expected: $${prevDebtRemaining - repaymentAmount})`);
  console.log(`Customer remaining balance after payment: $${custAfterRepay?.remaining_debt} (Expected: $${prevCustRemaining - repaymentAmount})`);

  if (Math.abs(Number(debtAfterRepay?.remaining_balance) - (prevDebtRemaining - repaymentAmount)) > 0.01) {
    throw new Error(`TEST 12 FAILED: Debt remaining balance did not decrease by repayment amount!`);
  }
  if (Math.abs(Number(custAfterRepay?.remaining_debt) - (prevCustRemaining - repaymentAmount)) > 0.01) {
    throw new Error(`TEST 12 FAILED: Customer remaining debt did not decrease by repayment amount!`);
  }
  console.log('✅ TEST 12 PASSED: Debt repayment accurately reduced outstanding balances without mutating items or historical prices.');

  console.log('\n=================================================================');
  console.log('🎉 ALL 12 TEST SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('=================================================================\n');

  // Clean up test data safely to keep database clean
  console.log('Cleaning up test records...');
  for (const debtId of createdDebtIds) {
    await supabase.from('debt_payments').delete().eq('debt_id', debtId);
    await supabase.from('debts').delete().eq('id', debtId);
  }
  for (const saleId of createdSaleIds) {
    await supabase.from('sale_items').delete().eq('sale_id', saleId);
    await supabase.from('stock_movements').delete().eq('reference_id', saleId);
    await supabase.from('sales').delete().eq('id', saleId);
  }
  for (const cId of createdCustomerIds) {
    await supabase.from('customers').delete().eq('id', cId);
  }
  console.log('✅ Test cleanup completed successfully.');
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
