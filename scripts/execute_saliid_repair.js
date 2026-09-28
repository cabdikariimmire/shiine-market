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

// Exact UUIDs of affected sales:
const HISTORICAL_8_SALE_IDS = [
  '382f349e-3ac1-48e6-aa87-f2ea6de5e544',
  '1c66fdab-6f26-4e57-9877-ba989cafbb9d',
  'bfb59678-cd0e-4c96-bc3d-4d22b285dc4a',
  'e3d8e9e4-9bfd-4d03-bc33-0f9f8116b807',
  '69f709bc-9f08-4714-aaea-cdc5eefbae85',
  '721e4b56-e40c-46ff-8a01-ee8636cda5e7',
  '802ede85-0c0e-4451-98d7-1c86a7a74d0a',
  'f290945a-4a35-4301-9753-28f3fbac1810',
];

// Additional sale created right before the fix:
const LATER_AFFECTED_SALE_IDS = [
  '2bfd3393-a9c0-40e3-8d50-2c3f1ce25144',
];

const ALL_AFFECTED_SALE_IDS = [...HISTORICAL_8_SALE_IDS, ...LATER_AFFECTED_SALE_IDS];

async function executeRepair() {
  console.log('====================================================================================================');
  console.log('PHASE 6: EXECUTING HISTORICAL SALIID FINANCIAL REPAIR');
  console.log('====================================================================================================\n');
  console.log(`Exact Affected Sale IDs to Repair (${HISTORICAL_8_SALE_IDS.length} historical + ${LATER_AFFECTED_SALE_IDS.length} recent):`);
  ALL_AFFECTED_SALE_IDS.forEach((id, idx) => console.log(`  ${idx + 1}. ${id}`));
  console.log('\n----------------------------------------------------------------------------------------------------');

  const { data: prods } = await supabase.from('products').select('id, name').ilike('name', '%saliid%');
  const prodIds = (prods || []).map(p => p.id);

  const { data: variants } = await supabase.from('product_variants').select('*').in('product_id', prodIds);
  const variantIds = (variants || []).map(v => v.id);

  // Fetch movements to verify exact physical deduction
  const { data: movements } = await supabase
    .from('stock_movements')
    .select('*')
    .in('product_variant_id', variantIds)
    .eq('type', 'sale')
    .in('reference_id', ALL_AFFECTED_SALE_IDS);

  const unitCostPerLiter = 1.525;

  for (const saleId of ALL_AFFECTED_SALE_IDS) {
    console.log(`\nRepairing Sale ID: ${saleId}...`);

    const { data: sale, error: fetchErr } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('id', saleId)
      .single();

    if (fetchErr || !sale) {
      console.error(`Sale ${saleId} not found:`, fetchErr?.message);
      continue;
    }

    const saleMovements = (movements || []).filter(m => m.reference_id === saleId);
    let newSaleCostTotal = 0;

    for (const item of sale.items || []) {
      const isSaliid = variantIds.includes(item.product_variant_id);
      if (isSaliid) {
        const move = saleMovements.find(m => m.product_variant_id === item.product_variant_id) || saleMovements[0];
        const physicalLiters = move ? Math.abs(Number(move.quantity)) : (Number(item.quantity) < 1 ? Number(item.quantity) : 0.1);
        
        const lineRevenue = Number(item.total_price);
        const exactCost = cleanPrecision(physicalLiters * unitCostPerLiter);
        const exactGP = cleanPrecision(lineRevenue - exactCost);

        console.log(`  -> Saliid Item ${item.id}:`);
        console.log(`     Old: Qty=${item.quantity}L, UnitCost=$${item.unit_cost}, GP=$${item.gross_profit}`);
        console.log(`     New: Qty=${physicalLiters}L, UnitCost=$${unitCostPerLiter}, GP=$${roundToCents(exactGP)}`);

        const { error: itemErr } = await supabase
          .from('sale_items')
          .update({
            quantity: physicalLiters,
            unit_cost: unitCostPerLiter,
            gross_profit: roundToCents(exactGP),
          })
          .eq('id', item.id);

        if (itemErr) {
          console.error(`  ERROR updating sale_item ${item.id}:`, itemErr.message);
        } else {
          console.log(`     Item updated successfully.`);
        }

        newSaleCostTotal += exactCost;
      } else {
        const nonCost = Number(item.quantity) * Number(item.unit_cost);
        newSaleCostTotal += nonCost;
      }
    }

    const newSaleCostRounded = roundToCents(newSaleCostTotal);
    const newSaleGPRounded = roundToCents(Number(sale.total_amount) - newSaleCostRounded);

    console.log(`  -> Sale Header ${saleId}:`);
    console.log(`     Old: Cost=$${sale.cost_amount}, GP=$${sale.gross_profit}`);
    console.log(`     New: Cost=$${newSaleCostRounded}, GP=$${newSaleGPRounded}`);

    const { error: saleErr } = await supabase
      .from('sales')
      .update({
        cost_amount: newSaleCostRounded,
        gross_profit: newSaleGPRounded,
      })
      .eq('id', saleId);

    if (saleErr) {
      console.error(`  ERROR updating sale ${saleId}:`, saleErr.message);
    } else {
      console.log(`     Sale header updated successfully.`);
    }
  }

  console.log('\n====================================================================================================');
  console.log('REPAIR COMPLETED. VERIFYING 8 HISTORICAL SALIID SALES (+ 1 UNTOUCHED 1L SALE):');
  console.log('====================================================================================================\n');

  // Verify the 8 historical sales + 1L sale
  const historicalSet = [...HISTORICAL_8_SALE_IDS, 'd125c1c1-2844-4066-afb6-94253aeeb7ff'];

  const { data: histSales } = await supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .in('id', historicalSet)
    .order('created_at', { ascending: true });

  console.log(
    'Sale ID'.padEnd(10) +
    'Date'.padEnd(20) +
    'Revenue'.padEnd(10) +
    'True COGS'.padEnd(12) +
    'True GP'.padEnd(12) +
    'Physical L'.padEnd(12) +
    'Unit Cost'
  );
  console.log('-'.repeat(85));

  let histRev = 0;
  let histCost = 0;
  let histGP = 0;
  let histLiters = 0;

  for (const s of histSales) {
    const sItems = (s.items || []).filter(i => variantIds.includes(i.product_variant_id));
    for (const it of sItems) {
      const rev = Number(it.total_price);
      const cost = cleanPrecision(Number(it.quantity) * Number(it.unit_cost));
      const gp = Number(it.gross_profit);
      const liters = Number(it.quantity);

      histRev += rev;
      histCost += cost;
      histGP += gp;
      histLiters += liters;

      console.log(
        s.id.slice(0, 8).padEnd(10) +
        s.created_at.slice(0, 19).padEnd(20) +
        ('$' + rev.toFixed(2)).padEnd(10) +
        ('$' + roundToCents(cost).toFixed(2)).padEnd(12) +
        ('$' + (gp >= 0 ? '+' : '') + gp.toFixed(2)).padEnd(12) +
        (liters + ' L').padEnd(12) +
        ('$' + Number(it.unit_cost).toFixed(4))
      );
    }
  }

  console.log('-'.repeat(85));
  console.log(`\nVerified Results for the 8 Historical + 1L Investigation Sales:`);
  console.log(`  Revenue:       $${histRev.toFixed(2)}  (Target: $4.11)`);
  console.log(`  Physical Qty:  ${cleanPrecision(histLiters)} L  (Target: 2.25 L)`);
  console.log(`  True COGS:     $${cleanPrecision(histCost).toFixed(2)}  (Target: ~$3.44)`);
  console.log(`  True GP:       +$${cleanPrecision(histGP).toFixed(2)}  (Target: ~+$0.67)`);
  console.log('====================================================================================================\n');
}

executeRepair().catch(console.error);
