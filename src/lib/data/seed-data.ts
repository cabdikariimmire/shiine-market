import { 
  Category, 
  Customer, 
  Debt, 
  DebtPayment, 
  Expense, 
  Product, 
  ProductVariant, 
  Sale, 
  SaleItem, 
  StockMovement, 
  Supplier, 
  SupplierTransaction,
  SupplierTransactionItem,
  SystemUser
} from '@/types';

export const INITIAL_USERS: SystemUser[] = [
  {
    id: 'user-admin',
    name: 'Admin',
    email: 'admin@tukaan.so',
    password: 'admin123',
    role: 'admin',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-reporter',
    name: 'Reporter',
    email: 'reporter@tukaan.so',
    password: 'reporter123',
    role: 'reporter',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Raashin (Grains & Staples)', description: 'Baris, Sonkor, Bur, Baasto, Saliid', icon: 'Wheat', created_at: '2026-08-01' },
  { id: 'cat-2', name: 'Cabitaanno & Caano (Beverages & Dairy)', description: 'Caano, Biyo, Cabitaan, Shaah, Bun', icon: 'Coffee', created_at: '2026-08-01' },
  { id: 'cat-3', name: 'Qudaar & Miro (Fresh Produce)', description: 'Karooto, Baradho, Moos, Liin, Tufaax', icon: 'Apple', created_at: '2026-08-01' },
  { id: 'cat-4', name: 'Nadaafadda & Daryeelka (Cleaning & Hygiene)', description: 'Saabuun, Omo, Shampoo, Biyo-kululye', icon: 'Sparkles', created_at: '2026-08-01' },
  { id: 'cat-5', name: 'Cunto Fudud & Macmacaan (Snacks & Sweets)', description: 'Buskud, Nacnac, Shukulaato, Chips', icon: 'Cookie', created_at: '2026-08-01' },
  { id: 'cat-6', name: 'Qalabka Guriga (Household & Kitchen)', description: 'Bakeeri, Weel, Qalabka xafiiska, Bacaha', icon: 'Home', created_at: '2026-08-01' },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Xamse Ganacsi',
    phone: '615500112',
    company: 'Xamse Trade Ltd',
    address: 'Suuqa Bakaaraha, Qeybta Raashinka',
    notes: 'Qeybiyaha ugu weyn ee Bariska iyo Sonkorta',
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
    total_purchases: 8,
    total_spend: 1450,
    last_purchase_date: '2026-09-08',
  },
  {
    id: 'sup-2',
    name: 'Bakaaro Wholesale Co.',
    phone: '615500223',
    company: 'Bakaaro Foods',
    address: 'Wadada 1aad, Bakaaro',
    notes: 'Saliidda, Baastada iyo Caanaha',
    created_at: '2026-08-02',
    updated_at: '2026-08-02',
    total_purchases: 5,
    total_spend: 2100,
    last_purchase_date: '2026-09-07',
  },
  {
    id: 'sup-3',
    name: 'Tawakal Importers',
    phone: '615500334',
    company: 'Tawakal General Trading',
    address: 'Dekedda Weyn, Mogadishu',
    notes: 'Buskudka, Shaaha iyo Nadaafadda',
    created_at: '2026-08-05',
    updated_at: '2026-08-05',
    total_purchases: 4,
    total_spend: 920,
    last_purchase_date: '2026-09-05',
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Axmed Cali Cilmi',
    phone: '615112233',
    address: 'Hoddan, Mogadishu',
    notes: 'Macmiil joogto ah, dukaan yar',
    created_at: '2026-08-10',
    updated_at: '2026-09-05',
    total_debt: 120,
    paid_debt: 40,
    remaining_debt: 80,
  },
  {
    id: 'cust-2',
    name: 'Faadumo Maxamed Nuur',
    phone: '615223344',
    address: 'Waberi, Mogadishu',
    notes: 'Reer xaafad',
    created_at: '2026-08-15',
    updated_at: '2026-09-08',
    total_debt: 95,
    paid_debt: 95,
    remaining_debt: 0,
  },
  {
    id: 'cust-3',
    name: 'Jaamac Xasan Warsame',
    phone: '615334455',
    address: 'Yaqshid, Mogadishu',
    notes: 'Maqaayad yar',
    created_at: '2026-08-20',
    updated_at: '2026-09-02',
    total_debt: 150,
    paid_debt: 30,
    remaining_debt: 120,
  },
  {
    id: 'cust-4',
    name: 'Maryan Cabdi Cilmi',
    phone: '615445566',
    address: 'Howlwadaag, Mogadishu',
    notes: 'Dayn bixinteedu wanaagsan tahay',
    created_at: '2026-08-25',
    updated_at: '2026-09-09',
    total_debt: 50,
    paid_debt: 50,
    remaining_debt: 0,
  }
];

