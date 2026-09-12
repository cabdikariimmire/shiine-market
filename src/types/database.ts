export type UnitType = 
  | 'kg' 
  | 'gram' 
  | 'liter' 
  | 'ml' 
  | 'piece' 
  | 'pcs' 
  | 'carton' 
  | 'kartoon' 
  | 'jawan' 
  | 'kiish' 
  | 'bag' 
  | 'box' 
  | 'meter' 
  | 'bottle' 
  | 'dhalo' 
  | 'packet' 
  | 'xabo';

export type PaymentMethod = 'cash' | 'credit' | 'partial';

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
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  shop_id: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'manager';
  phone?: string;
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
  shop_id?: string;
  product_id: string;
  variant_name: string;
  sku?: string;
  barcode?: string;
  buy_price: number; // Price per purchase unit (e.g. $20/jawan)
  purchase_unit: string; // e.g. 'jawan', 'carton', 'box'
  sell_price: number; // Price per base selling unit (e.g. $0.65/kg)
  selling_unit: string; // e.g. 'kg', 'pcs', 'liter'
  conversion_factor: number; // e.g. 50 kg per 1 jawan
  unit_division?: number; // e.g. 4 (1 kg divided into 4 parts = 0.25 kg)
  min_sellable_qty?: number; // e.g. 0.25 (1 / unit_division)
  stock_quantity: number; // Stored in base selling units (e.g. 500 kg)
  minimum_stock: number; // In base selling units (e.g. 50 kg)
  supplier_id?: string;
  image_url?: string;
  is_active: boolean;
  is_pending?: boolean; // For pending product rows awaiting user edit & save
  created_at: string;
  updated_at: string;
  // Joins / Computed
  product?: Product;
  supplier?: Supplier;
  category?: Category;
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
  quantity: number; // In base selling units (supports decimals e.g. 1.25 kg)
  unit: string; // e.g. 'kg'
  unit_price: number; // selling price per base unit
  unit_cost: number; // cost per base unit (buy_price / conversion_factor)
  discount: number;
  total_price: number;
  gross_profit: number;
  product_variant?: ProductVariant;
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

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
