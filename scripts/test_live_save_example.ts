import { repository } from '../src/lib/services/repository';
import { supabase } from '../src/lib/supabase/client';

async function runTest() {
  console.log('====================================================');
  console.log('🧪 LIVE TEST: PRODUCT SAVE WITH FRACTIONAL UNITS');
  console.log('====================================================\n');

  const repo = repository;
  repo.checkAdminAuth = async () => ({
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@tukaan.so',
    role: 'admin',
    name: 'Admin User',
    status: 'active',
    created_at: new Date().toISOString()
  });
  const testSuffix = Date.now();
  const prodName = `Bariis Guri Test ${testSuffix}`;

  console.log('1. Testing Product Creation:');
  console.log('   - Product Name:', prodName);
  console.log('   - Incoming Unit: jawan');
  console.log('   - 1 Jawan = 25 KG (conversion_factor: 25)');
  console.log('   - Selling Unit: kg');
  console.log('   - 1 KG divided into: 4 (unit_division: 4)');
  console.log('   - Expected min_sellable_qty: 0.25');

  const result = await repo.createProduct(
    {
      name: prodName,
      description: 'Test rice product with fractional sales'
    },
    {
      variant_name: '25kg Jawan',
      buy_price: 15.00,
      purchase_unit: 'jawan',
      sell_price: 0.80,
      selling_unit: 'kg',
      conversion_factor: 25,
      unit_division: 4,
      min_sellable_qty: 0.25,
      stock_quantity: 50, // 2 jawans = 50 kg
      minimum_stock: 10,
    },
    'Test fractional product creation'
  );

  console.log('\n2. Creation Result:');
  console.log('   - Product ID:', result.product.id);
  console.log('   - Variant ID:', result.variant.id);
  console.log('   - Stored unit_division:', result.variant.unit_division);
  console.log('   - Stored min_sellable_qty:', result.variant.min_sellable_qty);
  console.log('   - Stored stock_quantity:', result.variant.stock_quantity);

  if (result.variant.min_sellable_qty === 0.25 && result.variant.unit_division === 4) {
    console.log('✅ PASS: min_sellable_qty (0.25) and unit_division (4) saved accurately!');
  } else {
    console.error('❌ FAIL: Expected min_sellable_qty 0.25, got', result.variant.min_sellable_qty);
  }

  // Clean up test product
  console.log('\n3. Cleaning up test record...');
  await supabase.from('stock_movements').delete().eq('product_variant_id', result.variant.id);
  await supabase.from('product_variants').delete().eq('id', result.variant.id);
  await supabase.from('products').delete().eq('id', result.product.id);
  console.log('✅ Clean up completed successfully.');

  console.log('\n====================================================');
  console.log('🎉 LIVE REPOSITORY SAVE VERIFICATION COMPLETED');
  console.log('====================================================');
}

runTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