// Core curated realistic retail products with multi-variants & bulk conversion
export const INITIAL_PRODUCTS: Product[] = [
  { id: 'prod-1', name: 'Baris (Rice)', category_id: 'cat-1', description: 'Baris tayo sare leh oo jawan iyo kiilo lagu iibiyo', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-2', name: 'Sonkor (Sugar)', category_id: 'cat-1', description: 'Sonkor cad oo jawan iyo kiilo lagu gado', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-3', name: 'Bur (Flour)', category_id: 'cat-1', description: 'Bur rooti iyo canjeero', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-4', name: 'Baasto (Pasta)', category_id: 'cat-1', description: 'Baasto carton iyo xabo', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-5', name: 'Caano (Milk)', category_id: 'cat-2', description: 'Caano dhalo iyo boore', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-6', name: 'Saliid (Cooking Oil)', category_id: 'cat-1', description: 'Saliid cunto nadiif ah', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-7', name: 'Shaah Caleen (Tea)', category_id: 'cat-2', description: 'Shaah tayadiisu sarayso', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-8', name: 'Saabuun & Omo', category_id: 'cat-4', description: 'Saabuun lagu dhaqdo dharka iyo jirka', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-9', name: 'Biyo Safiir (Bottled Water)', category_id: 'cat-2', description: 'Biyo qabow oo nadiif ah', created_at: '2026-08-01', updated_at: '2026-08-01' },
  { id: 'prod-10', name: 'Buskud & Macmacaan', category_id: 'cat-5', description: 'Buskud shaah iyo caruur', created_at: '2026-08-01', updated_at: '2026-08-01' },
];

