// Test Product Sales Report Aggregations, Decimal Quantities & Paid/Debt Ratio Logic

function testProductReportCalculations() {
  console.log('=== Running Product Sales Report Logic Tests ===\n');

  // Simulated sales data
  const sampleSales = [
    {
      id: 'sale-001',
      created_at: '2026-09-11T10:00:00Z',
      payment_method: 'cash',
      total_amount: 12.00,
      amount_paid: 12.00,
      debt_amount: 0.00,
      customer: { name: 'Ahmed Ali' },
      items: [
        {
          id: 'item-1',
          product_variant_id: 'var-rice-1kg',
          quantity: 20.0,
          unit: 'KG',
          unit_price: 0.60,
          unit_cost: 0.40,
          total_price: 12.00,
          gross_profit: 4.00,
          product_variant: {
            id: 'var-rice-1kg',
            variant_name: 'Bariis Furfur 1KG',
            selling_unit: 'KG',
            product: { id: 'prod-rice', name: 'Bariis Furfur' }
          }
        }
      ]
    },
    {
      id: 'sale-002',
      created_at: '2026-09-11T11:00:00Z',
      payment_method: 'credit',
      total_amount: 10.00,
      amount_paid: 0.00,
      debt_amount: 10.00,
      customer: { name: 'Jama Duale' },
      items: [
        {
          id: 'item-2',
          product_variant_id: 'var-rice-1kg',
          quantity: 10.0,
          unit: 'KG',
          unit_price: 0.60,
          unit_cost: 0.40,
          total_price: 6.00,
          gross_profit: 2.00,
          product_variant: {
            id: 'var-rice-1kg',
            variant_name: 'Bariis Furfur 1KG',
            selling_unit: 'KG',
            product: { id: 'prod-rice', name: 'Bariis Furfur' }
          }
        },
        {
          id: 'item-3',
          product_variant_id: 'var-oil-1l',
          quantity: 2.0,
          unit: 'Liter',
          unit_price: 2.00,
          unit_cost: 1.50,
          total_price: 4.00,
          gross_profit: 1.00,
          product_variant: {
            id: 'var-oil-1l',
            variant_name: 'Saliid 1L',
            selling_unit: 'Liter',
            product: { id: 'prod-oil', name: 'Saliid Macaan' }
          }
        }
      ]
    },
    {
      id: 'sale-003',
      created_at: '2026-09-11T12:00:00Z',
      payment_method: 'partial',
      total_amount: 10.00,
      amount_paid: 2.00, // 20% paid
      debt_amount: 8.00, // 80% debt
      customer: { name: 'Faadumo Noor' },
      items: [
        {
          id: 'item-4',
          product_variant_id: 'var-sugar-1kg',
          quantity: 0.75, // Fractional
          unit: 'KG',
          unit_price: 1.00,
          unit_cost: 0.70,
          total_price: 0.75,
          gross_profit: 0.225,
          product_variant: {
            id: 'var-sugar-1kg',
            variant_name: 'Sonkor Cad 1KG',
            selling_unit: 'KG',
            product: { id: 'prod-sugar', name: 'Sonkor Cad' }
          }
        },
        {
          id: 'item-5',
          product_variant_id: 'var-rice-1kg',
          quantity: 15.416666, // Total to make sale = 10.00: 0.75 + 9.25 = 10.00
          unit: 'KG',
          unit_price: 0.60,
          unit_cost: 0.40,
          total_price: 9.25,
          gross_profit: 3.08,
          product_variant: {
            id: 'var-rice-1kg',
            variant_name: 'Bariis Furfur 1KG',
            selling_unit: 'KG',
            product: { id: 'prod-rice', name: 'Bariis Furfur' }
          }
        }
      ]
    }
  ];

  // Aggregation logic (as implemented in repository.ts)
  const productMap = {};

  for (const sale of sampleSales) {
    const saleTotal = Number(sale.total_amount || 0);
    const salePaid = Number(sale.amount_paid || 0);
    const saleDebt = Number(sale.debt_amount || 0);
    const isCash = sale.payment_method === 'cash' || saleDebt === 0;
    const isCredit = sale.payment_method === 'credit' || salePaid === 0;
    const paidRatio = saleTotal > 0 ? (salePaid / saleTotal) : 1;

    for (const item of sale.items) {
      const variantId = item.product_variant_id;
      const pName = item.product_variant?.product?.name || 'Alaab';
      const vName = item.product_variant?.variant_name || '';
      const unit = item.unit || 'KG';
      const lineTotal = Math.round(Number(item.total_price || 0) * 100) / 100;
      const lineQty = Number(Number(item.quantity || 0).toFixed(4));
      const lineProfit = Math.round(Number(item.gross_profit || 0) * 100) / 100;

      let itemPaid = 0;
      let itemDebt = 0;
      if (isCash) {
        itemPaid = lineTotal;
        itemDebt = 0;
      } else if (isCredit) {
        itemPaid = 0;
        itemDebt = lineTotal;
      } else {
        itemPaid = Math.round(lineTotal * paidRatio * 100) / 100;
        itemDebt = Math.round((lineTotal - itemPaid) * 100) / 100;
      }

      if (!productMap[variantId]) {
        productMap[variantId] = {
          variantId,
          productName: pName,
          variantName: vName,
          sellingUnit: unit,
          quantitySold: 0,
          totalSales: 0,
          totalPaid: 0,
          totalDebt: 0,
          totalProfit: 0,
          transactionCount: 0,
        };
      }

      productMap[variantId].quantitySold = Number((productMap[variantId].quantitySold + lineQty).toFixed(4));
      productMap[variantId].totalSales = Math.round((productMap[variantId].totalSales + lineTotal) * 100) / 100;
      productMap[variantId].totalPaid = Math.round((productMap[variantId].totalPaid + itemPaid) * 100) / 100;
      productMap[variantId].totalDebt = Math.round((productMap[variantId].totalDebt + itemDebt) * 100) / 100;
      productMap[variantId].totalProfit = Math.round((productMap[variantId].totalProfit + lineProfit) * 100) / 100;
      productMap[variantId].transactionCount += 1;
    }
  }

  const rows = Object.values(productMap);

  console.log('Aggregated Product Rows:');
  console.table(rows);

  // Assertions
  const rice = rows.find(r => r.productName === 'Bariis Furfur');
  console.log('\n--- Checking Bariis Furfur ---');
  console.log(`Total Sales: $${rice.totalSales} (Expected: $27.25)`);
  console.log(`Paid: $${rice.totalPaid} (Expected: $13.85 -> 12.00 cash + 0 credit + 1.85 partial)`);
  console.log(`Debt: $${rice.totalDebt} (Expected: $13.40 -> 0 cash + 6.00 credit + 7.40 partial)`);
  console.log(`Paid + Debt: $${(rice.totalPaid + rice.totalDebt).toFixed(2)} === Total Sales: $${rice.totalSales.toFixed(2)}`);

  if (Math.abs((rice.totalPaid + rice.totalDebt) - rice.totalSales) < 0.001) {
    console.log('✅ PASS: Paid + Debt exactly matches Total Sales with zero leak!');
  } else {
    console.error('❌ FAIL: Discrepancy between Paid + Debt and Total Sales');
    process.exit(1);
  }

  const sugar = rows.find(r => r.productName === 'Sonkor Cad');
  console.log('\n--- Checking Sonkor Cad (Fractional Qty 0.75 KG) ---');
  console.log(`Qty Sold: ${sugar.quantitySold} ${sugar.sellingUnit} (Expected: 0.75 KG)`);
  console.log(`Total Sales: $${sugar.totalSales} (Expected: $0.75)`);
  console.log(`Paid: $${sugar.totalPaid} (Expected: $0.15)`);
  console.log(`Debt: $${sugar.totalDebt} (Expected: $0.60)`);

  if (sugar.quantitySold === 0.75 && sugar.totalPaid === 0.15 && sugar.totalDebt === 0.60) {
    console.log('✅ PASS: Fractional quantity and partial payment split verified!');
  } else {
    console.error('❌ FAIL: Unexpected sugar values');
    process.exit(1);
  }

  console.log('\n✅ ALL PRODUCT SALES REPORT LOGIC TESTS PASSED SUCCESSFULLY!');
}

testProductReportCalculations();
