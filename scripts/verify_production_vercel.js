// scripts/verify_production_vercel.js
async function main() {
  const targetUrl = 'https://shiine-market.vercel.app';
  console.log(`Checking production deployment at ${targetUrl}...`);

  let deployed = false;
  let attempts = 0;
  const maxAttempts = 20;

  while (!deployed && attempts < maxAttempts) {
    attempts++;
    try {
      // Bust Vercel edge cache by adding a unique query param
      const cacheBust = `?t=${Date.now()}`;
      const res = await fetch(`${targetUrl}/login${cacheBust}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      console.log(`[Attempt ${attempts}] GET /login -> Status: ${res.status}`);
      const html = await res.text();

      // Find all chunk script paths
      const scriptRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
      const scripts = [];
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        scripts.push(match[1]);
      }

      console.log(`Found ${scripts.length} chunk scripts in HTML.`);

      // Check if any chunk contains our newly added identifiers
      let foundNewCode = false;
      for (const scriptPath of scripts) {
        const jsRes = await fetch(`${targetUrl}${scriptPath}${cacheBust}`);
        const jsText = await jsRes.text();

        // Identifiers from today's work
        if (
          jsText.includes('Seller / Iibiye') ||
          jsText.includes('roundToCents') ||
          jsText.includes('getVariantStep') ||
          jsText.includes('Xiriirka Supabase wuu daahay')
        ) {
          foundNewCode = true;
          console.log(`✅ Found new deployment markers in chunk: ${scriptPath}`);
          break;
        }
      }

      if (foundNewCode) {
        deployed = true;
        console.log(`\n🎉 New deployment is LIVE on Vercel! (Detected after ${attempts} attempts)`);
        break;
      } else {
        console.log('Old bundle still served by Vercel. Waiting 10 seconds for Vercel build/propagation...');
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  // Once live or after wait, run deep verification of routes
  console.log('\n--- VERIFYING LIVE PRODUCTION ROUTES & STATUS ---');
  const routesToTest = [
    '/',
    '/login',
    '/sales/new',
    '/products',
    '/reports',
    '/dashboard',
    '/settings',
    '/debts',
    '/customers'
  ];

  for (const r of routesToTest) {
    try {
      const resp = await fetch(`${targetUrl}${r}`, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      console.log(`Route ${r.padEnd(14)} -> Status: ${resp.status} ${resp.status === 307 ? `(Redirect to ${resp.headers.get('location')})` : ''}`);
    } catch (e) {
      console.log(`Route ${r.padEnd(14)} -> Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
