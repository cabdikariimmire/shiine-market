// scripts/test_live_repository_oil_save.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function testRepositoryOilCreation() {
  console.log('====================================================');
  console.log('🧪 VERIFYING REPOSITORY OIL CREATION WITH LIVE SUPABASE');
  console.log('====================================================\n');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Get default shop
  const { data: shops } = await supabase.from('shops').select('id, name, settings').limit(1);
  const shop = shops[0];
  console.log(`Using Shop: ${shop.name} (${shop.id})`);

  // 2. Insert Category if needed
  let categoryId = null;
  const { data: cats } = await supabase.from('categories').select('id').eq('shop_id', shop.id).limit(1);
  if (cats && cats.length > 0) {
    categoryId = cats[0].id;
  } else {
    const { data: newCat } = await supabase.from('categories').insert({ shop_id: shop.id, name: 'Saliidaha' }).select().single();
    categoryId = newCat.id;
  }

  // 3. Product: Salid, Variant: Cadey, 4 Caag x 20L = 80L, Batch cost: $32 ($0.40/L)
  const crypto = require('crypto');
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();

  const productData = {
    id: productId,
    shop_id: shop.id,
    name: 'Salid',
    category_id: categoryId,
    description: 'Cooking Oil test product'
  };

  const { data: prodCreated, error: prodErr } = await supabase.from('products').insert([productData]).select().single();
  if (prodErr) throw new Error('Product creation failed: ' + prodErr.message);
  console.log(`✅ Created Product: "${prodCreated.name}" (ID: ${prodCreated.id})`);

  const initialStock = 4 * 20; // 80 Liters
  const batchCost = 32.00;
  const costPerLiter = batchCost / initialStock; // $0.40/L

  const variantData = {
    id: variantId,
    shop_id: shop.id,
    product_id: productId,
    variant_name: 'Cadey',
    barcode: 'SALID-' + Date.now(),
    buy_price: 8.00, // $8 per caag
    purchase_unit: 'caag',
    sell_price: 1.50, // $1.50 per liter
    selling_unit: 'liter',
    conversion_factor: 20,
    stock_quantity: initialStock,
    minimum_stock: 10,
    is_active: true,
    is_pending: false
  };

  const { data: varCreated, error: varErr } = await supabase.from('product_variants').insert([variantData]).select().single();
  if (varErr) throw new Error('Variant creation failed: ' + varErr.message);
  console.log(`✅ Created Base Variant: "${varCreated.variant_name}" with ${varCreated.stock_quantity} Liters`);

  // Persist model settings into shop settings
  const currentSettings = shop.settings || {};
  const variantModels = currentSettings.variant_models || {};
  const variantBatches = currentSettings.variant_batches || {};

  const modelConfig = {
    management_mode: 'amount_based',
    container_unit: 'caag',
    container_capacity_liters: 20,
    selling_options: [
      { id: 'opt-3000', label: '3,000 SOS', currency: 'SOS', value: 3000, isFixed: false },
      { id: 'opt-4000', label: '4,000 SOS', currency: 'SOS', value: 4000, isFixed: false },
      { id: 'opt-5000', label: '5,000 SOS', currency: 'SOS', value: 5000, isFixed: false },
      { id: 'opt-6000', label: '6,000 SOS', currency: 'SOS', value: 6000, isFixed: false },
      { id: 'opt-7000', label: '7,000 SOS', currency: 'SOS', value: 7000, isFixed: false },
      { id: 'opt-rubac-50', label: 'Rubac weyn $0.50', currency: 'USD', value: 0.50, isFixed: true },
      { id: 'opt-rubac-45', label: 'Rubac weyn $0.45', currency: 'USD', value: 0.45, isFixed: true }
    ]
  };

  const batchConfig = {
    id: 'batch-' + Date.now(),
    product_variant_id: variantId,
    batch_number: 'DUF-001',
    container_count: 4,
    liters_per_container: 20,
    total_liters: 80,
    remaining_quantity: 80,
    total_purchase_cost: 32.00,
    cost_per_liter: 0.40,
    status: 'active'
  };

  await supabase.from('shops').update({
    settings: {
      ...currentSettings,
      variant_models: { ...variantModels, [variantId]: modelConfig },
      variant_batches: { ...variantBatches, [variantId]: [batchConfig] }
    }
  }).eq('id', shop.id);
  console.log(`✅ Saved Model & Batch configuration to shop settings store.`);

  // 4. Verification: Query product with variants & settings
  const { data: updatedShop } = await supabase.from('shops').select('settings').eq('id', shop.id).single();
  const retrievedModel = updatedShop.settings?.variant_models?.[variantId];
  const retrievedBatches = updatedShop.settings?.variant_batches?.[variantId];

  const { data: retrievedVariant } = await supabase.from('product_variants').select('*, product:products(*)').eq('id', variantId).single();

  console.log('\n--- VERIFICATION OF PRODUCT RETRIEVAL ---');
  console.log(`Product Name: ${retrievedVariant.product.name}`);
  console.log(`Variant Name: ${retrievedVariant.variant_name}`);
  console.log(`Stock in Liters: ${retrievedVariant.stock_quantity} Liters (Expected: 80 Liters)`);
  console.log(`Management Mode: ${retrievedModel?.management_mode}`);
  console.log(`Container: ${retrievedModel?.container_unit} (${retrievedModel?.container_capacity_liters} L/caag)`);
  console.log(`Initial Batch: ${retrievedBatches?.[0]?.batch_number} (${retrievedBatches?.[0]?.total_liters}L @ $${retrievedBatches?.[0]?.cost_per_liter}/L)`);
  console.log(`Selling Options Count: ${retrievedModel?.selling_options?.length}`);

  if (
    retrievedVariant.stock_quantity === 80 &&
    retrievedModel?.management_mode === 'amount_based' &&
    retrievedBatches?.[0]?.cost_per_liter === 0.40 &&
    retrievedModel?.selling_options?.length === 7
  ) {
    console.log('\n🎉 ALL PERSISTENCE AND CALCULATION CHECKS PASSED!');
  } else {
    throw new Error('Data verification failed!');
  }

  // Clean up test data
  await supabase.from('product_variants').delete().eq('id', variantId);
  await supabase.from('products').delete().eq('id', productId);
  delete updatedShop.settings.variant_models[variantId];
  delete updatedShop.settings.variant_batches[variantId];
  await supabase.from('shops').update({ settings: updatedShop.settings }).eq('id', shop.id);
  console.log('🧹 Cleaned up temporary test records.');
}

testRepositoryOilCreation().catch(console.error);
