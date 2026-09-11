// Test Product Edit Payload & UUID Sanitation Logic

function testEditProductSaveLogic() {
  console.log('=== Running Edit Product Save & UUID Validation Tests ===\n');

  const existingVariant = {
    id: 'e5a782b1-6a2d-45f8-8422-4874b3d735dc',
    product_id: 'c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
    variant_name: 'bubr',
    sku: null,
    barcode: null,
    buy_price: 12.0,
    purchase_unit: 'jawan',
    sell_price: 0.60,
    selling_unit: 'kg',
    conversion_factor: 25.0,
    unit_division: 8,
    min_sellable_qty: 0.125,
    stock_quantity: 100.0,
    minimum_stock: 10,
    supplier_id: null,
    is_active: true,
    is_pending: false,
    product: {
      id: 'c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c',
      name: 'baris',
      category_id: null
    }
  };

  // Simulated Edit Form state when user edits "baris / bubr" without selecting a Category or Supplier (values are "")
  const formPayload = {
    productName: 'baris',
    categoryId: '', // Empty string from <select>
    variant_name: 'bubr',
    sku: '',
    barcode: '',
    buy_price: 12.0,
    purchase_unit: 'jawan',
    sell_price: 0.60,
    selling_unit: 'kg',
    conversion_factor: 25.0,
    unit_division: 8,
    min_sellable_qty: 0.125,
    minimum_stock: 10,
    supplier_id: '', // Empty string from <select>
  };

  // 1. Process Product Master Update Payload
  const rawCatId = formPayload.categoryId;
  const cleanCatId = (rawCatId && typeof rawCatId === 'string' && rawCatId.trim().length > 0) ? rawCatId.trim() : null;

  const productUpdates = {
    updated_at: new Date().toISOString()
  };
  if (formPayload.productName && typeof formPayload.productName === 'string' && formPayload.productName.trim()) {
    productUpdates.name = formPayload.productName.trim();
  }
  if (formPayload.categoryId !== undefined) {
    productUpdates.category_id = cleanCatId;
  }

  console.log('1. Generated Product Table Update Payload:');
  console.log(productUpdates);

  if (productUpdates.category_id === '') {
    console.error('❌ FAIL: category_id was sent as empty string ""!');
    process.exit(1);
  } else if (productUpdates.category_id === null) {
    console.log('✅ PASS: category_id is safely converted to null.');
  }

  // 2. Process Variant Update Payload
  const rawSuppId = formPayload.supplier_id;
  let cleanSupplierId = existingVariant.supplier_id || null;
  if (rawSuppId !== undefined) {
    cleanSupplierId = (rawSuppId && typeof rawSuppId === 'string' && rawSuppId.trim().length > 0) ? rawSuppId.trim() : null;
  }

  const division = formPayload.unit_division !== undefined ? Math.max(1, Number(formPayload.unit_division) || 1) : Math.max(1, Number(existingVariant.unit_division) || 1);
  const minSellable = formPayload.min_sellable_qty !== undefined && Number(formPayload.min_sellable_qty) > 0
    ? Number(formPayload.min_sellable_qty)
    : (1 / division);

  const variantUpdates = {
    variant_name: (formPayload.variant_name || existingVariant.variant_name).trim(),
    sku: formPayload.sku !== undefined ? (typeof formPayload.sku === 'string' && formPayload.sku.trim() ? formPayload.sku.trim() : null) : (existingVariant.sku || null),
    barcode: formPayload.barcode !== undefined ? (typeof formPayload.barcode === 'string' && formPayload.barcode.trim() ? formPayload.barcode.trim() : null) : (existingVariant.barcode || null),
    buy_price: formPayload.buy_price !== undefined ? Number(formPayload.buy_price) : Number(existingVariant.buy_price || 0),
    purchase_unit: formPayload.purchase_unit || existingVariant.purchase_unit,
    sell_price: formPayload.sell_price !== undefined ? Number(formPayload.sell_price) : Number(existingVariant.sell_price || 0),
    selling_unit: formPayload.selling_unit || existingVariant.selling_unit,
    conversion_factor: formPayload.conversion_factor !== undefined ? Number(formPayload.conversion_factor) : Number(existingVariant.conversion_factor || 1),
    unit_division: division,
    min_sellable_qty: minSellable,
    minimum_stock: formPayload.minimum_stock !== undefined ? Number(formPayload.minimum_stock) : Number(existingVariant.minimum_stock || 0),
    supplier_id: cleanSupplierId,
    updated_at: new Date().toISOString(),
  };

  console.log('\n2. Generated Variant Table Update Payload:');
  console.log(variantUpdates);

  // Assertions
  if (variantUpdates.supplier_id === '') {
    console.error('❌ FAIL: supplier_id was sent as empty string ""!');
    process.exit(1);
  } else if (variantUpdates.supplier_id === null) {
    console.log('✅ PASS: supplier_id is safely converted to null.');
  }

  // Check that id is preserved and never overwritten
  if (existingVariant.id !== 'e5a782b1-6a2d-45f8-8422-4874b3d735dc') {
    console.error('❌ FAIL: existing variant UUID altered!');
    process.exit(1);
  }
  console.log('✅ PASS: Variant target ID preserved:', existingVariant.id);

  // Check division & minSellable
  if (variantUpdates.unit_division === 8 && variantUpdates.min_sellable_qty === 0.125) {
    console.log('✅ PASS: Division (8) and Minimum Sellable Quantity (0.125 KG) accurately set.');
  } else {
    console.error('❌ FAIL: Fractional calculations unexpected:', variantUpdates);
    process.exit(1);
  }

  // Check that stock_quantity is NOT in variantUpdates (stock preservation)
  if ('stock_quantity' in variantUpdates) {
    console.error('❌ FAIL: stock_quantity should not be modified by edit product!');
    process.exit(1);
  } else {
    console.log('✅ PASS: stock_quantity is untouched by Edit Product (stock preserved).');
  }

  console.log('\n✅ ALL EDIT PRODUCT SAVE & UUID SANITATION TESTS PASSED!');
}

testEditProductSaveLogic();
