// scripts/verify_live_oil_product_creation.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = trimmed.replace('NEXT_PUBLIC_SUPABASE_URL=', '').replace(/["']/g, '');
      }
      if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        supabaseAnonKey = trimmed.replace('NEXT_PUBLIC_SUPABASE_ANON_KEY=', '').replace(/["']/g, '');
      }
    }
  }
}

async function testLiveOilCreation() {
  console.log('====================================================');
  console.log('🧪 VERIFYING MANUAL STOCK IN / OIL CREATION PERSISTENCE');
  console.log('====================================================\n');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Get default shop
  const { data: shops, error: shopErr } = await supabase.from('shops').select('id, name').limit(1);
  if (shopErr || !shops || shops.length === 0) {
    throw new Error('Could not query shops table: ' + (shopErr?.message || 'No shop found'));
  }
  const shopId = shops[0].id;
  console.log(`Using Shop: ${shops[0].name} (${shopId})`);

  // 2. Get or create category
  let categoryId = null;
  const { data: cats } = await supabase.from('categories').select('id').eq('shop_id', shopId).limit(1);
  if (cats && cats.length > 0) {
    categoryId = cats[0].id;
  } else {
    const { data: newCat } = await supabase.from('categories').insert({ shop_id: shopId, name: 'Saliidaha' }).select().single();
    categoryId = newCat.id;
  }

  // 3. Create Product: Salid
  const testBarcode = 'OIL-TEST-' + Date.now();
  const { data: product, error: prodErr } = await supabase.from('products').insert({
    shop_id: shopId,
    name: 'Salid Test ' + Date.now(),
    category_id: categoryId,
    description: 'Test Cooking Oil for manual stock in verification'
  }).select().single();

  if (prodErr) throw new Error('Failed to create product: ' + prodErr.message);
  console.log(`✅ Step 1: Created Product "${product.name}" (ID: ${product.id})`);

  // 4. Create Variant: Cadey, Amount-based, 4 Caag x 20L = 80L, Batch cost $32 ($0.40/L)
  const containers = 4;
  const literPerCaag = 20;
  const totalLiters = containers * literPerCaag; // 80L
  const batchCost = 32.00;
  const costPerLiter = batchCost / totalLiters; // $0.40/L

  const sellingOptions = [
    { id: 'opt-3000', label: '3,000 SOS', currency: 'SOS', value: 3000, isFixed: false },
    { id: 'opt-4000', label: '4,000 SOS', currency: 'SOS', value: 4000, isFixed: false },
    { id: 'opt-5000', label: '5,000 SOS', currency: 'SOS', value: 5000, isFixed: false },
    { id: 'opt-6000', label: '6,000 SOS', currency: 'SOS', value: 6000, isFixed: false },
    { id: 'opt-7000', label: '7,000 SOS', currency: 'SOS', value: 7000, isFixed: false },
    { id: 'opt-rubac-50', label: 'Rubac weyn $0.50', currency: 'USD', value: 0.50, isFixed: true },
    { id: 'opt-rubac-45', label: 'Rubac weyn $0.45', currency: 'USD', value: 0.45, isFixed: true }
  ];

  const { data: variant, error: varErr } = await supabase.from('product_variants').insert({
    shop_id: shopId,
    product_id: product.id,
    name: 'Cadey',
    barcode: testBarcode,
    purchase_unit: 'caag',
    selling_unit: 'liter',
    conversion_factor: literPerCaag,
    buy_price: batchCost / containers, // $8 per caag
    sell_price: 1.50, // $1.50 per Liter
    stock_quantity: totalLiters,
    minimum_stock: 10,
    management_mode: 'amount_based',
    container_unit: 'caag',
    container_capacity: literPerCaag,
    selling_options: sellingOptions
  }).select().single();

  if (varErr) throw new Error('Failed to create variant: ' + varErr.message);
  console.log(`✅ Step 2: Created Variant "${variant.name}" with 80 Liters Stock (ID: ${variant.id})`);

  // 5. Create Batch in product_batches table
  const { data: batch, error: batchErr } = await supabase.from('product_batches').insert({
    shop_id: shopId,
    product_variant_id: variant.id,
    batch_number: 'BATCH-001',
    containers_count: containers,
    capacity_per_container: literPerCaag,
    total_initial_quantity: totalLiters,
    quantity_sold: 0,
    remaining_quantity: totalLiters,
    total_purchase_cost: batchCost,
    cost_per_unit: costPerLiter,
    status: 'active'
  }).select().single();

  if (batchErr) throw new Error('Failed to create batch: ' + batchErr.message);
  console.log(`✅ Step 3: Created Product Batch (Initial: ${batch.total_initial_quantity}L, Cost/L: $${batch.cost_per_unit})`);

  // 6. Test Persistence & Reload: Fetch from Supabase exactly like the Products page does
  const { data: fetchedVariant, error: fetchErr } = await supabase
    .from('product_variants')
    .select(`
      *,
      product:products(*),
      batches:product_batches(*)
    `)
    .eq('id', variant.id)
    .single();

  if (fetchErr) throw new Error('Failed to fetch variant: ' + fetchErr.message);

  console.log('\n--- VERIFICATION OF RETRIEVED DATA ---');
  console.log(`Product Name: ${fetchedVariant.product.name}`);
  console.log(`Variant Name: ${fetchedVariant.name}`);
  console.log(`Management Mode: ${fetchedVariant.management_mode}`);
  console.log(`Container: ${fetchedVariant.container_unit} (${fetchedVariant.container_capacity} L/caag)`);
  console.log(`Stock Quantity: ${fetchedVariant.stock_quantity} Liters`);
  console.log(`Selling Options Count: ${fetchedVariant.selling_options?.length}`);
  console.log(`Active Batches Count: ${fetchedVariant.batches?.length}`);
  console.log(`Batch Remaining Liters: ${fetchedVariant.batches[0]?.remaining_quantity} L`);
  console.log(`Batch Cost Per Liter: $${fetchedVariant.batches[0]?.cost_per_unit}/L`);

  if (
    fetchedVariant.stock_quantity === 80 &&
    fetchedVariant.management_mode === 'amount_based' &&
    fetchedVariant.batches[0]?.cost_per_unit === 0.4
  ) {
    console.log('\n🎉 ALL PERSISTENCE CHECKS PASSED PERFECTLY!');
  } else {
    throw new Error('Data mismatch in retrieved product!');
  }

  // Clean up test records
  await supabase.from('product_batches').delete().eq('id', batch.id);
  await supabase.from('product_variants').delete().eq('id', variant.id);
  await supabase.from('products').delete().eq('id', product.id);
  console.log('🧹 Cleaned up temporary test entities.\n');
}

testLiveOilCreation().catch(console.error);
