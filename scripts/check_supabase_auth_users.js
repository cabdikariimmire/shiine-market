// scripts/check_supabase_auth_users.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  console.log('--- Inspecting Profiles in Supabase ---');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) {
    console.error('Error querying profiles:', pErr.message);
  } else {
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(p => {
      console.log(`  - ID: ${p.id}, Name: ${p.full_name}, Role: ${p.role}, Phone/Email: ${p.phone}`);
    });
  }

  console.log('\n--- Testing Common Login Emails ---');
  const testEmails = [
    'admin@tukaan.so',
    'admin@tukaanshiine.so',
    'admin@gmail.com',
    'reporter@tukaan.so',
    'seller@tukaan.so',
    'user@tukaan.so'
  ];

  for (const email of testEmails) {
    const start = Date.now();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: 'password123',
    });
    console.log(`Email [${email}] with 'password123' (${Date.now() - start}ms):`, {
      success: !!data.user,
      userId: data.user?.id,
      error: error?.message
    });
  }
}

inspect().catch(console.error);
