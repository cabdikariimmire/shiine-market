const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const { createClient } = require('@supabase/supabase-js');
const client = createClient(url, key);

function roundToCents(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function cleanPrecision(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

async function run() {
  const { data: salesList } = await client
    .from('sales')
    .select('*, items:sale_items(id, quantity, unit_price, unit_cost, total_price, gross_profit)');

  let totalRev = 0;
  let totalCogs = 0;
  let totalGP = 0;

  for (const s of salesList || []) {
    totalRev += Number(s.total_amount || 0);
    const items = s.items || [];
    for (const item of items) {
      const actualQty = (item.actual_quantity_used !== undefined && item.actual_quantity_used !== null && Number(item.actual_quantity_used) > 0)
        ? Number(item.actual_quantity_used)
        : Number(item.quantity || 0);
      const unitCost = item.unit_cost !== undefined && item.unit_cost !== null ? Number(item.unit_cost) : 0;
      const lineCost = cleanPrecision(actualQty * unitCost);
      const lineTotal = Number(item.total_price || (actualQty * Number(item.unit_price || 0)));
      const lineProfit = unitCost > 0 ? cleanPrecision(lineTotal - lineCost) : Number(item.gross_profit || 0);

      totalCogs += lineCost;
      totalGP += lineProfit;
    }
  }

  console.log('====================================================');
  console.log('ALL LIVE STORE SALES DASHBOARD TOTALS:');
  console.log('====================================================');
  console.log(`Total Sales Count:        ${salesList.length}`);
  console.log(`Total Store Revenue:      $${roundToCents(totalRev).toFixed(2)}`);
  console.log(`Total Store COGS:         $${roundToCents(totalCogs).toFixed(2)}`);
  console.log(`Total Store Gross Profit: +$${roundToCents(totalGP).toFixed(2)}`);
  console.log('====================================================\n');
}

run().catch(console.error);
