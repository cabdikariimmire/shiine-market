// scripts/test_auth_call.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ffzrwkhuazpaqiuvgbkd.supabase.co';
const supabaseKey = 'sb_publishable_PrIoWHT_gsdDS-AErUhtAw_oy4_F0Gt';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing connection to Supabase...');
  
  console.log('1. Testing signInWithPassword with wrong credentials...');
  const start = Date.now();
  try {
    const res = await supabase.auth.signInWithPassword({
      email: 'nonexistent@example.com',
      password: 'wrongpassword',
    });
    console.log(`Response received in ${Date.now() - start}ms:`, {
      error: res.error?.message,
      status: res.error?.status,
      user: res.data?.user ? 'found' : 'null'
    });
  } catch (err) {
    console.error('Exception during signInWithPassword:', err);
  }

  console.log('\n2. Testing query on profiles table...');
  const pStart = Date.now();
  try {
    const pRes = await supabase.from('profiles').select('*').limit(5);
    console.log(`Profiles response in ${Date.now() - pStart}ms:`, {
      error: pRes.error?.message,
      count: pRes.data?.length,
      data: pRes.data
    });
  } catch (err) {
    console.error('Exception during profiles query:', err);
  }
}

test().catch(console.error);
