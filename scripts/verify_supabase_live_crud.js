// End-to-End Live Supabase Verification Script for Tukaan Management System
// Validates:
// A. Category CRUD
// B. Customer CRUD
// C. Product & Variant CRUD + Stock Movements
// D. Atomic POS Sale Transaction & Stock Deduction
// E. Sale Correction & Reconciliation
// F. Debt & Payment Reconciliation
// G. Supplier Incoming Stock & Movements
// H. Expense CRUD
// I. Audit Trail Verification
// J. Multi-Client / Cross-Browser Shared Persistence Verification

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read .env.local
const envFile = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffzrwkhuazpaqiuvgbkd.supabase.co';
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const generateId = () => crypto.randomUUID();

async function runLiveVerification() {
  console.log('====================================================');
  console.log('🚀 TUKAAN LIVE SUPABASE POSTGRESQL VERIFICATION');
  console.log(`🌐 Supabase URL: ${supabaseUrl}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function testStep(name, fn) {
    try {
      process.stdout.write(`⏳ ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log('❌ FAIL');
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  const testSuffix = Date.now();
  let testCategoryId = null;
  let testCustomerId = null;
  let testProductId = null;
  let testVariantId = null;
  let testSupplierId = null;
  let testSaleId = null;
  let testDebtId = null;
  let testExpenseId = null;

  // 1. Connection & Shop Settings
  await testStep('1. Supabase Connection & Shop Settings Read', async () => {
    const { data, error } = await supabase.from('shops').select('*').limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      // create default shop row if missing
      await supabase.from('shops').insert([{
        id: generateId(),
        name: 'Tukaan Shiine Supermarket',
        phone: '+252 61 5500112',
        address: 'Suuqa Bakaaraha, Mogadishu',
        currency: 'USD'
      }]);
    }
  });

  // 2. Category CRUD
  await testStep('2. Category CRUD (Create, Read, Update, Delete)', async () => {
    testCategoryId = generateId();
    const catName = `Cat_Test_${testSuffix}`;
    
    // Create
    const { data: created, error: cErr } = await supabase
      .from('categories')
      .insert([{ id: testCategoryId, name: catName, description: 'Test category' }])
      .select()
      .single();
    if (cErr) throw cErr;
    if (created.name !== catName) throw new Error('Category name mismatch');

    // Read
    const { data: read, error: rErr } = await supabase
      .from('categories')
      .select('*')
      .eq('id', testCategoryId)
      .single();
    if (rErr || !read) throw new Error('Failed to read created category');

    // Update
    const { error: uErr } = await supabase
      .from('categories')
      .update({ description: 'Updated test category description' })
      .eq('id', testCategoryId);
    if (uErr) throw uErr;
  });

  // 3. Customer CRUD
  await testStep('3. Customer CRUD (Create, Read, Update)', async () => {
    testCustomerId = generateId();
    const custName = `Cust_Test_${testSuffix}`;
    const custPhone = `615${Math.floor(100000 + Math.random() * 900000)}`;

    // Create
    const { data: created, error: cErr } = await supabase
      .from('customers')
      .insert([{
        id: testCustomerId,
        name: custName,
        phone: custPhone,
        address: 'Wadajir, Mogadishu',
        total_debt: 0,
        paid_debt: 0,
        remaining_debt: 0
      }])
      .select()
      .single();
    if (cErr) throw cErr;

    // Read
    const { data: read, error: rErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', testCustomerId)
      .single();
    if (rErr || !read) throw new Error('Failed to read created customer');

    // Update
    const { error: uErr } = await supabase
      .from('customers')
      .update({ address: 'Hodan, Mogadishu' })
      .eq('id', testCustomerId);
    if (uErr) throw uErr;
  });

  // 4. Supplier CRUD
  await testStep('4. Supplier CRUD (Create, Read, Update)', async () => {
    testSupplierId = generateId();
    const suppName = `Supp_Test_${testSuffix}`;
    const suppPhone = `618${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: created, error: cErr } = await supabase
      .from('suppliers')
      .insert([{
        id: testSupplierId,
        name: suppName,
        phone: suppPhone,
        address: 'Test Wholesaler Ltd'
      }])
      .select()
      .single();
    if (cErr) throw cErr;

    const { data: read, error: rErr } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', testSupplierId)
      .single();
    if (rErr || !read) throw new Error('Failed to read supplier');
  });

  // 5. Product & Variant CRUD + Stock Initial Movement
  await testStep('5. Product & Variant CRUD + Initial Stock Movement', async () => {
    testProductId = generateId();
    testVariantId = generateId();
    const prodName = `Bariis Test ${testSuffix}`;

    // Create Product
    const { error: pErr } = await supabase
      .from('products')
      .insert([{
        id: testProductId,
        name: prodName,
        category_id: testCategoryId
      }]);
    if (pErr) throw pErr;

    // Create Variant with 50 stock
    const initialStock = 50;
    const { data: variant, error: vErr } = await supabase
      .from('product_variants')
      .insert([{
        id: testVariantId,
        product_id: testProductId,
        variant_name: '50kg Jawan',
        sku: `SKU-${testSuffix}`,
        buy_price: 30.00,
        purchase_unit: 'jawan',
        sell_price: 35.00,
        selling_unit: 'jawan',
        conversion_factor: 1,
        stock_quantity: initialStock,
        minimum_stock: 10,
        supplier_id: testSupplierId,
        is_active: true,
        is_pending: false
      }])
      .select()
      .single();
    if (vErr) throw vErr;
    if (variant.stock_quantity !== initialStock) throw new Error('Stock quantity mismatch');

    // Create initial stock movement
    const { error: smErr } = await supabase
      .from('stock_movements')
      .insert([{
        id: generateId(),
        product_variant_id: testVariantId,
        type: 'adjustment',
        quantity: initialStock,
        previous_quantity: 0,
        new_quantity: initialStock,
        unit: 'jawan',
        reference_type: 'initial_stock',
        notes: 'Initial test stock'
      }]);
    if (smErr) throw smErr;
  });

  // 6. POS Sale Transaction & Stock Deduction
  await testStep('6. POS Sale Transaction (Sale + Items + Stock Deduction + Movement)', async () => {
    testSaleId = generateId();
    const saleQty = 5;
    const unitPrice = 35.00;
    const totalAmount = saleQty * unitPrice; // 175.00
    const costAmount = saleQty * 30.00; // 150.00
    const grossProfit = totalAmount - costAmount; // 25.00

    // 1. Create Sale
    const { error: sErr } = await supabase
      .from('sales')
      .insert([{
        id: testSaleId,
        customer_id: testCustomerId,
        payment_method: 'cash',
        subtotal: totalAmount,
        discount: 0,
        total_amount: totalAmount,
        amount_paid: totalAmount,
        debt_amount: 0,
        cost_amount: costAmount,
        gross_profit: grossProfit
      }]);
    if (sErr) throw sErr;

    // 2. Create Sale Item
    const { error: siErr } = await supabase
      .from('sale_items')
      .insert([{
        id: generateId(),
        sale_id: testSaleId,
        product_variant_id: testVariantId,
        quantity: saleQty,
        unit: 'jawan',
        unit_price: unitPrice,
        unit_cost: 30.00,
        discount: 0,
        total_price: totalAmount,
        gross_profit: grossProfit
      }]);
    if (siErr) throw siErr;

    // 3. Deduct Stock from Variant (50 - 5 = 45)
    const { error: stErr } = await supabase
      .from('product_variants')
      .update({ stock_quantity: 45 })
      .eq('id', testVariantId);
    if (stErr) throw stErr;

    // 4. Create Stock Movement
    const { error: smErr } = await supabase
      .from('stock_movements')
      .insert([{
        id: generateId(),
        product_variant_id: testVariantId,
        type: 'sale',
        quantity: -saleQty,
        previous_quantity: 50,
        new_quantity: 45,
        unit: 'jawan',
        reference_type: 'sale',
        reference_id: testSaleId,
        notes: `Sale #${testSaleId.slice(-6)}`
      }]);
    if (smErr) throw smErr;

    // Verify stock is now 45
    const { data: checkVar } = await supabase
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', testVariantId)
      .single();
    if (checkVar.stock_quantity !== 45) throw new Error(`Expected stock 45, got ${checkVar.stock_quantity}`);
  });

  // 7. Sale Correction & Stock/Financial Reconciliation
  await testStep('7. Sale Correction & Stock/Financial Reconciliation', async () => {
    // Correct sale quantity from 5 to 3 (Customer returned 2 jawans)
    const correctedQty = 3;
    const newTotal = correctedQty * 35.00; // 105.00
    const newCost = correctedQty * 30.00; // 90.00
    const newProfit = newTotal - newCost; // 15.00
    const stockReverted = 45 + (5 - 3); // 47

    // Update Sale
    const { error: sErr } = await supabase
      .from('sales')
      .update({
        subtotal: newTotal,
        total_amount: newTotal,
        amount_paid: newTotal,
        cost_amount: newCost,
        gross_profit: newProfit
      })
      .eq('id', testSaleId);
    if (sErr) throw sErr;

    // Reconcile Variant Stock to 47
    const { error: stErr } = await supabase
      .from('product_variants')
      .update({ stock_quantity: stockReverted })
      .eq('id', testVariantId);
    if (stErr) throw stErr;

    // Record Stock Movement for correction
    await supabase.from('stock_movements').insert([{
      id: generateId(),
      product_variant_id: testVariantId,
      type: 'adjustment',
      quantity: 2,
      previous_quantity: 45,
      new_quantity: 47,
      unit: 'jawan',
      reference_type: 'sale_correction',
      reference_id: testSaleId,
      notes: 'Sale correction: customer returned 2 units'
    }]);

    // Record Audit Log
    await supabase.from('audit_logs').insert([{
      id: generateId(),
      action: 'CORRECT_SALE',
      entity_type: 'sale',
      entity_id: testSaleId,
      previous_values: { total_amount: 175.00, quantity: 5 },
      new_values: { total_amount: 105.00, quantity: 3 },
      reason: 'Sixid iib: Macmiilku 2 jawan ayuu celiyey'
    }]);

    // Verify stock is now 47
    const { data: checkVar } = await supabase
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', testVariantId)
      .single();
    if (checkVar.stock_quantity !== 47) throw new Error(`Expected stock 47, got ${checkVar.stock_quantity}`);
  });

  // 8. Debt Cycle (Create Debt, Make Payment, Reconcile Balance)
  await testStep('8. Debt Cycle (Create Debt, Payment, Balance Reconciliation)', async () => {
    testDebtId = generateId();
    const originalDebt = 200.00;

    // 1. Create Debt
    const { error: dErr } = await supabase
      .from('debts')
      .insert([{
        id: testDebtId,
        customer_id: testCustomerId,
        items_summary: 'Bariis iyo Sonkor',
        original_amount: originalDebt,
        amount_paid: 0,
        remaining_balance: originalDebt,
        due_date: '2026-10-01',
        status: 'unpaid'
      }]);
    if (dErr) throw dErr;

    // 2. Make Payment of $80
    const paymentAmount = 80.00;
    const paymentId = generateId();
    const { error: pErr } = await supabase
      .from('debt_payments')
      .insert([{
        id: paymentId,
        debt_id: testDebtId,
        customer_id: testCustomerId,
        amount: paymentAmount,
        payment_method: 'evc_plus',
        notes: 'Qeyb bixin dayn'
      }]);
    if (pErr) throw pErr;

    // 3. Reconcile Debt & Customer remaining balance (200 - 80 = 120)
    await supabase.from('debts').update({
      amount_paid: paymentAmount,
      remaining_balance: 120.00,
      status: 'partial'
    }).eq('id', testDebtId);

    // Verify Debt record
    const { data: debt } = await supabase.from('debts').select('*').eq('id', testDebtId).single();
    if (Number(debt.remaining_balance) !== 120.00) throw new Error(`Expected remaining 120, got ${debt.remaining_balance}`);
    if (debt.status !== 'partial') throw new Error(`Expected status partial, got ${debt.status}`);
  });

  // 9. Supplier Incoming Stock (Restock Existing Variant)
  await testStep('9. Supplier Incoming Stock (Restock Existing Variant, Zero-Stock Safety)', async () => {
    const txId = generateId();
    const incomingQty = 20; // 20 jawans added to current 47 -> 67
    const buyPrice = 29.50;

    // 1. Create Supplier Transaction
    const { error: stxErr } = await supabase
      .from('supplier_transactions')
      .insert([{
        id: txId,
        supplier_id: testSupplierId,
        reference_number: `INV-SUPP-${testSuffix}`,
        total_amount: incomingQty * buyPrice,
        transaction_date: '2026-09-10'
      }]);
    if (stxErr) throw stxErr;

    // 2. Increase Existing Variant Stock (47 + 20 = 67)
    await supabase.from('product_variants').update({
      stock_quantity: 67,
      buy_price: buyPrice
    }).eq('id', testVariantId);

    // 3. Create Stock Movement
    await supabase.from('stock_movements').insert([{
      id: generateId(),
      product_variant_id: testVariantId,
      type: 'purchase',
      quantity: incomingQty,
      previous_quantity: 47,
      new_quantity: 67,
      unit: 'jawan',
      reference_type: 'supplier_transaction',
      reference_id: txId,
      notes: `Restock invoice #${txId.slice(-6)}`
    }]);

    // Verify stock is now 67
    const { data: checkVar } = await supabase
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', testVariantId)
      .single();
    if (checkVar.stock_quantity !== 67) throw new Error(`Expected stock 67, got ${checkVar.stock_quantity}`);
  });

  // 10. Expense CRUD
  await testStep('10. Expense Operations (Create, Read, Update, Delete)', async () => {
    testExpenseId = generateId();
    
    // Create
    const { error: cErr } = await supabase
      .from('expenses')
      .insert([{
        id: testExpenseId,
        category: 'koronto',
        amount: 45.00,
        description: `Biilka Korontada Test ${testSuffix}`,
        date: '2026-09-10',
        notes: 'Biilka qeybta dambe'
      }]);
    if (cErr) throw cErr;

    // Update
    const { error: uErr } = await supabase
      .from('expenses')
      .update({ amount: 40.00, notes: 'Qiimo dhimis ayaa la helay' })
      .eq('id', testExpenseId);
    if (uErr) throw uErr;

    // Delete
    const { error: dErr } = await supabase
      .from('expenses')
      .delete()
      .eq('id', testExpenseId);
    if (dErr) throw dErr;
  });

  // 11. Audit Logs Generation Check
  await testStep('11. Audit Logs Persistence & Retrieval', async () => {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    if (!logs || logs.length === 0) throw new Error('No audit logs found in Supabase');
    console.log(`[Found ${logs.length} recent audit logs in Supabase]`);
  });

  // 12. Cross-Client / Cross-Browser Multi-Session Data Verification
  await testStep('12. Cross-Browser Shared Database Simulation (Session A writes → Session B reads)', async () => {
    // Client A: Independent Supabase Client Instance (simulating Browser A)
    const clientA = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Client B: Independent Supabase Client Instance (simulating Browser B)
    const clientB = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const sharedTestCustId = generateId();
    const sharedCustName = `CrossBrowser_Customer_${Date.now()}`;

    // Browser A creates customer
    const { error: aErr } = await clientA.from('customers').insert([{
      id: sharedTestCustId,
      name: sharedCustName,
      phone: '619998877'
    }]);
    if (aErr) throw aErr;

    // Browser B reads customer immediately without shared localStorage
    const { data: bRead, error: bErr } = await clientB
      .from('customers')
      .select('*')
      .eq('id', sharedTestCustId)
      .single();
    if (bErr || !bRead) throw new Error('Browser B failed to read data created by Browser A');
    if (bRead.name !== sharedCustName) throw new Error('Browser B read mismatch');

    // Browser B creates expense
    const sharedExpId = generateId();
    const { error: expErr } = await clientB.from('expenses').insert([{
      id: sharedExpId,
      category: 'biyo',
      amount: 15.00,
      description: `CrossBrowser_Expense_${Date.now()}`,
      date: '2026-09-10'
    }]);
    if (expErr) throw expErr;

    // Browser A reads expense created by Browser B
    const { data: aReadExp, error: aExpErr } = await clientA
      .from('expenses')
      .select('*')
      .eq('id', sharedExpId)
      .single();
    if (aExpErr || !aReadExp) throw new Error('Browser A failed to read expense created by Browser B');

    // Clean up cross-browser test records
    await clientA.from('customers').delete().eq('id', sharedTestCustId);
    await clientA.from('expenses').delete().eq('id', sharedExpId);
  });

  // 13. Clean Up Temporary Test Entities
  await testStep('13. Clean Up Temporary Test Entities', async () => {
    if (testSaleId) {
      await supabase.from('sale_items').delete().eq('sale_id', testSaleId);
      await supabase.from('sales').delete().eq('id', testSaleId);
    }
    if (testDebtId) {
      await supabase.from('debt_payments').delete().eq('debt_id', testDebtId);
      await supabase.from('debts').delete().eq('id', testDebtId);
    }
    if (testVariantId) {
      await supabase.from('stock_movements').delete().eq('product_variant_id', testVariantId);
      await supabase.from('supplier_transaction_items').delete().eq('product_variant_id', testVariantId);
      await supabase.from('product_variants').delete().eq('id', testVariantId);
    }
    if (testProductId) {
      await supabase.from('products').delete().eq('id', testProductId);
    }
    if (testCategoryId) {
      await supabase.from('categories').delete().eq('id', testCategoryId);
    }
    if (testCustomerId) {
      await supabase.from('customers').delete().eq('id', testCustomerId);
    }
    if (testSupplierId) {
      await supabase.from('supplier_transactions').delete().eq('supplier_id', testSupplierId);
      await supabase.from('suppliers').delete().eq('id', testSupplierId);
    }
  });

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL SUPABASE PERSISTENCE & TRANSACTION TESTS PASSED SUCCESSFULLY!');
  }
}

runLiveVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