export const INITIAL_VARIANTS: ProductVariant[] = [
  // Baris variants
  {
    id: 'var-1',
    product_id: 'prod-1',
    variant_name: 'Xamse',
    barcode: '6001001',
    sku: 'BARIS-XAMSE',
    buy_price: 20.00, // $20 per jawan
    purchase_unit: 'jawan',
    sell_price: 0.65, // $0.65 per kg
    selling_unit: 'kg',
    conversion_factor: 50, // 1 Jawan = 50 kg (cost = $0.40/kg, profit = $0.25/kg)
    stock_quantity: 500, // 500 kg
    minimum_stock: 50,
    supplier_id: 'sup-1',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-2',
    product_id: 'prod-1',
    variant_name: 'Nooca B',
    barcode: '6001002',
    sku: 'BARIS-NOOC-B',
    buy_price: 25.00,
    purchase_unit: 'jawan',
    sell_price: 0.75,
    selling_unit: 'kg',
    conversion_factor: 50,
    stock_quantity: 300,
    minimum_stock: 50,
    supplier_id: 'sup-1',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-3',
    product_id: 'prod-1',
    variant_name: 'Basmati Premium',
    barcode: '6001003',
    sku: 'BARIS-BASMATI',
    buy_price: 32.00,
    purchase_unit: 'jawan',
    sell_price: 0.95,
    selling_unit: 'kg',
    conversion_factor: 50,
    stock_quantity: 150,
    minimum_stock: 40,
    supplier_id: 'sup-1',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  // Sonkor variants
  {
    id: 'var-4',
    product_id: 'prod-2',
    variant_name: 'Nooca A',
    barcode: '6002001',
    sku: 'SONKOR-A',
    buy_price: 18.00,
    purchase_unit: 'jawan',
    sell_price: 0.55,
    selling_unit: 'kg',
    conversion_factor: 50,
    stock_quantity: 40, // 40 kg -> Low Stock!
    minimum_stock: 50,
    supplier_id: 'sup-1',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-5',
    product_id: 'prod-2',
    variant_name: 'Sonkor Burco',
    barcode: '6002002',
    sku: 'SONKOR-BURCO',
    buy_price: 19.50,
    purchase_unit: 'jawan',
    sell_price: 0.60,
    selling_unit: 'kg',
    conversion_factor: 50,
    stock_quantity: 450,
    minimum_stock: 50,
    supplier_id: 'sup-1',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  // Bur variants
  {
    id: 'var-6',
    product_id: 'prod-3',
    variant_name: 'Bur Galley',
    barcode: '6003001',
    sku: 'BUR-GALLEY',
    buy_price: 16.00,
    purchase_unit: 'jawan',
    sell_price: 0.48,
    selling_unit: 'kg',
    conversion_factor: 50,
    stock_quantity: 200,
    minimum_stock: 30,
    supplier_id: 'sup-1',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-7',
    product_id: 'prod-3',
    variant_name: 'Bur Cad',
    barcode: '6003002',
    sku: 'BUR-CAD',
    buy_price: 17.50,
    purchase_unit: 'jawan',
    sell_price: 0.52,
    selling_unit: 'kg',
    conversion_factor: 50,
    stock_quantity: 0, // Out of stock!
    minimum_stock: 30,
    supplier_id: 'sup-1',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  // Baasto variants
  {
    id: 'var-8',
    product_id: 'prod-4',
    variant_name: 'Spaghetti A (500g)',
    barcode: '6004001',
    sku: 'BAASTO-SPAG-A',
    buy_price: 12.00, // $12 per carton of 24 pcs
    purchase_unit: 'kartoon',
    sell_price: 0.65, // $0.65 per packet
    selling_unit: 'pcs',
    conversion_factor: 24, // cost = $0.50, profit = $0.15
    stock_quantity: 120, // 120 packets
    minimum_stock: 24,
    supplier_id: 'sup-2',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-9',
    product_id: 'prod-4',
    variant_name: 'Macaroni B (500g)',
    barcode: '6004002',
    sku: 'BAASTO-MAC-B',
    buy_price: 11.50,
    purchase_unit: 'kartoon',
    sell_price: 0.60,
    selling_unit: 'pcs',
    conversion_factor: 24,
    stock_quantity: 72,
    minimum_stock: 24,
    supplier_id: 'sup-2',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  // Caano variants
  {
    id: 'var-10',
    product_id: 'prod-5',
    variant_name: '500ml Dhalo',
    barcode: '6005001',
    sku: 'CAANO-500ML',
    buy_price: 8.00,
    purchase_unit: 'kartoon',
    sell_price: 0.80,
    selling_unit: 'dhalo',
    conversion_factor: 12,
    stock_quantity: 48,
    minimum_stock: 12,
    supplier_id: 'sup-2',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-11',
    product_id: 'prod-5',
    variant_name: '1L Dhalo',
    barcode: '6005002',
    sku: 'CAANO-1L',
    buy_price: 14.00,
    purchase_unit: 'kartoon',
    sell_price: 1.40,
    selling_unit: 'dhalo',
    conversion_factor: 12,
    stock_quantity: 36,
    minimum_stock: 12,
    supplier_id: 'sup-2',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-12',
    product_id: 'prod-5',
    variant_name: 'Anchor 2.5kg Boore',
    barcode: '6005003',
    sku: 'CAANO-ANCHOR-2.5',
    buy_price: 130.00,
    purchase_unit: 'kartoon',
    sell_price: 24.00,
    selling_unit: 'xabo',
    conversion_factor: 6,
    stock_quantity: 18,
    minimum_stock: 6,
    supplier_id: 'sup-2',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  // Saliid variants
  {
    id: 'var-13',
    product_id: 'prod-6',
    variant_name: 'Saliid 5L Dhalo',
    barcode: '6006001',
    sku: 'SALIID-5L',
    buy_price: 36.00,
    purchase_unit: 'kartoon',
    sell_price: 7.20,
    selling_unit: 'dhalo',
    conversion_factor: 6,
    stock_quantity: 30,
    minimum_stock: 6,
    supplier_id: 'sup-2',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  },
  {
    id: 'var-14',
    product_id: 'prod-6',
    variant_name: 'Saliid 20L Jagg',
    barcode: '6006002',
    sku: 'SALIID-20L',
    buy_price: 24.00,
    purchase_unit: 'box',
    sell_price: 28.00,
    selling_unit: 'pcs',
    conversion_factor: 1,
    stock_quantity: 15,
    minimum_stock: 4,
    supplier_id: 'sup-2',
    is_active: true,
    is_pending: false,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
  }
];

// Helper to generate 3,000+ realistic Somali retail products & variants for stress-testing and pagination
export function generateScalableSeedCatalog(count: number = 3100): { products: Product[]; variants: ProductVariant[] } {
  const products: Product[] = [...INITIAL_PRODUCTS];
  const variants: ProductVariant[] = [...INITIAL_VARIANTS];

  const somaliPrefixes = [
    'Baris', 'Sonkor', 'Bur', 'Baasto', 'Saliid', 'Shaah', 'Bun', 'Caano', 'Saabuun', 
    'Biyo', 'Buskud', 'Shukulaato', 'Karooto', 'Baradho', 'Basal', 'Toon', 'Moos',
    'Tufaax', 'Liin', 'Canbe', 'Kalluun', 'Hilib', 'Nacnac', 'Juice', 'Shampoo',
    'Cadush', 'Mindi', 'Bakeeri', 'Weel', 'Kaluun Tuna', 'Sardines', 'Ketchup',
    'Mayonnaise', 'Qaxwo', 'Sanbuus Masaala', 'Filfil', 'Xawaash', 'Sinjibiil',
    'Kalluun Qasac', 'Omo Budada', 'Dettol', 'Bakeeri Galaas', 'Birooyin'
  ];

  const variantLabels = [
    'Xamse Premium', 'Nooca A', 'Nooca B', 'Dubai Import', 'Turkiya Special', 
    '500ml', '1L', '2L', '5L', '250g', '500g', '1kg', '5kg', '25kg', '50kg',
    'Red Label', 'Gold Selection', 'Original', 'Cagaar', 'Cad', 'Buroo', 'Bakeeri 6x'
  ];

  const catIds = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6'];
  const supIds = ['sup-1', 'sup-2', 'sup-3'];
  const units: Array<{ pUnit: string; sUnit: string; conv: number }> = [
    { pUnit: 'jawan', sUnit: 'kg', conv: 50 },
    { pUnit: 'kartoon', sUnit: 'pcs', conv: 24 },
    { pUnit: 'kartoon', sUnit: 'dhalo', conv: 12 },
    { pUnit: 'box', sUnit: 'xabo', conv: 50 },
    { pUnit: 'kiish', sUnit: 'kg', conv: 25 },
    { pUnit: 'piece', sUnit: 'pcs', conv: 1 },
  ];

  let currentProdIndex = products.length + 1;
  let currentVarIndex = variants.length + 1;

  while (variants.length < count) {
    const prefix = somaliPrefixes[Math.floor(Math.random() * somaliPrefixes.length)];
    const prodId = `prod-${currentProdIndex++}`;
    const catId = catIds[Math.floor(Math.random() * catIds.length)];
    const prodName = `${prefix} #${currentProdIndex}`;

    const prod: Product = {
      id: prodId,
      name: prodName,
      category_id: catId,
      description: `${prodName} tayo wanaagsan`,
      created_at: '2026-08-15',
      updated_at: '2026-08-15',
    };
    products.push(prod);

    // Each product has 1 to 4 variants
    const numVariants = Math.floor(Math.random() * 3) + 1;
    for (let v = 0; v < numVariants && variants.length < count; v++) {
      const vLabel = variantLabels[Math.floor(Math.random() * variantLabels.length)];
      const unitConfig = units[Math.floor(Math.random() * units.length)];
      const supId = supIds[Math.floor(Math.random() * supIds.length)];

      const buyPrice = Math.round((Math.random() * 40 + 5) * 100) / 100;
      const costPerBase = buyPrice / unitConfig.conv;
      const profitMargin = 1 + (Math.random() * 0.4 + 0.15); // 15% - 55% margin
      const sellPrice = Math.round(costPerBase * profitMargin * 100) / 100;

      const stockQty = Math.floor(Math.random() * 300);
      const minStock = Math.floor(Math.random() * 20) + 5;

      variants.push({
        id: `var-${currentVarIndex++}`,
        product_id: prodId,
        variant_name: vLabel,
        barcode: `700${String(currentVarIndex).padStart(6, '0')}`,
        sku: `SKU-${String(currentVarIndex).padStart(5, '0')}`,
        buy_price: buyPrice,
        purchase_unit: unitConfig.pUnit,
        sell_price: sellPrice,
        selling_unit: unitConfig.sUnit,
        conversion_factor: unitConfig.conv,
        stock_quantity: stockQty,
        minimum_stock: minStock,
        supplier_id: supId,
        is_active: true,
        is_pending: false,
        created_at: '2026-08-15',
        updated_at: '2026-08-15',
      });
    }
  }

  return { products, variants };
}

export const INITIAL_DEBTS: Debt[] = [
  {
    id: 'debt-1',
    customer_id: 'cust-1',
    items_summary: '1 Jawan Baris Xamse, 10 kg Sonkor',
    original_amount: 120.00,
    amount_paid: 40.00,
    remaining_balance: 80.00,
    due_date: '2026-09-10', // Due Today
    status: 'partial',
    call_logs: [
      { id: 'cl-1', date: '2026-09-08', note: 'Waan wacay, wuxuu yiri bari ayaan keenayaa $40', caller_name: 'Cashier' }
    ],
    notes: 'Bixinta qeybta labaad',
    created_at: '2026-08-25',
    updated_at: '2026-09-08',
  },
  {
    id: 'debt-2',
    customer_id: 'cust-3',
    items_summary: '2 Kartoon Baasto Spaghetti, 1 Saliid 20L',
    original_amount: 150.00,
    amount_paid: 30.00,
    remaining_balance: 120.00,
    due_date: '2026-09-05', // Overdue!
    status: 'overdue',
    call_logs: [
      { id: 'cl-2', date: '2026-09-06', note: 'Telefanka ma qaban, SMS baa loo diray', caller_name: 'Manager' }
    ],
    notes: 'Maqaayadda Yaqshid',
    created_at: '2026-08-20',
    updated_at: '2026-09-06',
  },
  {
    id: 'debt-3',
    customer_id: 'cust-4',
    items_summary: '10 dhalo Caano 1L, 5 kg Sonkor',
    original_amount: 50.00,
    amount_paid: 50.00,
    remaining_balance: 0.00,
    due_date: '2026-09-09',
    status: 'paid',
    notes: 'Waa la wada bixiyey',
    created_at: '2026-08-28',
    updated_at: '2026-09-09',
  },
  {
    id: 'debt-4',
    customer_id: 'cust-1',
    items_summary: '5 Dhalo Saliid 5L',
    original_amount: 36.00,
    amount_paid: 0.00,
    remaining_balance: 36.00,
    due_date: '2026-09-15', // Upcoming
    status: 'unpaid',
    notes: 'Dayn cusub',
    created_at: '2026-09-08',
    updated_at: '2026-09-08',
  }
];

export const INITIAL_DEBT_PAYMENTS: DebtPayment[] = [
  {
    id: 'dp-1',
    customer_id: 'cust-1',
    debt_id: 'debt-1',
    amount: 40.00,
    payment_method: 'evc_plus',
    notes: 'Qeyb ka mid ah daynta Bariska',
    created_at: '2026-09-08T10:30:00Z',
  },
  {
    id: 'dp-2',
    customer_id: 'cust-4',
    debt_id: 'debt-3',
    amount: 50.00,
    payment_method: 'cash',
    notes: 'Dhameystir buuxa',
    created_at: '2026-09-09T14:15:00Z',
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'exp-1', category: 'koronto', amount: 45.00, description: 'Biilka korontada dukaanka (Enco)', date: '2026-09-05', created_at: '2026-09-05' },
  { id: 'exp-2', category: 'biyo', amount: 15.00, description: 'Biyaha dukaanka', date: '2026-09-04', created_at: '2026-09-04' },
  { id: 'exp-3', category: 'gaadiid', amount: 20.00, description: 'Gaadiidka soo qaaday raashinka Bakaaro', date: '2026-09-08', created_at: '2026-09-08' },
  { id: 'exp-4', category: 'mushahar', amount: 120.00, description: 'Mushaharka caawiyaha dukaanka', date: '2026-09-01', created_at: '2026-09-01' },
  { id: 'exp-5', category: 'dayactir', amount: 25.00, description: 'Dayactirka armaajada qaboojiyaha', date: '2026-09-07', created_at: '2026-09-07' },
];

export const INITIAL_SUPPLIER_TRANSACTIONS: SupplierTransaction[] = [
  {
    id: 'tx-1',
    supplier_id: 'sup-1',
    reference_number: 'INV-88291',
    total_amount: 1450.00,
    status: 'completed',
    transaction_date: '2026-09-08',
    notes: 'Soo galka Bariska Xamse iyo Sonkorta',
    created_at: '2026-09-08T09:00:00Z',
    items: [
      {
        id: 'txi-1',
        transaction_id: 'tx-1',
        product_variant_id: 'var-1',
        product_name: 'Baris (Rice)',
        variant_name: 'Xamse',
        quantity: 50,
        purchase_unit: 'jawan',
        buy_price: 20.00,
        conversion_factor: 50,
        total_cost: 1000.00,
        created_at: '2026-09-08T09:00:00Z',
      },
      {
        id: 'txi-2',
        transaction_id: 'tx-1',
        product_variant_id: 'var-4',
        product_name: 'Sonkor (Sugar)',
        variant_name: 'Nooca A',
        quantity: 25,
        purchase_unit: 'jawan',
        buy_price: 18.00,
        conversion_factor: 50,
        total_cost: 450.00,
        created_at: '2026-09-08T09:00:00Z',
      }
    ]
  }
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-1',
    customer_id: 'cust-1',
    subtotal: 32.50,
    discount: 0.00,
    total_amount: 32.50,
    amount_paid: 32.50,
    debt_amount: 0.00,
    cost_amount: 20.00,
    gross_profit: 12.50,
    payment_method: 'cash',
    notes: 'Iib caddaan ah',
    created_at: '2026-09-10T08:15:00Z',
  }
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'sm-1',
    product_variant_id: 'var-1',
    type: 'purchase',
    quantity: 500, // +500 kg
    previous_quantity: 0,
    new_quantity: 500,
    unit: 'kg',
    reference_id: 'tx-1',
    reference_type: 'supplier_transaction',
    notes: 'Soo gashay Shirkadda Xamse Ganacsi',
    created_at: '2026-09-08T09:00:00Z',
  },
  {
    id: 'sm-2',
    product_variant_id: 'var-1',
    type: 'sale',
    quantity: -20, // -20 kg
    previous_quantity: 500,
    new_quantity: 480,
    unit: 'kg',
    reference_id: 'sale-1',
    reference_type: 'sale',
    notes: 'Iib POS',
    created_at: '2026-09-09T11:00:00Z',
  },
  {
    id: 'sm-3',
    product_variant_id: 'var-1',
    type: 'sale',
    quantity: -10, // -10 kg
    previous_quantity: 480,
    new_quantity: 470,
    unit: 'kg',
    reference_id: 'sale-1',
    reference_type: 'sale',
    notes: 'Iib POS',
    created_at: '2026-09-09T16:00:00Z',
  },
  {
    id: 'sm-4',
    product_variant_id: 'var-1',
    type: 'adjustment',
    quantity: 30, // +30 kg adjustment
    previous_quantity: 470,
    new_quantity: 500,
    unit: 'kg',
    notes: 'Xisaab-xir & dib-u-habeyn kaydka',
    created_at: '2026-09-10T07:00:00Z',
  }
];
