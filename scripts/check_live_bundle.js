// scripts/check_live_bundle.js
async function main() {
  console.log('Fetching https://shiine-market.vercel.app/login ...');
  const res = await fetch('https://shiine-market.vercel.app/login', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await res.text();
  console.log('HTML status:', res.status);
  
  // Find JS script tags in HTML
  const scriptRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
  let match;
  const scripts = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  
  console.log('Found scripts:', scripts);

  for (const scriptPath of scripts) {
    const fullUrl = `https://shiine-market.vercel.app${scriptPath}`;
    console.log(`\nInspecting ${scriptPath}...`);
    const jsRes = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const js = await jsRes.text();
    
    // Check for NEXT_PUBLIC_SUPABASE_URL or supabase URL patterns
    const supabaseUrlMatches = js.match(/https:\/\/[a-z0-9-]+\.supabase\.co/gi);
    if (supabaseUrlMatches) {
      console.log('  Found Supabase URLs in bundle:', Array.from(new Set(supabaseUrlMatches)));
    }
    
    // Check for anon key or publishable key patterns
    const keyMatches = js.match(/sb_publishable_[a-zA-Z0-9_\-]+|eyJ[a-zA-Z0-9_\-\.]+/g);
    if (keyMatches) {
      console.log('  Found Key matches:', Array.from(new Set(keyMatches)));
    }

    if (js.includes('placeholder')) {
      console.log('  Found "placeholder" in bundle!');
    }
    
    if (js.includes('isSupabaseConfigured') || js.includes('signInWithPassword') || js.includes('Hubinayaa')) {
      console.log('  Contains auth/login logic!');
      // Let's find context around isSupabaseConfigured or placeholder
      const idx = js.indexOf('placeholder');
      if (idx !== -1) {
        console.log('  Context around placeholder:', js.substring(Math.max(0, idx - 100), Math.min(js.length, idx + 100)));
      }
    }
  }
}

main().catch(console.error);
