const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

function roundToCents(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function cleanPrecision(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

async function runDryRun() {
  const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%saliid%');
  const prodIds = (prods || []).map(p => p.id);

  const { data: variants } = await supabase.from('product_variants').select('*').in('product_id', prodIds);
  const variantIds = (variants || []).map(v => v.id);

  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('*')
    .in('product_variant_id', variantIds)
    .order('created_at', { ascending: true });

  const saleIds = Array.from(new Set((saleItems || []).map(si => si.sale_id)));

  const { data: sales } = await supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .in('id', saleIds)
    .order('created_at', { ascending: true });

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('*')
    .in('product_variant_id', variantIds)
    .eq('type', 'sale')
    .order('created_at', { ascending: true });

  const unitCostPerLiter = 1.525; // Base buy price per liter for Saliid

  const dryRunRows = [];
  let totalSaliidRevenue = 0;
  let totalSaliidOldCost = 0;
  let totalSaliidNewCost = 0;
  let totalSaliidOldGP = 0;
  let totalSaliidNewGP = 0;

  for (const sale of sales) {
    const saliidItems = (sale.items || []).filter(it => variantIds.includes(it.product_variant_id));
    const nonSaliidItems = (sale.items || []).filter(it => !variantIds.includes(it.product_variant_id));

    // Calculate non-saliid cost and revenue
    let nonSaliidCost = 0;
    for (const nonItem of nonSaliidItems) {
      nonSaliidCost += Number(nonItem.quantity) * Number(nonItem.unit_cost);
    }

    const saleMovements = movements.filter(m => m.reference_id === sale.id);

    for (const item of saliidItems) {
      const move = saleMovements.find(m => m.product_variant_id === item.product_variant_id) || saleMovements[0];
      const physicalLiters = move ? Math.abs(Number(move.quantity)) : Number(item.quantity);

      let measureName = '1L';
      if (move && move.notes) {
        const match = move.notes.match(/\((.*?)\)/);
        if (match) {
          measureName = match[1];
        }
      } else if (physicalLiters === 0.1) {
        measureName = '5K (0.1L)';
      } else if (physicalLiters === 0.125) {
        measureName = '6K (0.125L)';
      } else if (physicalLiters === 0.15) {
        measureName = '7K (0.15L)';
      } else if (physicalLiters === 0.5) {
        measureName = '½ Liter (0.5L)';
      } else if (physicalLiters === 0.0625) {
        measureName = '4K (0.0625L)';
      }

      const revenue = Number(item.total_price);
      
      // The old cost stored on this sale item vs old cost in dashboard
      const oldDashboardItemCost = Number(item.quantity) * Number(item.unit_cost);
      
      const exactUnitCost = unitCostPerLiter;
      const newCostExact = cleanPrecision(physicalLiters * exactUnitCost);
      const newCostRounded = roundToCents(newCostExact);
      const newGPExact = cleanPrecision(revenue - newCostExact);
      const newGPRounded = roundToCents(revenue - newCostExact);

      // What was the sale header's stored cost and GP for this sale?
      const oldSaleHeaderCost = Number(sale.cost_amount);
      const oldSaleHeaderGP = Number(sale.gross_profit);

      // What will the new sale header cost and GP be?
      const newSaleHeaderCost = roundToCents(nonSaliidCost + newCostExact);
      const newSaleHeaderGP = roundToCents(Number(sale.total_amount) - newSaleHeaderCost);

      const isAffected = (sale.id !== 'd125c1c1-4cb5-4e76-880c-7b003a315b81');

      dryRunRows.push({
        saleId: sale.id,
        shortId: sale.id.slice(0, 8),
        measure: measureName,
        physicalLiters,
        revenue,
        // Item-level financial comparison
        itemOldCost: roundToCents(oldDashboardItemCost),
        itemNewCost: newCostRounded,
        itemOldGP: roundToCents(revenue - oldDashboardItemCost),
        itemNewGP: newGPRounded,
        itemDiffGP: roundToCents(newGPRounded - (revenue - oldDashboardItemCost)),
        // Sale-header comparison
        saleTotal: Number(sale.total_amount),
        oldSaleCost: oldSaleHeaderCost,
        newSaleCost: newSaleHeaderCost,
        oldSaleGP: oldSaleHeaderGP,
        newSaleGP: newSaleHeaderGP,
        saleDiffGP: roundToCents(newSaleHeaderGP - oldSaleHeaderGP),
        isAffected,
      });

      totalSaliidRevenue += revenue;
      totalSaliidOldCost += oldDashboardItemCost;
      totalSaliidNewCost += newCostExact;
      totalSaliidOldGP += (revenue - oldDashboardItemCost);
      totalSaliidNewGP += newGPExact;
    }
  }

  console.log('\n====================================================================================================');
  console.log('PHASE 1: DRY RUN CALCULATION FOR 8 AFFECTED HISTORICAL SALIID SALES');
  console.log('====================================================================================================\n');
  console.log(
    'Sale ID'.padEnd(10) +
    'Measure'.padEnd(16) +
    'Phys Liters'.padEnd(13) +
    'Revenue'.padEnd(10) +
    'Old Cost'.padEnd(11) +
    'New Cost'.padEnd(11) +
    'Old GP'.padEnd(10) +
    'New GP'.padEnd(10) +
    'Difference'
  );
  console.log('-'.repeat(95));

  const affectedRows = dryRunRows.filter(r => r.isAffected);

  for (const row of affectedRows) {
    console.log(
      row.shortId.padEnd(10) +
      row.measure.padEnd(16) +
      (row.physicalLiters + ' L').padEnd(13) +
      ('$' + row.revenue.toFixed(2)).padEnd(10) +
      ('$' + row.itemOldCost.toFixed(2)).padEnd(11) +
      ('$' + row.itemNewCost.toFixed(2)).padEnd(11) +
      ('$' + row.itemOldGP.toFixed(2)).padEnd(10) +
      ('$' + row.itemNewGP.toFixed(2)).padEnd(10) +
      ('$' + (row.itemDiffGP >= 0 ? '+' : '') + row.itemDiffGP.toFixed(2)).padEnd(11)
    );
  }

  console.log('-'.repeat(95));
  console.log('\n[SALE HEADER LEVEL REPAIR DRY-RUN]');
  console.log(
    'Sale ID'.padEnd(10) +
    'Sale Total'.padEnd(12) +
    'Old Header Cost'.padEnd(18) +
    'New Header Cost'.padEnd(18) +
    'Old Header GP'.padEnd(16) +
    'New Header GP'.padEnd(16) +
    'Recovery'
  );
  console.log('-'.repeat(95));

  for (const row of affectedRows) {
    console.log(
      row.shortId.padEnd(10) +
      ('$' + row.saleTotal.toFixed(2)).padEnd(12) +
      ('$' + row.oldSaleCost.toFixed(2)).padEnd(18) +
      ('$' + row.newSaleCost.toFixed(2)).padEnd(18) +
      ('$' + row.oldSaleGP.toFixed(2)).padEnd(16) +
      ('$' + row.newSaleGP.toFixed(2)).padEnd(16) +
      ('$' + (row.saleDiffGP >= 0 ? '+' : '') + row.saleDiffGP.toFixed(2))
    );
  }

  console.log('-'.repeat(95));

  console.log(`\nOverall Saliid Results (All 9 Saliid Sales):`);
  console.log(`  Revenue:           $${totalSaliidRevenue.toFixed(2)}  (Target: $4.11)`);
  console.log(`  Old Dashboard Cost:$${totalSaliidOldCost.toFixed(2)}`);
  console.log(`  True COGS:         $${cleanPrecision(totalSaliidNewCost).toFixed(2)}  (Target: ~$3.44)`);
  console.log(`  Old Dashboard GP:  $${totalSaliidOldGP.toFixed(2)}`);
  console.log(`  True Gross Profit: +$${cleanPrecision(totalSaliidNewGP).toFixed(2)}  (Target: ~+$0.67)`);
  console.log(`  Net GP Difference: +$${(totalSaliidNewGP - totalSaliidOldGP).toFixed(2)}`);
  console.log('====================================================================================================\n');
}

runDryRun().catch(console.error);
