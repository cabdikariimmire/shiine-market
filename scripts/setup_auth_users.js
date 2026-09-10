const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log('Testing with admin@tukaan.com...');
  
  const emails = ['admin@tukaan.com', 'reporter@tukaan.com'];

  for (const email of emails) {
    const isReporter = email.includes('reporter');
    const password = isReporter ? 'reporter123' : 'admin123';
    const role = isReporter ? 'reporter' : 'admin';
    const fullName = isReporter ? 'Reporter User' : 'Admin Shiine';

    console.log(`\nAttempting signup for ${email}...`);
    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role
        }
      }
    });

    if (signupErr) {
      console.error(`SignUp Error for ${email}:`, signupErr.message);
    } else {
      console.log(`✅ Success for ${email}! User ID:`, signupData.user?.id);
      console.log('Session returned:', !!signupData.session);
    }

    console.log(`Attempting login for ${email}...`);
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginErr) {
      console.error(`Login Error for ${email}:`, loginErr.message);
    } else {
      console.log(`🎉 Login SUCCESS for ${email}! User ID:`, loginData.user?.id);
    }
  }
}

run();
