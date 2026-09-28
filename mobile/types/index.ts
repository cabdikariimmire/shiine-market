export type UserRole = 'admin' | 'reporter' | 'seller';
export type UserStatus = 'active' | 'inactive';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  shop_id?: string | null;
  last_login?: string;
}

export interface AuthSession {
  user: SystemUser;
  token: string;
  expires_at: number;
}

export interface Profile {
  id: string;
  shop_id?: string | null;
  full_name: string;
  email?: string;
  role: 'admin' | 'reporter' | 'seller' | 'cashier' | 'manager';
  phone?: string;
  signature_url?: string;
  created_at: string;
}

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

export interface Category {
  id: string;
  shop_id?: string;
  name: string;
  description?: string;
  icon?: string;
  created_at: string;
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
  category?: Category;
  variants?: ProductVariant[];
}

export type ManagementMode = 'standard' | 'pack_based' | 'amount_based';

export interface AmountSellingOption {
  id: string;
  label: string;
  type?: 'sos' | 'usd' | string;
  currency?: '$' | 'SOS' | 'usd' | 'sos' | string;
  amount: number;
  pricing_mode?: 'fixed' | 'denomination' | string;
  default_qty?: number;
  default_liters?: number;
}

export interface ProductBatch {
  id: string;
  shop_id?: string;
  product_variant_id: string;
  batch_number: string;
  supplier_id?: string | null;
  received_date?: string;
  containers_count?: number;
  capacity_per_container?: number;
  total_initial_quantity?: number;
  quantity_sold?: number;
  remaining_quantity: number;
  total_purchase_cost: number;
  cost_currency: string;
  cost_per_unit?: number;
  cost_per_liter?: number;
  status: 'active' | 'reconciled' | 'closed' | 'finished';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  shop_id?: string | null;
  product_id: string;
  variant_name: string;
  sku?: string | null;
  barcode?: string | null;
  buy_price: number;
  purchase_unit: string;
  sell_price: number;
  selling_unit: string;
  conversion_factor: number;
  unit_division?: number;
  min_sellable_qty?: number;
  pricing_mode?: 'fixed' | 'denomination';
  sos_price?: number | null;
  management_mode?: ManagementMode;
  pack_source_quantity?: number | null;
  pack_source_unit?: string | null;
  pack_count?: number | null;
  pack_qty_per_pack?: number | null;
  selling_pack_unit?: string | null;
  container_unit?: string | null;
  container_capacity?: number | null;
  selling_options?: AmountSellingOption[] | null;
  stock_quantity: number;
  minimum_stock: number;
  supplier_id?: string | null;
  image_url?: string | null;
  is_active: boolean;
  is_pending?: boolean;
  created_at: string;
  updated_at: string;
  product?: Product;
  batches?: ProductBatch[];
}

export type PaymentMethod = 'cash' | 'credit' | 'partial';

export interface SaleItem {
  id: string;
  sale_id: string;
  product_variant_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  unit_cost: number;
  pricing_mode?: 'fixed' | 'denomination';
  sos_price?: number;
  sos_total?: number;
  actual_quantity_used?: number;
  batch_id?: string;
  selling_method?: 'liter' | 'money' | string;
  selling_option_label?: string;
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

export type DebtStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

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
}

export interface Expense {
  id: string;
  shop_id?: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface CartItem {
  id: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  totalPrice: number;
  pricing_mode?: 'fixed' | 'denomination';
  sosPrice?: number | null;
  actual_quantity_used?: number;
  selling_method?: 'liter' | 'money' | 'measure';
  selling_option_label?: string;
  amount_based_currency?: 'SOS' | 'USD';
  amount_based_value?: number;
  customer_payment?: number;
  change_amount?: number;
  batch_id?: string;
}
