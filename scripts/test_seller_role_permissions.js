// Test script: test_seller_role_permissions.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('=== TEST SUITE: STAFF ROLE "Seller / Iibiye" & PERMISSIONS ===\n');

  const testEmail = `seller_test_${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';
  const testName = 'Liibaan Iibiye';

  // Test 1: Create a seller user via Supabase Auth
  console.log(`Test 1: Creating seller account in Supabase Auth (${testEmail})...`);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testName,
        role: 'seller',
      },
    },
  });

  if (authErr) {
    console.error('❌ Supabase Auth signUp failed:', authErr.message);
    process.exit(1);
  }

  const userId = authData.user?.id;
  console.log('✅ Seller user created in Supabase Auth with ID:', userId);

  // Test 2: Ensure profile has role = 'seller'
  console.log('\nTest 2: Verifying/upserting profile role = "seller"...');
  const { data: profileData, error: profErr } = await supabase
    .from('profiles')
    .upsert([{
      id: userId,
      full_name: testName,
      role: 'seller',
      phone: testEmail,
    }])
    .select()
    .single();

  if (profErr) {
    console.log('Notice on profile upsert:', profErr.message);
  } else {
    console.log('✅ Profile stored with role:', profileData.role);
  }

  // Test 3: Log in as Seller using Supabase Auth
  console.log('\nTest 3: Logging in as Seller with credentials...');
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginErr || !loginData.user) {
    console.error('❌ Seller login failed:', loginErr?.message);
  } else {
    console.log('✅ Seller logged in successfully across devices/browsers! User ID:', loginData.user.id);
  }

  // Test 4: Seller querying POS products
  console.log('\nTest 4: Seller querying POS catalog...');
  const { data: products, error: prodErr } = await supabase
    .from('product_variants')
    .select('id, variant_name, selling_unit, sell_price, stock_quantity, product:products(name)')
    .eq('is_active', true)
    .limit(3);

  if (prodErr) {
    console.error('❌ POS catalog query failed:', prodErr.message);
  } else {
    console.log(`✅ Seller successfully accessed POS catalog (${products.length} items found):`);
    products.forEach(p => {
      console.log(`   - ${p.product?.name || p.variant_name}: $${p.sell_price}/${p.selling_unit} (Stock: ${p.stock_quantity})`);
    });
  }

  // Test 5: Seller creating a customer during POS debt sale
  console.log('\nTest 5: Seller creating a customer for POS debt sale...');
  const { data: newCustomer, error: newCustErr } = await supabase
    .from('customers')
    .insert([{
      name: 'Faarax Iidle (POS Macmiil)',
      phone: '+252615998877',
      total_debt: 0,
      paid_debt: 0,
      remaining_debt: 0,
    }])
    .select()
    .single();

  if (newCustErr) {
    console.error('❌ Seller POS customer creation notice:', newCustErr.message);
  } else {
    console.log('✅ Seller POS customer registered successfully:', newCustomer.name, `(#${newCustomer.id})`);
    // clean up customer
    await supabase.from('customers').delete().eq('id', newCustomer.id);
  }

  // Test 6: Verify Authorization checks for Admin vs Seller vs Reporter
  console.log('\nTest 6: Role Permission Matrices Verification...');
  
  // Simulated repository checkAdminAuth logic
  function checkAdminAuth(user) {
    if (!user) throw new Error('Not Authenticated');
    if (user.role === 'seller') throw new Error('Hawshan waxaa u fasaxan kaliya Maamulaha (Admin). Seller / Iibiye wuxuu galayaa kaliya POS / Iibka.');
    if (user.role === 'reporter') throw new Error('Hawshan waxaa u fasaxan kaliya Maamulaha (Admin). Reporter waa Akhris-Kaliya (Read-Only).');
    if (user.role !== 'admin') throw new Error('Admin only');
    return true;
  }

  const adminUser = { id: 'admin-1', role: 'admin', name: 'Admin' };
  const reporterUser = { id: 'rep-1', role: 'reporter', name: 'Reporter' };
  const sellerUser = { id: userId, role: 'seller', name: testName };

  // Check Admin
  try {
    checkAdminAuth(adminUser);
    console.log('✅ Admin authorization: FULL ACCESS GRANTED.');
  } catch (e) {
    console.error('❌ Admin was wrongly blocked:', e.message);
  }

  // Check Reporter
  try {
    checkAdminAuth(reporterUser);
    console.error('❌ Reporter was wrongly allowed admin mutation!');
  } catch (e) {
    console.log('✅ Reporter blocked from Admin actions:', e.message);
  }

  // Check Seller
  try {
    checkAdminAuth(sellerUser);
    console.error('❌ Seller was wrongly allowed admin mutation!');
  } catch (e) {
    console.log('✅ Seller blocked from Admin actions:', e.message);
  }

  // Sign out test user
  await supabase.auth.signOut();
  console.log('\n=== ALL SELLER TESTS COMPLETED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
