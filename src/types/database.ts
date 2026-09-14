export type UnitType = 
  | 'kg' 
  | 'gram' 
  | 'g'
  | 'liter' 
  | 'l'
  | 'ml' 
  | 'piece' 
  | 'pcs' 
  | 'carton' 
  | 'kartoon' 
  | 'jawan' 
  | 'kiish' 
  | 'bag' 
  | 'bac'
  | 'box' 
  | 'meter' 
  | 'bottle' 
  | 'dhalo' 
  | 'packet' 
  | 'caag'
  | 'xabo';

export type PaymentMethod = 'cash' | 'credit' | 'partial';

export type ManagementMode = 'standard' | 'pack_based' | 'amount_based';

export interface AmountSellingOption {
  id: string;
  label: string; // e.g. '4,000 SOS', '5,000 SOS', 'Rubac weyn $0.50'
  type?: 'sos' | 'usd' | string;
  currency?: '$' | 'SOS' | 'usd' | 'sos' | string;
  amount: number; // e.g. 4000, 5000, 0.50, 0.45
  pricing_mode?: 'fixed' | 'denomination' | string;
  default_qty?: number; // optional default/suggested liters
  default_liters?: number;
}

export interface ProductBatch {
  id: string;
  shop_id?: string;
  product_variant_id: string;
  batch_number: string;
  supplier_id?: string | null;
  received_date?: string;
  containers_count?: number; // e.g. 4 Caag
  container_count?: number;
  capacity_per_container?: number; // e.g. 20 L
  liters_per_container?: number;
  total_initial_quantity?: number; // e.g. 80 L
  total_liters?: number;
  quantity_sold?: number; // e.g. 75.5 L
  remaining_quantity: number; // e.g. 4.5 L
  total_purchase_cost: number; // e.g. $32.00
  cost_currency: string; // '$'
  cost_per_unit?: number; // $0.40 / L
  cost_per_liter?: number;
  total_revenue?: number; // sales revenue
  physical_remaining_quantity?: number; // physical reconciliation count
  actual_remaining_liters?: number;
  variance_quantity?: number; // physical - remaining
  variance_liters?: number;
  reconciled_at?: string;
  reconciled_by?: string;
  status: 'active' | 'reconciled' | 'closed' | 'finished';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  supplier?: Supplier;
  product_variant?: ProductVariant;
}

export type StockMovementType = 
  | 'purchase' 
  | 'sale' 
  | 'sale_return' 
  | 'purchase_return' 
  | 'adjustment';

export type DebtStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export type ExpenseCategory = 
  | 'electricity' 
  | 'water' 
  | 'transport' 
  | 'rent' 
  | 'salary' 
  | 'maintenance' 
  | 'internet_phone' 
  | 'other'
  | 'koronto'
  | 'biyo'
  | 'gaadiid'
  | 'kiro'
  | 'mushahar'
  | 'dayactir'
  | 'internet_tel'
  | 'kale';

export interface Shop {
  id: string;
  name: string;
  currency: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  signature_url?: string;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  shop_id?: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'reporter' | 'seller' | 'cashier' | 'manager';
  phone?: string;
  signature_url?: string;
  created_at: string;
}

export interface Category {
  id: string;
  shop_id?: string;
  name: string;
  description?: string;
  icon?: string;
  created_at: string;
  _count?: {
    products: number;
    variants: number;
  };
}

export interface Supplier {
  id: string;
  shop_id?: string;
  name: string;
  phone: string;
  company?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_purchases?: number;
  total_spend?: number;
  last_purchase_date?: string;
}

export interface Customer {
  id: string;
  shop_id?: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_debt?: number;
  paid_debt?: number;
  remaining_debt?: number;
}

export interface Product {
  id: string;
  shop_id?: string;
  name: string;
  category_id?: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  // Joins
  category?: Category;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  shop_id?: string | null;
  product_id: string;
  variant_name: string;
  sku?: string | null;
  barcode?: string | null;
  buy_price: number; // Price per purchase unit (e.g. $20/jawan)
  purchase_unit: string; // e.g. 'jawan', 'carton', 'box', 'caag'
  sell_price: number; // Price per base selling unit (e.g. $0.65/kg, $1.20/liter)
  selling_unit: string; // e.g. 'kg', 'pcs', 'liter', 'bac'
  conversion_factor: number; // e.g. 50 kg per 1 jawan, 20 L per 1 caag
  unit_division?: number; // e.g. 4 (1 kg divided into 4 parts = 0.25 kg)
  min_sellable_qty?: number; // e.g. 0.25 (1 / unit_division)
  pricing_mode?: 'fixed' | 'denomination'; // 'fixed' (standard USD) or 'denomination' (shop SOS denomination rules)
  sos_price?: number | null; // Configured price in SOS for denomination-based products (e.g. 5000 SOS)
  management_mode?: ManagementMode; // 'standard' | 'pack_based' | 'amount_based'
  source_quantity?: number | null; // e.g. 500
  source_unit?: string | null; // e.g. 'g' or 'kg'
  pack_source_quantity?: number | null; // e.g. 500
  pack_source_unit?: string | null; // e.g. 'g' or 'kg'
  pack_count?: number | null; // e.g. 10
  pack_qty_per_pack?: number | null; // e.g. 50 (500g / 10 = 50g per bac)
  selling_pack_unit?: string | null; // e.g. 'bac'
  container_unit?: string | null; // e.g. 'caag'
  container_capacity?: number | null; // e.g. 20 (liters per caag)
  container_capacity_liters?: number | null; // e.g. 20
  initial_containers?: number | null; // e.g. 4 (initial containers count)
  selling_options?: AmountSellingOption[] | null; // money options for amount_based items
  stock_quantity: number; // Stored in base selling units (e.g. 500 kg, 80 L, 10 Bac)
  minimum_stock: number; // In base selling units
  supplier_id?: string | null;
  image_url?: string | null;
  is_active: boolean;
  is_pending?: boolean; // For pending product rows awaiting user edit & save
  created_at: string;
  updated_at: string;
  // Joins / Computed
  product?: Product;
  supplier?: Supplier;
  category?: Category;
  batches?: ProductBatch[];
}

