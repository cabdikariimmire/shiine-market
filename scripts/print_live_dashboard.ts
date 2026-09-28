import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
});

import { repository } from '../src/lib/services/repository';

async function main() {
  console.log('Calculating Live Production Dashboard Metrics (Period: Today)...');
  const m = await repository.getDashboardMetrics('today');
  console.log('====================================================');
  console.log('LIVE PRODUCTION DASHBOARD METRICS (TODAY):');
  console.log('====================================================');
  console.log(`Today's Sales Revenue:      $${m.todaySales.toFixed(2)}`);
  console.log(`Today's Sales Count:        ${m.todaySalesCount}`);
  console.log(`Today's COGS:               $${m.todayCostOfGoods.toFixed(2)}`);
  console.log(`Today's Gross Profit:       $${m.todayGrossProfit.toFixed(2)}`);
  console.log(`Today's Cash Received:      $${m.todayCashReceived.toFixed(2)}`);
  console.log(`Today's Expenses:           $${m.todayExpenses.toFixed(2)}`);
  console.log(`Today's Net Profit:         $${m.todayNetProfit.toFixed(2)}`);
  console.log(`Total Products:             ${m.totalProductsCount}`);
  console.log(`Total Variants:             ${m.totalVariantsCount}`);
  console.log('====================================================\n');
}

main().catch(console.error);
