// scripts/verify_vercel_18db1cd.js
async function main() {
  const targetUrl = 'https://shiine-market.vercel.app';
  console.log(`Checking live Vercel deployment for commit 18db1cd at ${targetUrl}...`);

  let deployed = false;
  let attempts = 0;
  const maxAttempts = 25;

  while (!deployed && attempts < maxAttempts) {
    attempts++;
    try {
      const cacheBust = `?t=${Date.now()}`;
      const res = await fetch(`${targetUrl}/sales/new${cacheBust}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      console.log(`[Attempt ${attempts}] GET /sales/new -> Status: ${res.status}`);
      const html = await res.text();

      // Find all chunk script paths
      const scriptRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
      const scripts = [];
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        scripts.push(match[1]);
      }

      console.log(`Found ${scripts.length} chunk scripts in /sales/new HTML.`);

      let foundNewCode = false;
      let matchedMarker = '';
      for (const scriptPath of scripts) {
        const jsRes = await fetch(`${targetUrl}${scriptPath}${cacheBust}`);
        const jsText = await jsRes.text();

        // Unique markers from commit 18db1cd
        if (jsText.includes('calculateJawanChange') || jsText.includes('jawanPaymentAmount') || jsText.includes('supports_cash_change') || jsText.includes('jawan-three-quarter-kg')) {
          foundNewCode = true;
          matchedMarker = 'calculateJawanChange/supports_cash_change';
          console.log(`✅ Found marker '${matchedMarker}' in chunk: ${scriptPath}`);
          break;
        }
      }

      if (foundNewCode) {
        deployed = true;
        console.log(`\n🎉 New deployment is LIVE on Vercel! (Detected after ${attempts} attempts)`);
        break;
      } else {
        console.log('Build still in progress on Vercel. Waiting 10 seconds...');
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  // Route status check
  console.log('\n--- VERIFYING LIVE PRODUCTION ROUTES ---');
  const routesToTest = ['/', '/login', '/sales/new', '/products', '/reports', '/dashboard'];
  for (const r of routesToTest) {
    try {
      const resp = await fetch(`${targetUrl}${r}`, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      console.log(`Route ${r.padEnd(14)} -> Status: ${resp.status}`);
    } catch (e) {
      console.log(`Route ${r.padEnd(14)} -> Error: ${e.message}`);
    }
  }

  if (!deployed) {
    console.error('\n⚠️ Vercel deployment could not be verified within the timeout window.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