export interface SupplierTransactionItem {
  id: string;
  transaction_id: string;
  product_variant_id?: string;
  product_name: string;
  variant_name: string;
  quantity: number; // in purchase units
  purchase_unit: string;
  buy_price: number; // per purchase unit
  conversion_factor: number;
  total_cost: number;
  is_pending?: boolean;
  created_at: string;
  product_variant?: ProductVariant;
}

export interface SupplierTransaction {
  id: string;
  shop_id?: string;
  supplier_id?: string;
  reference_number?: string;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  transaction_date: string;
  created_at: string;
  supplier?: Supplier;
  items?: SupplierTransactionItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_variant_id: string;
  quantity: number; // In base selling units (supports decimals e.g. 1.25 L, 1.25 kg)
  unit: string; // e.g. 'kg', 'liter', 'bac'
  unit_price: number; // selling price per base unit
  unit_cost: number; // cost per base unit (buy_price / conversion_factor)
  pricing_mode?: 'fixed' | 'denomination';
  sos_price?: number;
  sos_total?: number;
  actual_quantity_used?: number; // exact liters used for amount_based sales
  batch_id?: string; // attributed batch for costing
  selling_method?: 'liter' | 'money' | string; // 'liter' | 'money'
  selling_option_label?: string; // e.g. '5,000 SOS' or 'Rubac weyn $0.50'
  amount_based_currency?: 'SOS' | 'USD';
  amount_based_value?: number;
  discount: number;
  total_price: number;
  gross_profit: number;
  product_variant?: ProductVariant;
  product_batch?: ProductBatch;
}

export interface Sale {
  id: string;
  shop_id?: string;
  customer_id?: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  debt_amount: number;
  cost_amount: number;
  gross_profit: number;
  payment_method: PaymentMethod;
  notes?: string;
  created_at: string;
  customer?: Customer;
  items?: SaleItem[];
}

export interface StockMovement {
  id: string;
  shop_id?: string;
  product_variant_id: string;
  type: StockMovementType;
  quantity: number; // Positive for incoming, negative for outgoing
  previous_quantity: number;
  new_quantity: number;
  unit: string;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  created_at: string;
  product_variant?: ProductVariant;
}

export interface CallLog {
  id: string;
  date: string;
  note: string;
  caller_name?: string;
}

export interface Debt {
  id: string;
  shop_id?: string;
  customer_id: string;
  sale_id?: string;
  items_summary?: string;
  original_amount: number;
  amount_paid: number;
  remaining_balance: number;
  due_date?: string;
  status: DebtStatus;
  call_logs?: CallLog[];
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  sale?: Sale;
}

export interface DebtPayment {
  id: string;
  shop_id?: string;
  customer_id: string;
  debt_id?: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  customer?: Customer;
  debt?: Debt;
}

export interface Expense {
  id: string;
  shop_id?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  shop_id?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  previous_values?: Record<string, any>;
  new_values?: Record<string, any>;
  reason?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface SaleCorrectionPayload {
  customerId?: string;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  overallDiscount?: number;
  createdAt?: string;
  notes?: string;
  items?: Array<{
    id?: string;
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
}

export interface SupplierTransactionCorrectionPayload {
  supplierId?: string;
  referenceNumber?: string;
  transactionDate?: string;
  notes?: string;
  items?: Array<{
    id?: string;
    productVariantId?: string;
    productName?: string;
    variantName?: string;
    quantity: number;
    purchaseUnit: string;
    buyPrice: number;
    conversionFactor: number;
  }>;
}

export interface DebtCorrectionPayload {
  customerId?: string;
  itemsSummary?: string;
  originalAmount?: number;
  dueDate?: string;
  createdAt?: string;
  notes?: string;
}

export interface DebtPaymentCorrectionPayload {
  customerId?: string;
  debtId?: string;
  amount?: number;
  paymentMethod?: string;
  createdAt?: string;
  notes?: string;
}

export interface StockAdjustmentPayload {
  variantId: string;
  quantityChange: number;
  reason: string;
}

export interface SentEmailAlert {
  id: string;
  shop_id?: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'debt_reminder' | 'test';
  recipient_email: string;
  entity_id?: string;
  subject: string;
  status: 'sent' | 'failed';
  details?: Record<string, any>;
  created_at: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
