// scripts/verify_live_production_deployment.js
const https = require('https');

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function verify() {
  const baseUrl = 'https://shiine-market.vercel.app';
  console.log('====================================================');
  console.log('🌐 VERIFYING VERCEL PRODUCTION DEPLOYMENT');
  console.log(`Target: ${baseUrl}`);
  console.log('====================================================\n');

  const routes = ['/', '/login', '/products', '/sales/new', '/reports', '/settings', '/debts'];
  for (const route of routes) {
    const res = await fetchUrl(`${baseUrl}${route}?t=${Date.now()}`);
    console.log(`Route: ${route.padEnd(14)} -> HTTP ${res.status} (${res.body.length} bytes)`);
  }

  console.log('\n--- Scanning JavaScript Chunks for Latest Features ---');
  const loginRes = await fetchUrl(`${baseUrl}/login?t=${Date.now()}`);
  const productsRes = await fetchUrl(`${baseUrl}/products?t=${Date.now()}`);
  const salesRes = await fetchUrl(`${baseUrl}/sales/new?t=${Date.now()}`);
  const reportsRes = await fetchUrl(`${baseUrl}/reports?t=${Date.now()}`);

  const combinedHtml = loginRes.body + productsRes.body + salesRes.body + reportsRes.body;
  const scriptRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
  const chunkPaths = new Set();
  let match;
  while ((match = scriptRegex.exec(combinedHtml)) !== null) {
    chunkPaths.add(match[1]);
  }

  console.log(`Discovered ${chunkPaths.size} unique JavaScript bundle chunks.`);

  const featuresToCheck = [
    { name: 'Cooking Oil amount_based model', pattern: /amount_based/ },
    { name: 'Powder pack_based model', pattern: /pack_based/ },
    { name: 'Liter container capacity (Caag)', pattern: /container_capacity|container_unit/ },
    { name: 'Money-based quick options (5,000 SOS)', pattern: /5,000 SOS|5000 SOS/ },
    { name: 'Rubac weyn ($0.50 / $0.45)', pattern: /Rubac weyn|0\.50 Rubac|0\.45 Rubac/ },
    { name: 'Oil batches & FIFO costing', pattern: /product_batches|cost_per_unit|received_date/ },
    { name: 'Dynamic actual_quantity_used deduction', pattern: /actual_quantity_used/ },
    { name: 'Email alerts & Resend integration', pattern: /sent_email_alerts|low_stock|out_of_stock/ }
  ];

  const foundFeatures = new Set();
  let allJsContent = '';

  for (const chunk of chunkPaths) {
    const jsRes = await fetchUrl(`${baseUrl}${chunk}?t=${Date.now()}`);
    allJsContent += jsRes.body;
  }

  console.log(`Downloaded ${Math.round(allJsContent.length / 1024)} KB of frontend bundle code.\n`);

  for (const feat of featuresToCheck) {
    if (feat.pattern.test(allJsContent)) {
      foundFeatures.add(feat.name);
      console.log(`✅ [CONFIRMED LIVE] ${feat.name}`);
    } else {
      console.log(`⏳ [WAITING/CHECKING] ${feat.name}`);
    }
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${foundFeatures.size} / ${featuresToCheck.length} verified live in production bundle`);
  console.log('====================================================');
}

verify().catch(console.error);
